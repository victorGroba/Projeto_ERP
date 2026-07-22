import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Índices gerenciais — consolida num único payload os indicadores que a
 * diretoria acompanha: composição, concentração, difusão, ofensores da
 * variação, custo de pessoal, dependência de fornecedores e fôlego de caixa.
 *
 * Convenção de períodos (a mesma do comparativo por CC): A = período de
 * comparação (anterior), B = período atual.
 *
 * Regime: despesas por dataPagamento (caixa, como o resto do sistema) e
 * receitas por dataCompetencia com fallback para dataVencimento. Sem esse
 * alinhamento os índices que cruzam receita e despesa ficariam distorcidos.
 */

const r = (v: number) => Math.round(v * 100) / 100;
const pct = (parte: number, todo: number) => (todo > 0 ? r((parte / todo) * 100) : 0);
const varPct = (a: number, b: number) => (a > 0 ? r(((b - a) / a) * 100) : null);

const DIAS_NO_MES = 30.4375;

/** Categorias que compõem o custo de pessoal. Exposto na resposta para auditoria. */
const REGRAS_PESSOAL: RegExp[] = [
    /sal[áa]rio/i,
    /pr[óo]\s*-?\s*labore/i,
    /13[º°o]?\s*sal/i,
    /f[ée]rias/i,
    /rescis/i,
    /\bfgts\b/i,
    /\binss\b/i,
    /vale[\s.-]*alimenta/i,
    /vale[\s.-]*transp/i,
    /vale[\s.-]*refei/i,
    /^\s*v\.?\s*a\.?\s*$/i,
    /^\s*v\.?\s*t\.?\s*$/i,
    /^\s*v\.?\s*r\.?\s*$/i,
    /pl(ano)?\.?\s*[- ]?\s*sa[úu]de/i,
    /assist[êe]ncia\s+m[ée]dica/i,
    /encargos?\s+sociais/i,
    /adiantamento\s+salarial/i,
    /estagi[áa]ri/i,
];

const ehPessoal = (categoria: string) => REGRAS_PESSOAL.some(re => re.test(categoria));

const mesesEntre = (inicio: Date, fim: Date) =>
    Math.max(1, (fim.getTime() - inicio.getTime()) / (1000 * 60 * 60 * 24) / DIAS_NO_MES);

const chaveMes = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

/** Coeficiente de variação (desvio padrão ÷ média) — mede o quanto o gasto oscila. */
function coefVariacao(valores: number[]): number | null {
    const n = valores.length;
    if (n < 2) return null;
    const media = valores.reduce((s, v) => s + v, 0) / n;
    if (media <= 0) return null;
    const variancia = valores.reduce((s, v) => s + (v - media) ** 2, 0) / n;
    return r((Math.sqrt(variancia) / media) * 100);
}

export const getIndices = async (req: Request, res: Response): Promise<void> => {
    try {
        const { deA, ateA, deB, ateB } = req.query;
        const ano = new Date().getFullYear();

        const inicioA = deA ? new Date(`${deA}T00:00:00`) : new Date(ano - 1, 0, 1);
        const fimA = ateA ? new Date(`${ateA}T23:59:59`) : new Date(ano - 1, 11, 31, 23, 59, 59);
        const inicioB = deB ? new Date(`${deB}T00:00:00`) : new Date(ano, 0, 1);
        const fimB = ateB ? new Date(`${ateB}T23:59:59`) : new Date();

        // Receita por competência, caindo para vencimento quando não houver competência.
        const receitaWhere = (ini: Date, fim: Date) => ({
            OR: [
                { dataCompetencia: { gte: ini, lte: fim } },
                { AND: [{ dataCompetencia: null }, { dataVencimento: { gte: ini, lte: fim } }] },
            ],
        });

        const [despA, despB, recA, recB, saldos] = await Promise.all([
            prisma.lancamento.findMany({
                where: { tipo: 'DESPESA', dataPagamento: { gte: inicioA, lte: fimA } },
                select: { categoria: true, centroDeCusto: true, valor: true, fornecedor: true, dataPagamento: true },
            }),
            prisma.lancamento.findMany({
                where: { tipo: 'DESPESA', dataPagamento: { gte: inicioB, lte: fimB } },
                select: { categoria: true, centroDeCusto: true, valor: true, fornecedor: true, dataPagamento: true },
            }),
            prisma.contaReceber.findMany({
                where: receitaWhere(inicioA, fimA),
                select: { valor: true, dataCompetencia: true, dataVencimento: true },
            }),
            prisma.contaReceber.findMany({
                where: receitaWhere(inicioB, fimB),
                select: { valor: true, dataCompetencia: true, dataVencimento: true },
            }),
            prisma.saldoBancario.findMany({ orderBy: { data: 'desc' } }),
        ]);

        const mesesA = mesesEntre(inicioA, fimA);
        const mesesB = mesesEntre(inicioB, fimB);

        // ── Agregações base ──────────────────────────────────────────────
        type Par = { a: number; b: number };
        const novoPar = (): Par => ({ a: 0, b: 0 });

        const porCategoria: Record<string, Par> = {};
        const porCC: Record<string, Par> = {};
        const porCCCategoria: Record<string, Record<string, Par>> = {};
        const ccDaCategoria: Record<string, Record<string, number>> = {};
        const fornecedores: Record<string, Par> = {};
        const serieMes: Record<string, { despesa: number; receita: number }> = {};
        const serieMesPorCC: Record<string, Record<string, number>> = {};

        let totalA = 0, totalB = 0, pessoalA = 0, pessoalB = 0;

        const acumular = (
            itens: typeof despB,
            periodo: 'a' | 'b',
        ) => {
            itens.forEach(l => {
                const cat = l.categoria || 'Sem Categoria';
                const cc = l.centroDeCusto || 'Geral';
                const forn = l.fornecedor?.trim() || null;

                (porCategoria[cat] ||= novoPar())[periodo] += l.valor;
                (porCC[cc] ||= novoPar())[periodo] += l.valor;
                ((porCCCategoria[cc] ||= {})[cat] ||= novoPar())[periodo] += l.valor;
                if (forn) (fornecedores[forn] ||= novoPar())[periodo] += l.valor;

                if (periodo === 'b') {
                    totalB += l.valor;
                    if (ehPessoal(cat)) pessoalB += l.valor;
                    (ccDaCategoria[cat] ||= {})[cc] = (ccDaCategoria[cat]?.[cc] || 0) + l.valor;

                    const mes = chaveMes(l.dataPagamento);
                    (serieMes[mes] ||= { despesa: 0, receita: 0 }).despesa += l.valor;
                    (serieMesPorCC[cc] ||= {})[mes] = (serieMesPorCC[cc]?.[mes] || 0) + l.valor;
                } else {
                    totalA += l.valor;
                    if (ehPessoal(cat)) pessoalA += l.valor;
                }
            });
        };

        acumular(despA, 'a');
        acumular(despB, 'b');

        const somaReceita = (lista: typeof recB) => lista.reduce((s, x) => s + x.valor, 0);
        const receitaA = somaReceita(recA);
        const receitaB = somaReceita(recB);

        recB.forEach(x => {
            const d = x.dataCompetencia ?? x.dataVencimento;
            (serieMes[chaveMes(d)] ||= { despesa: 0, receita: 0 }).receita += x.valor;
        });

        // ── Ofensores e economias (contribuição para a variação) ─────────
        const variacaoTotal = totalB - totalA;
        const movimentos = Object.entries(porCategoria)
            .map(([categoria, v]) => {
                const ccs = ccDaCategoria[categoria] || {};
                const principal = Object.entries(ccs).sort((x, y) => y[1] - x[1])[0];
                return {
                    categoria,
                    centroDeCusto: principal?.[0] ?? null,
                    valorA: r(v.a),
                    valorB: r(v.b),
                    deltaRS: r(v.b - v.a),
                    variacao: varPct(v.a, v.b),
                    // Quanto essa rubrica explica da variação total, em %.
                    contribuicao: variacaoTotal !== 0 ? r(((v.b - v.a) / Math.abs(variacaoTotal)) * 100) : 0,
                };
            })
            .filter(m => m.valorA > 0 || m.valorB > 0);

        const ofensores = [...movimentos].sort((x, y) => y.deltaRS - x.deltaRS).filter(m => m.deltaRS > 0).slice(0, 8);
        const economias = [...movimentos].sort((x, y) => x.deltaRS - y.deltaRS).filter(m => m.deltaRS < 0).slice(0, 8);

        // ── Concentração (Pareto) sobre as rubricas do período atual ─────
        const concentracaoDe = (valores: number[], total: number) => {
            const ordenado = [...valores].filter(v => v > 0).sort((x, y) => y - x);
            let acum = 0;
            let itensPara80 = 0;
            for (const v of ordenado) {
                if (acum / (total || 1) >= 0.8) break;
                acum += v;
                itensPara80++;
            }
            return {
                totalItens: ordenado.length,
                top1: pct(ordenado[0] || 0, total),
                top5: pct(ordenado.slice(0, 5).reduce((s, v) => s + v, 0), total),
                itensPara80,
            };
        };

        const concentracao = concentracaoDe(Object.values(porCategoria).map(v => v.b), totalB);

        // ── Difusão: quantas rubricas subiram, caíram, nasceram, morreram ─
        const difusaoDe = (pares: Par[]) => {
            let subiram = 0, cairam = 0, estaveis = 0, novas = 0, descontinuadas = 0;
            pares.forEach(({ a, b }) => {
                if (a === 0 && b > 0) novas++;
                else if (a > 0 && b === 0) descontinuadas++;
                else if (a > 0 && b > 0) {
                    const d = ((b - a) / a) * 100;
                    if (d > 1) subiram++;
                    else if (d < -1) cairam++;
                    else estaveis++;
                }
            });
            const comparaveis = subiram + cairam + estaveis;
            return {
                subiram, cairam, estaveis, novas, descontinuadas, comparaveis,
                pctSubiram: pct(subiram, comparaveis),
            };
        };

        const difusao = difusaoDe(Object.values(porCategoria));

        // ── Fornecedores ─────────────────────────────────────────────────
        const listaForn = Object.entries(fornecedores)
            .map(([fornecedor, v]) => ({ fornecedor, valorA: r(v.a), valorB: r(v.b), variacao: varPct(v.a, v.b) }))
            .filter(f => f.valorB > 0)
            .sort((x, y) => y.valorB - x.valorB);

        const totalComFornecedor = listaForn.reduce((s, f) => s + f.valorB, 0);
        const fornecedoresResumo = {
            identificados: listaForn.length,
            // Parte da despesa que sequer tem fornecedor preenchido — mede a qualidade do dado.
            coberturaPct: pct(totalComFornecedor, totalB),
            top1: pct(listaForn[0]?.valorB || 0, totalComFornecedor),
            top5: pct(listaForn.slice(0, 5).reduce((s, f) => s + f.valorB, 0), totalComFornecedor),
            top: listaForn.slice(0, 10).map(f => ({ ...f, participacao: pct(f.valorB, totalComFornecedor) })),
        };

        // ── Caixa: último saldo conhecido de cada instituição ────────────
        const ultimoPorInstituicao = new Map<string, { saldo: number; data: Date }>();
        saldos.forEach(s => {
            if (!ultimoPorInstituicao.has(s.instituicao)) {
                ultimoPorInstituicao.set(s.instituicao, { saldo: s.saldo, data: s.data });
            }
        });
        const saldoTotal = [...ultimoPorInstituicao.values()].reduce((s, x) => s + x.saldo, 0);
        const dataSaldo = saldos[0]?.data ?? null;
        const runRateB = totalB / mesesB;

        // ── Série mensal ordenada ────────────────────────────────────────
        const serie = Object.entries(serieMes)
            .sort(([m1], [m2]) => m1.localeCompare(m2))
            .map(([mes, v]) => ({
                mes,
                despesa: r(v.despesa),
                receita: r(v.receita),
                resultado: r(v.receita - v.despesa),
            }));

        // ── Índices por centro de custo ──────────────────────────────────
        const indicesPorCC = Object.entries(porCC)
            .map(([cc, v]) => {
                const cats = porCCCategoria[cc] || {};
                const paresCat = Object.values(cats);
                const valoresB = Object.values(cats).map(c => c.b);
                const pessoalCC = Object.entries(cats)
                    .filter(([cat]) => ehPessoal(cat))
                    .reduce((s, [, c]) => s + c.b, 0);
                const serieCC = Object.entries(serieMesPorCC[cc] || {})
                    .sort(([m1], [m2]) => m1.localeCompare(m2))
                    .map(([, valor]) => valor);

                return {
                    centroDeCusto: cc,
                    totalA: r(v.a),
                    totalB: r(v.b),
                    variacao: varPct(v.a, v.b),
                    deltaRS: r(v.b - v.a),
                    peso: pct(v.b, totalB),
                    consumoReceita: pct(v.b, receitaB),
                    pessoalPct: pct(pessoalCC, v.b),
                    runRate: r(v.b / mesesB),
                    volatilidade: coefVariacao(serieCC),
                    concentracao: concentracaoDe(valoresB, v.b),
                    difusao: difusaoDe(paresCat),
                    serie: serieCC.map(x => r(x)),
                };
            })
            .filter(cc => cc.totalA > 0 || cc.totalB > 0)
            .sort((x, y) => y.totalB - x.totalB);

        res.json({
            success: true,
            periodo: {
                // Ecoa as datas como vieram: converter para ISO/UTC deslocaria o dia final.
                a: { de: deA ?? null, ate: ateA ?? null, meses: r(mesesA) },
                b: { de: deB ?? null, ate: ateB ?? null, meses: r(mesesB) },
            },
            global: {
                despesaA: r(totalA),
                despesaB: r(totalB),
                deltaRS: r(variacaoTotal),
                variacao: varPct(totalA, totalB),
                receitaA: r(receitaA),
                receitaB: r(receitaB),
                resultadoB: r(receitaB - totalB),
                margem: receitaB > 0 ? r(((receitaB - totalB) / receitaB) * 100) : null,
                cobertura: totalB > 0 ? r(receitaB / totalB) : null,
                pessoal: {
                    valorA: r(pessoalA),
                    valorB: r(pessoalB),
                    variacao: varPct(pessoalA, pessoalB),
                    pctDespesa: pct(pessoalB, totalB),
                    pctReceita: pct(pessoalB, receitaB),
                    categorias: Object.keys(porCategoria).filter(ehPessoal).sort(),
                },
                runRate: r(runRateB),
                runRateAnterior: r(totalA / mesesA),
                projecaoAnual: r(runRateB * 12),
                caixa: {
                    saldoTotal: r(saldoTotal),
                    dataReferencia: dataSaldo,
                    instituicoes: [...ultimoPorInstituicao.entries()].map(([instituicao, x]) => ({
                        instituicao, saldo: r(x.saldo), data: x.data,
                    })),
                    // Sem saldo registrado o indicador não existe — devolver 0 daria a
                    // impressão falsa de caixa zerado.
                    mesesDeCaixa: saldoTotal > 0 && runRateB > 0 ? r(saldoTotal / runRateB) : null,
                },
                concentracao,
                difusao,
                ofensores,
                economias,
                fornecedores: fornecedoresResumo,
                serie,
            },
            porCC: indicesPorCC,
        });
    } catch (error: any) {
        console.error('Erro ao calcular índices:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};
