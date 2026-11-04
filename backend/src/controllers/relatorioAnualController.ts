import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const MATS_SERVICOS_KEYWORDS = ['microbiologia', 'operacional', 'quimico', 'fisico'];
const DESPESAS_ADMIN_KEYWORDS = [
    'recursos humanos', 'administrativo', 'comercial',
    'tributos', 'diretoria', 'financeiro', 'financas',
    'qualidade', 'terceiros',
];

// Categorias que, independentemente do Centro de Custo a que estão atreladas, não fazem
// parte do Resultado Operacional — são destinações do resultado apurado (pedido do Daniel,
// 04/11/2026). Nomes exatos conferidos contra a produção, grafia (inclusive erros de
// digitação já gravados nos lançamentos) preservada de propósito.
const CATEGORIAS_INVESTIMENTOS = [
    'Máquinas, Equipamentos e Instalações Industriais',
    'Outras Imobilizações por Aquisição',
    'Consórcio - Veículos',
    'Veículos',
];
const CATEGORIAS_DISTRIBUICAO_LUCROS = [
    'Antecipação de Lucros do Exercício - Carmen',
    'Antecipação de Lucros do Exercício - Raphael',
    'Antecipação de Lucros do Execício-Vivian',
    'Antecipação de Lucros Exercício - Raphael Mattos',
];

function normalize(s: string): string {
    return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

const CATEGORIAS_INVESTIMENTOS_NORM = CATEGORIAS_INVESTIMENTOS.map(normalize);
const CATEGORIAS_DISTRIBUICAO_LUCROS_NORM = CATEGORIAS_DISTRIBUICAO_LUCROS.map(normalize);

function classificaDestinacao(categoria: string): 'investimentos' | 'distribuicaoLucros' | null {
    const n = normalize(categoria);
    if (CATEGORIAS_INVESTIMENTOS_NORM.includes(n)) return 'investimentos';
    if (CATEGORIAS_DISTRIBUICAO_LUCROS_NORM.includes(n)) return 'distribuicaoLucros';
    return null;
}

function classify(cc: string): 'mats' | 'desp' | 'outros' {
    const n = normalize(cc);
    if (n === 'sem centro de custo' || n === 'geral' || n === 'n/a') return 'outros';
    if (MATS_SERVICOS_KEYWORDS.some(k => n.includes(k))) return 'mats';
    if (DESPESAS_ADMIN_KEYWORDS.some(k => n.includes(k))) return 'desp';
    return 'outros';
}

const r = (v: number) => Math.round(v * 100) / 100;
const pct = (anterior: number, atual: number) =>
    anterior !== 0 ? ((atual - anterior) / Math.abs(anterior)) * 100 : null;

export const getRelatorioAnual = async (req: Request, res: Response): Promise<void> => {
    try {
        const { de, ate } = req.query;

        const inicioAtual = de ? new Date(`${de}T00:00:00Z`) : new Date(Date.UTC(new Date().getFullYear(), 0, 1));
        const fimAtual = ate ? new Date(`${ate}T23:59:59Z`) : new Date();

        const anoAtual = inicioAtual.getUTCFullYear();
        const anoAnterior = anoAtual - 1;

        const inicioAnterior = new Date(inicioAtual);
        inicioAnterior.setUTCFullYear(anoAnterior);
        const fimAnterior = new Date(fimAtual);
        fimAnterior.setUTCFullYear(anoAnterior);

        const [lancAnterior, lancAtual] = await Promise.all([
            prisma.lancamento.findMany({
                where: { dataPagamento: { gte: inicioAnterior, lte: fimAnterior } },
                select: { tipo: true, categoria: true, centroDeCusto: true, valor: true },
            }),
            prisma.lancamento.findMany({
                where: { dataPagamento: { gte: inicioAtual, lte: fimAtual } },
                select: { tipo: true, categoria: true, centroDeCusto: true, valor: true },
            }),
        ]);

        // ── ENTRADAS (tipo=RECEITA) ──
        const entradasMap: Record<string, { anterior: number; atual: number }> = {};
        const processEntradas = (items: typeof lancAnterior, periodo: 'anterior' | 'atual') => {
            items.filter(l => l.tipo === 'RECEITA').forEach(l => {
                const cat = l.categoria || 'Receitas';
                if (!entradasMap[cat]) entradasMap[cat] = { anterior: 0, atual: 0 };
                entradasMap[cat][periodo] += l.valor;
            });
        };
        processEntradas(lancAnterior, 'anterior');
        processEntradas(lancAtual, 'atual');

        const entradasCategorias = Object.entries(entradasMap)
            .map(([cat, v]) => ({
                categoria: cat,
                totalAnterior: r(v.anterior),
                totalAtual: r(v.atual),
                variacao: pct(v.anterior, v.atual),
            }))
            .filter(c => c.totalAnterior > 0 || c.totalAtual > 0)
            .sort((a, b) => b.totalAtual - a.totalAtual);

        const totalEntradasAnterior = r(entradasCategorias.reduce((s, c) => s + c.totalAnterior, 0));
        const totalEntradasAtual = r(entradasCategorias.reduce((s, c) => s + c.totalAtual, 0));

        // ── DESPESAS por CC → Categoria ──
        // Investimentos em Imobilizados e Distribuição de Lucros ficam fora do rateio por CC:
        // não são Resultado Operacional, são destinação do resultado já apurado.
        const ccMap: Record<string, Record<string, { anterior: number; atual: number }>> = {};
        const destinacaoMap: Record<'investimentos' | 'distribuicaoLucros', Record<string, { anterior: number; atual: number }>> = {
            investimentos: {},
            distribuicaoLucros: {},
        };
        const processDespesas = (items: typeof lancAnterior, periodo: 'anterior' | 'atual') => {
            items.filter(l => l.tipo === 'DESPESA').forEach(l => {
                const cat = l.categoria || 'Sem Categoria';
                const destinacao = classificaDestinacao(cat);
                if (destinacao) {
                    if (!destinacaoMap[destinacao][cat]) destinacaoMap[destinacao][cat] = { anterior: 0, atual: 0 };
                    destinacaoMap[destinacao][cat][periodo] += l.valor;
                    return;
                }
                const cc = l.centroDeCusto || 'Geral';
                if (!ccMap[cc]) ccMap[cc] = {};
                if (!ccMap[cc][cat]) ccMap[cc][cat] = { anterior: 0, atual: 0 };
                ccMap[cc][cat][periodo] += l.valor;
            });
        };
        processDespesas(lancAnterior, 'anterior');
        processDespesas(lancAtual, 'atual');

        const buildCategoriaGroup = (map: Record<string, { anterior: number; atual: number }>) => {
            const categorias = Object.entries(map)
                .map(([cat, v]) => ({
                    categoria: cat,
                    totalAnterior: r(v.anterior),
                    totalAtual: r(v.atual),
                    variacao: pct(v.anterior, v.atual),
                }))
                .filter(c => c.totalAnterior > 0 || c.totalAtual > 0)
                .sort((a, b) => b.totalAtual - a.totalAtual);
            const totalAnterior = r(categorias.reduce((s, c) => s + c.totalAnterior, 0));
            const totalAtual = r(categorias.reduce((s, c) => s + c.totalAtual, 0));
            return { categorias, total: { totalAnterior, totalAtual, variacao: pct(totalAnterior, totalAtual) } };
        };

        const investimentos = buildCategoriaGroup(destinacaoMap.investimentos);
        const distribuicaoLucros = buildCategoriaGroup(destinacaoMap.distribuicaoLucros);

        const buildCCGroup = (filter: (cc: string) => boolean) => {
            const centros = Object.entries(ccMap)
                .filter(([cc]) => filter(cc))
                .map(([cc, cats]) => {
                    const categorias = Object.entries(cats)
                        .map(([cat, v]) => ({
                            categoria: cat,
                            totalAnterior: r(v.anterior),
                            totalAtual: r(v.atual),
                            variacao: pct(v.anterior, v.atual),
                        }))
                        .filter(c => c.totalAnterior > 0 || c.totalAtual > 0)
                        .sort((a, b) => b.totalAtual - a.totalAtual);

                    const totalAnterior = r(categorias.reduce((s, c) => s + c.totalAnterior, 0));
                    const totalAtual = r(categorias.reduce((s, c) => s + c.totalAtual, 0));

                    return {
                        nome: cc,
                        categorias,
                        total: { totalAnterior, totalAtual, variacao: pct(totalAnterior, totalAtual) },
                    };
                })
                .filter(cc => cc.total.totalAnterior > 0 || cc.total.totalAtual > 0)
                .sort((a, b) => b.total.totalAtual - a.total.totalAtual);

            const totalAnterior = r(centros.reduce((s, c) => s + c.total.totalAnterior, 0));
            const totalAtual = r(centros.reduce((s, c) => s + c.total.totalAtual, 0));

            return { centrosDeCusto: centros, total: { totalAnterior, totalAtual, variacao: pct(totalAnterior, totalAtual) } };
        };

        const materiaisServicos = buildCCGroup(cc => classify(cc) === 'mats');
        const despesas = buildCCGroup(cc => classify(cc) === 'desp');
        const outros = buildCCGroup(cc => classify(cc) === 'outros');

        // Resultado = Entradas - MatServ - Despesas
        const resultAnterior = r(totalEntradasAnterior - materiaisServicos.total.totalAnterior - despesas.total.totalAnterior - (outros.total.totalAnterior || 0));
        const resultAtual = r(totalEntradasAtual - materiaisServicos.total.totalAtual - despesas.total.totalAtual - (outros.total.totalAtual || 0));

        // Resultado Financeiro Líquido = Resultado Operacional - destinações (Investimentos e
        // Distribuição de Lucros). Essas categorias não entram no Resultado Operacional em si
        // (pedido do Daniel, 04/11/2026) — são o que se faz com o resultado já apurado.
        const liquidoAnterior = r(resultAnterior - investimentos.total.totalAnterior - distribuicaoLucros.total.totalAnterior);
        const liquidoAtual = r(resultAtual - investimentos.total.totalAtual - distribuicaoLucros.total.totalAtual);

        res.json({
            success: true,
            anoAtual,
            anoAnterior,
            periodoAtual: { de: inicioAtual.toISOString().split('T')[0], ate: fimAtual.toISOString().split('T')[0] },
            periodoAnterior: { de: inicioAnterior.toISOString().split('T')[0], ate: fimAnterior.toISOString().split('T')[0] },
            entradas: {
                categorias: entradasCategorias,
                total: { totalAnterior: totalEntradasAnterior, totalAtual: totalEntradasAtual, variacao: pct(totalEntradasAnterior, totalEntradasAtual) },
            },
            materiaisServicos,
            despesas,
            outros: outros.centrosDeCusto.length > 0 ? outros : undefined,
            investimentos: investimentos.categorias.length > 0 ? investimentos : undefined,
            distribuicaoLucros: distribuicaoLucros.categorias.length > 0 ? distribuicaoLucros : undefined,
            resultadoOperacional: {
                totalAnterior: resultAnterior,
                totalAtual: resultAtual,
                variacao: pct(resultAnterior, resultAtual),
            },
            resultadoFinanceiroLiquido: {
                totalAnterior: liquidoAnterior,
                totalAtual: liquidoAtual,
                variacao: pct(liquidoAnterior, liquidoAtual),
            },
        });
    } catch (error: any) {
        console.error('Erro ao gerar relatório anual:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};
