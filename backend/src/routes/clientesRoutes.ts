import { Router } from 'express';
import { authMiddleware } from '../middlewares/authMiddleware';
import { getVisaoClientes, syncClientes } from '../controllers/clientesController';

const router = Router();

router.get('/', authMiddleware, getVisaoClientes);
router.post('/sync', authMiddleware, syncClientes);

export default router;
