import { Request, Response } from 'express';
import { ContaAzulSyncService } from '../services/contaAzulSyncService';

export const runSync = async (req: Request, res: Response) => {
    try {
        const result = await ContaAzulSyncService.runFullSync();
        if (result.success) {
            res.json(result);
        } else {
            res.status(500).json(result);
        }
    } catch (error) {
        res.status(500).json({ error: 'Erro interno no ETL' });
    }
};
