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
    if (url.includes('/api/dashboard/despesas/caixa-bancos')) {
        return { data: [{ name: 'Recebido', valor: 1284600 }] };
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
