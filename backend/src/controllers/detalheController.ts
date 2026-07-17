import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const getDetalhePorCC = async (req: Request, res: Response): Promise<void> => {
    try {
        const { year, de, ate, de2, ate2 } = req.query;
        const targetYear = year ? parseInt(year as string, 10) : new Date().getFullYear();

        // Período atual
        const dataInicio = de  ? new Date(`${de}T00:00:00`)  : new Date(targetYear, 0,  1);
        const dataFim    = ate ? new Date(`${ate}T23:59:59`) : new Date(targetYear, 11, 31, 23, 59, 59);

        // Período de comparação: totalmente configurável via de2/ate2.
        // Se não informado, cai no padrão histórico (mesma janela, 1 ano antes).
        let dataInicioAnt: Date;
        let dataFimAnt: Date;
        if (de2 && ate2) {
            dataInicioAnt = new Date(`${de2}T00:00:00`);
            dataFimAnt    = new Date(`${ate2}T23:59:59`);
        } else {
            dataInicioAnt = new Date(dataInicio);
            dataInicioAnt.setFullYear(dataInicioAnt.getFullYear() - 1);
            dataFimAnt = new Date(dataFim);
            dataFimAnt.setFullYear(dataFimAnt.getFullYear() - 1);
        }

        // Períodos configuráveis podem vir em qualquer ordem (comparação não precisa ser "antes")
        const rangeInicio = dataInicio < dataInicioAnt ? dataInicio : dataInicioAnt;
        const rangeFim    = dataFim    > dataFimAnt    ? dataFim    : dataFimAnt;

        const lancamentos = await prisma.lancamento.findMany({
            where: {
                tipo: 'DESPESA',
                dataPagamento: { gte: rangeInicio, lte: rangeFim },
            },
            select: { categoria: true, centroDeCusto: true, valor: true, dataPagamento: true },
        });

        // Agrega: CC → categoria → { atual, anterior }
        const aggr: Record<string, Record<string, { atual: number; anterior: number }>> = {};

        lancamentos.forEach(l => {
            const cc  = l.centroDeCusto || 'Geral';
            const cat = l.categoria     || 'Sem Categoria';
            const dt  = l.dataPagamento;

            if (!aggr[cc])      aggr[cc]      = {};
            if (!aggr[cc][cat]) aggr[cc][cat] = { atual: 0, anterior: 0 };

            if (dt >= dataInicio && dt <= dataFim)
                aggr[cc][cat].atual    += l.valor;
            else if (dt >= dataInicioAnt && dt <= dataFimAnt)
                aggr[cc][cat].anterior += l.valor;
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

        res.json({
            success: true,
            data: result,
            filtro: {
                de:          dataInicio.toISOString().split('T')[0],
                ate:         dataFim.toISOString().split('T')[0],
                deAnterior:  dataInicioAnt.toISOString().split('T')[0],
                ateAnterior: dataFimAnt.toISOString().split('T')[0],
            },
        });

    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};
