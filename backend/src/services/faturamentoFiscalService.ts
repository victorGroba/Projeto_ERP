import { Readable } from 'stream';
import csv from 'csv-parser';
import { Prisma, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const normalizeKey = (value: string) => value
    .replace(/^\uFEFF/, '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

const digits = (value: unknown) => String(value || '').replace(/\D/g, '');

function parseCurrency(value: unknown): number {
    const raw = String(value ?? '').trim().replace(/R\$\s?/gi, '');
    if (!raw) return 0;
    const normalized = raw.includes(',') ? raw.replace(/\./g, '').replace(',', '.') : raw;
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
}

function parseMunicipalDate(value: unknown): Date | null {
    const match = String(value ?? '').trim().match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2}):(\d{2}))?/);
    if (!match) return null;
    const [, day, month, year, hour = '12', minute = '00', second = '00'] = match;
    const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second)));
    return Number.isNaN(date.getTime()) ? null : date;
}

const monthKey = (date: Date) => `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;

// Chave de agrupamento da composicao de vendas: mesma normalizacao de
// `normalizeKey`, mas preservando espacos (acentos variam muito na digitacao
// livre da discriminacao, ex: "IN161" vs "IN 161").
const normalizeServico = (value: string) => value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

// Prefixos de segmentos que sao rodape da nota (total, referencia, contrato,
// numero de OC/guia), nao um item de servico vendido.
const PREFIXOS_RODAPE = /^(total|ref(erente)?\b|oc:?|contrato\b|n[ºo°]?\s*cno\b|banco\b|nota de empenho\b|processo\b)/i;

// Casa segmentos como "Swab 3 parametros - R$ 122,00  8  R$ 976,00": nome do
// servico, preco unitario, quantidade e valor total do item.
const ITEM_SERVICO_PATTERN = /^(.+?)\s*-\s*R\$\s*([\d.,]+)\s+(\d+)\s+R\$\s*([\d.,]+)\s*$/;

export interface ItemServicoParseado {
    descricao: string;
    descricaoNormalizada: string;
    quantidade: number;
    valorUnitario: number | null;
    valorTotal: number;
    estruturado: boolean;
}

/**
 * Extrai os itens vendidos da discriminacao de servicos de uma nota. A
 * discriminacao e texto livre digitado nota a nota; quando segue o padrao
 * "nome - R$ unit  qtd  R$ total" conseguimos o item exato. Quando nao segue
 * (contratos, prestacao continua, etc.), devolvemos um unico item com o texto
 * inteiro e `estruturado: false`, usando o valor bruto da nota, para a
 * composicao de vendas nao perder faturamento mesmo sem conseguir detalhar.
 */
export function parseItensServico(descricao: string | null | undefined, valorBrutoNota: number): ItemServicoParseado[] {
    const texto = String(descricao || '').trim();
    if (!texto) return [];

    const segmentos = texto.split('|').map(segmento => segmento.trim()).filter(Boolean);
    const itens: ItemServicoParseado[] = [];
    for (const segmento of segmentos) {
        if (PREFIXOS_RODAPE.test(segmento)) continue;
        const match = segmento.match(ITEM_SERVICO_PATTERN);
        if (!match) continue;
        const [, nome, preco, qtd, total] = match;
        const nomeLimpo = nome.trim();
        if (!nomeLimpo) continue;
        itens.push({
            descricao: nomeLimpo,
            descricaoNormalizada: normalizeServico(nomeLimpo),
            quantidade: Number(qtd),
            valorUnitario: parseCurrency(preco),
            valorTotal: parseCurrency(total),
            estruturado: true,
        });
    }

    if (itens.length > 0) return itens;

    // Nenhum segmento reconhecido: guarda o texto inteiro como um item unico
    // nao estruturado, para a composicao de vendas nao perder esse valor.
    const nomeFallback = texto.length > 180 ? `${texto.slice(0, 180)}…` : texto;
    return [{
        descricao: nomeFallback,
        descricaoNormalizada: normalizeServico(nomeFallback),
        quantidade: 1,
        valorUnitario: null,
        valorTotal: valorBrutoNota,
        estruturado: false,
    }];
}

function readRows(buffer: Buffer): Promise<Record<string, string>[]> {
    const content = buffer.toString('latin1');
    const header = content.split(/\r?\n/, 1)[0] || '';
    const separator = (header.match(/;/g) || []).length >= (header.match(/,/g) || []).length ? ';' : ',';

    return new Promise((resolve, reject) => {
        const rows: Record<string, string>[] = [];
        Readable.from([content])
            .pipe(csv({ separator, mapHeaders: ({ header: name }) => normalizeKey(name) }))
            .on('data', row => rows.push(row))
            .on('end', () => resolve(rows))
            .on('error', reject);
    });
}

export interface ResultadoImportacaoFiscal {
    competenciaInicio: string;
    competenciaFim: string;
    competencias: string[];
    qtdMeses: number;
    qtdNotas: number;
    valorTotal: number;
    qtdNaoConciliadas: number;
    mesesSubstituidos: number;
    avisoTotal?: string;
}

export async function importarFaturamentoFiscal(buffer: Buffer, arquivoNome: string): Promise<ResultadoImportacaoFiscal> {
    const rows = await readRows(buffer);
    if (rows.length === 0) throw new Error('Arquivo rejeitado: o CSV está vazio.');

    const notas = rows
        .filter(row => String(row.tipo_de_registro || '').trim() === '20')
        .filter(row => String(row.status_da_nota_fiscal || '').trim() === '1' && !String(row.data_de_cancelamento || '').trim())
        .map((row, index) => {
            const numero = String(row.n_da_nota_fiscal_eletronica || '').trim();
            const dataEmissao = parseMunicipalDate(row.data_hora_da_emissao_da_nota_fiscal);
            const dataCompetencia = parseMunicipalDate(row.data_de_competencia);
            const valorBruto = parseCurrency(row.valor_dos_servicos);
            const clienteDocumento = digits(row.cpf_cnpj_nif_do_tomador);
            const clienteNome = String(row.razao_social_do_tomador || '').trim();
            const prestadorDocumento = digits(row.cpf_cnpj_do_prestador);
            // Retencoes federais e discriminacao do servico: colunas opcionais no
            // layout (nem toda prefeitura/versao do arquivo as inclui), por isso
            // nao entram na validacao de linha obrigatoria abaixo.
            const valorCSLL = parseCurrency(row.valor_csll);
            const valorIR = parseCurrency(row.valor_ir);
            const descricaoServico = String(row.discriminacao_dos_servicos || '').trim() || null;

            if (!numero || !dataEmissao || !dataCompetencia || !prestadorDocumento || !clienteDocumento || !clienteNome || !(valorBruto > 0)) {
                throw new Error(`Arquivo rejeitado: a nota da linha ${index + 2} tem número, data, CNPJ, cliente ou valor inválido.`);
            }
            return {
                numero, dataEmissao, dataCompetencia, valorBruto, clienteDocumento, clienteNome, prestadorDocumento,
                valorCSLL, valorIR, descricaoServico,
                itens: parseItensServico(descricaoServico, valorBruto),
            };
        });

    if (notas.length === 0) {
        throw new Error('Arquivo rejeitado: nenhuma NFS-e ativa foi encontrada no layout da prefeitura.');
    }

    const valorTotal = Math.round(notas.reduce((sum, nota) => sum + nota.valorBruto, 0) * 100) / 100;
    const totalizador = rows.find(row => String(row.tipo_de_registro || '').trim().toLowerCase() === 'total');
    const valorTotalizador = totalizador ? parseCurrency(totalizador.valor_dos_servicos) : 0;
    const avisoTotal = valorTotalizador > 0 && Math.abs(valorTotalizador - valorTotal) > 0.01
        ? `O totalizador do arquivo (${valorTotalizador.toFixed(2)}) difere da soma das notas ativas (${valorTotal.toFixed(2)}).`
        : undefined;

    const clientes = await prisma.clienteContaAzul.findMany({ select: { documento: true } });
    const documentosCadastrados = new Set(clientes.map(cliente => digits(cliente.documento)).filter(Boolean));
    const qtdNaoConciliadas = notas.filter(nota => !documentosCadastrados.has(nota.clienteDocumento)).length;
    const notasPorMes = new Map<string, typeof notas>();
    notas.forEach(nota => {
        const key = monthKey(nota.dataCompetencia);
        if (!notasPorMes.has(key)) notasPorMes.set(key, []);
        notasPorMes.get(key)!.push(nota);
    });
    const competencias = [...notasPorMes.keys()].sort();
    const datasCompetencia = competencias.map(key => {
        const [year, month] = key.split('-').map(Number);
        return new Date(Date.UTC(year, month - 1, 1, 12));
    });
    const anteriores = await prisma.importacaoFiscal.findMany({
        where: { competencia: { in: datasCompetencia } },
        select: { id: true },
    });

    try {
        await prisma.$transaction(async tx => {
            if (anteriores.length > 0) {
                await tx.importacaoFiscal.deleteMany({ where: { id: { in: anteriores.map(item => item.id) } } });
            }
            for (let index = 0; index < competencias.length; index++) {
                const notasDoMes = notasPorMes.get(competencias[index])!;
                await tx.importacaoFiscal.create({
                    data: {
                        competencia: datasCompetencia[index],
                        arquivoNome,
                        qtdNotas: notasDoMes.length,
                        valorTotal: Math.round(notasDoMes.reduce((sum, nota) => sum + nota.valorBruto, 0) * 100) / 100,
                        qtdNaoConciliadas: notasDoMes.filter(nota => !documentosCadastrados.has(nota.clienteDocumento)).length,
                        notas: {
                            create: notasDoMes.map(({ itens, ...nota }) => ({
                                ...nota,
                                itens: { create: itens },
                            })),
                        },
                    },
                });
            }
        });
    } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
            throw new Error('Arquivo rejeitado: uma ou mais notas já foram importadas em outra competência.');
        }
        throw error;
    }

    return {
        competenciaInicio: competencias[0],
        competenciaFim: competencias[competencias.length - 1],
        competencias,
        qtdMeses: competencias.length,
        qtdNotas: notas.length,
        valorTotal,
        qtdNaoConciliadas,
        mesesSubstituidos: anteriores.length,
        avisoTotal,
    };
}

export async function listarImportacoesFiscais() {
    return prisma.importacaoFiscal.findMany({
        orderBy: { competencia: 'desc' },
        select: {
            id: true,
            competencia: true,
            arquivoNome: true,
            qtdNotas: true,
            valorTotal: true,
            qtdNaoConciliadas: true,
            createdAt: true,
        },
    });
}
