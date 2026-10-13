import { Prisma, PrismaClient } from '@prisma/client';
import * as XLSX from 'xlsx';
import { chaveCadastro } from './custosService';
import { FichaLida, LinhaCadastro, lerFichasFQ, lerFichasMicro } from './custosFichasImportacao';
import { abrirAba, moeda, normalizarUnidade } from './custosPlanilhaUtil';

const prisma = new PrismaClient();

// Planilhas de custo do laboratório (referência: arquivos do Daniel).
// - Físico-Química: abas "Insumos MM", "Equipamentos MM" e uma aba por ficha.
// - Microbiologia: os insumos ficam dentro das fichas de cada área e as
//   calibrações em abas "Calibrações ...".
// Reimportar é seguro: cadastros e fichas existentes não são alterados e o
// preço só entra no histórico quando difere dos já registrados para o insumo.

const ABAS_FICHAS_MICRO = ['Automação', 'Tradicional Alimentos', 'Compact Dry', 'Ambiental', 'Hospitalar'];

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
    tipo: 'EQUIPAMENTO' | 'CALIBRACAO' | 'MANUTENCAO';
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
    ensaiosCriados: number;
    ensaiosExistentes: number;
    comPendencia: number;
    linhasIgnoradas: number;
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

function descreverPreco(preco: number | null, qtd: number | null, unidade: string | null, origem: string) {
    if (preco === null) return `sem preço (${origem})`;
    return `${qtd ?? '?'} ${unidade ?? ''} por ${moeda(preco)} (${origem})`.replace(/\s+/g, ' ');
}

function acumularInsumo(mapa: Map<string, InsumoLido>, lido: Omit<InsumoLido, 'variantes'>, origem: string): string {
    const chave = chaveCadastro(lido.nome);
    const variante = descreverPreco(lido.precoEmbalagem, lido.qtdEmbalagem, lido.unidade, origem);
    const existente = mapa.get(chave);
    if (!existente) {
        mapa.set(chave, { ...lido, variantes: [variante] });
    } else {
        const mesmoPreco = existente.precoEmbalagem === lido.precoEmbalagem && existente.qtdEmbalagem === lido.qtdEmbalagem;
        if (!mesmoPreco && !existente.variantes.includes(variante)) existente.variantes.push(variante);
    }
    return chave;
}

// Devolve a chave do insumo de cada linha da aba, usada pelas fichas que
// apontam para 'Insumos MM'!B<linha>.
function lerInsumosFQ(wb: XLSX.WorkBook, nomeAba: string, mapa: Map<string, InsumoLido>) {
    const aba = abrirAba(wb, nomeAba);
    const porLinha = new Map<number, LinhaCadastro>();
    let ignoradas = 0;
    let cabecalho = false;
    for (const l of aba.linhas) {
        const nome = aba.texto(l, 0);
        if (!cabecalho) { cabecalho = /^descri/i.test(nome); continue; }
        if (!nome) {
            if ([1, 2, 3].some(c => aba.valor(l, c) !== null)) ignoradas++;
            continue;
        }
        const precoEmbalagem = aba.numero(l, 1);
        const qtdEmbalagem = aba.numero(l, 2);
        const chave = acumularInsumo(mapa, {
            nome,
            unidade: normalizarUnidade(aba.valor(l, 3)),
            categoria: inferirCategoria(nome),
            setor: 'FQ',
            precoEmbalagem,
            qtdEmbalagem,
        }, nomeAba);
        porLinha.set(l, { chave, valor: precoEmbalagem, qtd: qtdEmbalagem });
    }
    return { porLinha, ignoradas };
}

function lerInsumosMicro(wb: XLSX.WorkBook, abas: string[], mapa: Map<string, InsumoLido>): number {
    let ignoradas = 0;
    for (const nomeAba of abas) {
        const aba = abrirAba(wb, nomeAba);
        for (const l of aba.linhas) {
            const nome = aba.texto(l, 3);
            if (!nome || /^reagentes/i.test(nome)) continue;
            const qtd = aba.numero(l, 4);
            const preco = aba.numero(l, 5);
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
            }, nomeAba.trim());
        }
    }
    return ignoradas;
}

function ehCalibracao(nome: string) {
    return /^(servi[çc]o de )?calibra[çc][ãa]o|^qualifica[çc][ãa]o/i.test(nome);
}

function lerEquipamentosFQ(wb: XLSX.WorkBook, nomeAba: string, mapa: Map<string, EquipamentoLido>) {
    const aba = abrirAba(wb, nomeAba);
    const linhas = aba.linhas
        .map(l => ({ linha: l, nome: aba.texto(l, 0), valor: aba.numero(l, 1) }))
        .filter(l => l.nome && !/^valor dos equipamentos/i.test(l.nome));

    const repetidos = new Set(
        linhas.map(l => chaveCadastro(l.nome)).filter((c, i, todas) => todas.indexOf(c) !== i),
    );

    // Na planilha a calibração vem logo abaixo do equipamento a que se refere;
    // nomes repetidos ("Calibração de vazão") recebem esse equipamento entre parênteses.
    const porLinha = new Map<number, LinhaCadastro>();
    let ultimoEquipamento = '';
    for (const { linha, nome, valor } of linhas) {
        const tipo = ehCalibracao(nome) ? 'CALIBRACAO' : 'EQUIPAMENTO';
        const nomeFinal = repetidos.has(chaveCadastro(nome)) && ultimoEquipamento ? `${nome} (${ultimoEquipamento})` : nome;
        if (tipo === 'EQUIPAMENTO') ultimoEquipamento = nome;
        const chave = chaveCadastro(nomeFinal);
        porLinha.set(linha, { chave, valor });
        if (!mapa.has(chave)) {
            mapa.set(chave, { nome: nomeFinal, tipo, setor: 'FQ', valor, vidaUtilMeses: null, diasUsoMes: null, variantes: [] });
        }
    }
    return porLinha;
}

function lerCalibracoesMicro(wb: XLSX.WorkBook, abas: string[], mapa: Map<string, EquipamentoLido>): number {
    let ignoradas = 0;
    for (const nomeAba of abas) {
        const aba = abrirAba(wb, nomeAba);
        for (const l of aba.linhas) {
            const equipamento = aba.texto(l, 0);
            const periodicidade = aba.numero(l, 1);
            const valor = aba.numero(l, 2);
            if (!equipamento || periodicidade === null || valor === null) {
                if (/^total/i.test(equipamento)) continue;
                if (equipamento && !/^(rateio|equipamento|o rateio|preencha)/i.test(equipamento)) ignoradas++;
                continue;
            }
            const nome = `Calibração/qualificação - ${equipamento}`;
            const chave = chaveCadastro(nome);
            const diasUsoMes = aba.numero(l, 3);
            const variante = `${periodicidade} meses, ${moeda(valor)}, ${diasUsoMes ?? '?'} dias/mês (${nomeAba})`;
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
    if (lido.variantes.length === 1 && /^(Cadastrado a partir|Contrato de manutenção)/.test(lido.variantes[0])) itens.push(lido.variantes[0]);
    if (lido.variantes.length > 1) itens.push(`Aparece com valores diferentes: ${lido.variantes.join('; ')}.`);
    return itens.length ? itens.join(' ') : null;
}

async function gravarFichas(tx: Prisma.TransactionClient, fichas: FichaLida[], resultado: ResultadoImportacaoCustos) {
    const [insumos, equipamentos] = await Promise.all([
        tx.insumo.findMany({ include: { precos: { orderBy: [{ vigencia: 'desc' }, { createdAt: 'desc' }], take: 1 } } }),
        tx.equipamento.findMany(),
    ]);
    const insumoPorChave = new Map(insumos.map(i => [i.chave, i]));
    const equipamentoPorChave = new Map(equipamentos.map(e => [e.chave, e]));
    const nomesNestaImportacao = new Set<string>();

    for (const ficha of fichas) {
        // Nome repetido é outro método (ex.: Ferro colorimétrico e Ferro Kit
        // Hanna) ou outra área (Estafilococos em Alimentos e Hospitalar).
        let nome = ficha.nome;
        if (nomesNestaImportacao.has(chaveCadastro(nome)) && ficha.metodologia) nome = `${ficha.nome} - ${ficha.metodologia}`;
        if (nomesNestaImportacao.has(chaveCadastro(nome))) nome = `${ficha.nome} (${ficha.origem})`;
        const chave = chaveCadastro(nome);
        nomesNestaImportacao.add(chave);

        if (await tx.ensaio.findUnique({ where: { chave } })) {
            resultado.ensaiosExistentes++;
            continue;
        }

        const notas = [...ficha.notas];
        const itens: Prisma.FichaItemCreateWithoutEnsaioInput[] = [];
        for (const item of ficha.itens) {
            if (item.tipo === 'ATIVIDADE') {
                itens.push({ tipo: item.tipo, ordem: itens.length, descricao: item.descricao, minutos: item.minutos, rendimento: item.rendimento });
            } else if (item.tipo === 'INSUMO') {
                const insumo = insumoPorChave.get(item.insumoChave!);
                if (!insumo) { notas.push(`Insumo "${item.insumoChave}" não encontrado no cadastro; linha não importada.`); continue; }
                if (item.unidadeFicha && insumo.unidade && item.unidadeFicha.toLowerCase() !== insumo.unidade.toLowerCase()) {
                    notas.push(`"${insumo.nome}": a ficha usa ${item.unidadeFicha} e o cadastro está em ${insumo.unidade}; conferir a quantidade.`);
                }
                const precoUnitario = insumo.precos[0]?.precoUnitario;
                if (item.precoPlanilha && precoUnitario && Math.abs(item.precoPlanilha / precoUnitario - 1) > 0.01) {
                    notas.push(`A ficha usa "${insumo.nome}" a ${moeda(item.precoPlanilha)}/${insumo.unidade ?? 'un'} e o cadastro a ${moeda(precoUnitario)}/${insumo.unidade ?? 'un'}; o sistema usa o cadastro.`);
                }
                const rendimento = item.custoAlvo && precoUnitario && item.quantidade
                    ? Number((item.quantidade * precoUnitario / item.custoAlvo).toPrecision(6))
                    : item.rendimento;
                itens.push({
                    tipo: item.tipo, ordem: itens.length, grupo: item.grupo, quantidade: item.quantidade,
                    rendimento, insumo: { connect: { id: insumo.id } },
                });
            } else {
                const equipamento = equipamentoPorChave.get(item.equipamentoChave!);
                if (!equipamento) { notas.push(`Equipamento "${item.equipamentoChave}" não encontrado no cadastro; linha não importada.`); continue; }
                itens.push({
                    tipo: item.tipo, ordem: itens.length, vidaUtilMeses: item.vidaUtilMeses,
                    rendimento: item.rendimento, equipamento: { connect: { id: equipamento.id } },
                });
            }
        }

        const pendencia = notas.length ? notas.join(' ') : null;
        if (pendencia) resultado.comPendencia++;
        await tx.ensaio.create({
            data: {
                chave,
                nome,
                codigoLims: ficha.codigoLims,
                metodologia: ficha.metodologia,
                setor: ficha.setor,
                percentualCQ: ficha.percentualCQ,
                custoPlanilha: ficha.custoPlanilha,
                origem: ficha.origem,
                pendencia,
                itens: { create: itens },
            },
        });
        resultado.ensaiosCriados++;
    }
}

export async function importarPlanilhaCustos(buffer: Buffer, nomeArquivo: string): Promise<ResultadoImportacaoCustos> {
    let wb: XLSX.WorkBook;
    try {
        wb = XLSX.read(buffer, { type: 'buffer', cellFormula: true });
    } catch {
        throw new Error('Arquivo rejeitado: não foi possível ler a planilha.');
    }

    const abas = wb.SheetNames;
    const abaPorNome = (nome: string) => abas.find(a => a.trim().toLowerCase() === nome.toLowerCase());
    const abasMicro = ABAS_FICHAS_MICRO.map(abaPorNome).filter((a): a is string => Boolean(a));
    const abasCalibracao = abas.filter(a => /^calibra[çc][õo]es/i.test(a.trim()));
    const abaInsumosFQ = abaPorNome('Insumos MM');
    const abaEquipFQ = abaPorNome('Equipamentos MM');

    if (!abaInsumosFQ && !abaEquipFQ && !abasMicro.length && !abasCalibracao.length) {
        throw new Error('Arquivo rejeitado: não encontrei as abas de insumos (ex.: "Insumos MM") nem as fichas de Microbiologia.');
    }

    const insumos = new Map<string, InsumoLido>();
    const equipamentos = new Map<string, EquipamentoLido>();
    const insumosDaFicha = new Map<string, string>();
    let linhasIgnoradas = 0;
    let insumoPorLinha = new Map<number, LinhaCadastro>();
    let equipamentoPorLinha = new Map<number, LinhaCadastro>();
    if (abaInsumosFQ) {
        const lidos = lerInsumosFQ(wb, abaInsumosFQ, insumos);
        insumoPorLinha = lidos.porLinha;
        linhasIgnoradas += lidos.ignoradas;
    }
    if (abaEquipFQ) equipamentoPorLinha = lerEquipamentosFQ(wb, abaEquipFQ, equipamentos);
    if (abasMicro.length) linhasIgnoradas += lerInsumosMicro(wb, abasMicro, insumos);
    if (abasCalibracao.length) linhasIgnoradas += lerCalibracoesMicro(wb, abasCalibracao, equipamentos);

    const fichasFQ = abaInsumosFQ ? lerFichasFQ(wb, insumoPorLinha, equipamentoPorLinha) : { fichas: [], cadastrosDaFicha: [] };
    const fichasMicro = lerFichasMicro(wb, abasMicro);
    for (const item of [...fichasFQ.cadastrosDaFicha, ...fichasMicro.cadastrosDaFicha]) {
        const nota = item.tipo === 'MANUTENCAO'
            ? `Contrato de manutenção da ficha "${item.origem}"; a ficha define por quantas análises o valor é dividido.`
            : `Cadastrado a partir da ficha "${item.origem}": o valor estava na ficha e não na aba de cadastro.`;
        if (item.tipo === 'INSUMO') {
            const jaCadastrado = insumos.has(chaveCadastro(item.nome));
            const chave = acumularInsumo(insumos, {
                nome: item.nome, unidade: item.unidade ?? null, categoria: inferirCategoria(item.nome),
                setor: item.setor, precoEmbalagem: item.valor, qtdEmbalagem: item.qtd ?? null,
            }, item.origem);
            if (!jaCadastrado) {
                insumosDaFicha.set(chave, item.unidade === 'emb'
                    ? `${nota} A embalagem não tem quantidade na planilha; foi cadastrada como 1 embalagem e a ficha indica quantas análises ela rende.`
                    : nota);
            }
        } else if (!equipamentos.has(chaveCadastro(item.nome))) {
            equipamentos.set(chaveCadastro(item.nome), {
                nome: item.nome,
                tipo: item.tipo === 'MANUTENCAO' ? 'MANUTENCAO' : ehCalibracao(item.nome) ? 'CALIBRACAO' : 'EQUIPAMENTO',
                setor: item.setor, valor: item.valor, vidaUtilMeses: null, diasUsoMes: null, variantes: [nota],
            });
        }
    }
    const fichas = [...fichasFQ.fichas, ...fichasMicro.fichas];

    const vigencia = vigenciaDoArquivo(nomeArquivo);
    const resultado: ResultadoImportacaoCustos = {
        arquivo: nomeArquivo,
        vigencia: vigencia.toISOString().slice(0, 10),
        abasLidas: [
            ...(abaInsumosFQ ? [abaInsumosFQ] : []),
            ...(abaEquipFQ ? [abaEquipFQ] : []),
            ...[...new Set(fichas.map(f => f.origem))].filter(a => !abasMicro.some(m => m.trim() === a)),
            ...abasMicro.map(a => a.trim()),
            ...abasCalibracao,
        ],
        insumosCriados: 0,
        precosAdicionados: 0,
        insumosSemAlteracao: 0,
        equipamentosCriados: 0,
        equipamentosExistentes: 0,
        ensaiosCriados: 0,
        ensaiosExistentes: 0,
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
                const pendencia = [insumosDaFicha.get(chave), pendenciaInsumo(lido)].filter(Boolean).join(' ') || null;
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

        await gravarFichas(tx, fichas, resultado);
    }, { timeout: 120_000 });

    return resultado;
}

