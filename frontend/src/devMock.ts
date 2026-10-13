// SCAFFOLDING TEMPORÁRIO — apenas para revisão visual local, com o banco de
// desenvolvimento vazio. Nunca roda fora de `npm run dev` + `?mock=1` na URL,
// e não é importado em lugar nenhum por padrão. Remover este arquivo e a
// linha de import em main.tsx assim que a revisão visual terminar.
import axios from 'axios';

const MOCK_FLAG = '__mockShortCircuit';

function matchMock(url: string): any | null {
    if (url.includes('/api/dashboard/inadimplencia/aging')) {
        return {
            totalAtraso: 184320.5,
            aging: { a_vencer: 96500, ate_30: 54200, de_31_a_60: 38600, de_61_a_90: 29040, mais_de_90: 62480 },
            topDevedores: [
                { cliente: 'Hospital Santa Clara', valorDevido: 42500 },
                { cliente: 'Convênio Vida Plena', valorDevido: 31200 },
                { cliente: 'Clínica BioSaúde', valorDevido: 24800 },
                { cliente: 'UPA Jardim das Flores', valorDevido: 18900 },
                { cliente: 'Convênio Saúde Total', valorDevido: 15600 },
                { cliente: 'Posto de Saúde Central', valorDevido: 8200 },
                { cliente: 'Clínica Vale Verde', valorDevido: 6100 },
                { cliente: 'Drogaria Bem Estar', valorDevido: 4300 },
                { cliente: 'Particular - J. Mendes', valorDevido: 3200 },
            ],
        };
    }
    if (url.includes('/api/dashboard/despesas/resumo-periodo')) {
        return {
            categorias: [
                { categoria: 'Reagentes e Insumos', totalAtual: 412000, totalAnterior: 378000 },
                { categoria: 'Pessoal Técnico', totalAtual: 356000, totalAnterior: 331000 },
                { categoria: 'Logística de Coleta', totalAtual: 98000, totalAnterior: 91000 },
                { categoria: 'Manutenção de Equipamentos', totalAtual: 64000, totalAnterior: 72000 },
                { categoria: 'Serviços Terceirizados', totalAtual: 51000, totalAnterior: 46000 },
            ],
        };
    }
    if (url.includes('/api/dashboard/despesas/caixa-bancos') && url.includes('year=')) {
        // Formato usado por Análise Avançada (EvolucaoMensal): um item por instituição.
        return {
            data: [
                { name: 'BTG Pactual', valor: 142000, color: '#0b6b76' },
                { name: 'Itaú', valor: 58000, color: '#059669' },
                { name: 'Santander', valor: 27000, color: '#d97706' },
            ],
            totalReceitas: 1284600,
            saldoLiquido: 303600,
        };
    }
    if (url.includes('/api/dashboard/despesas/caixa-bancos')) {
        // Formato usado por Visão Geral: busca o item "Recebido".
        return { data: [{ name: 'Recebido', valor: 1284600 }] };
    }
    if (url.includes('/api/dashboard/despesas/evolucao-mensal')) {
        const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
        const atual = [92000, 88000, 101000, 95000, 108000, 112000, 98000, 105000, 118000, 121000, 0, 0];
        const anterior = [81000, 79000, 86000, 90000, 93000, 97000, 88000, 91000, 99000, 104000, 96000, 92000];
        return { data: meses.map((mes, i) => ({ mes, anoAtual: atual[i], anoAnterior: anterior[i] })) };
    }
    if (url.includes('/api/dashboard/despesas/distribuicao-lucros')) {
        return {
            data: [
                { name: 'Pro-labore — Sócia Diretora', value: 42000, pct: 46.2 },
                { name: 'Pro-labore — Diretor Financeiro', value: 31000, pct: 34.1 },
                { name: 'Distribuição extraordinária', value: 18000, pct: 19.7 },
            ],
            totalDistribuido: 91000,
        };
    }
    if (url.includes('/api/dashboard/resultado/mensal')) {
        const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out'];
        const receitas = [98000, 102000, 115000, 108000, 121000, 126000, 112000, 118000, 132000, 136000];
        const despesas = [76000, 74000, 81000, 79000, 86000, 90000, 82000, 85000, 92000, 96000];
        return {
            data: meses.map((mes, i) => ({ mes, receitas: receitas[i], despesas: despesas[i], resultado: receitas[i] - despesas[i] })),
            resultadoAno: 268000,
        };
    }
    if (url.includes('/api/dashboard/resultado/receitas-tipo')) {
        return {
            data: [
                { nome: 'Convênios', valor: 612000, pct: 47.7 },
                { nome: 'Particular', valor: 318000, pct: 24.8 },
                { nome: 'SUS / Prefeitura', valor: 215000, pct: 16.7 },
                { nome: 'Empresas (Ocupacional)', valor: 139000, pct: 10.8 },
            ],
            total: 1284000,
        };
    }
    if (url.includes('/api/dashboard/resultado/outras-saidas')) {
        return {
            data: {
                receitas: 1284000,
                despesaOperacional: 712000,
                lucroFinOperacional: 572000,
                depositoJudicial: 18000,
                imobilizacoes: 42000,
                distribuicaoLucros: 91000,
                resultadoExercicio: 421000,
            },
        };
    }
    if (url.includes('/api/dashboard/indices')) {
        const serie = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10'].map((m, i) => ({
            mes: `2026-${m}`,
            receita: [98000, 102000, 115000, 108000, 121000, 126000, 112000, 118000, 132000, 136000][i],
            despesa: [76000, 74000, 81000, 79000, 86000, 90000, 82000, 85000, 92000, 96000][i],
        }));
        return {
            global: {
                despesaB: 712000, receitaB: 980000, receitaA: 860000, variacao: 14.8, deltaRS: 92000,
                resultadoB: 268000, margem: 27.3, cobertura: 1.38, runRate: 71000, projecaoAnual: 852000,
                caixa: { mesesDeCaixa: 3.2, saldoTotal: 227000, instituicoes: ['BTG Pactual', 'Itaú', 'Santander'] },
                ofensores: [
                    { categoria: 'Reagentes e Insumos', centroDeCusto: 'Laboratório Central', deltaRS: 38000, contribuicao: 41, variacao: 15.8 },
                    { categoria: 'Pessoal Técnico', centroDeCusto: 'Laboratório Central', deltaRS: 25000, contribuicao: 27, variacao: 11.9 },
                    { categoria: 'Serviços Terceirizados', centroDeCusto: 'Administrativo', deltaRS: 14000, contribuicao: 15, variacao: 35.0 },
                ],
                economias: [
                    { categoria: 'Manutenção de Equipamentos', centroDeCusto: 'Laboratório Central', deltaRS: -6000, variacao: -9.4 },
                    { categoria: 'Material de Escritório', centroDeCusto: 'Administrativo', deltaRS: -1200, variacao: -14.0 },
                ],
                concentracao: { top5: 78, top1: 32, itensPara80: 6, totalItens: 24 },
                difusao: { pctSubiram: 64, subiram: 16, cairam: 6, estaveis: 2, novas: 2, descontinuadas: 1 },
                pessoal: {
                    pctDespesa: 50, valorB: 356000, pctReceita: 36, variacao: 11.9,
                    categorias: ['Salários', 'Encargos', 'Benefícios', 'Férias', 'Rescisões'],
                },
                fornecedores: {
                    coberturaPct: 82, identificados: 18, top5: 61, top1: 22,
                    top: [
                        { fornecedor: 'Reagentes Brasil Ltda.', valorB: 118000, participacao: 22 },
                        { fornecedor: 'BioLab Distribuidora', valorB: 84000, participacao: 16 },
                        { fornecedor: 'MedSupply Comércio', valorB: 56000, participacao: 10 },
                        { fornecedor: 'TechCal Calibrações', valorB: 41000, participacao: 8 },
                        { fornecedor: 'Transporte Rápido Log.', valorB: 29000, participacao: 5 },
                    ],
                },
                serie,
            },
            porCC: [
                {
                    centroDeCusto: 'Laboratório Central', totalB: 712000, variacao: 14.8, peso: 56,
                    consumoReceita: 73, pessoalPct: 33, runRate: 59000, volatilidade: 22,
                    concentracao: { top5: 80 }, serie: [52000, 55000, 58000, 56000, 61000, 63000, 59000, 60000, 65000, 66000],
                    difusao: { subiram: 5, comparaveis: 8 },
                },
                {
                    centroDeCusto: 'Unidade Coleta — Centro', totalB: 298000, variacao: 14.6, peso: 23,
                    consumoReceita: 30, pessoalPct: 54, runRate: 25000, volatilidade: 18,
                    concentracao: { top5: 85 }, serie: [22000, 23000, 24000, 23500, 25000, 26000, 24500, 25000, 27000, 27500],
                    difusao: { subiram: 3, comparaveis: 5 },
                },
                {
                    centroDeCusto: 'Unidade Coleta — Zona Sul', totalB: 172000, variacao: 14.7, peso: 13,
                    consumoReceita: 18, pessoalPct: 55, runRate: 14300, volatilidade: 26,
                    concentracao: { top5: 82 }, serie: [13000, 13500, 14000, 13500, 14500, 15000, 14000, 14500, 15500, 16000],
                    difusao: { subiram: 2, comparaveis: 4 },
                },
                {
                    centroDeCusto: 'Administrativo', totalB: 102000, variacao: 13.3, peso: 8,
                    consumoReceita: 10, pessoalPct: 63, runRate: 8500, volatilidade: 15,
                    concentracao: { top5: 90 }, serie: [8000, 8200, 8500, 8300, 8800, 9000, 8600, 8800, 9400, 9700],
                    difusao: { subiram: 2, comparaveis: 3 },
                },
            ],
        };
    }
    if (url.includes('/api/sync/status')) {
        return { ultimoSync: { em: new Date(Date.now() - 3 * 3600_000).toISOString(), modo: 'automático' } };
    }
    if (url.includes('/api/dashboard/despesas/comparativo-cc')) {
        return {
            totais: { totalA: 1120000, totalB: 1284000 },
            porCC: [
                {
                    centroDeCusto: 'Laboratório Central', totalA: 620000, totalB: 712000, variacao: 14.8,
                    categorias: [
                        { categoria: 'Reagentes e Insumos', valorA: 240000, valorB: 278000, variacao: 15.8 },
                        { categoria: 'Pessoal Técnico', valorA: 210000, valorB: 235000, variacao: 11.9 },
                        { categoria: 'Materiais de Consumo', valorA: 72000, valorB: 81000, variacao: 12.5 },
                        { categoria: 'Manutenção de Equipamentos', valorA: 58000, valorB: 64000, variacao: 10.3 },
                        { categoria: 'Serviços Terceirizados', valorA: 40000, valorB: 54000, variacao: 35.0 },
                    ],
                },
                {
                    centroDeCusto: 'Unidade Coleta - Centro', totalA: 260000, totalB: 298000, variacao: 14.6,
                    categorias: [
                        { categoria: 'Pessoal de Coleta', valorA: 140000, valorB: 161000, variacao: 15.0 },
                        { categoria: 'Logística de Coleta', valorA: 70000, valorB: 79000, variacao: 12.9 },
                        { categoria: 'Materiais de Consumo', valorA: 50000, valorB: 58000, variacao: 16.0 },
                    ],
                },
                {
                    centroDeCusto: 'Unidade Coleta - Zona Sul', totalA: 150000, totalB: 172000, variacao: 14.7,
                    categorias: [
                        { categoria: 'Pessoal de Coleta', valorA: 82000, valorB: 94000, variacao: 14.6 },
                        { categoria: 'Logística de Coleta', valorA: 41000, valorB: 48000, variacao: 17.1 },
                        { categoria: 'Materiais de Consumo', valorA: 27000, valorB: 30000, variacao: 11.1 },
                    ],
                },
                {
                    centroDeCusto: 'Administrativo', totalA: 90000, totalB: 102000, variacao: 13.3,
                    categorias: [
                        { categoria: 'Pessoal Administrativo', valorA: 58000, valorB: 64000, variacao: 10.3 },
                        { categoria: 'Serviços Terceirizados', valorA: 20000, valorB: 24000, variacao: 20.0 },
                        { categoria: 'Infraestrutura e TI', valorA: 12000, valorB: 14000, variacao: 16.7 },
                    ],
                },
            ],
        };
    }
    return null;
}

axios.interceptors.request.use(config => {
    const mock = matchMock(config.url || '');
    if (mock) {
        const err: any = new Error('mock-short-circuit');
        err[MOCK_FLAG] = mock;
        throw err;
    }
    return config;
});

axios.interceptors.response.use(undefined, err => {
    if (err && err[MOCK_FLAG]) {
        return Promise.resolve({ data: err[MOCK_FLAG], status: 200, statusText: 'OK (mock)', headers: {}, config: err.config ?? {} });
    }
    return Promise.reject(err);
});

// eslint-disable-next-line no-console
console.info('[devMock] respostas simuladas ativas para revisão visual local.');
