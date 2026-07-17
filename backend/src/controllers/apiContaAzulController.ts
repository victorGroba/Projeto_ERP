import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { getAPI } from '../services/contaAzulSyncService';

const prisma = new PrismaClient();

// Página máxima de "vendas" buscada ao vivo por request — a tela é on-demand
// (sem sync/cache), então limitamos a paginação pra não segurar a resposta HTTP
// por muito tempo num período com muitos registros.
const MAX_PAGINAS_VENDAS = 10;

/**
 * Indicadores que dá pra montar diretamente com a API v2 do Conta Azul, sem
 * precisar da quebra por conta bancária/rateio (que só existe por parcela
 * individual — ver memória "regra_despesas_reais"). Cada seção é buscada com
 * try/catch isolado: se um endpoint falhar ou tiver campo inesperado, as
 * demais seções continuam aparecendo em vez de derrubar a página inteira.
 */
export const getIndicadoresApi = async (req: Request, res: Response): Promise<void> => {
    const hoje = new Date();
    const de = (req.query.de as string) || `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-01`;
    const ate = (req.query.ate as string) || hoje.toISOString().split('T')[0];

    const [vendas, notasFiscais, cadastros, despesasTendencia, inadimplencia] = await Promise.all([
        buscarVendas(de, ate),
        buscarNotasFiscais(),
        buscarCadastros(),
        buscarDespesasTendencia(de, ate),
        buscarInadimplencia(),
    ]);

    res.json({
        success: true,
        periodo: { de, ate },
        vendas,
        notasFiscais,
        cadastros,
        despesasTendencia,
        inadimplencia,
    });
};

async function buscarVendas(de: string, ate: string) {
    try {
        const api = await getAPI();
        let total = 0;
        let quantidade = 0;
        let pagina = 1;
        let totalPaginas = 1;
        do {
            const data = await api.getVendas({ dataInicio: de, dataFim: ate, pagina, tamanhoPagina: 200 });
            const itens = data?.itens || [];
            itens.forEach((v: any) => {
                total += Math.abs(v.valor_total ?? v.total ?? v.valor ?? 0);
            });
            quantidade += itens.length;
            const totalRegistros = data?.itens_totais ?? itens.length;
            totalPaginas = Math.min(Math.ceil(totalRegistros / 200) || 1, MAX_PAGINAS_VENDAS);
            pagina++;
        } while (pagina <= totalPaginas);

        return {
            disponivel: true,
            total: Math.round(total * 100) / 100,
            quantidade,
            ticketMedio: quantidade > 0 ? Math.round((total / quantidade) * 100) / 100 : 0,
            truncado: totalPaginas >= MAX_PAGINAS_VENDAS,
        };
    } catch (error: any) {
        console.error('[ApiIndicadores] Erro ao buscar vendas:', error.message);
        return { disponivel: false, erro: 'Não foi possível buscar vendas na API' };
    }
}

async function buscarNotasFiscais() {
    try {
        const api = await getAPI();
        const data = await api.getNotasFiscais({ pagina: 1, tamanhoPagina: 1 });
        return {
            disponivel: true,
            total: data?.itens_totais ?? 0,
            obs: 'A API não filtra notas fiscais por período nesta versão — total geral do cadastro.',
        };
    } catch (error: any) {
        console.error('[ApiIndicadores] Erro ao buscar notas fiscais:', error.message);
        return { disponivel: false, erro: 'Não foi possível buscar notas fiscais na API' };
    }
}

async function buscarCadastros() {
    try {
        const api = await getAPI();
        const [categorias, centros, contas, pessoas] = await Promise.all([
            api.getCategorias(1, 1),
            api.getCentrosDeCusto(1, 1),
            api.getContasFinanceiras(),
            api.getPessoas({ pagina: 1, tamanhoPagina: 1 }),
        ]);

        const listaContas = Array.isArray(contas) ? contas : (contas?.itens || []);
        const saldoTotal = listaContas.reduce((acc: number, c: any) => acc + (c.saldo ?? 0), 0);

        return {
            disponivel: true,
            categorias: categorias?.itens_totais ?? 0,
            centrosDeCusto: centros?.itens_totais ?? 0,
            pessoas: pessoas?.itens_totais ?? 0,
            contasFinanceiras: listaContas.map((c: any) => ({ nome: c.nome || c.descricao || 'Conta', saldo: c.saldo ?? null })),
            saldoTotalContas: Math.round(saldoTotal * 100) / 100,
        };
    } catch (error: any) {
        console.error('[ApiIndicadores] Erro ao buscar cadastros:', error.message);
        return { disponivel: false, erro: 'Não foi possível buscar cadastros na API' };
    }
}

// Despesas por categoria/CC — tendência, já sincronizada no banco (Lancamento).
// Não tem quebra confiável por conta bancária (ver memória "regra_despesas_reais").
async function buscarDespesasTendencia(de: string, ate: string) {
    try {
        const dataInicio = new Date(`${de}T00:00:00`);
        const dataFim = new Date(`${ate}T23:59:59`);

        const despesas = await prisma.lancamento.findMany({
            where: { tipo: 'DESPESA', dataPagamento: { gte: dataInicio, lte: dataFim } },
            select: { categoria: true, centroDeCusto: true, valor: true },
        });

        const porCategoria: Record<string, number> = {};
        const porCC: Record<string, number> = {};
        despesas.forEach(d => {
            const cat = d.categoria || 'Sem Categoria';
            const cc = d.centroDeCusto || 'Geral';
            porCategoria[cat] = (porCategoria[cat] || 0) + d.valor;
            porCC[cc] = (porCC[cc] || 0) + d.valor;
        });

        const toSortedArray = (obj: Record<string, number>, key: string) =>
            Object.entries(obj)
                .map(([nome, total]) => ({ [key]: nome, total: Math.round(total * 100) / 100 }))
                .sort((a, b) => b.total - a.total);

        return {
            disponivel: true,
            total: Math.round(despesas.reduce((a, d) => a + d.valor, 0) * 100) / 100,
            porCategoria: toSortedArray(porCategoria, 'categoria'),
            porCentroDeCusto: toSortedArray(porCC, 'centroDeCusto'),
        };
    } catch (error: any) {
        console.error('[ApiIndicadores] Erro ao agregar despesas:', error.message);
        return { disponivel: false, erro: 'Não foi possível agregar despesas do banco' };
    }
}

async function buscarInadimplencia() {
    try {
        const hoje = new Date();
        const [emAberto, vencido] = await Promise.all([
            prisma.contaReceber.aggregate({
                where: { status: { in: ['A Vencer', 'Vencido'] } },
                _sum: { valor: true },
                _count: true,
            }),
            prisma.contaReceber.aggregate({
                where: { status: 'Vencido', dataVencimento: { lt: hoje } },
                _sum: { valor: true },
                _count: true,
            }),
        ]);

        return {
            disponivel: true,
            totalEmAberto: Math.round((emAberto._sum.valor || 0) * 100) / 100,
            qtdEmAberto: emAberto._count,
            totalVencido: Math.round((vencido._sum.valor || 0) * 100) / 100,
            qtdVencido: vencido._count,
        };
    } catch (error: any) {
        console.error('[ApiIndicadores] Erro ao agregar inadimplência:', error.message);
        return { disponivel: false, erro: 'Não foi possível agregar inadimplência do banco' };
    }
}
