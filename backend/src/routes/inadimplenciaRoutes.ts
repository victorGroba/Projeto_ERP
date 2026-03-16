import { Router } from 'express';
import { getInadimplenciaOverview, getInadimplenciaComposition, getInadimplenciaEvolution } from '../controllers/inadimplenciaController';
import { authMiddleware } from '../middlewares/authMiddleware';

const router = Router();

router.use(authMiddleware);

router.get('/overview', getInadimplenciaOverview);
router.get('/composition', getInadimplenciaComposition);
router.get('/evolution', getInadimplenciaEvolution);

export default router;
