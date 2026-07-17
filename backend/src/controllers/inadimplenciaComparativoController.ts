import { Request, Response } from 'express';
import { PrismaClient, ContaReceber } from '@prisma/client';

const prisma = new PrismaClient();

async function calcularAging(dataInicio: Date, dataFim: Date) {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    const pendentes = await prisma.contaReceber.findMany({
        where: {
            status: { notIn: ['Recebido', 'Baixado', 'Pago'] },
            dataVencimento: { gte: dataInicio, lte: dataFim },
        },
    });

    const aging = { a_vencer: 0, ate_30: 0, de_31_a_60: 0, de_61_a_90: 0, mais_de_90: 0 };
    const rankingDevedores: Record<string, number> = {};

    pendentes.forEach((conta: ContaReceber) => {
        const valor    = conta.valor;
        const dataVenc = new Date(conta.dataVencimento);
        dataVenc.setHours(0, 0, 0, 0);

        if (dataVenc >= hoje) {
            aging.a_vencer += valor;
            return;
        }

        const diffDias = Math.ceil((hoje.getTime() - dataVenc.getTime()) / (1000 * 60 * 60 * 24));

        if (diffDias <= 30)       aging.ate_30     += valor;
        else if (diffDias <= 60)  aging.de_31_a_60 += valor;
        else if (diffDias <= 90)  aging.de_61_a_90 += valor;
        else                      aging.mais_de_90  += valor;

        const key = conta.grupo
            ? `${conta.grupo} (Grupo)`
            : (conta.cliente || 'Sem Cliente');
        rankingDevedores[key] = (rankingDevedores[key] || 0) + valor;
    });

    const totalAtraso =
        aging.ate_30 + aging.de_31_a_60 + aging.de_61_a_90 + aging.mais_de_90;

    const topDevedores = Object.entries(rankingDevedores)
        .map(([cliente, valorDevido]) => ({ cliente, valorDevido }))
        .sort((a, b) => b.valorDevido - a.valorDevido)
        .slice(0, 20);

    return {
        aging,
        totalAtraso:  Math.round(totalAtraso  * 100) / 100,
        aVencer:      Math.round(aging.a_vencer * 100) / 100,
        topDevedores,
        totalPeriodo: Math.round(pendentes.reduce((s, c) => s + c.valor, 0) * 100) / 100,
    };
}

export const getComparativoInadimplencia = async (req: Request, res: Response): Promise<void> => {
    try {
        const { deA, ateA, deB, ateB } = req.query;
        const anoAtual = new Date().getFullYear();

        const inicioA = deA  ? new Date(`${deA}T00:00:00`)  : new Date(anoAtual - 1, 0, 1);
        const fimA    = ateA ? new Date(`${ateA}T23:59:59`) : new Date(anoAtual - 1, 5, 30, 23, 59, 59);
        const inicioB = deB  ? new Date(`${deB}T00:00:00`)  : new Date(anoAtual,     0, 1);
        const fimB    = ateB ? new Date(`${ateB}T23:59:59`) : new Date();

        const [resultA, resultB] = await Promise.all([
            calcularAging(inicioA, fimA),
            calcularAging(inicioB, fimB),
        ]);

        // Tabela comparativa: merge devedores de ambos os períodos
        const mapaA: Record<string, number> = {};
        const mapaB: Record<string, number> = {};
        resultA.topDevedores.forEach(d => { mapaA[d.cliente] = d.valorDevido; });
        resultB.topDevedores.forEach(d => { mapaB[d.cliente] = d.valorDevido; });

        const todasChaves = new Set([...Object.keys(mapaA), ...Object.keys(mapaB)]);
        const tabelaComparativa = Array.from(todasChaves)
            .map(cliente => ({
                cliente,
                valorA:  mapaA[cliente] || 0,
                valorB:  mapaB[cliente] || 0,
                variacao: mapaA[cliente]
                    ? ((( mapaB[cliente] || 0) - mapaA[cliente]) / mapaA[cliente]) * 100
                    : null,
            }))
            .sort((a, b) => Math.max(b.valorA, b.valorB) - Math.max(a.valorA, a.valorB));

        res.json({
            success: true,
            periodoA: {
                label: `${inicioA.toISOString().split('T')[0]} → ${fimA.toISOString().split('T')[0]}`,
                ...resultA,
            },
            periodoB: {
                label: `${inicioB.toISOString().split('T')[0]} → ${fimB.toISOString().split('T')[0]}`,
                ...resultB,
            },
            tabelaComparativa,
        });

    } catch (error: any) {
        console.error('Erro ao calcular comparativo de inadimplência:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};
