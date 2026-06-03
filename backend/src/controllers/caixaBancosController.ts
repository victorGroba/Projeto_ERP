import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const getCaixaBancos = async (req: Request, res: Response): Promise<void> => {
    try {
        const { year } = req.query;
        const targetYear = year ? parseInt(year as string, 10) : new Date().getFullYear();

        // Receitas do ano por status (do ContaReceber)
        const receitas = await prisma.contaReceber.findMany({
            where: {
                dataVencimento: {
                    gte: new Date(targetYear, 0, 1),
                    lt: new Date(targetYear + 1, 0, 1)
                }
            },
            select: { status: true, valor: true }
        });

        const porStatus: Record<string, number> = { 'Pago': 0, 'A Vencer': 0, 'Vencido': 0 };
        receitas.forEach(r => {
            const s = r.status || 'A Vencer';
            if (s === 'Pago' || s === 'A Vencer' || s === 'Vencido') {
                porStatus[s] += r.valor;
            } else {
                porStatus['A Vencer'] += r.valor;
            }
        });

        const chartData = [
            { name: 'Recebido', valor: Math.round(porStatus['Pago'] * 100) / 100, color: '#059669' },
            { name: 'A Vencer', valor: Math.round(porStatus['A Vencer'] * 100) / 100, color: '#2563eb' },
            { name: 'Vencido', valor: Math.round(porStatus['Vencido'] * 100) / 100, color: '#dc2626' },
        ];

        const totalReceitas = chartData.reduce((a, b) => a + b.valor, 0);

        // Despesas do ano para comparação
        const { _sum: sumDesp } = await prisma.lancamento.aggregate({
            where: {
                tipo: 'DESPESA',
                dataPagamento: {
                    gte: new Date(targetYear, 0, 1),
                    lt: new Date(targetYear + 1, 0, 1)
                }
            },
            _sum: { valor: true }
        });

        const totalDespesas = sumDesp.valor || 0;
        const saldoLiquido = totalReceitas - totalDespesas;

        res.json({
            success: true,
            data: chartData,
            totalReceitas: Math.round(totalReceitas * 100) / 100,
            totalDespesas: Math.round(totalDespesas * 100) / 100,
            saldoLiquido: Math.round(saldoLiquido * 100) / 100,
            totalSaldo: Math.round(totalReceitas * 100) / 100,
            totalSaidas: Math.round(totalDespesas * 100) / 100,
            targetYear
        });

    } catch (error: any) {
        console.error('Erro ao calcular resumo financeiro:', error);
        res.status(500).json({ success: false, error: 'Erro ao processar resumo financeiro' });
    }
};
