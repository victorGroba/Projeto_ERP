import { Router, Request, Response } from 'express';
import multer from 'multer';
import { ImportacaoService } from '../services/importacaoService';
import { authMiddleware } from '../middlewares/authMiddleware';

const router = Router();
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

export default router;
