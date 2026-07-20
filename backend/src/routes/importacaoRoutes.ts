import { Router, Request, Response } from 'express';
import multer from 'multer';
import { PrismaClient } from '@prisma/client';
import { ImportacaoService } from '../services/importacaoService';
import { authMiddleware } from '../middlewares/authMiddleware';

const router = Router();
const prisma = new PrismaClient();
const upload = multer({ dest: 'uploads/' });

router.post('/upload', authMiddleware, upload.single('file'), async (req: Request, res: Response): Promise<void> => {
    try {
        if (!req.file) {
            res.status(400).json({ error: 'Nenhum arquivo enviado.' });
            return;
        }

        const tipo = req.body.tipo; // "DESPESAS" ou "RECEITAS"
        if (!tipo) {
            res.status(400).json({ error: 'Tipo do arquivo não especificado (DESPESAS ou RECEITAS).' });
            return;
        }

        const result = await ImportacaoService.processarCSV(req.file.path, tipo);
        res.json({ success: true, message: 'Arquivo processado com sucesso!', ...result });
    } catch (error: any) {
        console.error('Erro no upload de CSV:', error);
        res.status(500).json({ error: error.message || 'Erro interno ao processar o arquivo CSV.' });
    }
});

router.get('/historico', authMiddleware, async (req: Request, res: Response) => {
    try {
        const historico = await prisma.historicoImportacao.findMany({
            orderBy: { createdAt: 'desc' }
        });
        res.json(historico);
    } catch (error: any) {
        console.error('Erro ao buscar histórico:', error);
        res.status(500).json({ error: 'Erro ao buscar histórico de importações.' });
    }
});

router.delete('/historico/:id', authMiddleware, async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        await prisma.historicoImportacao.delete({
            where: { id }
        });
        res.json({ success: true, message: 'Importação excluída com sucesso.' });
    } catch (error: any) {
        console.error('Erro ao excluir importação:', error);
        res.status(500).json({ error: 'Erro ao excluir importação.' });
    }
});

export default router;
