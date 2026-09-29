import { Router } from 'express';
import multer from 'multer';
import { authMiddleware } from '../middlewares/authMiddleware';
import { getClientesSyncStatus, getVisaoClientes, syncClientes } from '../controllers/clientesController';
import { getImportacoesFiscais, uploadFaturamentoFiscal } from '../controllers/faturamentoFiscalController';

const router = Router();
const fiscalUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (_req, file, callback) => {
        callback(null, file.originalname.toLowerCase().endsWith('.csv'));
    },
});

router.get('/', authMiddleware, getVisaoClientes);
router.get('/sync/status', authMiddleware, getClientesSyncStatus);
router.post('/sync', authMiddleware, syncClientes);
router.get('/faturamento-fiscal', authMiddleware, getImportacoesFiscais);
router.post('/faturamento-fiscal', authMiddleware, fiscalUpload.single('file'), uploadFaturamentoFiscal);

export default router;
