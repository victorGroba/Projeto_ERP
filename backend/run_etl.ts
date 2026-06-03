import { ImportacaoService } from './src/services/importacaoService';

async function run() {
    console.log("Iniciando injeção direta do CSV...");
    try {
        const result = await ImportacaoService.processarCSV('../frontend/detalhe_analise_de_pagamentos.csv', 'DESPESAS');
        console.log("SUCESSO:", result);
    } catch (e) {
        console.error("ERRO:", e);
    }
}

run();
