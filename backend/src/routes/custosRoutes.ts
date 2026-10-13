import { Router } from 'express';
import multer from 'multer';
import { authMiddleware } from '../middlewares/authMiddleware';
import {
    deleteEquipamento, deleteInsumo, deletePrecoInsumo,
    getEquipamentos, getInsumo, getInsumos,
    postEquipamento, postInsumo, postPrecoInsumo,
    putEquipamento, putInsumo, uploadPlanilhaCustos,
    deleteEnsaio, getEnsaio, getEnsaios, getParametros, postDuplicarEnsaio,
    postEnsaio, postSimularFicha, putEnsaio, putParametros,
    deleteServico, getServico, getServicos, postServico, putServico,
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

router.get('/ensaios', getEnsaios);
router.post('/ensaios', postEnsaio);
router.post('/ensaios/simular', postSimularFicha);
router.get('/ensaios/:id', getEnsaio);
router.put('/ensaios/:id', putEnsaio);
router.delete('/ensaios/:id', deleteEnsaio);
router.post('/ensaios/:id/duplicar', postDuplicarEnsaio);

router.get('/servicos', getServicos);
router.post('/servicos', postServico);
router.get('/servicos/:id', getServico);
router.put('/servicos/:id', putServico);
router.delete('/servicos/:id', deleteServico);

router.get('/parametros', getParametros);
router.put('/parametros', putParametros);

router.post('/importar-planilha', planilhaUpload.single('file'), uploadPlanilhaCustos);

export default router;
