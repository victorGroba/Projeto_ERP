import { Router } from 'express';
import { getDespesasAgrupadas } from '../controllers/despesasController';
import { getInadimplenciaAging } from '../controllers/inadimplenciaCSVController';
import { getEvolucaoMensal } from '../controllers/evolucaoMensalController';
import { getDistribuicaoLucros } from '../controllers/distribuicaoLucrosController';
import { getCaixaBancos } from '../controllers/caixaBancosController';
import { getDetalhePorCC } from '../controllers/detalheController';
import { getResultadoMensal, getReceitasPorTipo, getOutrasSaidas } from '../controllers/resultadoController';
import { authMiddleware } from '../middlewares/authMiddleware';

const router = Router();

// Endpoint para o Gráfico de Barras Empilhado YoY (Pareto por Categoria/CC)
router.get('/despesas/agrupado', authMiddleware, getDespesasAgrupadas);

// Endpoint para Evolução Mensal Comparativa (Ano Atual vs Anterior)
router.get('/despesas/evolucao-mensal', authMiddleware, getEvolucaoMensal);

// Endpoint para Distribuição de Lucros por Sócio
router.get('/despesas/distribuicao-lucros', authMiddleware, getDistribuicaoLucros);

// Endpoint para Posição de Caixa e Bancos
router.get('/despesas/caixa-bancos', authMiddleware, getCaixaBancos);

// Endpoint para o Gráfico de Pizza (Aging) e Top Devedores
router.get('/inadimplencia/aging', authMiddleware, getInadimplenciaAging);

// Endpoint para o Detalhamento por Centro de Custo (accordion)
router.get('/despesas/detalhe-por-cc', authMiddleware, getDetalhePorCC);

// Endpoints do bloco de Resultado (replicam a planilha GRAFICOS)
router.get('/resultado/mensal', authMiddleware, getResultadoMensal);
router.get('/resultado/receitas-tipo', authMiddleware, getReceitasPorTipo);
router.get('/resultado/outras-saidas', authMiddleware, getOutrasSaidas);

export default router;
