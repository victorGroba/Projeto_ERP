import fs from 'fs';
import path from 'path';
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
        // 1a passada: match exato, respeitando a ordem de prioridade dos aliases
        for (const pK of possibleKeys) {
            if (rowKeys.includes(pK)) return row[pK];
        }
        // 2a passada: match parcial, tambem na ordem de prioridade dos aliases
        // (antes iterava as colunas do arquivo, entao a 1a coluna do CSV vencia
        //  mesmo casando com um alias de baixa prioridade — ex: 'valor_total_geral')
        for (const pK of possibleKeys) {
            const hit = rowKeys.find(k => k.includes(pK));
            if (hit) return row[hit];
        }
        return null;
    }

    /**
     * Normaliza o status de um titulo a receber para o vocabulario canonico
     * usado tambem pelo sync da API: 'Pago' | 'Vencido' | 'A Vencer' | 'Cancelado'.
     * Retorna null quando o status esta ausente ou nao e reconhecido — a linha
     * deve ser descartada, nunca assumida como inadimplente.
     */
    private static normalizeStatusReceita(statusStr: string | null, dataVencimento: Date): string | null {
        const s = String(statusStr || '')
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .replace(/\s+/g, ' ')
            .trim()
            .toUpperCase();
        if (!s) return null;
        if (['RECEBIDO', 'PAGO', 'PAID', 'BAIXADO', 'LIQUIDADO', 'QUITADO'].includes(s)) return 'Pago';
        if (['CANCELADO', 'ESTORNADO'].includes(s)) return 'Cancelado';
        if (s.includes('VENC') || s.includes('ABERTO') || s.includes('PENDENTE') || s.includes('ATRAS')) {
            return dataVencimento < new Date() ? 'Vencido' : 'A Vencer';
        }
        return null;
    }

    /** Detecta linhas de totalizador do relatorio ("Total", "Subtotal", "Total do periodo"...). */
    private static isLinhaTotalizadora(...campos: (string | null)[]): boolean {
        return campos.some(c => /^(sub)?totais?\b|^total d[oae]\b/i.test(
            String(c || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()
        ));
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
        const descartados: Record<string, number> = {};

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
                        const centro = this.getFlexValue(row, ['centro_de_custo', 'centro_custo']) || 'Geral';
                        if (categoria.toLowerCase().includes('total do per') || centro.toLowerCase().includes('total do per')) continue;
                        
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

                        // Rodapes e subtotais do relatorio nao sao lancamentos.
                        if (this.isLinhaTotalizadora(categoria, fornec, desc)) {
                            descartados['linha de totalizador do relatorio'] = (descartados['linha de totalizador do relatorio'] || 0) + 1;
                            continue;
                        }
                        // Sem data de pagamento a despesa era carimbada com "hoje", caindo no
                        // mes errado e distorcendo qualquer comparativo por periodo.
                        if (!dataPgto) {
                            descartados['sem data de pagamento valida'] = (descartados['sem data de pagamento valida'] || 0) + 1;
                            continue;
                        }

                        registros.push({
                            tipo: 'DESPESA',
                            descricao: desc || 'Diversos',
                            fornecedor: fornec || 'Diversos',
                            categoria: categoria,
                            centroDeCusto: centro,
                            contaBancaria: conta,
                            dataPagamento: dataPgto,
                            valor: Math.abs(valor) // Despesas são sempre positivas na base
                        });
                    }
                }

                // Filtrar e Inserir
                const registrosValidos = registros.filter(r => r.valor > 0);
                console.log(`[ETL] Registros validados para DESPESAS: ${registrosValidos.length}`);
                if (Object.keys(descartados).length > 0) {
                    console.warn('[ETL] Linhas descartadas em DESPESAS:', descartados);
                }
                if (rows.length > 0 && registrosValidos.length < rows.length * 0.5 && monthHeaders.length === 0) {
                    throw new Error(
                        `Arquivo rejeitado: apenas ${registrosValidos.length} de ${rows.length} linhas sao lancamentos validos. ` +
                        `Motivos: ${Object.entries(descartados).map(([m, q]) => `${m} (${q})`).join('; ') || 'valor zerado ou nao numerico'}. ` +
                        `Verifique se o CSV e o relatorio de despesas e se tem as colunas de data de pagamento e valor.`
                    );
                }
                
                if (registrosValidos.length > 0) {
                    const minDate = new Date(Math.min(...registrosValidos.map(r => r.dataPagamento.getTime())));
                    const maxDate = new Date(Math.max(...registrosValidos.map(r => r.dataPagamento.getTime())));
                    
                    const start = new Date(Date.UTC(minDate.getUTCFullYear(), minDate.getUTCMonth(), 1));
                    const end = new Date(Date.UTC(maxDate.getUTCFullYear(), maxDate.getUTCMonth() + 1, 0, 23, 59, 59));

                    console.log(`[ETL] Substituindo DESPESAS no período: ${start.toISOString()} até ${end.toISOString()}`);
                    
                    await prisma.lancamento.deleteMany({ 
                        where: { 
                            tipo: 'DESPESA',
                            dataPagamento: { gte: start, lte: end }
                        } 
                    });

                    const historico = await prisma.historicoImportacao.create({
                        data: {
                            tipo: 'DESPESAS',
                            arquivoNome: path.basename(filePath),
                            dataInicio: start,
                            dataFim: end,
                            qtdRegistros: registrosValidos.length
                        }
                    });

                    const registrosComImportacaoId = registrosValidos.map(r => ({ ...r, importacaoId: historico.id }));

                    const result = await prisma.lancamento.createMany({ data: registrosComImportacaoId });
                    inseridos = result.count;
                }

            } else if (tipo === 'RECEITAS') {
                const descartar = (motivo: string) => {
                    descartados[motivo] = (descartados[motivo] || 0) + 1;
                    return null;
                };

                const registros = rows.map(row => {
                    // Contas a Receber
                    const dataComp = this.parseDate(this.getFlexValue(row, ['data_de_competencia', 'competencia', 'emissao', 'data']));
                    const dataVenc = this.parseDate(this.getFlexValue(row, ['vencimento', 'data_de_vencimento', 'venc']));
                    const valor = this.parseCurrency(this.getFlexValue(row, ['valor_total', 'valor', 'saldo', 'valor_recebido']));
                    const statusBruto = this.getFlexValue(row, ['status', 'situacao', 'estado']);
                    const cli = this.getFlexValue(row, ['cliente', 'nome_do_cliente', 'pessoa']);
                    const grupo = this.getFlexValue(row, ['grupo', 'rede/grupo', 'rede', 'grupo_economico']) || 'Sem Grupo';
                    const desc = this.getFlexValue(row, ['descricao', 'historico', 'observacao']) || '';
                    const nf = this.getFlexValue(row, ['nota_fiscal', 'nf', 'n_nf']) || '';

                    // Rodapes e subtotais do relatorio nao sao titulos.
                    if (this.isLinhaTotalizadora(cli, desc)) return descartar('linha de totalizador do relatorio');
                    // Sem vencimento nao da para dizer se esta vencido — antes virava "hoje",
                    // o que jogava a linha direto para o balde de inadimplencia.
                    if (!dataVenc) return descartar('sem data de vencimento valida');
                    // Sem status reconhecido nao da para dizer se esta em aberto — antes
                    // assumia 'VENCIDO', inflando a inadimplencia com titulos ja quitados.
                    const status = this.normalizeStatusReceita(statusBruto, dataVenc);
                    if (!status) {
                        return descartar(statusBruto
                            ? `status nao reconhecido ("${String(statusBruto).trim()}")`
                            : 'sem coluna de status');
                    }
                    if (status === 'Cancelado') return descartar('titulo cancelado');
                    if (!(Math.abs(valor) > 0)) return descartar('valor zerado ou nao numerico');

                    return {
                        cliente: cli || 'Diversos',
                        grupo: grupo,
                        dataCompetencia: dataComp,
                        dataVencimento: dataVenc,
                        valor: Math.abs(valor),
                        status: status,
                        descricao: desc,
                        numeroNotaFiscal: nf
                    };
                }).filter((r): r is NonNullable<typeof r> => r !== null);

                console.log(`[ETL] Registros validados para RECEITAS: ${registros.length}`);
                if (Object.keys(descartados).length > 0) {
                    console.warn('[ETL] Linhas descartadas em RECEITAS:', descartados);
                }
                // Se o layout do arquivo nao bate com nenhum alias conhecido, quase tudo
                // e descartado. Melhor falhar alto do que gravar uma carga sem sentido.
                if (rows.length > 0 && registros.length < rows.length * 0.5) {
                    throw new Error(
                        `Arquivo rejeitado: apenas ${registros.length} de ${rows.length} linhas sao titulos validos. ` +
                        `Motivos: ${Object.entries(descartados).map(([m, q]) => `${m} (${q})`).join('; ')}. ` +
                        `Verifique se o CSV e o relatorio de Contas a Receber e se tem as colunas de vencimento, valor e status.`
                    );
                }

                if (registros.length > 0) {
                    const minDate = new Date(Math.min(...registros.map(r => r.dataVencimento.getTime())));
                    const maxDate = new Date(Math.max(...registros.map(r => r.dataVencimento.getTime())));
                    
                    const start = new Date(Date.UTC(minDate.getUTCFullYear(), minDate.getUTCMonth(), 1));
                    const end = new Date(Date.UTC(maxDate.getUTCFullYear(), maxDate.getUTCMonth() + 1, 0, 23, 59, 59));

                    console.log(`[ETL] Substituindo RECEITAS com vencimento no período: ${start.toISOString()} até ${end.toISOString()}`);
                    
                    // O CSV passa a ser a verdade do periodo: apaga tudo na faixa (inclusive o
                    // que veio do sync da API) para nao duplicar titulos e inflar a inadimplencia.
                    const daApi = await prisma.contaReceber.count({
                        where: { dataVencimento: { gte: start, lte: end }, importacaoId: null }
                    });
                    if (daApi > 0) {
                        console.warn(`[ETL] ${daApi} titulos vindos do sync da API serao substituidos pelo CSV neste periodo. Rode o sync novamente se quiser reverter.`);
                    }

                    await prisma.contaReceber.deleteMany({
                        where: {
                            dataVencimento: { gte: start, lte: end }
                        }
                    });

                    const historico = await prisma.historicoImportacao.create({
                        data: {
                            tipo: 'RECEITAS',
                            arquivoNome: path.basename(filePath),
                            dataInicio: start,
                            dataFim: end,
                            qtdRegistros: registros.length
                        }
                    });

                    const registrosComImportacaoId = registros.map(r => ({ ...r, importacaoId: historico.id }));

                    const result = await prisma.contaReceber.createMany({ data: registrosComImportacaoId });
                    inseridos = result.count;
                }
            } else if (tipo === 'ENTRADAS') {
                const registros: any[] = [];
                const monthHeaders = headersList.filter(h => this.parseMonthHeaderToDate(h) !== null);

                if (monthHeaders.length > 0) {
                    console.log(`[ETL] Formato MATRIZ detectado para ENTRADAS.`);
                    for (const row of rows) {
                        const categoria = this.getFlexValue(row, ['categoria']) || 'Receitas';
                        if (categoria.toLowerCase().includes('total do per')) continue;

                        for (const monthHeader of monthHeaders) {
                            const valor = this.parseCurrency(row[monthHeader]);
                            if (valor !== 0) {
                                const dataPgto = this.parseMonthHeaderToDate(monthHeader);
                                if (dataPgto) {
                                    registros.push({
                                        tipo: 'RECEITA',
                                        descricao: categoria,
                                        fornecedor: 'N/A',
                                        categoria: categoria,
                                        centroDeCusto: 'N/A',
                                        contaBancaria: 'N/A',
                                        dataPagamento: dataPgto,
                                        valor: Math.abs(valor)
                                    });
                                }
                            }
                        }
                    }
                } else {
                    console.log(`[ETL] Formato LISTA detectado para ENTRADAS.`);
                    for (const row of rows) {
                        const dataPgto = this.parseDate(this.getFlexValue(row, ['data_de_pagamento', 'pagamento', 'data', 'data_de_recebimento', 'recebimento']));
                        const categoria = this.getFlexValue(row, ['categoria', 'classificacao', 'tipo']) || 'Receitas';
                        const valor = this.parseCurrency(this.getFlexValue(row, ['valor_liquidado', 'valor', 'total', 'valor_recebido', 'valor_pago']));
                        const desc = this.getFlexValue(row, ['descricao', 'historico']) || categoria;

                        registros.push({
                            tipo: 'RECEITA',
                            descricao: desc,
                            fornecedor: 'N/A',
                            categoria: categoria,
                            centroDeCusto: 'N/A',
                            contaBancaria: 'N/A',
                            dataPagamento: dataPgto || new Date(),
                            valor: Math.abs(valor)
                        });
                    }
                }

                const registrosValidos = registros.filter(r => r.valor > 0);
                console.log(`[ETL] Registros validados para ENTRADAS: ${registrosValidos.length}`);

                if (registrosValidos.length > 0) {
                    const minDate = new Date(Math.min(...registrosValidos.map(r => r.dataPagamento.getTime())));
                    const maxDate = new Date(Math.max(...registrosValidos.map(r => r.dataPagamento.getTime())));

                    const start = new Date(Date.UTC(minDate.getUTCFullYear(), minDate.getUTCMonth(), 1));
                    const end = new Date(Date.UTC(maxDate.getUTCFullYear(), maxDate.getUTCMonth() + 1, 0, 23, 59, 59));

                    console.log(`[ETL] Substituindo ENTRADAS no período: ${start.toISOString()} até ${end.toISOString()}`);

                    await prisma.lancamento.deleteMany({
                        where: {
                            tipo: 'RECEITA',
                            dataPagamento: { gte: start, lte: end }
                        }
                    });

                    const historico = await prisma.historicoImportacao.create({
                        data: {
                            tipo: 'ENTRADAS',
                            arquivoNome: path.basename(filePath),
                            dataInicio: start,
                            dataFim: end,
                            qtdRegistros: registrosValidos.length
                        }
                    });

                    const registrosComImportacaoId = registrosValidos.map(r => ({ ...r, importacaoId: historico.id }));
                    const result = await prisma.lancamento.createMany({ data: registrosComImportacaoId });
                    inseridos = result.count;
                }

            } else {
                throw new Error('Tipo não suportado. Use DESPESAS, RECEITAS ou ENTRADAS.');
            }

            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
            return { totalLido: rows.length, totalInserido: inseridos, descartados };

        } catch (error) {
            console.error('[ETL] Falha crítica:', error);
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
            throw error;
        }
    }
}
