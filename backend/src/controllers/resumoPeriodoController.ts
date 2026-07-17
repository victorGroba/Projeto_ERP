import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Retorna despesas do período agrupadas por categoria (período atual + mesmo período ano anterior).
// Frontend usa esses dados para recalcular totais instantaneamente ao excluir categorias.
export const getResumoDespesasPeriodo = async (req: Request, res: Response): Promise<void> => {
    try {
        const { de, ate } = req.query;

        const hoje = new Date();
        const anoAtual = hoje.getFullYear();

        const dataInicio = de ? new Date(`${de}T00:00:00`) : new Date(anoAtual, 0, 1);
        const dataFim    = ate ? new Date(`${ate}T23:59:59`) : hoje;

        // Mesmo período, ano anterior
        const dataInicioAnt = new Date(dataInicio);
        dataInicioAnt.setFullYear(dataInicioAnt.getFullYear() - 1);
        const dataFimAnt = new Date(dataFim);
        dataFimAnt.setFullYear(dataFimAnt.getFullYear() - 1);

        const [lancAtual, lancAnterior] = await Promise.all([
            prisma.lancamento.findMany({
                where: { tipo: 'DESPESA', dataPagamento: { gte: dataInicio, lte: dataFim } },
                select: { categoria: true, valor: true }
            }),
            prisma.lancamento.findMany({
                where: { tipo: 'DESPESA', dataPagamento: { gte: dataInicioAnt, lte: dataFimAnt } },
                select: { categoria: true, valor: true }
            }),
        ]);

        const mapAtual:    Record<string, number> = {};
        const mapAnterior: Record<string, number> = {};

        lancAtual.forEach(l => {
            const cat = l.categoria || 'Sem Categoria';
            mapAtual[cat] = (mapAtual[cat] || 0) + l.valor;
        });
        lancAnterior.forEach(l => {
            const cat = l.categoria || 'Sem Categoria';
            mapAnterior[cat] = (mapAnterior[cat] || 0) + l.valor;
        });

        const todasCats = new Set([...Object.keys(mapAtual), ...Object.keys(mapAnterior)]);

        const categorias = Array.from(todasCats)
            .map(cat => ({
                categoria:     cat,
                totalAtual:    Math.round((mapAtual[cat]    || 0) * 100) / 100,
                totalAnterior: Math.round((mapAnterior[cat] || 0) * 100) / 100,
            }))
            .sort((a, b) => b.totalAtual - a.totalAtual);

        res.json({
            success: true,
            categorias,
            filtro: {
                de:  dataInicio.toISOString().split('T')[0],
                ate: dataFim.toISOString().split('T')[0],
                deAnterior:  dataInicioAnt.toISOString().split('T')[0],
                ateAnterior: dataFimAnt.toISOString().split('T')[0],
            }
        });

    } catch (error: any) {
        console.error('Erro ao calcular resumo de despesas por período:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};
