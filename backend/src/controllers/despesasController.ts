import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const getDespesasAgrupadas = async (req: Request, res: Response): Promise<void> => {
    try {
        const { year } = req.query;
        const targetYear = year ? parseInt(year as string, 10) : new Date().getFullYear();
        const previousYear = targetYear - 1;

        // Buscar despesas do ano selecionado e do anterior
        const despesas = await prisma.lancamento.findMany({
            where: {
                tipo: 'DESPESA',
                dataPagamento: {
                    gte: new Date(previousYear, 0, 1),
                    lt: new Date(targetYear + 1, 0, 1) // Até o fim do ano alvo
                }
            }
        });

        const agregacao: Record<string, Record<string, { current: Record<number, number>, previous: Record<number, number> }>> = {};

        despesas.forEach(d => {
            const cat = d.categoria || 'Sem Categoria';
            const cc = d.centroDeCusto || 'Geral';
            const mes = d.dataPagamento.getMonth();
            const dYear = d.dataPagamento.getFullYear();

            if (!agregacao[cat]) agregacao[cat] = {};
            if (!agregacao[cat][cc]) agregacao[cat][cc] = { current: {}, previous: {} };

            if (dYear === targetYear) {
                if (!agregacao[cat][cc].current[mes]) agregacao[cat][cc].current[mes] = 0;
                agregacao[cat][cc].current[mes] += d.valor;
            } else if (dYear === previousYear) {
                if (!agregacao[cat][cc].previous[mes]) agregacao[cat][cc].previous[mes] = 0;
                agregacao[cat][cc].previous[mes] += d.valor;
            }
        });

        const resultadoFinal: any[] = [];

        Object.keys(agregacao).forEach(categoria => {
            Object.keys(agregacao[categoria]).forEach(centroDeCusto => {
                const dadosAct = agregacao[categoria][centroDeCusto].current;
                const dadosPrev = agregacao[categoria][centroDeCusto].previous;

                const mesesFormatados: any = {};
                for (let i = 0; i < 12; i++) {
                    mesesFormatados[`mes_${i}`] = dadosAct[i] || 0;
                }

                const totalAtual = Object.values(dadosAct).reduce((a, b) => a + b, 0);
                const totalAnterior = Object.values(dadosPrev).reduce((a, b) => a + b, 0);

                const evolucaoRS = totalAtual - totalAnterior;
                const evolucaoPercent = totalAnterior > 0 ? (evolucaoRS / totalAnterior) * 100 : (totalAtual > 0 ? 100 : 0);

                resultadoFinal.push({
                    id: `${categoria}-${centroDeCusto}`.replace(/\s+/g, '-').toLowerCase(),
                    categoria,
                    centroDeCusto,
                    ...mesesFormatados,
                    totalAnterior,
                    totalAnual: totalAtual,
                    evolucaoRS,
                    evolucaoPercent
                });
            });
        });

        resultadoFinal.sort((a, b) => b.totalAnual - a.totalAnual);

        res.json({ success: true, data: resultadoFinal });

    } catch (error: any) {
        console.error('Erro ao agrupar despesas:', error);
        res.status(500).json({ success: false, error: 'Erro ao processar as despesas' });
    }
};
