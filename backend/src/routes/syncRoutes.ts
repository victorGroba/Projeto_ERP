import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middlewares/authMiddleware';
import { runIncrementalSync, runFullSync } from '../services/contaAzulSyncService';

const router = Router();

// Incremental: últimos 60 dias + próximos 90 — rápido, para uso diário
router.post('/sync', authMiddleware, async (req: Request, res: Response): Promise<void> => {
    const result = await runIncrementalSync();
    res.status(result.success ? 200 : 500).json(result);
});

// Full: 2 anos completos — para carga inicial ou reprocessamento histórico
router.post('/sync/full', authMiddleware, async (req: Request, res: Response): Promise<void> => {
    const result = await runFullSync();
    res.status(result.success ? 200 : 500).json(result);
});

export default router;
