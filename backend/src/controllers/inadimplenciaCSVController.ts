import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { STATUS_PENDENTES } from '../utils/statusReceita';
import { resolverGruposPorCliente, chaveDevedor } from '../utils/grupoEconomico';

const prisma = new PrismaClient();

export const getInadimplenciaAging = async (req: Request, res: Response): Promise<void> => {
    try {
        const { year, de, ate } = req.query;

        // Filtro de data por vencimento. Sem parametros, NAO restringe: divida vencida
        // nao deixa de existir na virada do ano, e o default anterior (ano corrente)
        // escondia silenciosamente o atraso dos anos anteriores.
        const dataInicio = de   ? new Date(de as string)
                         : year ? new Date(parseInt(year as string, 10), 0, 1)
                         : new Date(1970, 0, 1);
        const dataFim    = ate   ? new Date(`${ate}T23:59:59`)
                         : year  ? new Date(parseInt(year as string, 10) + 1, 0, 1)
                         : new Date(9999, 0, 1);

        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);

        const gruposPorCliente = await resolverGruposPorCliente(prisma);

        const pendentes = await prisma.contaReceber.findMany({
            where: {
                status: { in: STATUS_PENDENTES },
                dataVencimento: {
                    gte: dataInicio,
                    lt:  dataFim,
                }
            }
        });

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
            const dataVenc = new Date(conta.dataVencimento);
            dataVenc.setHours(0, 0, 0, 0);

            // Inadimplente real = vencimento anterior a hoje
            if (dataVenc >= hoje) {
                agingBuckets.a_vencer += valor;
                return;
            }

            const diffDias = Math.ceil((hoje.getTime() - dataVenc.getTime()) / (1000 * 60 * 60 * 24));

            if (diffDias <= 30)      agingBuckets.ate_30     += valor;
            else if (diffDias <= 60) agingBuckets.de_31_a_60 += valor;
            else if (diffDias <= 90) agingBuckets.de_61_a_90 += valor;
            else                     agingBuckets.mais_de_90 += valor;

            const key = chaveDevedor(conta.cliente, gruposPorCliente);
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
