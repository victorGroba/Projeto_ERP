import { Router } from 'express';
import { authMiddleware } from '../middlewares/authMiddleware';
import { getClientesSyncStatus, getVisaoClientes, syncClientes } from '../controllers/clientesController';

const router = Router();

router.get('/', authMiddleware, getVisaoClientes);
router.get('/sync/status', authMiddleware, getClientesSyncStatus);
router.post('/sync', authMiddleware, syncClientes);

export default router;
