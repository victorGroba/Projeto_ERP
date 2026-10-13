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
    if (url.includes('/api/dashboard/inadimplencia/comparativo')) {
        return {
            periodoA: { label: '01/01/2025 – 30/06/2025', totalAtraso: 142800, aVencer: 81200, aging: { mais_de_90: 38900 } },
            periodoB: { label: '01/01/2026 – 13/10/2026', totalAtraso: 184320.5, aVencer: 96500, aging: { mais_de_90: 62480 } },
            tabelaComparativa: [
                { cliente: 'Hospital Santa Clara (Grupo)', valorA: 35600, valorB: 42500, variacao: 19.4 },
                { cliente: 'Convênio Vida Plena', valorA: 28100, valorB: 31200, variacao: 11.0 },
                { cliente: 'Clínica BioSaúde', valorA: 26400, valorB: 24800, variacao: -6.1 },
                { cliente: 'UPA Jardim das Flores', valorA: 0, valorB: 18900, variacao: null },
                { cliente: 'Convênio Saúde Total', valorA: 19800, valorB: 15600, variacao: -21.2 },
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
    if (url.includes('/api/dashboard/relatorio-anual')) {
        const cc = (nome: string, categorias: { categoria: string; totalAnterior: number; totalAtual: number; variacao: number }[]) => {
            const totalAnterior = categorias.reduce((s, c) => s + c.totalAnterior, 0);
            const totalAtual = categorias.reduce((s, c) => s + c.totalAtual, 0);
            return { nome, categorias, total: { totalAnterior, totalAtual, variacao: (totalAtual - totalAnterior) / totalAnterior * 100 } };
        };
        const grupo = (centrosDeCusto: ReturnType<typeof cc>[]) => {
            const totalAnterior = centrosDeCusto.reduce((s, c) => s + c.total.totalAnterior, 0);
            const totalAtual = centrosDeCusto.reduce((s, c) => s + c.total.totalAtual, 0);
            return { centrosDeCusto, total: { totalAnterior, totalAtual, variacao: (totalAtual - totalAnterior) / totalAnterior * 100 } };
        };
        const entradasCategorias = [
            { categoria: 'Convênios', totalAnterior: 820000, totalAtual: 980000, variacao: 19.5 },
            { categoria: 'Particular', totalAnterior: 410000, totalAtual: 462000, variacao: 12.7 },
            { categoria: 'SUS / Prefeitura', totalAnterior: 260000, totalAtual: 298000, variacao: 14.6 },
            { categoria: 'Empresas (Ocupacional)', totalAnterior: 180000, totalAtual: 214000, variacao: 18.9 },
        ];
        const entradasTotal = {
            totalAnterior: entradasCategorias.reduce((s, c) => s + c.totalAnterior, 0),
            totalAtual: entradasCategorias.reduce((s, c) => s + c.totalAtual, 0),
            variacao: 17.0,
        };
        const materiaisServicos = grupo([
            cc('Laboratório Central', [
                { categoria: 'Reagentes e Insumos', totalAnterior: 240000, totalAtual: 278000, variacao: 15.8 },
                { categoria: 'Materiais de Consumo', totalAnterior: 72000, totalAtual: 81000, variacao: 12.5 },
            ]),
            cc('Unidade Coleta — Centro', [
                { categoria: 'Materiais de Consumo', totalAnterior: 50000, totalAtual: 58000, variacao: 16.0 },
            ]),
        ]);
        const despesas = grupo([
            cc('Laboratório Central', [
                { categoria: 'Pessoal Técnico', totalAnterior: 210000, totalAtual: 235000, variacao: 11.9 },
                { categoria: 'Manutenção de Equipamentos', totalAnterior: 58000, totalAtual: 64000, variacao: 10.3 },
                { categoria: 'Serviços Terceirizados', totalAnterior: 40000, totalAtual: 54000, variacao: 35.0 },
            ]),
            cc('Unidade Coleta — Centro', [
                { categoria: 'Pessoal de Coleta', totalAnterior: 140000, totalAtual: 161000, variacao: 15.0 },
                { categoria: 'Logística de Coleta', totalAnterior: 70000, totalAtual: 79000, variacao: 12.9 },
            ]),
            cc('Unidade Coleta — Zona Sul', [
                { categoria: 'Pessoal de Coleta', totalAnterior: 82000, totalAtual: 94000, variacao: 14.6 },
                { categoria: 'Logística de Coleta', totalAnterior: 41000, totalAtual: 48000, variacao: 17.1 },
            ]),
            cc('Administrativo', [
                { categoria: 'Pessoal Administrativo', totalAnterior: 58000, totalAtual: 64000, variacao: 10.3 },
                { categoria: 'Infraestrutura e TI', totalAnterior: 12000, totalAtual: 14000, variacao: 16.7 },
            ]),
        ]);
        const resAnterior = entradasTotal.totalAnterior - materiaisServicos.total.totalAnterior - despesas.total.totalAnterior;
        const resAtual = entradasTotal.totalAtual - materiaisServicos.total.totalAtual - despesas.total.totalAtual;
        return {
            anoAtual: 2026, anoAnterior: 2025,
            periodoAtual: { de: '2026-01-01', ate: '2026-10-13' },
            periodoAnterior: { de: '2025-01-01', ate: '2025-10-13' },
            entradas: { categorias: entradasCategorias, total: entradasTotal },
            materiaisServicos,
            despesas,
            resultadoOperacional: { totalAnterior: resAnterior, totalAtual: resAtual, variacao: (resAtual - resAnterior) / resAnterior * 100 },
        };
    }
    if (url.includes('/api/etl/historico')) {
        return [
            {
                id: 'etl-1', tipo: 'ENTRADAS', arquivoNome: 'entradas_2026.csv',
                dataInicio: '2026-01-01', dataFim: '2026-10-13', qtdRegistros: 842,
                createdAt: new Date(Date.now() - 2 * 86_400_000).toISOString(),
            },
            {
                id: 'etl-2', tipo: 'DESPESAS', arquivoNome: 'despesas_2026.csv',
                dataInicio: '2026-01-01', dataFim: '2026-10-13', qtdRegistros: 1203,
                createdAt: new Date(Date.now() - 2 * 86_400_000).toISOString(),
            },
        ];
    }
    if (url.includes('/api/clientes/servicos')) {
        const servicos = [
            { descricao: 'Análise Físico-Química — Água', estruturado: true, quantidade: 420, notas: 180, valorTotal: 186000, ticketMedio: 443, pctDoTotal: 0.28 },
            { descricao: 'Análise Microbiológica — Água', estruturado: true, quantidade: 310, notas: 150, valorTotal: 142000, ticketMedio: 458, pctDoTotal: 0.21 },
            { descricao: 'Monitoramento Ambiental Mensal', estruturado: true, quantidade: 96, notas: 96, valorTotal: 118000, ticketMedio: 1229, pctDoTotal: 0.18 },
            { descricao: 'Análise de Efluente Industrial', estruturado: true, quantidade: 64, notas: 58, valorTotal: 94000, ticketMedio: 1469, pctDoTotal: 0.14 },
            { descricao: 'Não classificado', estruturado: false, quantidade: 0, notas: 42, valorTotal: 52000, ticketMedio: 1238, pctDoTotal: 0.08 },
        ];
        return {
            periodo: { de: '2026-01-01', ate: '2026-10-13' }, grupo: null,
            notasConsideradas: servicos.reduce((s, x) => s + x.notas, 0),
            valorTotal: servicos.reduce((s, x) => s + x.valorTotal, 0),
            coberturaEstruturada: 0.92,
            servicos,
        };
    }
    if (url.includes('/api/clientes/faturamento-fiscal')) {
        return {
            importacoes: [
                { id: 'fis-1', competencia: '2026-09-01', arquivoNome: 'nfse_2026_09.csv', qtdNotas: 210, valorTotal: 142000, qtdNaoConciliadas: 3, createdAt: new Date(Date.now() - 5 * 86_400_000).toISOString() },
                { id: 'fis-2', competencia: '2026-08-01', arquivoNome: 'nfse_2026_08.csv', qtdNotas: 198, valorTotal: 128000, qtdNaoConciliadas: 1, createdAt: new Date(Date.now() - 35 * 86_400_000).toISOString() },
            ],
        };
    }
    if (url.includes('/api/clientes/sync/status')) {
        return { emAndamento: false };
    }
    if (url.includes('/api/clientes')) {
        let idSeq = 0;
        const cliente = (nomeEmpresa: string, faturamento: number, faturamentoAnterior: number, titulos: number, titulosAnterior: number, cidade: string, uf: string) => {
            idSeq += 1;
            const impostos = Math.round(faturamento * 0.08);
            const impostosAnterior = Math.round(faturamentoAnterior * 0.08);
            return {
                id: `cli-${idSeq}`, codigo: null, nome: nomeEmpresa, nomeEmpresa, documento: '12.345.678/0001-0' + idSeq,
                email: `financeiro@${nomeEmpresa.toLowerCase().replace(/[^a-z]+/g, '')}.com.br`, cidade, uf, ativo: true,
                faturamento, recebido: Math.round(faturamento * 0.85), aberto: Math.round(faturamento * 0.15), titulos, impostos,
                faturamentoAnterior, titulosAnterior, impostosAnterior,
            };
        };
        const grupo = (codigo: string | null, clientes: ReturnType<typeof cliente>[]) => {
            const soma = (campo: 'faturamento' | 'recebido' | 'aberto' | 'titulos' | 'impostos' | 'faturamentoAnterior' | 'titulosAnterior' | 'impostosAnterior') =>
                clientes.reduce((s, c) => s + c[campo], 0);
            return {
                codigo, clientes, faturamento: soma('faturamento'), recebido: soma('recebido'), aberto: soma('aberto'),
                titulos: soma('titulos'), impostos: soma('impostos'), faturamentoAnterior: soma('faturamentoAnterior'),
                titulosAnterior: soma('titulosAnterior'), impostosAnterior: soma('impostosAnterior'),
            };
        };
        const grupos = [
            grupo('GRP-001', [cliente('Hospital Santa Clara', 142000, 118000, 24, 20, 'Campinas', 'SP')]),
            grupo('GRP-002', [
                cliente('Convênio Vida Plena', 78000, 60000, 14, 12, 'Campinas', 'SP'),
                cliente('Convênio Vida Plena — Filial Centro', 20000, 16000, 4, 3, 'Campinas', 'SP'),
            ]),
            grupo('GRP-003', [cliente('Clínica BioSaúde', 54000, 68000, 12, 14, 'Valinhos', 'SP')]),
            grupo('GRP-004', [cliente('UPA Jardim das Flores', 46000, 0, 9, 0, 'Campinas', 'SP')]),
            grupo('GRP-005', [cliente('Convênio Saúde Total', 38000, 52000, 8, 10, 'Vinhedo', 'SP')]),
            grupo(null, [cliente('Posto de Saúde Central', 21000, 19000, 5, 5, 'Campinas', 'SP')]),
            grupo('GRP-006', [cliente('Clínica Vale Verde', 0, 24000, 0, 6, 'Valinhos', 'SP')]),
            grupo('GRP-007', [cliente('Drogaria Bem Estar', 15000, 15200, 4, 4, 'Campinas', 'SP')]),
        ];
        const somaGrupos = (campo: 'faturamento' | 'recebido' | 'aberto' | 'titulos' | 'impostos') => grupos.reduce((s, g) => s + g[campo], 0);
        const faturamentoAnteriorTotal = grupos.reduce((s, g) => s + g.faturamentoAnterior, 0);
        const impostosAnteriorTotal = grupos.reduce((s, g) => s + g.impostosAnterior, 0);
        const meses2026 = Array.from({ length: 10 }, (_, i) => `2026-${String(i + 1).padStart(2, '0')}`);
        const meses2025 = Array.from({ length: 10 }, (_, i) => `2025-${String(i + 1).padStart(2, '0')}`);
        const serieAtual = [92000, 88000, 101000, 95000, 108000, 112000, 98000, 105000, 118000, 121000];
        const serieAnterior = [81000, 79000, 86000, 90000, 93000, 97000, 88000, 91000, 99000, 104000];
        return {
            atualizadoEm: new Date(Date.now() - 3 * 3600_000).toISOString(),
            fiscal: {
                mesesImportados: meses2026, mesesEsperados: meses2026, mesesAusentes: [],
                notasNoPeriodo: somaGrupos('titulos'), naoConciliadasNoPeriodo: 4,
                ultimaImportacao: new Date(Date.now() - 5 * 86_400_000).toISOString(),
            },
            comparacao: {
                de: '2025-01-01', ate: '2025-10-13', mesesEsperados: meses2025, mesesImportados: meses2025, mesesAusentes: [],
                notasNoPeriodo: grupos.reduce((s, g) => s + g.titulosAnterior, 0),
                faturamento: faturamentoAnteriorTotal, impostos: impostosAnteriorTotal,
            },
            serieMensal: meses2026.map((mes, i) => ({ mes, mesAnterior: meses2025[i], atual: serieAtual[i], anterior: serieAnterior[i] })),
            resumo: {
                cadastros: grupos.reduce((s, g) => s + g.clientes.length, 0), grupos: grupos.length,
                semCodigo: grupos.filter(g => !g.codigo).length,
                faturamentoSemCodigo: grupos.filter(g => !g.codigo).reduce((s, g) => s + g.faturamento, 0),
                faturamento: somaGrupos('faturamento'), impostos: somaGrupos('impostos'),
                recebido: somaGrupos('recebido'), aberto: somaGrupos('aberto'), titulos: somaGrupos('titulos'),
            },
            grupos,
        };
    }
    if (url.includes('/api/dashboard/despesas/agrupado')) {
        const linhas: { categoria: string; centroDeCusto: string; totalAnual: number; totalAnterior: number }[] = [];
        const add = (centroDeCusto: string, categoria: string, totalAnterior: number, totalAnual: number) =>
            linhas.push({ categoria, centroDeCusto, totalAnual, totalAnterior });
        add('Laboratório Central', 'Reagentes e Insumos', 240000, 278000);
        add('Laboratório Central', 'Pessoal Técnico', 210000, 235000);
        add('Laboratório Central', 'Materiais de Consumo', 72000, 81000);
        add('Laboratório Central', 'Manutenção de Equipamentos', 58000, 64000);
        add('Laboratório Central', 'Serviços Terceirizados', 40000, 54000);
        add('Unidade Coleta — Centro', 'Pessoal de Coleta', 140000, 161000);
        add('Unidade Coleta — Centro', 'Logística de Coleta', 70000, 79000);
        add('Unidade Coleta — Centro', 'Materiais de Consumo', 50000, 58000);
        add('Unidade Coleta — Zona Sul', 'Pessoal de Coleta', 82000, 94000);
        add('Unidade Coleta — Zona Sul', 'Logística de Coleta', 41000, 48000);
        add('Unidade Coleta — Zona Sul', 'Materiais de Consumo', 27000, 30000);
        add('Administrativo', 'Pessoal Administrativo', 58000, 64000);
        add('Administrativo', 'Serviços Terceirizados', 20000, 24000);
        add('Administrativo', 'Infraestrutura e TI', 12000, 14000);
        return {
            data: linhas,
            filtro: { de: '2026-01-01', ate: '2026-10-13', deAnterior: '2025-01-01', ateAnterior: '2025-10-13' },
        };
    }
    if (url.includes('/api/dashboard/despesas/detalhe-por-cc')) {
        const bloco = (centroDeCusto: string, categorias: { categoria: string; anterior: number; atual: number }[]) => {
            const totalAnterior = categorias.reduce((s, c) => s + c.anterior, 0);
            const totalAtual = categorias.reduce((s, c) => s + c.atual, 0);
            return {
                centroDeCusto, totalAnterior, totalAtual,
                variacao: (totalAtual - totalAnterior) / totalAnterior,
                categorias: categorias.map(c => ({ ...c, variacao: c.anterior > 0 ? (c.atual - c.anterior) / c.anterior : 1 })),
            };
        };
        return {
            data: [
                bloco('Laboratório Central', [
                    { categoria: 'Reagentes e Insumos', anterior: 240000, atual: 278000 },
                    { categoria: 'Pessoal Técnico', anterior: 210000, atual: 235000 },
                    { categoria: 'Materiais de Consumo', anterior: 72000, atual: 81000 },
                    { categoria: 'Manutenção de Equipamentos', anterior: 58000, atual: 64000 },
                    { categoria: 'Serviços Terceirizados', anterior: 40000, atual: 54000 },
                ]),
                bloco('Unidade Coleta — Centro', [
                    { categoria: 'Pessoal de Coleta', anterior: 140000, atual: 161000 },
                    { categoria: 'Logística de Coleta', anterior: 70000, atual: 79000 },
                    { categoria: 'Materiais de Consumo', anterior: 50000, atual: 58000 },
                ]),
                bloco('Unidade Coleta — Zona Sul', [
                    { categoria: 'Pessoal de Coleta', anterior: 82000, atual: 94000 },
                    { categoria: 'Logística de Coleta', anterior: 41000, atual: 48000 },
                    { categoria: 'Materiais de Consumo', anterior: 27000, atual: 30000 },
                ]),
                bloco('Administrativo', [
                    { categoria: 'Pessoal Administrativo', anterior: 58000, atual: 64000 },
                    { categoria: 'Serviços Terceirizados', anterior: 20000, atual: 24000 },
                    { categoria: 'Infraestrutura e TI', anterior: 12000, atual: 14000 },
                ]),
            ],
        };
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

// ── Módulo de custeio laboratorial (custosApi usa fetch, não axios) ───────
function ensaio(id: string, nome: string, setor: string, total: number) {
    return {
        id, nome, codigoLims: null, metodologia: null, setor, percentualCQ: 15,
        custoPlanilha: null, origem: null, ativo: true, pendencia: null, observacao: null,
        qtdItens: 3,
        custo: { maoDeObra: total * 0.4, materiais: total * 0.45, equipamentos: total * 0.1, controleQualidade: total * 0.05, total, qtdAvisos: 0 },
    };
}

const MOCK_ENSAIOS = [
    ensaio('ens-dqo', 'DQO', 'FQ', 18.4),
    ensaio('ens-dbo', 'DBO', 'FQ', 24.1),
    ensaio('ens-ph', 'pH', 'FQ', 4.2),
    ensaio('ens-cloro', 'Cloro Residual', 'FQ', 6.8),
    ensaio('ens-turbidez', 'Turbidez', 'FQ', 5.1),
    ensaio('ens-coliformes', 'Coliformes Totais', 'MICRO', 22.5),
    ensaio('ens-ecoli', 'Escherichia coli', 'MICRO', 19.9),
    ensaio('ens-cpp', 'Contagem Padrão em Placas', 'MICRO', 15.3),
];

function grupoRef(ids: string[]) {
    const byId = new Map(MOCK_ENSAIOS.map(e => [e.id, e]));
    return ids.map(id => ({ ensaioId: id, ensaio: { nome: byId.get(id)!.nome, ativo: true } }));
}
function margemDe(precoVenda: number, ids: string[], aliquota = 0.08, extra: Partial<{ pendencia: string }> = {}) {
    const custoDireto = ids.reduce((acc, id) => acc + (MOCK_ENSAIOS.find(e => e.id === id)?.custo.total ?? 0), 0);
    const imposto = precoVenda * aliquota;
    const margemContribuicao = precoVenda - imposto - custoDireto;
    return {
        custoDireto, imposto, margemContribuicao,
        percentualMargem: precoVenda > 0 ? (margemContribuicao / precoVenda) * 100 : null,
        qtdAvisos: 0, avisos: [], ...extra,
    };
}

const MOCK_SERVICOS = [
    {
        id: 'srv-agua-rede', nome: 'Água de Rede', codigo: 'SRV-001', observacao: null, ativo: true,
        grupos: [
            {
                id: 'grp-agua-fq', servicoId: 'srv-agua-rede', nome: 'Água de Rede — Físico-Química', setor: 'FQ',
                precoVenda: 85, nomeAllims: null, pendencia: null,
                ensaios: grupoRef(['ens-dqo', 'ens-dbo', 'ens-ph', 'ens-cloro', 'ens-turbidez']),
                margem: margemDe(85, ['ens-dqo', 'ens-dbo', 'ens-ph', 'ens-cloro', 'ens-turbidez']),
            },
            {
                id: 'grp-agua-micro', servicoId: 'srv-agua-rede', nome: 'Água de Rede — Microbiologia', setor: 'MICRO',
                precoVenda: 62, nomeAllims: null, pendencia: null,
                ensaios: grupoRef(['ens-coliformes', 'ens-ecoli', 'ens-cpp']),
                margem: margemDe(62, ['ens-coliformes', 'ens-ecoli', 'ens-cpp']),
            },
        ],
    },
    {
        id: 'srv-efluente', nome: 'Efluente Industrial', codigo: 'SRV-002', observacao: null, ativo: true,
        grupos: [
            {
                id: 'grp-efluente', servicoId: 'srv-efluente', nome: 'Efluente — Completo', setor: 'FQ',
                precoVenda: 220, nomeAllims: null, pendencia: null,
                ensaios: grupoRef(['ens-dqo', 'ens-dbo', 'ens-ph', 'ens-cloro']),
                margem: margemDe(220, ['ens-dqo', 'ens-dbo', 'ens-ph', 'ens-cloro']),
            },
        ],
    },
    {
        id: 'srv-monitoramento', nome: 'Monitoramento Ambiental Mensal', codigo: 'SRV-003', observacao: null, ativo: true,
        grupos: [
            {
                id: 'grp-monitoramento', servicoId: 'srv-monitoramento', nome: 'Monitoramento — Padrão', setor: 'FQ',
                precoVenda: 150, nomeAllims: 'Monitoramento Mensal Padrão', pendencia: 'Confirmar se inclui coleta externa.',
                ensaios: grupoRef(['ens-turbidez', 'ens-ph']),
                margem: margemDe(150, ['ens-turbidez', 'ens-ph'], 0.08, { pendencia: 'Confirmar se inclui coleta externa.' }),
            },
        ],
    },
];

function matchFetchMock(pathname: string): any | null {
    if (pathname === '/api/custos/ensaios') return MOCK_ENSAIOS;
    if (pathname === '/api/custos/servicos') return MOCK_SERVICOS;
    if (pathname === '/api/custos/insumos') return [];
    if (pathname === '/api/custos/equipamentos') return [];
    return null;
}

const fetchOriginal = window.fetch.bind(window);
window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    const method = (init?.method || 'GET').toUpperCase();
    if (method === 'GET') {
        const pathname = new URL(url, window.location.origin).pathname;
        const mock = matchFetchMock(pathname);
        if (mock) {
            return new Response(JSON.stringify(mock), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }
    }
    return fetchOriginal(input, init);
};

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
