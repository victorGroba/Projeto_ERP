import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Endpoint 1: Visão Geral (Faturado vs Recebido vs Em Aberto)
export const getInadimplenciaOverview = async (req: Request, res: Response) => {
    try {
        const { year, accountId } = req.query;
        let whereClause: any = {};

        if (year) {
            const startOfYear = new Date(Number(year), 0, 1);
            const endOfYear = new Date(Number(year), 11, 31, 23, 59, 59);
            whereClause.dueDate = { gte: startOfYear, lte: endOfYear };
        }
        if (accountId) {
            whereClause.accountId = String(accountId);
        }

        // Faturado (Invoices) - Usando Data de Emissão para o ano correspondente
        let invoiceWhere: any = {};
        if (year) {
            invoiceWhere.issueDate = {
                gte: new Date(Number(year), 0, 1),
                lte: new Date(Number(year), 11, 31, 23, 59, 59)
            };
        }
        if (accountId) invoiceWhere.accountId = String(accountId);

        const totalFaturadoRes = await prisma.invoice.aggregate({
            _sum: { grossValue: true },
            where: invoiceWhere
        });

        // Recebido (Pago) vs Em Aberto (Vencido / A Vencer)
        const receivables = await prisma.accountsReceivable.groupBy({
            by: ['status'],
            _sum: { value: true },
            where: whereClause
        });

        const totalFaturado = totalFaturadoRes._sum.grossValue || 0;
        let totalRecebido = 0;
        let totalVencido = 0;
        let totalAVencer = 0;

        receivables.forEach(item => {
            const val = item._sum.value || 0;
            if (item.status.toUpperCase() === 'PAGO' || item.status.toUpperCase() === 'RECEBIDO') {
                totalRecebido += val;
            } else if (item.status.toUpperCase() === 'VENCIDO') {
                totalVencido += val;
            } else if (item.status.toUpperCase() === 'A_VENCER' || item.status.toUpperCase() === 'A VENCER') {
                totalAVencer += val;
            }
        });

        const totalEmAberto = totalVencido + totalAVencer;

        res.json({
            totalFaturado,
            totalRecebido,
            totalEmAberto,
            detalheEmAberto: {
                vencido: totalVencido,
                aVencer: totalAVencer
            }
        });
    } catch (error) {
        console.error('Erro getInadimplenciaOverview:', error);
        res.status(500).json({ error: 'Erro interno ao buscar visão geral da inadimplência.' });
    }
};

// Endpoint 2: Composição da Inadimplência
export const getInadimplenciaComposition = async (req: Request, res: Response) => {
    try {
        const { year, accountId } = req.query;
        let whereClause: any = {
            status: { in: ['VENCIDO', 'A_VENCER', 'A VENCER'] }
        };

        if (year) {
            whereClause.dueDate = {
                gte: new Date(Number(year), 0, 1),
                lte: new Date(Number(year), 11, 31, 23, 59, 59)
            };
        }
        if (accountId) whereClause.accountId = String(accountId);

        // Buscar Títulos em Aberto e Fazer JOIN manual na Memória
        const abertos = await prisma.accountsReceivable.findMany({
            where: whereClause
        });

        const deParaList = await prisma.deParaClientes.findMany({
            include: { grupoEconomico: true }
        });
        const deParaMap = new Map(deParaList.map(dp => [dp.clienteIdContaAzul, dp]));

        // Agrupar por Cliente/Grupo
        const composition: Record<string, { nome: string; total: number; isGroup: boolean }> = {};

        abertos.forEach(item => {
            const dePara = deParaMap.get(item.clientId);
            const grupo = dePara?.grupoEconomico;

            const key = grupo ? `GRUPO_${grupo.id}` : `CLI_${item.clientId}`;
            const label = grupo ? grupo.nome : (dePara?.nomeOriginal || item.clientId);

            if (!composition[key]) {
                composition[key] = { nome: label, total: 0, isGroup: !!grupo };
            }
            composition[key].total += item.value;
        });

        // Ordenar e extrair Maiores (Restante vira "Outros")
        const sorted = Object.values(composition).sort((a, b) => b.total - a.total);
        const top10 = sorted.slice(0, 10);
        const outros = sorted.slice(10).reduce((acc, curr) => acc + curr.total, 0);

        if (outros > 0) {
            top10.push({ nome: 'Outros (Menores)', total: outros, isGroup: false });
        }

        res.json({ composicao: top10 });
    } catch (error) {
        console.error('Erro getInadimplenciaComposition:', error);
        res.status(500).json({ error: 'Erro ao analisar composição da inadimplência.' });
    }
};

// Endpoint 3: Evolução Semanal (Historico)
export const getInadimplenciaEvolution = async (req: Request, res: Response) => {
    try {
        const { year } = req.query;
        let whereClause: any = {};

        if (year) {
            whereClause.dataReferencia = {
                gte: new Date(Number(year), 0, 1),
                lte: new Date(Number(year), 11, 31, 23, 59, 59)
            };
        }

        const snapshots = await prisma.snapshotsRecebiveis.findMany({
            where: whereClause,
            orderBy: { dataReferencia: 'asc' }
        });

        // Agrupar por Semana (Data Referencia) x Status
        const evolutionMap: Record<string, any> = {};

        snapshots.forEach(snap => {
            // Pega apenas a data em formato YYYY-MM-DD
            const dateStr = snap.dataReferencia.toISOString().split('T')[0];

            if (!evolutionMap[dateStr]) {
                evolutionMap[dateStr] = { data: dateStr, Vencido: 0, AVencer: 0 };
            }

            if (snap.statusFatura.toUpperCase() === 'VENCIDO') {
                evolutionMap[dateStr].Vencido += snap.valor;
            } else if (snap.statusFatura.toUpperCase() === 'A_VENCER' || snap.statusFatura.toUpperCase() === 'A VENCER') {
                evolutionMap[dateStr].AVencer += snap.valor;
            }
        });

        res.json({ evolution: Object.values(evolutionMap) });
    } catch (error) {
        console.error('Erro getInadimplenciaEvolution:', error);
        res.status(500).json({ error: 'Erro interno na evolução semanal.' });
    }
};
