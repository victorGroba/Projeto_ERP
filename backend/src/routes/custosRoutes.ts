import { Router } from 'express';
import multer from 'multer';
import { authMiddleware } from '../middlewares/authMiddleware';
import {
    deleteEquipamento, deleteInsumo, deletePrecoInsumo,
    getEquipamentos, getInsumo, getInsumos,
    postEquipamento, postInsumo, postPrecoInsumo,
    putEquipamento, putInsumo, uploadPlanilhaCustos,
} from '../controllers/custosController';

const router = Router();
const planilhaUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 20 * 1024 * 1024 },
    fileFilter: (_req, file, callback) => {
        callback(null, /\.xlsx?$/i.test(file.originalname));
    },
});

router.use(authMiddleware);

router.get('/insumos', getInsumos);
router.post('/insumos', postInsumo);
router.get('/insumos/:id', getInsumo);
router.put('/insumos/:id', putInsumo);
router.delete('/insumos/:id', deleteInsumo);
router.post('/insumos/:id/precos', postPrecoInsumo);
router.delete('/insumos/:id/precos/:precoId', deletePrecoInsumo);

router.get('/equipamentos', getEquipamentos);
router.post('/equipamentos', postEquipamento);
router.put('/equipamentos/:id', putEquipamento);
router.delete('/equipamentos/:id', deleteEquipamento);

router.post('/importar-planilha', planilhaUpload.single('file'), uploadPlanilhaCustos);

export default router;
