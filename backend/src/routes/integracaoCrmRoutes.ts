import { Router } from 'express';
import { integracaoCrmMiddleware } from '../middlewares/integracaoCrmMiddleware';
import { getFaturamentoParaCrm } from '../controllers/integracaoCrmController';

const router = Router();

router.get('/faturamento', integracaoCrmMiddleware, getFaturamentoParaCrm);

export default router;
