import { Prisma, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export class CustosValidationError extends Error {}

export function chaveCadastro(nome: string): string {
    return nome
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim();
}

function textoOpcional(value: unknown): string | null {
    if (value === undefined || value === null) return null;
    const texto = String(value).trim();
    return texto ? texto : null;
}

function numeroOpcional(value: unknown, campo: string): number | null {
    if (value === undefined || value === null || value === '') return null;
    const numero = typeof value === 'number' ? value : Number(String(value).replace(',', '.'));
    if (!Number.isFinite(numero) || numero < 0) throw new CustosValidationError(`${campo} inválido.`);
    return numero;
}

function inteiroOpcional(value: unknown, campo: string): number | null {
    const numero = numeroOpcional(value, campo);
    if (numero !== null && !Number.isInteger(numero)) throw new CustosValidationError(`${campo} deve ser um número inteiro.`);
    return numero;
}

function nomeObrigatorio(value: unknown): string {
    const nome = textoOpcional(value);
    if (!nome) throw new CustosValidationError('Informe o nome.');
    return nome;
}

function dataVigencia(value: unknown): Date {
    if (!value) return new Date();
    const data = new Date(String(value));
    if (Number.isNaN(data.getTime())) throw new CustosValidationError('Data de vigência inválida.');
    return data;
}

async function garantirChaveLivre(model: 'insumo' | 'equipamento', chave: string, idAtual?: string) {
    const existente = model === 'insumo'
        ? await prisma.insumo.findUnique({ where: { chave } })
        : await prisma.equipamento.findUnique({ where: { chave } });
    if (existente && existente.id !== idAtual) {
        throw new CustosValidationError(`Já existe um cadastro com o nome "${existente.nome}".`);
    }
}

// ── Insumos ──────────────────────────────────────────────

export interface NovoPrecoInput {
    precoEmbalagem: unknown;
    qtdEmbalagem: unknown;
    vigencia?: unknown;
    fornecedor?: unknown;
}

export function montarPreco(input: NovoPrecoInput, origem: string) {
    const precoEmbalagem = numeroOpcional(input.precoEmbalagem, 'Preço da embalagem');
    const qtdEmbalagem = numeroOpcional(input.qtdEmbalagem, 'Quantidade da embalagem');
    if (precoEmbalagem === null) throw new CustosValidationError('Informe o preço da embalagem.');
    if (!qtdEmbalagem) throw new CustosValidationError('Informe a quantidade da embalagem (maior que zero).');
    return {
        precoEmbalagem,
        qtdEmbalagem,
        precoUnitario: precoEmbalagem / qtdEmbalagem,
        vigencia: dataVigencia(input.vigencia),
        fornecedor: textoOpcional(input.fornecedor),
        origem,
    };
}

const precosOrdenados = { orderBy: [{ vigencia: 'desc' }, { createdAt: 'desc' }] } satisfies Prisma.Insumo$precosArgs;

function comPrecoAtual<T extends { precos: { vigencia: Date }[] }>(insumo: T) {
    const agora = Date.now();
    const precoAtual = insumo.precos.find(p => p.vigencia.getTime() <= agora) ?? null;
    return { ...insumo, precoAtual };
}

export async function listarInsumos() {
    const insumos = await prisma.insumo.findMany({
        orderBy: { nome: 'asc' },
        include: { precos: precosOrdenados },
    });
    return insumos.map(insumo => {
        const { precos, ...resto } = comPrecoAtual(insumo);
        return { ...resto, qtdPrecos: precos.length };
    });
}

export async function obterInsumo(id: string) {
    const insumo = await prisma.insumo.findUnique({ where: { id }, include: { precos: precosOrdenados } });
    return insumo ? comPrecoAtual(insumo) : null;
}

export async function criarInsumo(body: Record<string, unknown>) {
    const nome = nomeObrigatorio(body.nome);
    const chave = chaveCadastro(nome);
    await garantirChaveLivre('insumo', chave);
    const temPreco = body.precoEmbalagem !== undefined && body.precoEmbalagem !== '';
    const preco = temPreco ? montarPreco(body as unknown as NovoPrecoInput, 'Manual') : null;

    return prisma.insumo.create({
        data: {
            nome,
            chave,
            unidade: textoOpcional(body.unidade),
            categoria: textoOpcional(body.categoria),
            setor: textoOpcional(body.setor),
            observacao: textoOpcional(body.observacao),
            ...(preco ? { precos: { create: preco } } : {}),
        },
    });
}

export async function atualizarInsumo(id: string, body: Record<string, unknown>) {
    const nome = nomeObrigatorio(body.nome);
    const chave = chaveCadastro(nome);
    await garantirChaveLivre('insumo', chave, id);
    return prisma.insumo.update({
        where: { id },
        data: {
            nome,
            chave,
            unidade: textoOpcional(body.unidade),
            categoria: textoOpcional(body.categoria),
            setor: textoOpcional(body.setor),
            observacao: textoOpcional(body.observacao),
            pendencia: textoOpcional(body.pendencia),
            ativo: body.ativo === undefined ? undefined : Boolean(body.ativo),
        },
    });
}

export async function excluirInsumo(id: string) {
    await prisma.insumo.delete({ where: { id } });
}

export async function registrarPrecoInsumo(insumoId: string, body: NovoPrecoInput) {
    return prisma.insumoPreco.create({ data: { ...montarPreco(body, 'Manual'), insumoId } });
}

export async function excluirPrecoInsumo(insumoId: string, precoId: string) {
    const { count } = await prisma.insumoPreco.deleteMany({ where: { id: precoId, insumoId } });
    if (!count) throw new CustosValidationError('Preço não encontrado.');
}

// ── Equipamentos ─────────────────────────────────────────

const TIPOS_EQUIPAMENTO = ['EQUIPAMENTO', 'CALIBRACAO'];

function dadosEquipamento(body: Record<string, unknown>) {
    const nome = nomeObrigatorio(body.nome);
    const tipo = textoOpcional(body.tipo) ?? 'EQUIPAMENTO';
    if (!TIPOS_EQUIPAMENTO.includes(tipo)) throw new CustosValidationError('Tipo inválido.');
    return {
        nome,
        chave: chaveCadastro(nome),
        tipo,
        setor: textoOpcional(body.setor),
        valor: numeroOpcional(body.valor, 'Valor'),
        vidaUtilMeses: inteiroOpcional(body.vidaUtilMeses, 'Vida útil'),
        diasUsoMes: inteiroOpcional(body.diasUsoMes, 'Dias de uso por mês'),
        observacao: textoOpcional(body.observacao),
    };
}

export async function listarEquipamentos() {
    return prisma.equipamento.findMany({ orderBy: [{ tipo: 'asc' }, { nome: 'asc' }] });
}

export async function criarEquipamento(body: Record<string, unknown>) {
    const data = dadosEquipamento(body);
    await garantirChaveLivre('equipamento', data.chave);
    return prisma.equipamento.create({ data });
}

export async function atualizarEquipamento(id: string, body: Record<string, unknown>) {
    const data = dadosEquipamento(body);
    await garantirChaveLivre('equipamento', data.chave, id);
    return prisma.equipamento.update({
        where: { id },
        data: {
            ...data,
            pendencia: textoOpcional(body.pendencia),
            ativo: body.ativo === undefined ? undefined : Boolean(body.ativo),
        },
    });
}

export async function excluirEquipamento(id: string) {
    await prisma.equipamento.delete({ where: { id } });
}
