import { Router } from 'express';
import { runSync } from '../controllers/etlController';
import { authMiddleware } from '../middlewares/authMiddleware';

const router = Router();

// Protect this route with auth middleware so only logged in users can trigger ETL
router.post('/sync', authMiddleware, runSync);

export default router;
