import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Palavras-chave que identificam lançamentos de distribuição de lucros
const KEYWORDS_LUCROS = [
    'distribuicao de lucro', 'distribuição de lucro', 'lucro', 'pro-labore', 'pro labore',
    'prolabore', 'retirada', 'dividendo', 'pró-labore'
];

export const getDistribuicaoLucros = async (req: Request, res: Response): Promise<void> => {
    try {
        const { year } = req.query;
        const targetYear = year ? parseInt(year as string, 10) : new Date().getFullYear();

        const lancamentos = await prisma.lancamento.findMany({
            where: {
                tipo: 'DESPESA',
                dataPagamento: {
                    gte: new Date(targetYear, 0, 1),
                    lt: new Date(targetYear + 1, 0, 1)
                }
            },
            select: { categoria: true, fornecedor: true, valor: true, descricao: true }
        });

        // Filtrar por kata de distribuição de lucros
        const lancamentosLucro = lancamentos.filter(l => {
            const cat = (l.categoria || '').toLowerCase();
            const desc = (l.descricao || '').toLowerCase();
            return KEYWORDS_LUCROS.some(kw => cat.includes(kw) || desc.includes(kw));
        });

        // Agrupar por sócio/fornecedor
        const porSocio: Record<string, number> = {};
        lancamentosLucro.forEach(l => {
            const socio = l.fornecedor || 'Outros';
            if (!porSocio[socio]) porSocio[socio] = 0;
            porSocio[socio] += l.valor;
        });

        // Se não achou por categoria, agrupar por categoria que contenha a palavra 'lucro'
        const total = Object.values(porSocio).reduce((a, b) => a + b, 0);

        const chartData = Object.entries(porSocio)
            .map(([name, value]) => ({
                name,
                value: Math.round(value * 100) / 100,
                pct: total > 0 ? Math.round((value / total) * 10000) / 100 : 0
            }))
            .sort((a, b) => b.value - a.value);

        res.json({
            success: true,
            data: chartData,
            totalDistribuido: Math.round(total * 100) / 100,
            targetYear
        });

    } catch (error: any) {
        console.error('Erro ao calcular distribuição de lucros:', error);
        res.status(500).json({ success: false, error: 'Erro ao processar distribuição de lucros' });
    }
};
