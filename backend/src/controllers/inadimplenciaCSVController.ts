import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const getInadimplenciaAging = async (req: Request, res: Response): Promise<void> => {
    try {
        const { year, de, ate } = req.query;
        const targetYear = year ? parseInt(year as string, 10) : new Date().getFullYear();

        // Filtro de data: usa "de/ate" se fornecidos, senão usa o ano inteiro
        const dataInicio = de ? new Date(de as string) : new Date(targetYear, 0, 1);
        const dataFim    = ate ? new Date(ate as string) : new Date(targetYear + 1, 0, 1);

        const pendentes = await prisma.contaReceber.findMany({
            where: {
                status: { notIn: ['Recebido', 'Baixado', 'Pago'] },
                dataVencimento: {
                    gte: dataInicio,
                    lt:  dataFim,
                }
            }
        });

        const hoje = new Date();
        const agingBuckets = {
            a_vencer: 0,
            ate_30: 0,
            de_31_a_60: 0,
            de_61_a_90: 0,
            mais_de_90: 0
        };

        const rankingDevedores: Record<string, number> = {};

        pendentes.forEach(conta => {
            const valor = conta.valor;

            // Usa o STATUS da Conta Azul como fonte da verdade (A Vencer vs Vencido),
            // garantindo que os totais batam exatamente com o ERP.
            if (conta.status === 'A Vencer') {
                agingBuckets.a_vencer += valor;
                return;
            }

            // Vencido: distribui por faixa de dias de atraso (apenas para detalhamento do gráfico)
            const dataVenc = new Date(conta.dataVencimento);
            const diffDias = Math.ceil((hoje.getTime() - dataVenc.getTime()) / (1000 * 60 * 60 * 24));

            if (diffDias <= 30)      agingBuckets.ate_30     += valor;
            else if (diffDias <= 60) agingBuckets.de_31_a_60 += valor;
            else if (diffDias <= 90) agingBuckets.de_61_a_90 += valor;
            else                     agingBuckets.mais_de_90 += valor;

            const key = (conta as any).grupo
                ? `${(conta as any).grupo} (Grupo)`
                : (conta.cliente || 'Sem Cliente');
            rankingDevedores[key] = (rankingDevedores[key] || 0) + valor;
        });

        const topDevedores = Object.entries(rankingDevedores)
            .map(([cliente, valorDevido]) => ({ cliente, valorDevido }))
            .sort((a, b) => b.valorDevido - a.valorDevido)
            .slice(0, 15);

        res.json({
            success: true,
            aging: agingBuckets,
            totalAtraso: agingBuckets.ate_30 + agingBuckets.de_31_a_60 + agingBuckets.de_61_a_90 + agingBuckets.mais_de_90,
            topDevedores,
            // Totalizadores para comparação com Conta Azul
            totalPeriodo: pendentes.reduce((s, c) => s + c.valor, 0),
            filtro: {
                de: dataInicio.toISOString().split('T')[0],
                ate: dataFim.toISOString().split('T')[0],
                totalRegistros: pendentes.length
            }
        });

    } catch (error: any) {
        console.error('Erro ao calcular aging inadimplência:', error);
        res.status(500).json({ success: false, error: 'Erro ao processar as contas a receber' });
    }
};
