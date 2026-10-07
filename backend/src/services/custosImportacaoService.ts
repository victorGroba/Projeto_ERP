import { PrismaClient } from '@prisma/client';
import * as XLSX from 'xlsx';
import { chaveCadastro } from './custosService';

const prisma = new PrismaClient();

// Planilhas de custo do laboratório (referência: arquivos do Daniel).
// - Físico-Química: abas "Insumos MM" e "Equipamentos MM".
// - Microbiologia: os insumos ficam dentro das fichas de cada área e as
//   calibrações em abas "Calibrações ...".
// Reimportar é seguro: cadastros existentes não são alterados e o preço só
// entra no histórico quando difere dos já registrados para o insumo.

const ABAS_FICHAS_MICRO = ['Automação', 'Tradicional Alimentos', 'Compact Dry', 'Ambiental', 'Hospitalar'];

type Linha = unknown[];

interface InsumoLido {
    nome: string;
    unidade: string | null;
    categoria: string;
    setor: 'FQ' | 'MICRO';
    precoEmbalagem: number | null;
    qtdEmbalagem: number | null;
    variantes: string[];
}

interface EquipamentoLido {
    nome: string;
    tipo: 'EQUIPAMENTO' | 'CALIBRACAO';
    setor: 'FQ' | 'MICRO';
    valor: number | null;
    vidaUtilMeses: number | null;
    diasUsoMes: number | null;
    variantes: string[];
}

export interface ResultadoImportacaoCustos {
    arquivo: string;
    vigencia: string;
    abasLidas: string[];
    insumosCriados: number;
    precosAdicionados: number;
    insumosSemAlteracao: number;
    equipamentosCriados: number;
    equipamentosExistentes: number;
    comPendencia: number;
    linhasIgnoradas: number;
}

const moeda = (valor: number) => valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

function texto(value: unknown): string {
    return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
}

function numero(value: unknown): number | null {
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    if (typeof value !== 'string') return null;
    const limpo = value.replace(/R\$|\s/g, '');
    if (!/^-?[\d.,]+$/.test(limpo)) return null;
    // "1.234,56" (pt-BR) ou "1,234.56" (en)
    const normalizado = limpo.lastIndexOf(',') > limpo.lastIndexOf('.')
        ? limpo.replace(/\./g, '').replace(',', '.')
        : limpo.replace(/,/g, '');
    const n = Number(normalizado);
    return Number.isFinite(n) ? n : null;
}

function normalizarUnidade(value: unknown): string | null {
    const u = texto(value).toLowerCase();
    if (!u) return null;
    if (['un', 'und', 'unid', 'unidade', 'unidades'].includes(u)) return 'un';
    if (u === 'ml') return 'mL';
    if (u === 'l') return 'L';
    return texto(value);
}

export function inferirCategoria(nome: string): string {
    if (/\bMRC?\b|padr[aã]o|buffer/i.test(nome)) return 'Padrão / Material de referência';
    if (/\bcepas?\b/i.test(nome)) return 'Cepa padrão';
    if (/[áa]gar|caldo|\bbpw\b|peptonada|suplement|meio de cultura/i.test(nome)) return 'Meio de cultura';
    if (/^frasco|frasco (de )?(vidro|polietileno|est[ée]ril)|etiqueta|ponteira|placa|membrana|papel|filtro|fita|l[ãa] de vidro|al[çc]a|l[âa]mina|\bbag\b|swab|\bk7\b|tubo/i.test(nome)) return 'Consumível';
    return 'Reagente';
}

function vigenciaDoArquivo(nomeArquivo: string): Date {
    const m = nomeArquivo.match(/(\d{2})-?(\d{2})-?(20\d{2})/);
    if (m) {
        const data = new Date(Date.UTC(Number(m[3]), Number(m[2]) - 1, Number(m[1]), 12));
        if (!Number.isNaN(data.getTime()) && data.getUTCMonth() === Number(m[2]) - 1) return data;
    }
    return new Date();
}

function linhasDaAba(wb: XLSX.WorkBook, nomeAba: string): Linha[] {
    return XLSX.utils.sheet_to_json<Linha>(wb.Sheets[nomeAba], { header: 1, raw: true, defval: null });
}

function descreverPreco(preco: number | null, qtd: number | null, unidade: string | null, origem: string) {
    if (preco === null) return `sem preço (${origem})`;
    return `${qtd ?? '?'} ${unidade ?? ''} por ${moeda(preco)} (${origem})`.replace(/\s+/g, ' ');
}

function acumularInsumo(mapa: Map<string, InsumoLido>, lido: Omit<InsumoLido, 'variantes'>, origem: string) {
    const chave = chaveCadastro(lido.nome);
    const variante = descreverPreco(lido.precoEmbalagem, lido.qtdEmbalagem, lido.unidade, origem);
    const existente = mapa.get(chave);
    if (!existente) {
        mapa.set(chave, { ...lido, variantes: [variante] });
        return;
    }
    const mesmoPreco = existente.precoEmbalagem === lido.precoEmbalagem && existente.qtdEmbalagem === lido.qtdEmbalagem;
    if (!mesmoPreco && !existente.variantes.includes(variante)) existente.variantes.push(variante);
}

function lerInsumosFQ(wb: XLSX.WorkBook, mapa: Map<string, InsumoLido>): number {
    let ignoradas = 0;
    let cabecalho = false;
    for (const linha of linhasDaAba(wb, 'Insumos MM')) {
        const nome = texto(linha[0]);
        if (!cabecalho) { cabecalho = /^descri/i.test(nome); continue; }
        if (!nome) { if (linha.some(c => c !== null && c !== '')) ignoradas++; continue; }
        acumularInsumo(mapa, {
            nome,
            unidade: normalizarUnidade(linha[3]),
            categoria: inferirCategoria(nome),
            setor: 'FQ',
            precoEmbalagem: numero(linha[1]),
            qtdEmbalagem: numero(linha[2]),
        }, 'Insumos MM');
    }
    return ignoradas;
}

function lerInsumosMicro(wb: XLSX.WorkBook, abas: string[], mapa: Map<string, InsumoLido>): number {
    let ignoradas = 0;
    for (const aba of abas) {
        for (const linha of linhasDaAba(wb, aba)) {
            const nome = texto(linha[3]);
            if (!nome || /^reagentes/i.test(nome)) continue;
            const qtd = numero(linha[4]);
            const preco = numero(linha[5]);
            // Linhas de calibração, manutenção e reagentes sem embalagem informada
            // não são insumos com preço de compra.
            if (!qtd || !preco) { ignoradas++; continue; }
            acumularInsumo(mapa, {
                nome,
                unidade: null,
                categoria: inferirCategoria(nome),
                setor: 'MICRO',
                precoEmbalagem: preco,
                qtdEmbalagem: qtd,
            }, aba);
        }
    }
    return ignoradas;
}

function ehCalibracao(nome: string) {
    return /^(servi[çc]o de )?calibra[çc][ãa]o|^qualifica[çc][ãa]o/i.test(nome);
}

function lerEquipamentosFQ(wb: XLSX.WorkBook, mapa: Map<string, EquipamentoLido>) {
    const linhas = linhasDaAba(wb, 'Equipamentos MM')
        .map(l => ({ nome: texto(l[0]), valor: numero(l[1]) }))
        .filter(l => l.nome && !/^valor dos equipamentos/i.test(l.nome));

    const repetidos = new Set(
        linhas.map(l => chaveCadastro(l.nome)).filter((c, i, todas) => todas.indexOf(c) !== i),
    );

    // Na planilha a calibração vem logo abaixo do equipamento a que se refere;
    // nomes repetidos ("Calibração de vazão") recebem esse equipamento entre parênteses.
    let ultimoEquipamento = '';
    for (const { nome, valor } of linhas) {
        const tipo = ehCalibracao(nome) ? 'CALIBRACAO' : 'EQUIPAMENTO';
        const nomeFinal = repetidos.has(chaveCadastro(nome)) && ultimoEquipamento ? `${nome} (${ultimoEquipamento})` : nome;
        if (tipo === 'EQUIPAMENTO') ultimoEquipamento = nome;
        if (!mapa.has(chaveCadastro(nomeFinal))) {
            mapa.set(chaveCadastro(nomeFinal), {
                nome: nomeFinal, tipo, setor: 'FQ', valor, vidaUtilMeses: null, diasUsoMes: null, variantes: [],
            });
        }
    }
}

function lerCalibracoesMicro(wb: XLSX.WorkBook, abas: string[], mapa: Map<string, EquipamentoLido>): number {
    let ignoradas = 0;
    for (const aba of abas) {
        for (const linha of linhasDaAba(wb, aba)) {
            const equipamento = texto(linha[0]);
            const periodicidade = numero(linha[1]);
            const valor = numero(linha[2]);
            if (!equipamento || periodicidade === null || valor === null) {
                if (/^total/i.test(equipamento)) continue;
                if (equipamento && !/^(rateio|equipamento|o rateio|preencha)/i.test(equipamento)) ignoradas++;
                continue;
            }
            const nome = `Calibração/qualificação - ${equipamento}`;
            const chave = chaveCadastro(nome);
            const diasUsoMes = numero(linha[3]);
            const variante = `${periodicidade} meses, ${moeda(valor)}, ${diasUsoMes ?? '?'} dias/mês (${aba})`;
            const existente = mapa.get(chave);
            if (!existente) {
                mapa.set(chave, {
                    nome, tipo: 'CALIBRACAO', setor: 'MICRO', valor,
                    vidaUtilMeses: periodicidade, diasUsoMes, variantes: [variante],
                });
            } else if (
                (existente.vidaUtilMeses !== periodicidade || existente.valor !== valor || existente.diasUsoMes !== diasUsoMes)
                && !existente.variantes.includes(variante)
            ) {
                existente.variantes.push(variante);
            }
        }
    }
    return ignoradas;
}

function pendenciaInsumo(lido: InsumoLido): string | null {
    const itens: string[] = [];
    if (lido.precoEmbalagem === null) itens.push('Preço não informado na planilha.');
    if (!lido.qtdEmbalagem) itens.push('Quantidade da embalagem não informada na planilha.');
    if (!lido.unidade) itens.push('Unidade da embalagem não informada na planilha.');
    if (lido.variantes.length > 1) itens.push(`Aparece com valores diferentes: ${lido.variantes.join('; ')}.`);
    return itens.length ? itens.join(' ') : null;
}

function pendenciaEquipamento(lido: EquipamentoLido): string | null {
    const itens: string[] = [];
    if (lido.valor === null) itens.push('Valor não informado na planilha.');
    if (lido.variantes.length > 1) itens.push(`Aparece com valores diferentes: ${lido.variantes.join('; ')}.`);
    return itens.length ? itens.join(' ') : null;
}

export async function importarPlanilhaCustos(buffer: Buffer, nomeArquivo: string): Promise<ResultadoImportacaoCustos> {
    let wb: XLSX.WorkBook;
    try {
        wb = XLSX.read(buffer, { type: 'buffer' });
    } catch {
        throw new Error('Arquivo rejeitado: não foi possível ler a planilha.');
    }

    const abas = wb.SheetNames;
    const abaPorNome = (nome: string) => abas.find(a => a.trim().toLowerCase() === nome.toLowerCase());
    const abasMicro = ABAS_FICHAS_MICRO.map(abaPorNome).filter((a): a is string => Boolean(a));
    const abasCalibracao = abas.filter(a => /^calibra[çc][õo]es/i.test(a.trim()));
    const temFQ = Boolean(abaPorNome('Insumos MM'));
    const temEquipFQ = Boolean(abaPorNome('Equipamentos MM'));

    if (!temFQ && !temEquipFQ && !abasMicro.length && !abasCalibracao.length) {
        throw new Error('Arquivo rejeitado: não encontrei as abas de insumos (ex.: "Insumos MM") nem as fichas de Microbiologia.');
    }

    const insumos = new Map<string, InsumoLido>();
    const equipamentos = new Map<string, EquipamentoLido>();
    let linhasIgnoradas = 0;
    if (temFQ) linhasIgnoradas += lerInsumosFQ(wb, insumos);
    if (temEquipFQ) lerEquipamentosFQ(wb, equipamentos);
    if (abasMicro.length) linhasIgnoradas += lerInsumosMicro(wb, abasMicro, insumos);
    if (abasCalibracao.length) linhasIgnoradas += lerCalibracoesMicro(wb, abasCalibracao, equipamentos);

    const vigencia = vigenciaDoArquivo(nomeArquivo);
    const resultado: ResultadoImportacaoCustos = {
        arquivo: nomeArquivo,
        vigencia: vigencia.toISOString().slice(0, 10),
        abasLidas: [
            ...(temFQ ? ['Insumos MM'] : []),
            ...(temEquipFQ ? ['Equipamentos MM'] : []),
            ...abasMicro,
            ...abasCalibracao,
        ],
        insumosCriados: 0,
        precosAdicionados: 0,
        insumosSemAlteracao: 0,
        equipamentosCriados: 0,
        equipamentosExistentes: 0,
        comPendencia: 0,
        linhasIgnoradas,
    };

    await prisma.$transaction(async tx => {
        for (const [chave, lido] of insumos) {
            const temPreco = lido.precoEmbalagem !== null && Boolean(lido.qtdEmbalagem);
            const preco = temPreco ? {
                precoEmbalagem: lido.precoEmbalagem!,
                qtdEmbalagem: lido.qtdEmbalagem!,
                precoUnitario: lido.precoEmbalagem! / lido.qtdEmbalagem!,
                vigencia,
                origem: nomeArquivo,
            } : null;

            const existente = await tx.insumo.findUnique({ where: { chave }, include: { precos: true } });
            if (!existente) {
                const pendencia = pendenciaInsumo(lido);
                if (pendencia) resultado.comPendencia++;
                await tx.insumo.create({
                    data: {
                        chave,
                        nome: lido.nome,
                        unidade: lido.unidade,
                        categoria: lido.categoria,
                        setor: lido.setor,
                        pendencia,
                        ...(preco ? { precos: { create: preco } } : {}),
                    },
                });
                resultado.insumosCriados++;
                continue;
            }

            const jaRegistrado = !preco || existente.precos.some(p =>
                p.precoEmbalagem === preco.precoEmbalagem && p.qtdEmbalagem === preco.qtdEmbalagem);
            if (jaRegistrado) {
                resultado.insumosSemAlteracao++;
            } else {
                await tx.insumoPreco.create({ data: { ...preco, insumoId: existente.id } });
                resultado.precosAdicionados++;
            }
        }

        for (const [chave, lido] of equipamentos) {
            if (await tx.equipamento.findUnique({ where: { chave } })) {
                resultado.equipamentosExistentes++;
                continue;
            }
            const pendencia = pendenciaEquipamento(lido);
            if (pendencia) resultado.comPendencia++;
            await tx.equipamento.create({
                data: {
                    chave,
                    nome: lido.nome,
                    tipo: lido.tipo,
                    setor: lido.setor,
                    valor: lido.valor,
                    vidaUtilMeses: lido.vidaUtilMeses,
                    diasUsoMes: lido.diasUsoMes,
                    pendencia,
                },
            });
            resultado.equipamentosCriados++;
        }
    }, { timeout: 60_000 });

    return resultado;
}
