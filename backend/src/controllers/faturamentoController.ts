import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const getFaturamentoMetrics = async (req: Request, res: Response) => {
    try {
        const { year, accountId } = req.query;
        let whereClause: any = {};

        if (year) {
            const startOfYear = new Date(Number(year), 0, 1);
            const endOfYear = new Date(Number(year), 11, 31, 23, 59, 59);
            whereClause.issueDate = {
                gte: startOfYear,
                lte: endOfYear
            };
        }

        if (accountId) {
            whereClause.accountId = String(accountId);
        }

        const invoices = await prisma.invoice.findMany({
            where: whereClause,
            orderBy: { issueDate: 'asc' }
        });

        // Agregação mês a mês (Valor Bruto)
        const monthlyData = new Array(12).fill(0).map((_, i) => ({
            month: i + 1,
            receitaBruta: 0
        }));

        let faturamentoAcumulado = 0;

        invoices.forEach(inv => {
            const monthIndex = inv.issueDate.getMonth();
            const value = Number(inv.grossValue);
            monthlyData[monthIndex].receitaBruta += value;
            faturamentoAcumulado += value;
        });

        res.json({
            faturamentoAcumulado,
            monthlyEvolution: monthlyData
        });

    } catch (error) {
        console.error('Erro no Faturamento:', error);
        res.status(500).json({ error: 'Erro ao analisar faturamento.' });
    }
};

export const getTopClientsMetrics = async (req: Request, res: Response) => {
    try {
        const { year, accountId } = req.query;
        let whereClause: any = {};

        if (year) {
            const startOfYear = new Date(Number(year), 0, 1);
            const endOfYear = new Date(Number(year), 11, 31, 23, 59, 59);
            whereClause.issueDate = { gte: startOfYear, lte: endOfYear };
        }
        if (accountId) {
            whereClause.accountId = String(accountId);
        }

        const invoices = await prisma.invoice.findMany({
            where: whereClause
        });

        const deParaList = await prisma.deParaClientes.findMany({
            include: { grupoEconomico: true }
        });
        const deParaMap = new Map(deParaList.map(dp => [dp.clienteIdContaAzul, dp]));

        // Agrupamento por Cliente ou Grupo Econômico
        const clientTotals: Record<string, { nome: string; total: number; isGroup: boolean }> = {};

        invoices.forEach(inv => {
            const value = Number(inv.grossValue);
            const dePara = deParaMap.get(inv.clientId);
            const grupo = dePara?.grupoEconomico;

            // Se pertencer a um grupo, agrupa no nível do Grupo, senão usa o Cliente Conta Azul
            const key = grupo ? `GRUPO_${grupo.id}` : `CLI_${inv.clientId}`;
            const label = grupo ? grupo.nome : (dePara?.nomeOriginal || inv.clientId);

            if (!clientTotals[key]) {
                clientTotals[key] = { nome: label, total: 0, isGroup: !!grupo };
            }
            clientTotals[key].total += value;
        });

        const sortedClients = Object.values(clientTotals).sort((a, b) => b.total - a.total);

        const top5 = sortedClients.slice(0, 5);
        const top20 = sortedClients.slice(0, 20);

        // Cauda Longa: clientes/grupos com faturamento total > 10.000 no período
        const caudaLonga = sortedClients.filter(c => c.total > 10000);

        res.json({ top5, top20, caudaLonga });

    } catch (error) {
        console.error('Erro no Mix de Clientes:', error);
        res.status(500).json({ error: 'Erro ao analisar Mix de Clientes.' });
    }
};

export const getPublicPrivateMetrics = async (req: Request, res: Response) => {
    try {
        const { year, accountId } = req.query;
        let whereClause: any = {};

        if (year) {
            const startOfYear = new Date(Number(year), 0, 1);
            const endOfYear = new Date(Number(year), 11, 31, 23, 59, 59);
            whereClause.issueDate = { gte: startOfYear, lte: endOfYear };
        }
        if (accountId) {
            whereClause.accountId = String(accountId);
        }

        const invoices = await prisma.invoice.findMany({
            where: whereClause
        });

        const deParaList = await prisma.deParaClientes.findMany();
        const deParaMap = new Map(deParaList.map(dp => [dp.clienteIdContaAzul, dp.segmentoTipo]));

        let publico = 0;
        let privado = 0;
        let naoClassificado = 0;

        invoices.forEach(inv => {
            const segment = deParaMap.get(inv.clientId);
            const value = Number(inv.grossValue);

            if (segment === 'PUB') publico += value;
            else if (segment === 'PRI') privado += value;
            else naoClassificado += value;
        });

        res.json({
            data: [
                { name: 'Público', value: publico },
                { name: 'Privado', value: privado },
                ...(naoClassificado > 0 ? [{ name: 'Sem Classificação', value: naoClassificado }] : [])
            ]
        });

    } catch (error) {
        console.error('Erro no Segmento Público/Privado:', error);
        res.status(500).json({ error: 'Erro ao analisar segmento.' });
    }
};

