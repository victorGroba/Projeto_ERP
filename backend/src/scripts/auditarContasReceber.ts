import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { STATUS_RECEITA, STATUS_PENDENTES } from '../utils/statusReceita';

const prisma = new PrismaClient();

const VOCABULARIO: string[] = [STATUS_RECEITA.PAGO, STATUS_RECEITA.VENCIDO, STATUS_RECEITA.A_VENCER];
const APLICAR = process.argv.includes('--apply');

const brl = (v: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

/**
 * Audita o ContaReceber em busca das duas patologias que inflavam a inadimplencia:
 *
 *  1. Cargas de CSV em que o parser nao reconheceu as colunas: as linhas ficaram com
 *     dataVencimento igual ao `new Date()` do momento da importacao e status 'VENCIDO'
 *     de default. Assinatura: todo vencimento cai a segundos do createdAt da importacao.
 *  2. Status fora do vocabulario canonico ('Pago' | 'Vencido' | 'A Vencer'), que a
 *     antiga lista negra (`notIn`) contava como divida.
 *
 * Roda em modo relatorio por padrao. Use `--apply` para executar as correcoes.
 */
async function main() {
    console.log(APLICAR
        ? '=== AUDITORIA DE CONTAS A RECEBER (APLICANDO CORRECOES) ===\n'
        : '=== AUDITORIA DE CONTAS A RECEBER (relatorio — use --apply para corrigir) ===\n');

    // ── 1. Cargas com vencimento carimbado pela data da importacao ──────────
    const importacoes = await prisma.historicoImportacao.findMany({
        where: { tipo: 'RECEITAS' },
        orderBy: { createdAt: 'desc' },
    });

    const suspeitas: { id: string; arquivo: string; linhas: number; total: number; motivo: string }[] = [];

    for (const imp of importacoes) {
        const linhas = await prisma.contaReceber.findMany({ where: { importacaoId: imp.id } });
        if (linhas.length < 2) continue;

        const total = linhas.reduce((s, l) => s + l.valor, 0);
        // O `new Date()` era avaliado por linha, entao os milissegundos variam um pouco.
        const carimbada = linhas.every(
            l => Math.abs(l.dataVencimento.getTime() - imp.createdAt.getTime()) < 60_000
        );
        const clienteUnico = new Set(linhas.map(l => l.cliente)).size === 1 && linhas.length > 10;

        if (carimbada) {
            suspeitas.push({
                id: imp.id,
                arquivo: imp.arquivoNome || '?',
                linhas: linhas.length,
                total,
                motivo: `vencimento igual ao horario da importacao nas ${linhas.length} linhas`
                    + (clienteUnico ? ' e cliente unico (colunas nao reconhecidas)' : ''),
            });
        }
    }

    if (suspeitas.length === 0) {
        console.log('1) Nenhuma carga de RECEITAS com vencimento carimbado. OK\n');
    } else {
        console.log('1) Cargas invalidas encontradas:');
        for (const s of suspeitas) {
            console.log(`   - ${s.arquivo} (${s.id})`);
            console.log(`     ${s.linhas} linhas · ${brl(s.total)} · ${s.motivo}`);
        }
        if (APLICAR) {
            for (const s of suspeitas) {
                const { count } = await prisma.contaReceber.deleteMany({ where: { importacaoId: s.id } });
                await prisma.historicoImportacao.delete({ where: { id: s.id } });
                console.log(`     -> removidas ${count} linhas e o historico de ${s.arquivo}`);
            }
        }
        console.log('');
    }

    // ── 2. Status fora do vocabulario canonico ──────────────────────────────
    const foraDoVocabulario = await prisma.contaReceber.groupBy({
        by: ['status'],
        where: { status: { notIn: VOCABULARIO } },
        _count: { _all: true },
        _sum: { valor: true },
    });

    if (foraDoVocabulario.length === 0) {
        console.log('2) Todos os status estao no vocabulario canonico. OK\n');
    } else {
        console.log('2) Status fora do vocabulario canonico:');
        for (const g of foraDoVocabulario) {
            console.log(`   - "${g.status}": ${g._count._all} linhas · ${brl(g._sum.valor || 0)}`);
        }
        if (APLICAR) {
            const agora = new Date();
            for (const g of foraDoVocabulario) {
                const s = g.status.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toUpperCase();
                if (['RECEBIDO', 'PAGO', 'PAID', 'BAIXADO', 'LIQUIDADO', 'QUITADO'].includes(s)) {
                    const { count } = await prisma.contaReceber.updateMany({
                        where: { status: g.status }, data: { status: STATUS_RECEITA.PAGO },
                    });
                    console.log(`     -> "${g.status}" => Pago (${count})`);
                } else if (s.includes('VENC') || s.includes('ABERTO') || s.includes('PENDENTE') || s.includes('ATRAS')) {
                    const vencidos = await prisma.contaReceber.updateMany({
                        where: { status: g.status, dataVencimento: { lt: agora } },
                        data: { status: STATUS_RECEITA.VENCIDO },
                    });
                    const aVencer = await prisma.contaReceber.updateMany({
                        where: { status: g.status, dataVencimento: { gte: agora } },
                        data: { status: STATUS_RECEITA.A_VENCER },
                    });
                    console.log(`     -> "${g.status}" => Vencido (${vencidos.count}) / A Vencer (${aVencer.count})`);
                } else {
                    console.log(`     -> "${g.status}": nao reconhecido, mantido. Fora da lista branca, nao entra na inadimplencia.`);
                }
            }
        }
        console.log('');
    }

    // ── 3. Resultado ────────────────────────────────────────────────────────
    const idsSuspeitos = suspeitas.map(s => s.id);
    const pendentes = await prisma.contaReceber.findMany({
        where: {
            status: { in: STATUS_PENDENTES },
            // Sem --apply, projeta o numero como ficaria depois das correcoes.
            // O OR e necessario: `notIn` sozinho descartaria tambem as linhas com
            // importacaoId nulo (as que vieram do sync da API), por causa da
            // semantica de NOT IN com NULL em SQL.
            ...(idsSuspeitos.length > 0 && !APLICAR
                ? { OR: [{ importacaoId: null }, { importacaoId: { notIn: idsSuspeitos } }] }
                : {}),
        },
    });

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const atraso = pendentes
        .filter(c => new Date(c.dataVencimento) < hoje)
        .reduce((s, c) => s + c.valor, 0);

    console.log(APLICAR
        ? '3) Situacao apos a auditoria:'
        : '3) Situacao projetada (ja desconsiderando o que foi apontado acima):');
    console.log(`   Titulos em aberto: ${pendentes.length}`);
    console.log(`   Total vencido em atraso: ${brl(atraso)}`);
}

main()
    .catch(e => { console.error(e); process.exit(1); })
    .finally(() => prisma.$disconnect());
