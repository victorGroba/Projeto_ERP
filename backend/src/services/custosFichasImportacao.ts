import * as XLSX from 'xlsx';
import { chaveCadastro } from './custosService';
import { PARAMETROS_PADRAO } from './ensaiosService';
import { Aba, abrirAba, letraColuna, linhaReferenciada, linhasDaColuna, moeda, normalizarUnidade } from './custosPlanilhaUtil';

// Converte as fichas das planilhas em itens da ficha técnica do sistema.
// Em toda linha, "rendimento" é extraído dos divisores que a planilha aplica
// à mão (lote de 10 amostras, solução que serve 166 análises, equipamento
// dividido por 90 análises/dia...), assim o custo continua batendo com a
// planilha e passa a acompanhar os reajustes de preço dos insumos.

export interface ItemLido {
    tipo: 'ATIVIDADE' | 'INSUMO' | 'EQUIPAMENTO';
    descricao?: string;
    grupo?: string;
    minutos?: number;
    insumoChave?: string;
    quantidade?: number;
    unidadeFicha?: string | null;
    equipamentoChave?: string;
    vidaUtilMeses?: number;
    rendimento: number;
    precoPlanilha?: number;
    // Custo da linha na planilha. Quando presente, o rendimento é calculado na
    // gravação com o preço do cadastro, para a linha reproduzir a planilha mesmo
    // quando a embalagem aparece diferente em outras abas.
    custoAlvo?: number;
}

// Insumo ou equipamento com preço digitado na própria ficha, sem linha na aba
// de cadastro: é cadastrado na importação para a ficha não perder a linha.
export interface CadastroDaFicha {
    tipo: 'INSUMO' | 'EQUIPAMENTO' | 'MANUTENCAO';
    setor: 'FQ' | 'MICRO';
    nome: string;
    valor: number;
    qtd?: number;
    unidade?: string | null;
    origem: string;
}

export interface LinhaCadastro {
    chave: string;
    valor: number | null;
    qtd?: number | null;
}

export interface FichaLida {
    nome: string;
    codigoLims: string | null;
    metodologia: string | null;
    setor: 'FQ' | 'MICRO';
    percentualCQ: number;
    custoPlanilha: number | null;
    origem: string;
    itens: ItemLido[];
    notas: string[];
}

const arred = (n: number) => Number(n.toPrecision(6));

// ── Físico-Química ───────────────────────────────────────
// Colunas relativas à coluna "Tempo (min)" (t), iguais em todas as fichas.
const COL = {
    nome: -4, metodologia: -3, custoEnsaio: -2, codigo: -5,
    minutos: 0, atividade: 1, custoAtividade: 2,
    precoInsumo: 4, nomeInsumo: 7, qtdConsumida: 8, unidadeConsumida: 9, custoConsumido: 10,
    qtdPreparada: 11, custoPreparado: 13, nomePreparado: 14, qtdUsada: 15, custoUsado: 17,
    controleQualidade: 19, descEquipamento: 23, valorEquipamento: 24, custoEquipamento: 25, totalSemCQ: 27,
};

function acharCabecalhos(aba: Aba): { linha: number; t: number }[] {
    const cabecalhos: { linha: number; t: number }[] = [];
    for (const linha of aba.linhas) {
        for (let c = 0; c <= aba.ultimaColuna; c++) {
            if (/^tempo \(min\)$/i.test(aba.texto(linha, c))) cabecalhos.push({ linha, t: c });
        }
    }
    return cabecalhos;
}

// Divisores aplicados logo depois de uma referência, ex.: "U11*S11/Q11/10" → [10].
function divisoresApos(formula: string, referencia: string): number[] {
    const m = formula.match(new RegExp(`(?<![A-Z])${referencia}(?!\\d)\\)?((?:\\)?\\/\\(?\\d+(?:\\.\\d+)?\\)?)+)`));
    return m ? [...m[1].matchAll(/(\d+(?:\.\d+)?)/g)].map(x => Number(x[1])) : [];
}

// Quando a ficha digita o preço em vez de apontar para a aba de cadastro,
// identifica o item pelo valor (e quantidade da embalagem), se for único.
function porValor(linhas: Map<number, LinhaCadastro>, valor: number | null, qtd?: number | null): string | null {
    if (valor === null) return null;
    const chaves = new Set([...linhas.values()]
        .filter(x => x.valor === valor && (qtd === undefined || qtd === null || x.qtd === qtd))
        .map(x => x.chave));
    return chaves.size === 1 ? [...chaves][0] : null;
}

function lerFichaFQ(
    aba: Aba, t: number, cabecalho: number, inicio: number, fim: number,
    insumoPorLinha: Map<number, LinhaCadastro>, equipamentoPorLinha: Map<number, LinhaCadastro>,
    cadastrosDaFicha: CadastroDaFicha[],
): FichaLida {
    const c = (rel: number) => t + rel;
    const notas: string[] = [];
    const itens: ItemLido[] = [];
    const linhas = aba.linhas.filter(l => l >= inicio && l <= fim);
    const custoMinuto = PARAMETROS_PADRAO.custoMinutoTecnico.valor;

    // Atividades: custo = minutos × R$/min ÷ análises do lote.
    for (const l of linhas) {
        const minutos = aba.numero(l, c(COL.minutos));
        const descricao = aba.texto(l, c(COL.atividade));
        if (!minutos || !descricao) continue;
        const custo = aba.numero(l, c(COL.custoAtividade));
        if (!custo) { notas.push(`Atividade "${descricao}" sem custo na planilha; não importada.`); continue; }
        itens.push({ tipo: 'ATIVIDADE', descricao, minutos, rendimento: arred(minutos * custoMinuto / custo) });
    }

    // Insumos: cada solução preparada (coluna "custo do reagente preparado")
    // cita na fórmula as linhas dos reagentes que a compõem.
    const linhasUsadas = new Set<number>();
    for (const l of linhas) {
        const formulaPreparado = aba.formula(l, c(COL.custoPreparado));
        const temPreparado = formulaPreparado || aba.numero(l, c(COL.custoPreparado)) !== null;
        if (!temPreparado) continue;
        const grupo = aba.texto(l, c(COL.nomePreparado)) || aba.texto(l, c(COL.nomeInsumo));
        const preparado = aba.numero(l, c(COL.qtdPreparada));
        const usado = aba.numero(l, c(COL.qtdUsada));
        const formulaUsado = aba.formula(l, c(COL.custoUsado));
        const custoUsado = aba.numero(l, c(COL.custoUsado));
        const membros = formulaPreparado ? linhasDaColuna(formulaPreparado, c(COL.custoConsumido)) : [l];

        // Formato padrão "=usado × custo preparado ÷ preparado [÷ lote]": o
        // rendimento sai das quantidades, corrigindo a fórmula do custo preparado
        // (que multiplica quantidade por custo). Outros formatos ("=O9/1980",
        // kit que leva o custo na coluna de quantidade) reproduzem a planilha.
        const ref = (rel: number) => `${letraColuna(c(rel))}${l}`;
        const padrao = [COL.qtdUsada, COL.custoPreparado, COL.qtdPreparada]
            .every(rel => new RegExp(`(?<![A-Z])${ref(rel)}(?!\\d)`).test(formulaUsado));
        // "=I9/252/13": a embalagem inteira é dividida por um número de análises.
        const refPreco = ref(COL.precoInsumo);
        const embalagemInteira = !padrao && new RegExp(`(?<![A-Z])${refPreco}(?!\\d)`).test(formulaUsado);
        let rendimento: number | null = null;
        if (embalagemInteira) {
            rendimento = arred(divisoresApos(formulaUsado, refPreco).reduce((a, b) => a * b, 1));
        } else if (padrao && preparado && usado) {
            const extra = divisoresApos(formulaUsado, ref(COL.qtdPreparada)).reduce((a, b) => a * b, 1);
            rendimento = arred(preparado * extra / usado);
        } else if (custoUsado) {
            const custoMembros = membros.reduce((acc, m) => acc + (aba.numero(m, c(COL.custoConsumido)) ?? 0), 0);
            if (custoMembros > 0) rendimento = arred(custoMembros / custoUsado);
        }
        if (!rendimento) { notas.push(`Solução "${grupo}" sem quantidade preparada/usada; não importada.`); continue; }
        if (padrao && custoUsado !== null) {
            const custoCorreto = membros.reduce((acc, m) => acc + (aba.numero(m, c(COL.custoConsumido)) ?? 0), 0) / rendimento;
            if (Math.abs(custoCorreto - custoUsado) >= 0.01 && Math.abs(custoCorreto / (custoUsado || 1e-9) - 1) > 0.02) {
                notas.push(`Fórmula de "${grupo}" corrigida: a planilha multiplica quantidade por custo; por análise ela dá ${moeda(custoUsado)} e o cálculo correto dá ${moeda(custoCorreto)}.`);
            }
        }

        for (const m of membros) {
            linhasUsadas.add(m);
            const nomeInsumo = aba.texto(m, c(COL.nomeInsumo));
            const quantidade = embalagemInteira
                ? aba.numero(m, c(COL.precoInsumo) + 1)
                : aba.numero(m, c(COL.qtdConsumida));
            const linhaInsumo = linhaReferenciada(aba.formula(m, c(COL.precoInsumo)), 'Insumos MM');
            const precoDigitado = aba.numero(m, c(COL.precoInsumo));
            const qtdDigitada = aba.numero(m, c(COL.precoInsumo) + 1);
            let insumoChave = (linhaInsumo && insumoPorLinha.get(linhaInsumo)?.chave)
                || porValor(insumoPorLinha, precoDigitado, qtdDigitada)
                || '';
            if (!insumoChave && nomeInsumo) {
                insumoChave = chaveCadastro(nomeInsumo);
                if (!linhaInsumo && precoDigitado !== null && qtdDigitada) {
                    cadastrosDaFicha.push({
                        tipo: 'INSUMO', setor: 'FQ', nome: nomeInsumo, valor: precoDigitado, qtd: qtdDigitada, origem: aba.nome,
                        unidade: normalizarUnidade(aba.valor(m, c(COL.precoInsumo) + 2)) ?? normalizarUnidade(aba.valor(m, c(COL.unidadeConsumida))),
                    });
                }
            }
            if (!insumoChave || quantidade === null) {
                notas.push(`Reagente "${nomeInsumo || `linha ${m}`}" de "${grupo}" sem insumo ou quantidade; não importado.`);
                continue;
            }
            const custoConsumido = aba.numero(m, c(COL.custoConsumido));
            const precoUnitarioFicha = precoDigitado !== null && qtdDigitada ? precoDigitado / qtdDigitada : undefined;
            if (!embalagemInteira && precoUnitarioFicha !== undefined && custoConsumido !== null
                && Math.abs(custoConsumido - quantidade * precoUnitarioFicha) > 0.01 * Math.max(custoConsumido, 0.01)) {
                notas.push(`Na planilha, o custo de "${nomeInsumo}" (=${aba.formula(m, c(COL.custoConsumido))}) não considera a quantidade de ${quantidade}; o sistema usa quantidade × preço.`);
            }
            itens.push({
                tipo: 'INSUMO', grupo, insumoChave, quantidade, rendimento,
                unidadeFicha: normalizarUnidade(aba.valor(m, c(COL.unidadeConsumida))),
                precoPlanilha: precoUnitarioFicha,
            });
        }
    }
    for (const l of linhas) {
        const nomeInsumo = aba.texto(l, c(COL.nomeInsumo));
        if (nomeInsumo && !linhasUsadas.has(l) && aba.numero(l, c(COL.custoConsumido))) {
            notas.push(`"${nomeInsumo}" aparece na ficha mas não entra em nenhuma solução; não importado.`);
        }
    }

    // Equipamentos: custo por amostra = valor ÷ dias de vida útil ÷ análises por dia.
    const diasMes = PARAMETROS_PADRAO.diasUteisMes.valor;
    for (const l of linhas) {
        const formulaValor = aba.formula(l, c(COL.valorEquipamento));
        const descricao = aba.texto(l, c(COL.descEquipamento));
        if (!descricao && !formulaValor) continue;
        const custoAmostra = aba.formula(l, c(COL.custoEquipamento));
        if (!custoAmostra) continue;
        const linhaEquip = linhaReferenciada(formulaValor || aba.formula(l, c(COL.descEquipamento)), 'Equipamentos MM');
        const valorDigitado = aba.numero(l, c(COL.valorEquipamento));
        let equipamentoChave = (linhaEquip && equipamentoPorLinha.get(linhaEquip)?.chave)
            || porValor(equipamentoPorLinha, valorDigitado)
            || '';
        if (!equipamentoChave && descricao) {
            equipamentoChave = chaveCadastro(descricao);
            if (!linhaEquip && valorDigitado !== null) {
                cadastrosDaFicha.push({ tipo: 'EQUIPAMENTO', setor: 'FQ', nome: descricao, valor: valorDigitado, origem: aba.nome });
            }
        }
        if (!equipamentoChave) {
            notas.push(`Equipamento "${descricao || `linha ${l}`}" não identificado; não importado.`);
            continue;
        }
        // O valor vem da coluna de custo da linha ou direto da aba de equipamentos.
        const refValor = custoAmostra.match(/^\(?('Equipamentos MM'!\$?[A-Z]+\$?\d+)/i)?.[1] ?? `${letraColuna(c(COL.valorEquipamento))}${l}`;
        const divisores = divisoresApos(custoAmostra, refValor.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
        if (divisores.length < 2) {
            // Ex.: DBO, purificador "=(AC1259)/1/30": a planilha aponta para uma célula vazia.
            notas.push(`A fórmula do equipamento "${descricao}" na planilha está com erro (=${custoAmostra}); informe a vida útil e o uso por dia.`);
            itens.push({ tipo: 'EQUIPAMENTO', equipamentoChave, rendimento: 1 });
            continue;
        }
        const [dias, ...resto] = divisores;
        itens.push({
            tipo: 'EQUIPAMENTO',
            equipamentoChave,
            vidaUtilMeses: arred(dias / diasMes),
            rendimento: arred(resto.reduce((a, b) => a * b, 1)),
        });
    }

    // Ensaio derivado: o total da planilha soma linhas de outro ensaio
    // (ex.: Cloro total aproveita o equipamento do Cloro livre).
    const totais = [COL.custoEnsaio, COL.custoAtividade + 1, COL.custoUsado + 1, COL.custoEquipamento + 1, COL.totalSemCQ]
        .map(rel => aba.formula(inicio, c(rel)));
    const foraDoBloco = totais.some(f => [...f.matchAll(/(?<![A-Z!])\$?[A-Z]{1,2}\$?(\d+)/g)].some(m => {
        const r = Number(m[1]);
        return r < inicio || r > fim;
    }));
    if (foraDoBloco) {
        notas.push('Na planilha, o total deste ensaio usa linhas de outro ensaio da mesma aba; a ficha importada tem só as linhas próprias, conferir o que deve ser incluído.');
    }

    const totalSemCQ = aba.numero(inicio, c(COL.totalSemCQ));
    const cq = aba.numero(inicio, c(COL.controleQualidade));
    const temCodigo = c(COL.codigo) >= 0 && /c[óo]digo/i.test(aba.texto(cabecalho - 1, c(COL.codigo)));
    return {
        nome: aba.texto(inicio, c(COL.nome)),
        codigoLims: temCodigo ? aba.texto(inicio, c(COL.codigo)) || null : null,
        metodologia: aba.texto(inicio, c(COL.metodologia)) || null,
        setor: 'FQ',
        percentualCQ: totalSemCQ && cq ? Math.round(cq / totalSemCQ * 1000) / 10 : 0,
        custoPlanilha: aba.numero(inicio, c(COL.custoEnsaio)),
        origem: aba.nome,
        itens,
        notas,
    };
}

export function lerFichasFQ(
    wb: XLSX.WorkBook,
    insumoPorLinha: Map<number, LinhaCadastro>,
    equipamentoPorLinha: Map<number, LinhaCadastro>,
): { fichas: FichaLida[]; cadastrosDaFicha: CadastroDaFicha[] } {
    const fichas: FichaLida[] = [];
    const cadastrosDaFicha: CadastroDaFicha[] = [];
    const ignorar = /^(insumos|equipamentos|tabela|modelo)/i;
    for (const nomeAba of wb.SheetNames.filter(n => !ignorar.test(n.trim()))) {
        const aba = abrirAba(wb, nomeAba);
        const cabecalhos = acharCabecalhos(aba);
        cabecalhos.forEach(({ linha, t }, i) => {
            const limite = i + 1 < cabecalhos.length ? cabecalhos[i + 1].linha - 2 : Infinity;
            const inicios = aba.linhas.filter(l =>
                l > linha && l <= limite && aba.texto(l, t + COL.nome) && aba.formula(l, t + COL.custoEnsaio));
            inicios.forEach((inicio, j) => {
                const fim = j + 1 < inicios.length ? inicios[j + 1] - 1 : Math.min(limite, aba.linhas[aba.linhas.length - 1]);
                const ficha = lerFichaFQ(aba, t, linha, inicio, fim, insumoPorLinha, equipamentoPorLinha, cadastrosDaFicha);
                if (ficha.itens.length) fichas.push(ficha);
            });
        });
    }
    return { fichas, cadastrosDaFicha };
}

// ── Microbiologia ────────────────────────────────────────
// Colunas fixas: D insumo, E qtd. da embalagem, F custo, G/H uso por análise,
// I custo final. Cada linha "Custo Total ..." soma um subconjunto das linhas
// e vira um ensaio.

const M = { nome: 0, metodo: 1, rotulo: 2, insumo: 3, embalagem: 4, preco: 5, qtdG: 6, qtdH: 7, custo: 8 };

function itensDaLinhaMicro(
    wb: XLSX.WorkBook, aba: Aba, l: number, notas: string[], cadastros: CadastroDaFicha[],
): ItemLido[] {
    const nome = aba.texto(l, M.insumo);
    const formula = aba.formula(l, M.custo);
    let custo = aba.numero(l, M.custo);
    const origem = aba.nome.trim();

    // Calibrações: a fórmula aponta para a aba de rateio, para o TOTAL (todos
    // os equipamentos) ou para linhas específicas (SUM de alguns equipamentos).
    const refsCalibracao = [...formula.matchAll(/'([^']*calibra[^']*)'!\$?F\$?(\d+)/gi)];
    if (refsCalibracao.length) {
        const nomeAba = refsCalibracao[0][1];
        if (!wb.Sheets[nomeAba]) {
            notas.push(`"${nome}": aba "${nomeAba}" não encontrada; não importado.`);
            return [];
        }
        const cal = abrirAba(wb, nomeAba);
        const equipamentos = cal.linhas.filter(r => cal.texto(r, 0) && cal.numero(r, 1) !== null && cal.numero(r, 2) !== null);
        const citadas = refsCalibracao.map(r => Number(r[2]));
        const usaTotal = citadas.some(r => /^total/i.test(cal.texto(r, 0)));
        const selecionadas = usaTotal ? equipamentos : equipamentos.filter(r => citadas.includes(r));
        if (!selecionadas.length) {
            notas.push(`"${nome}": a fórmula da planilha aponta para uma linha vazia (=${formula}); calibração não importada.`);
            return [];
        }
        return selecionadas.map(r => ({
            tipo: 'EQUIPAMENTO' as const,
            equipamentoChave: chaveCadastro(`Calibração/qualificação - ${cal.texto(r, 0)}`),
            rendimento: 1,
        }));
    }

    if (!custo) return [];
    // Linha que soma o custo de outras linhas ("=(H89*F89)/E89+I87"): usa só o custo próprio.
    const outrasLinhas = linhasDaColuna(formula, M.custo).filter(r => r !== l);
    if (outrasLinhas.length) {
        notas.push(`Na planilha, "${nome}" soma o custo de outras linhas (=${formula}); o sistema considera só o custo do próprio item.`);
        custo -= outrasLinhas.reduce((acc, r) => acc + (aba.numero(r, M.custo) ?? 0), 0);
        if (custo <= 0) return [];
    }
    const preco = aba.numero(l, M.preco);
    if (!preco) {
        notas.push(`"${nome}" (${moeda(custo)}) sem preço na planilha; não importado.`);
        return [];
    }

    // Contrato de manutenção: valor ÷ análises (ex.: "=F9/30", "=F41/365").
    if (/manuten|contrato/i.test(nome)) {
        const nomeCadastro = `${nome} (${origem})`;
        cadastros.push({ tipo: 'MANUTENCAO', setor: 'MICRO', nome: nomeCadastro, valor: preco, origem });
        return [{ tipo: 'EQUIPAMENTO', equipamentoChave: chaveCadastro(nomeCadastro), rendimento: arred(preco / custo) }];
    }

    const embalagem = aba.numero(l, M.embalagem);
    if (!embalagem) {
        // Embalagem escrita como texto ("1 Kit", "225mL"): cadastra 1 embalagem
        // e a ficha diz quantas análises ela rende.
        cadastros.push({ tipo: 'INSUMO', setor: 'MICRO', nome, valor: preco, qtd: 1, unidade: 'emb', origem });
        return [{ tipo: 'INSUMO', insumoChave: chaveCadastro(nome), quantidade: 1, rendimento: arred(preco / custo), custoAlvo: custo }];
    }

    const colQtd = linhasDaColuna(formula, M.qtdH).length ? M.qtdH : linhasDaColuna(formula, M.qtdG).length ? M.qtdG : null;
    const quantidade = colQtd === null ? 1 : aba.numero(l, colQtd);
    if (!quantidade) {
        notas.push(`"${nome}" sem quantidade por análise; não importado.`);
        return [];
    }
    return [{
        tipo: 'INSUMO',
        insumoChave: chaveCadastro(nome),
        quantidade,
        rendimento: arred(quantidade * preco / embalagem / custo),
        custoAlvo: custo,
    }];
}

export function lerFichasMicro(wb: XLSX.WorkBook, abas: string[]): { fichas: FichaLida[]; cadastrosDaFicha: CadastroDaFicha[] } {
    const fichas: FichaLida[] = [];
    const cadastrosDaFicha: CadastroDaFicha[] = [];
    for (const nomeAba of abas) {
        const aba = abrirAba(wb, nomeAba);
        const cabecalhos = aba.linhas.filter(l => /^par[âa]metro/i.test(aba.texto(l, M.nome)));
        cabecalhos.forEach((cabecalho, i) => {
            const fim = i + 1 < cabecalhos.length ? cabecalhos[i + 1] - 1 : aba.linhas[aba.linhas.length - 1];
            const linhas = aba.linhas.filter(l => l > cabecalho && l <= fim);
            const parametro = linhas.map(l => aba.texto(l, M.nome)).find(Boolean);
            if (!parametro) return;
            const metodologia = linhas.map(l => aba.texto(l, M.metodo)).find(Boolean) || null;

            const totais = linhas.filter(l =>
                !aba.texto(l, M.insumo) && aba.texto(l, M.rotulo) && linhasDaColuna(aba.formula(l, M.custo), M.custo).length);
            if (!totais.length) return;

            const notasPorLinha = new Map<number, string[]>();
            const itensPorLinha = new Map<number, ItemLido[]>();
            for (const l of linhas) {
                if (!aba.texto(l, M.insumo) || totais.includes(l)) continue;
                const notas: string[] = [];
                itensPorLinha.set(l, itensDaLinhaMicro(wb, aba, l, notas, cadastrosDaFicha));
                notasPorLinha.set(l, notas);
            }

            for (const total of totais) {
                const formulaTotal = aba.formula(total, M.custo);
                const membros = linhasDaColuna(formulaTotal, M.custo).filter(l => itensPorLinha.has(l));
                const extras = formulaTotal.replace(/(?<![A-Z])I\d+(:I\d+)?/g, '').match(/[A-Z]+\d+/g);
                const notasTotal = extras ? [`O total da planilha soma valores fora das linhas da ficha (=${formulaTotal}); conferir.`] : [];
                const rotulo = aba.texto(total, M.rotulo).replace(/^custo( total)?\s*/i, '').trim();
                fichas.push({
                    nome: totais.length === 1 ? parametro : `${parametro} - ${rotulo || aba.texto(total, M.rotulo)}`,
                    codigoLims: null,
                    metodologia,
                    setor: 'MICRO',
                    percentualCQ: 0,
                    custoPlanilha: aba.numero(total, M.custo),
                    origem: nomeAba.trim(),
                    itens: membros.flatMap(l => itensPorLinha.get(l) ?? []),
                    notas: [...notasTotal, ...membros.flatMap(l => notasPorLinha.get(l) ?? [])],
                });
            }
        });
    }
    return { fichas, cadastrosDaFicha };
}
