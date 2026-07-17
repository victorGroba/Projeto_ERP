import fs from 'fs';
import csv from 'csv-parser';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const filePath = '../relatorios-conta-azul/detalhe_analise_de_pagamentos (1).csv';

function parseCurrency(valueStr: string): number {
    if (!valueStr) return 0;
    let cleaned = String(valueStr).trim().replace(/R\$\s?/g, '').trim();
    if (cleaned.includes(',')) {
        cleaned = cleaned.replace(/\./g, '');
        cleaned = cleaned.replace(',', '.');
    }
    const value = parseFloat(cleaned);
    return isNaN(value) ? 0 : value;
}

function parseMonthHeader(header: string): string | null {
    const match = header.match(/^(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)\.?\/(\d{2})$/);
    if (!match) return null;
    const [_, mesStr, anoStr] = match;
    const mesMap: Record<string, string> = {
        'jan': '01', 'fev': '02', 'mar': '03', 'abr': '04', 'mai': '05', 'jun': '06',
        'jul': '07', 'ago': '08', 'set': '09', 'out': '10', 'nov': '11', 'dez': '12'
    };
    return `20${anoStr}-${mesMap[mesStr.toLowerCase()]}`;
}

async function run() {
    const csvData = new Map<string, number>();
    const rows: any[] = await new Promise((resolve, reject) => {
        const results: any[] = [];
        fs.createReadStream(filePath, { encoding: 'latin1' })
            .pipe(csv({ separator: ';' }))
            .on('data', data => results.push(data))
            .on('end', () => resolve(results))
            .on('error', reject);
    });

    for (const row of rows) {
        const centro = (row['Centro de custo'] || 'Geral').trim();
        const categoria = (row['Categoria'] || 'Diversos').trim();
        if (centro.toLowerCase().includes('total do per')) continue;
        
        for (const k of Object.keys(row)) {
            const yyyymm = parseMonthHeader(k.trim().toLowerCase());
            if (yyyymm) {
                const valor = parseCurrency(row[k]);
                if (valor !== 0) {
                    const key = `${centro}|${categoria}|${yyyymm}`;
                    csvData.set(key, (csvData.get(key) || 0) + valor);
                }
            }
        }
    }

    const dbData = new Map<string, number>();
    const lancamentos = await prisma.lancamento.findMany({
        where: { tipo: 'DESPESA' }
    });

    for (const l of lancamentos) {
        const cc = (l.centroDeCusto || 'Geral').trim();
        const cat = (l.categoria || 'Diversos').trim();
        const date = new Date(l.dataPagamento);
        if (date.getUTCFullYear() !== 2026) continue;
        const yyyymm = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
        const key = `${cc}|${cat}|${yyyymm}`;
        dbData.set(key, (dbData.get(key) || 0) + l.valor);
    }

    const allKeys = new Set([...csvData.keys(), ...dbData.keys()]);
    let diffCount = 0;
    let sumCsv = 0;
    let sumDb = 0;

    const csvByCat = new Map<string, number>();
    for (const [k, v] of csvData.entries()) {
        const [, cat, yyyymm] = k.split('|');
        const key = `${cat}|${yyyymm}`;
        csvByCat.set(key, (csvByCat.get(key) || 0) + v);
    }

    const dbByCat = new Map<string, number>();
    for (const [k, v] of dbData.entries()) {
        const [, cat, yyyymm] = k.split('|');
        const key = `${cat}|${yyyymm}`;
        dbByCat.set(key, (dbByCat.get(key) || 0) + v);
    }

    console.log(`================ DIAGNÓSTICO POR CATEGORIA ================`);
    const allCatKeys = new Set([...csvByCat.keys(), ...dbByCat.keys()]);
    for (const key of Array.from(allCatKeys).sort()) {
        const valCsv = csvByCat.get(key) || 0;
        const valDb = dbByCat.get(key) || 0;
        const diff = Math.abs(valCsv - valDb);
        if (diff > 0.01) {
            console.log(`[${key}]:\n   CSV = R$ ${valCsv.toFixed(2)}\n   API = R$ ${valDb.toFixed(2)}\n   DIF = R$ ${diff.toFixed(2)}\n`);
        }
    }

    console.log(`================ DIAGNÓSTICO DETALHADO ================`);
    for (const key of Array.from(allKeys).sort()) {
        const valCsv = csvData.get(key) || 0;
        const valDb = dbData.get(key) || 0;
        sumCsv += valCsv;
        sumDb += valDb;
        const diff = Math.abs(valCsv - valDb);
        if (diff > 0.01) {
            console.log(`[${key}]:\n   CSV = R$ ${valCsv.toFixed(2)}\n   API = R$ ${valDb.toFixed(2)}\n   DIF = R$ ${diff.toFixed(2)}\n`);
            diffCount++;
        }
    }
    console.log(`Total CSV: R$ ${sumCsv.toFixed(2)}`);
    console.log(`Total API: R$ ${sumDb.toFixed(2)}`);
    console.log(`Total de combinações com diferença: ${diffCount}`);
}

run().catch(console.error);
