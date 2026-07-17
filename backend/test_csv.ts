import { ImportacaoService } from './src/services/importacaoService';
import fs from 'fs';
import path from 'path';

const filePath = path.join(__dirname, '../relatorios-conta-azul/detalhe_analise_de_pagamentos (1).csv');

async function test() {
    try {
        console.log('Importando:', filePath);
        // Cria cópia pra não deletar original
        fs.copyFileSync(filePath, 'temp.csv');
        const result = await ImportacaoService.processarCSV('temp.csv', 'DESPESAS');
        console.log('Success:', result);
    } catch (e) {
        console.error('Error during CSV process:', e);
    }
}

test();
