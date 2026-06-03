import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { ContaAzulAPI } from '../services/contaAzulApi';
import { authMiddleware } from '../middlewares/authMiddleware';

const router = Router();
const prisma = new PrismaClient();

async function getAPI(): Promise<ContaAzulAPI> {
    const [acc, ref] = await Promise.all([
        prisma.appConfig.findUnique({ where: { key: 'access_token_rj' } }),
        prisma.appConfig.findUnique({ where: { key: 'refresh_token_rj' } }),
    ]);
    return new ContaAzulAPI(
        acc?.value  || process.env.CONTA_AZUL_ACCESS_TOKEN_RJ  || '',
        ref?.value  || process.env.CONTA_AZUL_REFRESH_TOKEN_RJ || '',
        process.env.CONTA_AZUL_CLIENT_ID_RJ     || '',
        process.env.CONTA_AZUL_CLIENT_SECRET_RJ || '',
    );
}

// GET /api/audit/comparar?year=2026
// Busca o total de registros ao vivo na API e compara com o banco local
router.get('/comparar', authMiddleware, async (req: Request, res: Response): Promise<void> => {
    try {
        const year   = req.query.year ? parseInt(req.query.year as string) : new Date().getFullYear();
        const inicio = `${year}-01-01`;
        const fim    = `${year}-12-31`;

        // ── Banco local ──────────────────────────────────────────
        const [dbRecGrupos, dbDesp, ultimoSync] = await Promise.all([
            prisma.contaReceber.groupBy({
                by: ['status'],
                where: { dataVencimento: { gte: new Date(inicio), lte: new Date(fim) } },
                _sum: { valor: true },
                _count: true,
            }),
            prisma.lancamento.aggregate({
                where: { tipo: 'DESPESA', dataPagamento: { gte: new Date(inicio), lt: new Date(`${year + 1}-01-01`) } },
                _sum: { valor: true },
                _count: true,
            }),
            prisma.appConfig.findFirst({
                where: { key: 'access_token_rj' },
                select: { updatedAt: true },
            }),
        ]);

        const dbRecCount = dbRecGrupos.reduce((s, r) => s + r._count, 0);
        const dbRecTotal = dbRecGrupos.reduce((s, r) => s + (r._sum.valor || 0), 0);

        // ── API ao vivo (apenas 1 item para pegar itens_totais) ──
        const api = await getAPI();
        await api.tryRefreshToken();

        const [liveRec, liveDesp] = await Promise.all([
            api.getContasAReceber({ dataVencimentoInicio: inicio, dataVencimentoFim: fim, pagina: 1, tamanhoPagina: 1 }),
            api.getContasAPagar  ({ dataVencimentoInicio: inicio, dataVencimentoFim: fim, pagina: 1, tamanhoPagina: 1 }),
        ]);

        const apiRecCount  = liveRec?.itens_totais  ?? null;
        const apiDespCount = liveDesp?.itens_totais ?? null;

        // ── Monta resultado ──────────────────────────────────────
        res.json({
            success: true,
            data: {
                ano:  year,
                ultimaSincronizacao: ultimoSync?.updatedAt ?? null,
                fonte: 'api-v2.contaazul.com/v1',
                receitas: {
                    banco: {
                        registros: dbRecCount,
                        total: Math.round(dbRecTotal * 100) / 100,
                        porStatus: dbRecGrupos.map(r => ({
                            status: r.status,
                            registros: r._count,
                            total: Math.round((r._sum.valor || 0) * 100) / 100,
                        })),
                    },
                    api: { registros: apiRecCount },
                    confere: apiRecCount !== null ? dbRecCount === apiRecCount : null,
                },
                despesas: {
                    banco: {
                        registros: dbDesp._count,
                        total: Math.round((dbDesp._sum.valor || 0) * 100) / 100,
                    },
                    api: { registros: apiDespCount },
                    confere: apiDespCount !== null ? dbDesp._count === apiDespCount : null,
                },
            },
        });

    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

export default router;
