import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middlewares/authMiddleware';
import { runIncrementalSync, runFullSync, runCustomSync, getSyncStatus } from '../services/contaAzulSyncService';

const router = Router();

// Status do sync em andamento (a UI faz polling nisso pra mostrar progresso/tempo estimado)
router.get('/sync/status', authMiddleware, (req: Request, res: Response): void => {
    res.json(getSyncStatus());
});

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

// Período específico: janela livre (ex.: reprocessar um mês após corrigir dados no Conta Azul)
router.post('/sync/custom', authMiddleware, async (req: Request, res: Response): Promise<void> => {
    const { de, ate } = req.query;
    if (!de || !ate || typeof de !== 'string' || typeof ate !== 'string') {
        res.status(400).json({ success: false, message: 'Informe "de" e "ate" (YYYY-MM-DD).' });
        return;
    }
    if (de > ate) {
        res.status(400).json({ success: false, message: 'A data inicial não pode ser depois da data final.' });
        return;
    }
    const result = await runCustomSync(de, ate);
    res.status(result.success ? 200 : 500).json(result);
});

export default router;
