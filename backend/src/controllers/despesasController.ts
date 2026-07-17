import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const getDespesasAgrupadas = async (req: Request, res: Response): Promise<void> => {
    try {
        const { year, de, ate, de2, ate2 } = req.query;
        const targetYear = year ? parseInt(year as string, 10) : new Date().getFullYear();

        // Período atual: usa de/ate se fornecidos, senão o ano inteiro
        const dataInicio = de  ? new Date(`${de}T00:00:00`)  : new Date(targetYear,     0,  1);
        const dataFim    = ate ? new Date(`${ate}T23:59:59`) : new Date(targetYear,     11, 31, 23, 59, 59);

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

        const despesas = await prisma.lancamento.findMany({
            where: {
                tipo: 'DESPESA',
                dataPagamento: { gte: rangeInicio, lte: rangeFim },
            },
        });

        const agregacao: Record<string, Record<string, { current: number; previous: number }>> = {};

        despesas.forEach(d => {
            const cat = d.categoria     || 'Sem Categoria';
            const cc  = d.centroDeCusto || 'Geral';
            const dt  = d.dataPagamento;

            if (!agregacao[cat])      agregacao[cat]     = {};
            if (!agregacao[cat][cc])  agregacao[cat][cc] = { current: 0, previous: 0 };

            if (dt >= dataInicio && dt <= dataFim)
                agregacao[cat][cc].current  += d.valor;
            else if (dt >= dataInicioAnt && dt <= dataFimAnt)
                agregacao[cat][cc].previous += d.valor;
        });

        const resultadoFinal: any[] = [];

        Object.keys(agregacao).forEach(categoria => {
            Object.keys(agregacao[categoria]).forEach(centroDeCusto => {
                const { current: totalAtual, previous: totalAnterior } = agregacao[categoria][centroDeCusto];
                const evolucaoRS      = totalAtual - totalAnterior;
                const evolucaoPercent = totalAnterior > 0
                    ? (evolucaoRS / totalAnterior) * 100
                    : (totalAtual > 0 ? 100 : 0);

                resultadoFinal.push({
                    id: `${categoria}-${centroDeCusto}`.replace(/\s+/g, '-').toLowerCase(),
                    categoria,
                    centroDeCusto,
                    totalAnterior: Math.round(totalAnterior * 100) / 100,
                    totalAnual:    Math.round(totalAtual    * 100) / 100,
                    evolucaoRS:    Math.round(evolucaoRS    * 100) / 100,
                    evolucaoPercent,
                });
            });
        });

        resultadoFinal.sort((a, b) => b.totalAnual - a.totalAnual);

        res.json({
            success: true,
            data: resultadoFinal,
            filtro: {
                de:         dataInicio.toISOString().split('T')[0],
                ate:        dataFim.toISOString().split('T')[0],
                deAnterior: dataInicioAnt.toISOString().split('T')[0],
                ateAnterior:dataFimAnt.toISOString().split('T')[0],
            },
        });

    } catch (error: any) {
        console.error('Erro ao agrupar despesas:', error);
        res.status(500).json({ success: false, error: 'Erro ao processar as despesas' });
    }
};
