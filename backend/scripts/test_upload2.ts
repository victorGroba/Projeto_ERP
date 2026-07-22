import { ImportacaoService } from '../src/services/importacaoService';
import path from 'path';
import fs from 'fs';

async function test() {
    const originalPath = path.resolve(__dirname, '../../relatorios-conta-azul/detalhe_analise_de_pagamentos (2).csv');
    const tempPath = path.resolve(__dirname, '../../relatorios-conta-azul/temp_upload2.csv');
    fs.copyFileSync(originalPath, tempPath);
    
    console.log('Testing CSV processing...');
    try {
        const result = await ImportacaoService.processarCSV(tempPath, 'RECEITAS');
        console.log('Result:', result);
    } catch (e) {
        console.error('Error:', e);
    }
}

test();
