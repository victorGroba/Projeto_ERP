import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const getDetalhePorCC = async (req: Request, res: Response): Promise<void> => {
    try {
        const { year } = req.query;
        const targetYear = year ? parseInt(year as string, 10) : new Date().getFullYear();
        const previousYear = targetYear - 1;

        const lancamentos = await prisma.lancamento.findMany({
            where: {
                tipo: 'DESPESA',
                dataPagamento: {
                    gte: new Date(previousYear, 0, 1),
                    lt: new Date(targetYear + 1, 0, 1)
                }
            },
            select: { categoria: true, centroDeCusto: true, valor: true, dataPagamento: true }
        });

        // Agrega: CC → categoria → { atual, anterior }
        const aggr: Record<string, Record<string, { atual: number; anterior: number }>> = {};

        lancamentos.forEach(l => {
            const cc  = l.centroDeCusto || 'Geral';
            const cat = l.categoria     || 'Sem Categoria';
            const isAtual = l.dataPagamento.getFullYear() === targetYear;

            if (!aggr[cc])       aggr[cc] = {};
            if (!aggr[cc][cat])  aggr[cc][cat] = { atual: 0, anterior: 0 };

            if (isAtual) aggr[cc][cat].atual    += l.valor;
            else         aggr[cc][cat].anterior += l.valor;
        });

        const pct = (atual: number, ant: number) =>
            ant > 0 ? (atual - ant) / ant : (atual > 0 ? 1 : 0);

        const result = Object.entries(aggr)
            .map(([cc, cats]) => {
                const categorias = Object.entries(cats)
                    .map(([cat, v]) => ({
                        categoria: cat,
                        atual:     Math.round(v.atual    * 100) / 100,
                        anterior:  Math.round(v.anterior * 100) / 100,
                        variacao:  pct(v.atual, v.anterior),
                    }))
                    .filter(c => c.atual > 0 || c.anterior > 0)
                    .sort((a, b) => b.atual - a.atual);

                const totalAtual    = categorias.reduce((s, c) => s + c.atual,    0);
                const totalAnterior = categorias.reduce((s, c) => s + c.anterior, 0);

                return {
                    centroDeCusto: cc,
                    totalAtual:    Math.round(totalAtual    * 100) / 100,
                    totalAnterior: Math.round(totalAnterior * 100) / 100,
                    variacao:      pct(totalAtual, totalAnterior),
                    categorias,
                };
            })
            .filter(cc => cc.totalAtual > 0 || cc.totalAnterior > 0)
            .sort((a, b) => b.totalAtual - a.totalAtual);

        res.json({ success: true, data: result, targetYear, previousYear });

    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};
