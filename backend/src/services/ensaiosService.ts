import { PrismaClient } from '@prisma/client';
import { CustosValidationError, chaveCadastro } from './custosService';

const prisma = new PrismaClient();

// ── Parâmetros gerais ────────────────────────────────────

export const PARAMETROS_PADRAO = {
    custoMinutoTecnico: { valor: 0.25, descricao: 'Custo do minuto do técnico (R$). Planilha: R$ 4.050/mês = R$ 0,25/min.' },
    diasUteisMes: { valor: 21, descricao: 'Dias úteis por mês, usados para amortizar equipamentos (252 por ano).' },
} as const;

export type ChaveParametro = keyof typeof PARAMETROS_PADRAO;
export type Parametros = Record<ChaveParametro, number>;

export async function obterParametros(): Promise<Parametros> {
    const salvos = await prisma.parametroCusto.findMany();
    const resultado = {} as Parametros;
    for (const chave of Object.keys(PARAMETROS_PADRAO) as ChaveParametro[]) {
        resultado[chave] = salvos.find(p => p.chave === chave)?.valor ?? PARAMETROS_PADRAO[chave].valor;
    }
    return resultado;
}

export async function listarParametros() {
    const valores = await obterParametros();
    return (Object.keys(PARAMETROS_PADRAO) as ChaveParametro[]).map(chave => ({
        chave,
        valor: valores[chave],
        descricao: PARAMETROS_PADRAO[chave].descricao,
    }));
}

export async function salvarParametros(body: Record<string, unknown>) {
    for (const chave of Object.keys(PARAMETROS_PADRAO) as ChaveParametro[]) {
        if (body[chave] === undefined) continue;
        const valor = Number(body[chave]);
        if (!Number.isFinite(valor) || valor <= 0) throw new CustosValidationError('Os parâmetros devem ser números maiores que zero.');
        await prisma.parametroCusto.upsert({
            where: { chave },
            create: { chave, valor, descricao: PARAMETROS_PADRAO[chave].descricao },
            update: { valor },
        });
    }
    return listarParametros();
}

// ── Cálculo ──────────────────────────────────────────────

export const TIPOS_ITEM = ['ATIVIDADE', 'INSUMO', 'EQUIPAMENTO'] as const;
export type TipoItem = typeof TIPOS_ITEM[number];

export interface ItemFicha {
    tipo: TipoItem;
    ordem?: number;
    descricao?: string | null;
    grupo?: string | null;
    minutos?: number | null;
    insumoId?: string | null;
    quantidade?: number | null;
    equipamentoId?: string | null;
    vidaUtilMeses?: number | null;
    rendimento: number;
}

interface InsumoCalculo { nome: string; unidade: string | null; precoUnitario: number | null; vigencia: Date | null; ativo: boolean }
interface EquipamentoCalculo { nome: string; tipo: string; valor: number | null; vidaUtilMeses: number | null; diasUsoMes: number | null; ativo: boolean }

export interface ContextoCalculo {
    data: Date;
    parametros: Parametros;
    insumos: Map<string, InsumoCalculo>;
    equipamentos: Map<string, EquipamentoCalculo>;
}

// Carrega uma vez os preços vigentes na data e os equipamentos, para calcular
// várias fichas sem consultar o banco item a item.
export async function carregarContexto(data = new Date()): Promise<ContextoCalculo> {
    const [parametros, insumos, equipamentos] = await Promise.all([
        obterParametros(),
        prisma.insumo.findMany({
            include: { precos: { where: { vigencia: { lte: data } }, orderBy: [{ vigencia: 'desc' }, { createdAt: 'desc' }], take: 1 } },
        }),
        prisma.equipamento.findMany(),
    ]);
    return {
        data,
        parametros,
        insumos: new Map(insumos.map(i => [i.id, {
            nome: i.nome,
            unidade: i.unidade,
            precoUnitario: i.precos[0]?.precoUnitario ?? null,
            vigencia: i.precos[0]?.vigencia ?? null,
            ativo: i.ativo,
        }])),
        equipamentos: new Map(equipamentos.map(e => [e.id, {
            nome: e.nome, tipo: e.tipo, valor: e.valor, vidaUtilMeses: e.vidaUtilMeses, diasUsoMes: e.diasUsoMes, ativo: e.ativo,
        }])),
    };
}

export interface ItemCalculado extends ItemFicha {
    nome: string;
    unidade: string | null;
    precoUnitario: number | null;
    custo: number | null;
    aviso: string | null;
}

export interface ResultadoFicha {
    itens: ItemCalculado[];
    maoDeObra: number;
    materiais: number;
    equipamentos: number;
    subtotal: number;
    controleQualidade: number;
    total: number;
    avisos: string[];
}

function calcularItem(item: ItemFicha, ctx: ContextoCalculo): ItemCalculado {
    const base = { ...item, nome: item.descricao ?? '', unidade: null, precoUnitario: null };
    if (!(item.rendimento > 0)) return { ...base, custo: null, aviso: 'Rendimento deve ser maior que zero.' };

    if (item.tipo === 'ATIVIDADE') {
        if (item.minutos === null || item.minutos === undefined) return { ...base, custo: null, aviso: 'Informe os minutos.' };
        const custoMinuto = ctx.parametros.custoMinutoTecnico;
        return { ...base, precoUnitario: custoMinuto, custo: item.minutos * custoMinuto / item.rendimento, aviso: null };
    }

    if (item.tipo === 'INSUMO') {
        const insumo = item.insumoId ? ctx.insumos.get(item.insumoId) : undefined;
        if (!insumo) return { ...base, custo: null, aviso: 'Insumo não encontrado.' };
        const comInsumo = { ...base, nome: insumo.nome, unidade: insumo.unidade, precoUnitario: insumo.precoUnitario };
        if (insumo.precoUnitario === null) return { ...comInsumo, custo: null, aviso: `"${insumo.nome}" não tem preço vigente.` };
        if (item.quantidade === null || item.quantidade === undefined) return { ...comInsumo, custo: null, aviso: 'Informe a quantidade.' };
        return {
            ...comInsumo,
            custo: item.quantidade * insumo.precoUnitario / item.rendimento,
            aviso: insumo.ativo ? null : `"${insumo.nome}" está inativo.`,
        };
    }

    const equipamento = item.equipamentoId ? ctx.equipamentos.get(item.equipamentoId) : undefined;
    if (!equipamento) return { ...base, custo: null, aviso: 'Equipamento não encontrado.' };
    const comEquipamento = { ...base, nome: equipamento.nome, precoUnitario: equipamento.valor };
    if (equipamento.valor === null) return { ...comEquipamento, custo: null, aviso: `"${equipamento.nome}" está sem valor.` };
    const avisoInativo = equipamento.ativo ? null : `"${equipamento.nome}" está inativo.`;
    // Contrato de manutenção: o valor é dividido direto pelas análises atendidas.
    if (equipamento.tipo === 'MANUTENCAO') {
        return { ...comEquipamento, custo: equipamento.valor / item.rendimento, aviso: avisoInativo };
    }
    const vidaUtil = item.vidaUtilMeses ?? equipamento.vidaUtilMeses;
    if (!vidaUtil) return { ...comEquipamento, custo: null, aviso: `Informe a vida útil de "${equipamento.nome}".` };
    const diasMes = equipamento.diasUsoMes ?? ctx.parametros.diasUteisMes;
    return {
        ...comEquipamento,
        custo: equipamento.valor / (vidaUtil * diasMes) / item.rendimento,
        aviso: avisoInativo,
    };
}

export function calcularFicha(itens: ItemFicha[], percentualCQ: number, ctx: ContextoCalculo): ResultadoFicha {
    const calculados = itens.map(item => calcularItem(item, ctx));
    const soma = (tipo: TipoItem) => calculados.filter(i => i.tipo === tipo).reduce((acc, i) => acc + (i.custo ?? 0), 0);
    const maoDeObra = soma('ATIVIDADE');
    const materiais = soma('INSUMO');
    const equipamentos = soma('EQUIPAMENTO');
    const subtotal = maoDeObra + materiais + equipamentos;
    const controleQualidade = subtotal * percentualCQ / 100;
    return {
        itens: calculados,
        maoDeObra,
        materiais,
        equipamentos,
        subtotal,
        controleQualidade,
        total: subtotal + controleQualidade,
        avisos: calculados.filter(i => i.aviso).map(i => i.aviso!),
    };
}

// ── Validação ────────────────────────────────────────────

function numero(value: unknown, campo: string, opcional = true): number | null {
    if (value === undefined || value === null || value === '') {
        if (opcional) return null;
        throw new CustosValidationError(`Informe ${campo}.`);
    }
    const n = typeof value === 'number' ? value : Number(String(value).replace(',', '.'));
    if (!Number.isFinite(n) || n < 0) throw new CustosValidationError(`${campo} inválido.`);
    return n;
}

function texto(value: unknown): string | null {
    if (value === undefined || value === null) return null;
    const t = String(value).trim();
    return t || null;
}

export function validarItens(body: unknown): ItemFicha[] {
    if (!Array.isArray(body)) throw new CustosValidationError('Itens da ficha inválidos.');
    return body.map((raw, ordem) => {
        const item = (raw ?? {}) as Record<string, unknown>;
        const tipo = item.tipo as TipoItem;
        if (!TIPOS_ITEM.includes(tipo)) throw new CustosValidationError(`Linha ${ordem + 1}: tipo inválido.`);
        const rendimento = numero(item.rendimento, 'o rendimento') ?? 1;
        if (rendimento <= 0) throw new CustosValidationError(`Linha ${ordem + 1}: o rendimento deve ser maior que zero.`);
        const comum = { tipo, ordem, rendimento, grupo: texto(item.grupo) };
        if (tipo === 'ATIVIDADE') {
            return { ...comum, descricao: texto(item.descricao), minutos: numero(item.minutos, 'os minutos da atividade', false) };
        }
        if (tipo === 'INSUMO') {
            const insumoId = texto(item.insumoId);
            if (!insumoId) throw new CustosValidationError(`Linha ${ordem + 1}: escolha o insumo.`);
            return { ...comum, insumoId, quantidade: numero(item.quantidade, 'a quantidade do insumo', false) };
        }
        const equipamentoId = texto(item.equipamentoId);
        if (!equipamentoId) throw new CustosValidationError(`Linha ${ordem + 1}: escolha o equipamento.`);
        return { ...comum, equipamentoId, vidaUtilMeses: numero(item.vidaUtilMeses, 'a vida útil') };
    });
}

function dadosEnsaio(body: Record<string, unknown>) {
    const nome = texto(body.nome);
    if (!nome) throw new CustosValidationError('Informe o nome do ensaio.');
    const percentualCQ = numero(body.percentualCQ, 'o % de controle de qualidade') ?? 0;
    if (percentualCQ > 100) throw new CustosValidationError('O % de controle de qualidade deve ficar entre 0 e 100.');
    return {
        nome,
        chave: chaveCadastro(nome),
        codigoLims: texto(body.codigoLims),
        metodologia: texto(body.metodologia),
        setor: texto(body.setor),
        percentualCQ,
        observacao: texto(body.observacao),
    };
}

async function garantirNomeLivre(chave: string, idAtual?: string) {
    const existente = await prisma.ensaio.findUnique({ where: { chave } });
    if (existente && existente.id !== idAtual) throw new CustosValidationError(`Já existe o ensaio "${existente.nome}".`);
}

// ── CRUD ─────────────────────────────────────────────────

const itensOrdenados = { orderBy: { ordem: 'asc' as const } };

function paraItemFicha(item: {
    tipo: string; ordem: number; descricao: string | null; grupo: string | null; minutos: number | null;
    insumoId: string | null; quantidade: number | null; equipamentoId: string | null; vidaUtilMeses: number | null; rendimento: number;
}): ItemFicha {
    return { ...item, tipo: item.tipo as TipoItem };
}

export async function listarEnsaios(data?: Date) {
    const [ensaios, ctx] = await Promise.all([
        prisma.ensaio.findMany({ orderBy: { nome: 'asc' }, include: { itens: itensOrdenados } }),
        carregarContexto(data),
    ]);
    return ensaios.map(({ itens, ...ensaio }) => {
        const r = calcularFicha(itens.map(paraItemFicha), ensaio.percentualCQ, ctx);
        return {
            ...ensaio,
            qtdItens: itens.length,
            custo: {
                maoDeObra: r.maoDeObra,
                materiais: r.materiais,
                equipamentos: r.equipamentos,
                controleQualidade: r.controleQualidade,
                total: r.total,
                qtdAvisos: r.avisos.length,
            },
        };
    });
}

export async function obterEnsaio(id: string, data?: Date) {
    const ensaio = await prisma.ensaio.findUnique({ where: { id }, include: { itens: itensOrdenados } });
    if (!ensaio) return null;
    const ctx = await carregarContexto(data);
    const { itens, ...resto } = ensaio;
    const calculo = calcularFicha(itens.map(paraItemFicha), ensaio.percentualCQ, ctx);
    return { ...resto, calculo: { ...calculo, itens: calculo.itens.map((c, i) => ({ ...c, id: itens[i].id })) } };
}

export async function simularFicha(body: Record<string, unknown>) {
    const itens = validarItens(body.itens);
    const percentualCQ = numero(body.percentualCQ, 'o % de controle de qualidade') ?? 0;
    return calcularFicha(itens, percentualCQ, await carregarContexto());
}

function dadosItens(itens: ItemFicha[]) {
    return itens.map((item, ordem) => ({
        tipo: item.tipo,
        ordem,
        descricao: item.descricao ?? null,
        grupo: item.grupo ?? null,
        minutos: item.minutos ?? null,
        insumoId: item.insumoId ?? null,
        quantidade: item.quantidade ?? null,
        equipamentoId: item.equipamentoId ?? null,
        vidaUtilMeses: item.vidaUtilMeses ?? null,
        rendimento: item.rendimento,
    }));
}

export async function criarEnsaio(body: Record<string, unknown>) {
    const data = dadosEnsaio(body);
    await garantirNomeLivre(data.chave);
    const itens = body.itens === undefined ? [] : validarItens(body.itens);
    return prisma.ensaio.create({ data: { ...data, itens: { create: dadosItens(itens) } } });
}

export async function atualizarEnsaio(id: string, body: Record<string, unknown>) {
    const data = dadosEnsaio(body);
    await garantirNomeLivre(data.chave, id);
    const itens = body.itens === undefined ? null : validarItens(body.itens);
    return prisma.$transaction(async tx => {
        const ensaio = await tx.ensaio.update({
            where: { id },
            data: {
                ...data,
                pendencia: texto(body.pendencia),
                ativo: body.ativo === undefined ? undefined : Boolean(body.ativo),
            },
        });
        if (itens) {
            await tx.fichaItem.deleteMany({ where: { ensaioId: id } });
            await tx.fichaItem.createMany({ data: dadosItens(itens).map(i => ({ ...i, ensaioId: id })) });
        }
        return ensaio;
    });
}

export async function duplicarEnsaio(id: string) {
    const origem = await prisma.ensaio.findUnique({ where: { id }, include: { itens: itensOrdenados } });
    if (!origem) throw new CustosValidationError('Ensaio não encontrado.');
    let nome = `${origem.nome} (cópia)`;
    for (let n = 2; await prisma.ensaio.findUnique({ where: { chave: chaveCadastro(nome) } }); n++) {
        nome = `${origem.nome} (cópia ${n})`;
    }
    return prisma.ensaio.create({
        data: {
            nome,
            chave: chaveCadastro(nome),
            codigoLims: null,
            metodologia: origem.metodologia,
            setor: origem.setor,
            percentualCQ: origem.percentualCQ,
            observacao: origem.observacao,
            itens: { create: dadosItens(origem.itens.map(paraItemFicha)) },
        },
    });
}

export async function excluirEnsaio(id: string) {
    await prisma.ensaio.delete({ where: { id } });
}
