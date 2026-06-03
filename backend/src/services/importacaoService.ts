import fs from 'fs';
import csv from 'csv-parser';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export class ImportacaoService {
    private static parseDate(dateStr?: string): Date | null {
        if (!dateStr || dateStr.trim() === '') return null;
        try {
            const parts = dateStr.trim().split('/');
            if (parts.length === 3) {
                const day = parseInt(parts[0], 10);
                const month = parseInt(parts[1], 10) - 1;
                const year = parseInt(parts[2], 10);
                return new Date(Date.UTC(year, month, day, 12, 0, 0));
            }
            const isoParts = dateStr.trim().split('-');
            if (isoParts.length === 3) {
                const year = parseInt(isoParts[0], 10);
                const month = parseInt(isoParts[1], 10) - 1;
                const day = parseInt(isoParts[2], 10);
                return new Date(Date.UTC(year, month, day, 12, 0, 0));
            }
            return null;
        } catch (e) {
            return null;
        }
    }

    private static parseCurrency(valueStr?: string | number): number {
        if (valueStr === undefined || valueStr === null) return 0;
        if (typeof valueStr === 'number') return valueStr;
        let cleaned = String(valueStr).trim();
        cleaned = cleaned.replace(/R\$\s?/g, '').trim();
        if (cleaned.includes(',')) {
            cleaned = cleaned.replace(/\./g, '');
            cleaned = cleaned.replace(',', '.');
        }
        const value = parseFloat(cleaned);
        return isNaN(value) ? 0 : value;
    }

    private static normalizeKey(header: string): string {
        return header
            .replace(/^\uFEFF/g, '')
            .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
            .replace(/\s+/g, '_')
            .trim()
            .toLowerCase();
    }

    private static getFlexValue(row: any, possibleKeys: string[]) {
        const rowKeys = Object.keys(row);
        for (const k of rowKeys) {
            if (possibleKeys.some(pK => k.includes(pK))) {
                return row[k];
            }
        }
        return null;
    }

    /**
     * Extrai "jan./25" e converte para Data (2025-01-01)
     */
    private static parseMonthHeaderToDate(header: string): Date | null {
        const match = header.match(/^(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)\.?\/(\d{2})$/);
        if (!match) return null;
        const [_, mesStr, anoStr] = match;
        const mesMap: Record<string, number> = {
            'jan': 0, 'fev': 1, 'mar': 2, 'abr': 3, 'mai': 4, 'jun': 5,
            'jul': 6, 'ago': 7, 'set': 8, 'out': 9, 'nov': 10, 'dez': 11
        };
        const month = mesMap[mesStr.toLowerCase()];
        const year = 2000 + parseInt(anoStr, 10);
        return new Date(Date.UTC(year, month, 1, 12, 0, 0));
    }

    static async processarCSV(filePath: string, tipo: string): Promise<any> {
        let inseridos = 0;
        let totalLidos = 0;

        try {
            const rawContent = fs.readFileSync(filePath, 'latin1');
            let fileLines = rawContent.split('\n');
            if (fileLines.length === 1 && rawContent.includes('\r')) {
                fileLines = rawContent.split('\r');
            }
            const firstLine = fileLines[0] || '';
            const countVirgula = (firstLine.match(/,/g) || []).length;
            const countPontoVirgula = (firstLine.match(/;/g) || []).length;
            const expectedSeparator = countPontoVirgula >= countVirgula ? ';' : ',';

            console.log(`[ETL] Detectado separador: '${expectedSeparator}' no arquivo tipo: ${tipo}`);

            const results: any[] = [];
            let headersList: string[] = [];

            const processStream = new Promise((resolve, reject) => {
                fs.createReadStream(filePath, { encoding: 'latin1' })
                    .pipe(csv({
                        separator: expectedSeparator,
                        mapHeaders: ({ header }) => {
                            const normalized = this.normalizeKey(header);
                            headersList.push(normalized);
                            return normalized;
                        }
                    }))
                    .on('data', (data) => results.push(data))
                    .on('end', () => resolve(results))
                    .on('error', (err) => reject(err));
            });

            const rows = await processStream as any[];
            totalLidos = rows.length;

            if (tipo === 'DESPESAS') {
                const registros: any[] = [];
                // Check if it's a matrix format (has columns like jan./25)
                const monthHeaders = headersList.filter(h => this.parseMonthHeaderToDate(h) !== null);
                
                if (monthHeaders.length > 0) {
                    console.log(`[ETL] Formato MATRIZ detectado. Desmembrando colunas de meses...`);
                    // Unpivot Matrix (Análise de Pagamentos)
                    for (const row of rows) {
                        const categoria = this.getFlexValue(row, ['categoria']) || 'Diversos';
                        if (categoria.toLowerCase().includes('total do per')) continue;
                        
                        const centro = this.getFlexValue(row, ['centro_de_custo', 'centro_custo']) || 'Geral';
                        
                        for (const monthHeader of monthHeaders) {
                            const valor = this.parseCurrency(row[monthHeader]);
                            if (valor !== 0) {
                                const dataPgto = this.parseMonthHeaderToDate(monthHeader);
                                if (dataPgto) {
                                    registros.push({
                                        tipo: 'DESPESA',
                                        descricao: categoria,
                                        fornecedor: 'N/A (Carga Matricial)',
                                        categoria: categoria,
                                        centroDeCusto: centro,
                                        contaBancaria: 'N/A',
                                        dataPagamento: dataPgto,
                                        valor: valor
                                    });
                                }
                            }
                        }
                    }
                } else {
                    console.log(`[ETL] Formato LISTA detectado.`);
                    // Lista Tradicional
                    for (const row of rows) {
                        const dataPgto = this.parseDate(this.getFlexValue(row, ['data_de_pagamento', 'pagamento', 'data']));
                        const categoria = this.getFlexValue(row, ['categoria', 'classificacao']) || 'Indefinida';
                        const centro = this.getFlexValue(row, ['centro_de_custo', 'centro_custo', 'projeto']) || 'Geral';
                        const valor = this.parseCurrency(this.getFlexValue(row, ['valor_liquidado', 'valor', 'total', 'valor_pago']));
                        let fornec = this.getFlexValue(row, ['fornecedor', 'cliente/fornecedor', 'pessoa']);
                        // Conta Azul sometimes merges columns
                        if (!fornec && row['nome_do_fornecedor']) fornec = row['nome_do_fornecedor'];
                        
                        const desc = this.getFlexValue(row, ['descricao', 'historico']) || fornec;

                        const conta = this.getFlexValue(row, ['conta', 'conta_bancaria', 'banco', 'caixa']) || 'Diversos';

                        registros.push({
                            tipo: 'DESPESA',
                            descricao: desc || 'Diversos',
                            fornecedor: fornec || 'Diversos',
                            categoria: categoria,
                            centroDeCusto: centro,
                            contaBancaria: conta,
                            dataPagamento: dataPgto || new Date(),
                            valor: Math.abs(valor) // Despesas são sempre positivas na base
                        });
                    }
                }

                // Filtrar e Inserir
                const registrosValidos = registros.filter(r => r.valor > 0);
                console.log(`[ETL] Registros validados para DESPESAS: ${registrosValidos.length}`);
                
                if (registrosValidos.length > 0) {
                    await prisma.lancamento.deleteMany({ where: { tipo: 'DESPESA' } }); // Full replace for Despesas only
                    const result = await prisma.lancamento.createMany({ data: registrosValidos });
                    inseridos = result.count;
                }

            } else if (tipo === 'RECEITAS') {
                const registros = rows.map(row => {
                    // Contas a Receber
                    const dataComp = this.parseDate(this.getFlexValue(row, ['data_de_competencia', 'competencia', 'emissao', 'data']));
                    const dataVenc = this.parseDate(this.getFlexValue(row, ['vencimento', 'data_de_vencimento', 'venc']));
                    const valor = this.parseCurrency(this.getFlexValue(row, ['valor_total', 'valor', 'saldo', 'valor_recebido']));
                    const status = this.getFlexValue(row, ['status', 'situacao', 'estado']) || 'VENCIDO';
                    const cli = this.getFlexValue(row, ['cliente', 'nome_do_cliente', 'pessoa']);
                    const grupo = this.getFlexValue(row, ['grupo', 'rede/grupo', 'rede', 'grupo_economico']) || 'Sem Grupo';
                    const desc = this.getFlexValue(row, ['descricao', 'historico', 'observacao']) || '';
                    const nf = this.getFlexValue(row, ['nota_fiscal', 'nf', 'n_nf']) || '';

                    return {
                        cliente: cli || 'Diversos',
                        grupo: grupo,
                        dataCompetencia: dataComp,
                        dataVencimento: dataVenc || new Date(),
                        valor: Math.abs(valor),
                        status: status,
                        descricao: desc,
                        numeroNotaFiscal: nf
                    };
                }).filter(r => r.valor > 0 && r.dataVencimento != null);

                console.log(`[ETL] Registros validados para RECEITAS: ${registros.length}`);

                if (registros.length > 0) {
                    await prisma.contaReceber.deleteMany(); // Full replace
                    const result = await prisma.contaReceber.createMany({ data: registros });
                    inseridos = result.count;
                }
            } else {
                throw new Error('Tipo não suportado. Use DESPESAS ou RECEITAS.');
            }

            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
            return { totalLido: rows.length, totalInserido: inseridos };

        } catch (error) {
            console.error('[ETL] Falha crítica:', error);
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
            throw error;
        }
    }
}
