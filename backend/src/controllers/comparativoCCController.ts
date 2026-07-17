import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const getComparativoCC = async (req: Request, res: Response): Promise<void> => {
    try {
        const { deA, ateA, deB, ateB } = req.query;
        const anoAtual = new Date().getFullYear();

        const inicioA = deA  ? new Date(`${deA}T00:00:00`)  : new Date(anoAtual - 1, 0,  1);
        const fimA    = ateA ? new Date(`${ateA}T23:59:59`) : new Date(anoAtual - 1, 11, 31, 23, 59, 59);
        const inicioB = deB  ? new Date(`${deB}T00:00:00`)  : new Date(anoAtual,     0,  1);
        const fimB    = ateB ? new Date(`${ateB}T23:59:59`) : new Date();

        const [lancA, lancB] = await Promise.all([
            prisma.lancamento.findMany({
                where: { tipo: 'DESPESA', dataPagamento: { gte: inicioA, lte: fimA } },
                select: { categoria: true, centroDeCusto: true, valor: true },
            }),
            prisma.lancamento.findMany({
                where: { tipo: 'DESPESA', dataPagamento: { gte: inicioB, lte: fimB } },
                select: { categoria: true, centroDeCusto: true, valor: true },
            }),
        ]);

        // Agrega: CC → categoria → { a, b }
        const aggrCC: Record<string, Record<string, { a: number; b: number }>> = {};

        const processar = (items: { categoria: string | null; centroDeCusto: string | null; valor: number }[], periodo: 'a' | 'b') => {
            items.forEach(l => {
                const cc  = l.centroDeCusto || 'Geral';
                const cat = l.categoria     || 'Sem Categoria';
                if (!aggrCC[cc])       aggrCC[cc]      = {};
                if (!aggrCC[cc][cat])  aggrCC[cc][cat] = { a: 0, b: 0 };
                aggrCC[cc][cat][periodo] += l.valor;
            });
        };

        processar(lancA, 'a');
        processar(lancB, 'b');

        const pct = (a: number, b: number) =>
            a > 0 ? ((b - a) / a) * 100 : null;

        const r = (v: number) => Math.round(v * 100) / 100;

        // Estrutura Por CC
        const porCC = Object.entries(aggrCC)
            .map(([cc, cats]) => {
                const categorias = Object.entries(cats)
                    .map(([cat, v]) => ({
                        categoria: cat,
                        valorA:    r(v.a),
                        valorB:    r(v.b),
                        variacao:  pct(v.a, v.b),
                    }))
                    .filter(c => c.valorA > 0 || c.valorB > 0)
                    .sort((a, b) => b.valorB - a.valorB);

                const totalA = categorias.reduce((s, c) => s + c.valorA, 0);
                const totalB = categorias.reduce((s, c) => s + c.valorB, 0);

                return { centroDeCusto: cc, totalA: r(totalA), totalB: r(totalB), variacao: pct(totalA, totalB), categorias };
            })
            .filter(cc => cc.totalA > 0 || cc.totalB > 0)
            .sort((a, b) => b.totalB - a.totalB);

        // Estrutura Por Categoria (inversão)
        const aggrCat: Record<string, Record<string, { a: number; b: number }>> = {};
        Object.entries(aggrCC).forEach(([cc, cats]) => {
            Object.entries(cats).forEach(([cat, v]) => {
                if (!aggrCat[cat])      aggrCat[cat]     = {};
                if (!aggrCat[cat][cc])  aggrCat[cat][cc] = { a: 0, b: 0 };
                aggrCat[cat][cc].a += v.a;
                aggrCat[cat][cc].b += v.b;
            });
        });

        const porCategoria = Object.entries(aggrCat)
            .map(([cat, ccs]) => {
                const centros = Object.entries(ccs)
                    .map(([cc, v]) => ({
                        centroDeCusto: cc,
                        valorA:        r(v.a),
                        valorB:        r(v.b),
                        variacao:      pct(v.a, v.b),
                    }))
                    .filter(c => c.valorA > 0 || c.valorB > 0)
                    .sort((a, b) => b.valorB - a.valorB);

                const totalA = centros.reduce((s, c) => s + c.valorA, 0);
                const totalB = centros.reduce((s, c) => s + c.valorB, 0);

                return { categoria: cat, totalA: r(totalA), totalB: r(totalB), variacao: pct(totalA, totalB), centros };
            })
            .filter(c => c.totalA > 0 || c.totalB > 0)
            .sort((a, b) => b.totalB - a.totalB);

        res.json({
            success: true,
            periodoA: { label: `${inicioA.toISOString().split('T')[0]} → ${fimA.toISOString().split('T')[0]}` },
            periodoB: { label: `${inicioB.toISOString().split('T')[0]} → ${fimB.toISOString().split('T')[0]}` },
            porCC,
            porCategoria,
            totais: {
                totalA: r(porCC.reduce((s, cc) => s + cc.totalA, 0)),
                totalB: r(porCC.reduce((s, cc) => s + cc.totalB, 0)),
            },
        });

    } catch (error: any) {
        console.error('Erro ao calcular comparativo por CC:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};
