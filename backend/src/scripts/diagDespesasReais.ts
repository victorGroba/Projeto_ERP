import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { ContaAzulAPI } from '../services/contaAzulApi';

const prisma = new PrismaClient();

const WHITELIST_RAW = [
    'Banco do Brasil CC Lab',
    'BB Rende Fácil',
    'Banco Itaú - Aplicação CDB',
    'Banco Itaú - Aplicações Trust DI',
    'BTG CC Digital',
    'BTG Pactual',
    'Itaú - CC Lab',
    'Santander - CC Lab Rio',
    'Santander - Conta Max',
    'XP Investimento',
    'Depósito Judicial - processo ISS',
];

function normalize(s: string): string {
    return s
        .normalize('NFD').replace(/[̀-ͯ]/g, '') // remove acentos
        .toLowerCase()
        .replace(/[\/\-]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

const WHITELIST_NORM = new Set(WHITELIST_RAW.map(normalize));

async function getAPI(): Promise<ContaAzulAPI> {
    const [accessCfg, refreshCfg] = await Promise.all([
        prisma.appConfig.findUnique({ where: { key: 'access_token_rj' } }),
        prisma.appConfig.findUnique({ where: { key: 'refresh_token_rj' } }),
    ]);
    return new ContaAzulAPI(
        accessCfg?.value || process.env.CONTA_AZUL_ACCESS_TOKEN_RJ || '',
        refreshCfg?.value || process.env.CONTA_AZUL_REFRESH_TOKEN_RJ || '',
        process.env.CONTA_AZUL_CLIENT_ID_RJ || '',
        process.env.CONTA_AZUL_CLIENT_SECRET_RJ || '',
    );
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function paginateAll(fetchFn: (page: number) => Promise<any>): Promise<any[]> {
    const allItems: any[] = [];
    let page = 1;
    let totalRegistros = Infinity;
    while (allItems.length < totalRegistros) {
        if (page > 1) await sleep(300);
        const data = await fetchFn(page);
        const items = data?.itens || [];
        if (items.length === 0) break;
        if (page === 1) totalRegistros = data?.itens_totais ?? items.length;
        allItems.push(...items);
        if (allItems.length >= totalRegistros) break;
        page++;
        if (page % 20 === 0) console.log(`  ...pagina ${page}, ${allItems.length}/${totalRegistros}`);
    }
    return allItems;
}

async function main() {
    const inicio = '2025-01-01';
    const fim = new Date().toISOString().split('T')[0];
    // A API so filtra por data_vencimento/data_competencia, nao por data_pagamento.
    // Um titulo vencido em 2024 pode ter sido pago dentro do periodo 2025-01-01..hoje,
    // entao buscamos um range de vencimento bem mais largo e filtramos por data_pagamento no client.
    const buscaInicio = '2015-01-01';
    console.log(`Buscando contas a pagar (vencimento ${buscaInicio} ate ${fim}), filtrando por PAGAMENTO em ${inicio}..${fim}...`);

    const api = await getAPI();
    const items = await paginateAll(page =>
        api.getContasAPagar({ dataVencimentoInicio: buscaInicio, dataVencimentoFim: fim, pagina: page, tamanhoPagina: 200 })
    );
    console.log(`Total de itens retornados (filtro por VENCIMENTO): ${items.length}`);

    const statusSet = new Set<string>();
    const contaSet = new Set<string>();
    items.forEach((item: any) => {
        statusSet.add(item.status_traduzido ?? JSON.stringify(item.status));
        contaSet.add(item.conta_financeira?.nome ?? '(sem conta)');
    });

    console.log('\n=== Valores distintos de status_traduzido ===');
    console.log([...statusSet]);

    console.log('\n=== Contas financeiras distintas encontradas ===');
    [...contaSet].sort().forEach(c => {
        const match = WHITELIST_NORM.has(normalize(c));
        console.log(`  ${match ? '[OK]' : '[??]'} ${c}`);
    });

    console.log('\n=== Contas da whitelist que NAO apareceram nos dados ===');
    const contasNormEncontradas = new Set([...contaSet].map(normalize));
    WHITELIST_RAW.forEach(w => {
        if (!contasNormEncontradas.has(normalize(w))) console.log(`  [FALTOU] ${w}`);
    });

    // Soma bruta considerando data_pagamento dentro do periodo (client-side, ja que a API filtra por vencimento)
    let somaQuitadoWhitelistPorPagamento = 0;
    let somaQuitadoWhitelistPorVencimento = 0;
    let somaTodosQuitados = 0;
    const statusQuitadoCandidatos = ['PAGO', 'QUITADO', 'PAID'];

    items.forEach((item: any) => {
        const status = (item.status_traduzido || '').toUpperCase();
        const isQuitado = statusQuitadoCandidatos.includes(status);
        const contaNome = item.conta_financeira?.nome || '';
        const isWhitelist = WHITELIST_NORM.has(normalize(contaNome));
        const valor = Math.abs(item.total ?? item.valor ?? 0);

        if (isQuitado) somaTodosQuitados += valor;

        if (isQuitado && isWhitelist) {
            somaQuitadoWhitelistPorVencimento += valor;

            const dataPagto = item.data_pagamento || item.data_baixa;
            if (dataPagto) {
                const d = dataPagto.split('T')[0];
                if (d >= inicio && d <= fim) somaQuitadoWhitelistPorPagamento += valor;
            }
        }
    });

    console.log('\n=== Somas calculadas ===');
    console.log(`Alvo (Conta Azul, Extrato de Movimentacao): R$ 6.246.089,02`);
    console.log(`Soma TODOS quitados (sem filtro de conta):   R$ ${somaTodosQuitados.toFixed(2)}`);
    console.log(`Soma quitados + whitelist (por VENCIMENTO):  R$ ${somaQuitadoWhitelistPorVencimento.toFixed(2)}`);
    console.log(`Soma quitados + whitelist (por PAGAMENTO):   R$ ${somaQuitadoWhitelistPorPagamento.toFixed(2)}`);

    console.log('\n=== Exemplo de item bruto (para checar campos disponiveis) ===');
    console.log(JSON.stringify(items[0], null, 2));

    await prisma.$disconnect();
}

main().catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
});
