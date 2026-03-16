import { Router } from 'express';
import { getFaturamentoMetrics, getTopClientsMetrics, getPublicPrivateMetrics } from '../controllers/faturamentoController';
import { authMiddleware } from '../middlewares/authMiddleware';

const router = Router();

router.use(authMiddleware);
router.get('/metrics', getFaturamentoMetrics);
router.get('/top-clients', getTopClientsMetrics);
router.get('/public-private', getPublicPrivateMetrics);

export default router;
