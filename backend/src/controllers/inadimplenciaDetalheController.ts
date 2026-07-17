import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Retorna cada devedor individualmente (sem agrupar por grupo econômico),
// com a lista completa de títulos vencidos antes de hoje.
export const getDevedoresDetalhe = async (req: Request, res: Response): Promise<void> => {
    try {
        const { de, ate } = req.query;

        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);

        const anoAtual = hoje.getFullYear();
        const dataInicio = de ? new Date(`${de}T00:00:00`) : new Date(anoAtual, 0, 1);
        const dataFimRange = ate ? new Date(`${ate}T23:59:59`) : new Date(anoAtual, 11, 31, 23, 59, 59);

        // Apenas títulos realmente vencidos (dataVencimento < hoje) dentro do intervalo
        const contas = await prisma.contaReceber.findMany({
            where: {
                status: { notIn: ['Recebido', 'Baixado', 'Pago'] },
                dataVencimento: {
                    gte: dataInicio,
                    lt:  hoje,          // vencidos antes de hoje
                    lte: dataFimRange,  // dentro do intervalo solicitado
                },
            },
            orderBy: { dataVencimento: 'asc' },
        });

        // Agrupa por cliente individual
        const porCliente: Record<string, {
            cliente:  string;
            grupo:    string | null;
            titulos:  { id: string; dataVencimento: string; valor: number; diasAtraso: number; descricao: string | null; numeroNF: string | null }[];
        }> = {};

        contas.forEach(conta => {
            const key = conta.cliente || 'Sem Cliente';
            if (!porCliente[key]) {
                porCliente[key] = { cliente: key, grupo: conta.grupo || null, titulos: [] };
            }
            const dataVenc = new Date(conta.dataVencimento);
            dataVenc.setHours(0, 0, 0, 0);
            const diasAtraso = Math.ceil((hoje.getTime() - dataVenc.getTime()) / (1000 * 60 * 60 * 24));

            porCliente[key].titulos.push({
                id:             conta.id,
                dataVencimento: conta.dataVencimento.toISOString().split('T')[0],
                valor:          Math.round(conta.valor * 100) / 100,
                diasAtraso,
                descricao:      conta.descricao   || null,
                numeroNF:       conta.numeroNotaFiscal || null,
            });
        });

        const devedores = Object.values(porCliente)
            .map(d => ({
                cliente:      d.cliente,
                grupo:        d.grupo,
                valorTotal:   Math.round(d.titulos.reduce((s, t) => s + t.valor, 0) * 100) / 100,
                diasMaxAtraso: Math.max(...d.titulos.map(t => t.diasAtraso)),
                qtdTitulos:   d.titulos.length,
                titulos:      d.titulos.sort((a, b) => b.diasAtraso - a.diasAtraso),
            }))
            .sort((a, b) => b.valorTotal - a.valorTotal);

        res.json({ success: true, devedores, totalRegistros: contas.length });

    } catch (error: any) {
        console.error('Erro ao buscar detalhamento de devedores:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};
