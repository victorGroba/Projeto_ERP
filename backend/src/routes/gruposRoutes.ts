import { Router } from 'express';
import { getGroups, createGroup, updateClientGroupMapping } from '../controllers/gruposController';
import { authMiddleware } from '../middlewares/authMiddleware';

const router = Router();

router.use(authMiddleware);

router.get('/', getGroups);
router.post('/', createGroup);
router.put('/mapping', updateClientGroupMapping);

export default router;
