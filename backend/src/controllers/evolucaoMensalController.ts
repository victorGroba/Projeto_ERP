import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

export const getEvolucaoMensal = async (req: Request, res: Response): Promise<void> => {
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
            select: { dataPagamento: true, valor: true }
        });

        // Acumular por mês
        const porMesAtual: number[] = new Array(12).fill(0);
        const porMesAnterior: number[] = new Array(12).fill(0);

        lancamentos.forEach(l => {
            const mes = l.dataPagamento.getMonth();
            const ano = l.dataPagamento.getFullYear();
            if (ano === targetYear) porMesAtual[mes] += l.valor;
            else if (ano === previousYear) porMesAnterior[mes] += l.valor;
        });

        const chartData = MESES.map((nome, i) => ({
            mes: nome,
            anoAtual: Math.round(porMesAtual[i] * 100) / 100,
            anoAnterior: Math.round(porMesAnterior[i] * 100) / 100,
            variacao: Math.round((porMesAtual[i] - porMesAnterior[i]) * 100) / 100
        }));

        res.json({ success: true, data: chartData, targetYear, previousYear });

    } catch (error: any) {
        console.error('Erro ao calcular evolução mensal:', error);
        res.status(500).json({ success: false, error: 'Erro ao processar evolução mensal' });
    }
};
