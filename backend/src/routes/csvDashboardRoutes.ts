import { Router } from 'express';
import { getDespesasAgrupadas } from '../controllers/despesasController';
import { getInadimplenciaAging } from '../controllers/inadimplenciaCSVController';
import { getEvolucaoMensal } from '../controllers/evolucaoMensalController';
import { getDistribuicaoLucros } from '../controllers/distribuicaoLucrosController';
import { getCaixaBancos } from '../controllers/caixaBancosController';
import { getDetalhePorCC } from '../controllers/detalheController';
import { getResultadoMensal, getReceitasPorTipo, getOutrasSaidas } from '../controllers/resultadoController';
import { getResumoDespesasPeriodo } from '../controllers/resumoPeriodoController';
import { getDevedoresDetalhe } from '../controllers/inadimplenciaDetalheController';
import { getComparativoInadimplencia } from '../controllers/inadimplenciaComparativoController';
import { getComparativoCC } from '../controllers/comparativoCCController';
import { getIndicadoresApi } from '../controllers/apiContaAzulController';
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
router.get('/inadimplencia/aging',          authMiddleware, getInadimplenciaAging);
router.get('/inadimplencia/devedores-detalhe', authMiddleware, getDevedoresDetalhe);
router.get('/inadimplencia/comparativo',    authMiddleware, getComparativoInadimplencia);

// Endpoint para o Detalhamento por Centro de Custo (accordion)
router.get('/despesas/detalhe-por-cc', authMiddleware, getDetalhePorCC);

// Comparativo CC × Período A vs B
router.get('/despesas/comparativo-cc', authMiddleware, getComparativoCC);

// Resumo de despesas por categoria para período customizado (Visão Geral)
router.get('/despesas/resumo-periodo', authMiddleware, getResumoDespesasPeriodo);

// Endpoints do bloco de Resultado (replicam a planilha GRAFICOS)
router.get('/resultado/mensal', authMiddleware, getResultadoMensal);
router.get('/resultado/receitas-tipo', authMiddleware, getReceitasPorTipo);
router.get('/resultado/outras-saidas', authMiddleware, getOutrasSaidas);

// Indicadores buscados ao vivo na API v2 do Conta Azul (aba "API")
router.get('/conta-azul/indicadores', authMiddleware, getIndicadoresApi);

export default router;
