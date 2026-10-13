import { PrismaClient } from '@prisma/client';
import { CustosValidationError, chaveCadastro } from './custosService';
import { custoDiretoEnsaios, obterParametros } from './ensaiosService';

const prisma = new PrismaClient();

// Serviço vendido ao cliente. Um serviço pode ter mais de um grupo com preço
// próprio (ex.: "Água de Rede" vende um grupo Físico-Químico e um grupo
// Microbiológico em separado) — a margem de contribuição é calculada por
// grupo (preço − imposto − soma do custo direto dos ensaios do grupo), não
// no serviço nem no ensaio isolado.

function texto(value: unknown): string | null {
    if (value === undefined || value === null) return null;
    const t = String(value).trim();
    return t || null;
}

function nomeObrigatorio(value: unknown, campo = 'o nome'): string {
    const nome = texto(value);
    if (!nome) throw new CustosValidationError(`Informe ${campo}.`);
    return nome;
}

function numero(value: unknown, campo: string, opcional = true): number | null {
    if (value === undefined || value === null || value === '') {
        if (opcional) return null;
        throw new CustosValidationError(`Informe ${campo}.`);
    }
    const n = typeof value === 'number' ? value : Number(String(value).replace(',', '.'));
    if (!Number.isFinite(n) || n < 0) throw new CustosValidationError(`${campo} inválido.`);
    return n;
}

export interface GrupoInput {
    nome: string;
    setor: string | null;
    precoVenda: number;
    nomeAllims: string | null;
    pendencia: string | null;
    ensaioIds: string[];
}

export function validarGrupos(body: unknown): GrupoInput[] {
    if (!Array.isArray(body)) throw new CustosValidationError('Grupos do serviço inválidos.');
    if (!body.length) throw new CustosValidationError('O serviço precisa de pelo menos um grupo com preço.');
    return body.map((raw, i) => {
        const g = (raw ?? {}) as Record<string, unknown>;
        const ensaioIds = Array.isArray(g.ensaioIds) ? g.ensaioIds.map(String).filter(Boolean) : [];
        if (!ensaioIds.length) throw new CustosValidationError(`Grupo ${i + 1}: escolha pelo menos um ensaio.`);
        return {
            nome: nomeObrigatorio(g.nome, `o nome do grupo ${i + 1}`),
            setor: texto(g.setor),
            precoVenda: numero(g.precoVenda, `o preço de venda do grupo ${i + 1}`, false)!,
            nomeAllims: texto(g.nomeAllims),
            pendencia: texto(g.pendencia),
            ensaioIds: [...new Set(ensaioIds)],
        };
    });
}

function dadosServico(body: Record<string, unknown>) {
    const nome = nomeObrigatorio(body.nome);
    return {
        nome,
        chave: chaveCadastro(nome),
        codigo: texto(body.codigo),
        observacao: texto(body.observacao),
    };
}

async function garantirNomeLivre(chave: string, idAtual?: string) {
    const existente = await prisma.servico.findUnique({ where: { chave } });
    if (existente && existente.id !== idAtual) throw new CustosValidationError(`Já existe o serviço "${existente.nome}".`);
}

const gruposComEnsaios = {
    grupos: { include: { ensaios: { include: { ensaio: true } } } },
};

// Calcula a margem de contribuição de cada grupo usando o custo direto já
// calculado dos ensaios (preços vigentes) e a alíquota de imposto atual.
async function comMargem<T extends { precoVenda: number; ensaios: { ensaioId: string; ensaio: { nome: string; ativo: boolean } }[] }>(
    grupos: T[],
    data?: Date,
) {
    const todosIds = grupos.flatMap(g => g.ensaios.map(e => e.ensaioId));
    const [custos, parametros] = await Promise.all([
        custoDiretoEnsaios(todosIds, data),
        obterParametros(),
    ]);
    return grupos.map(grupo => {
        const custoDireto = grupo.ensaios.reduce((acc, ge) => acc + (custos.get(ge.ensaioId)?.total ?? 0), 0);
        const avisos: string[] = [];
        for (const ge of grupo.ensaios) {
            const c = custos.get(ge.ensaioId);
            if (!c) { avisos.push(`"${ge.ensaio.nome}" sem custo calculado.`); continue; }
            if (!c.ativo) avisos.push(`"${c.nome}" está inativo.`);
            if (c.avisos.length) avisos.push(...c.avisos);
        }
        const imposto = grupo.precoVenda * parametros.aliquotaImpostos / 100;
        const margemContribuicao = grupo.precoVenda - imposto - custoDireto;
        return {
            ...grupo,
            margem: {
                custoDireto,
                imposto,
                margemContribuicao,
                percentualMargem: grupo.precoVenda > 0 ? margemContribuicao / grupo.precoVenda * 100 : null,
                qtdAvisos: avisos.length,
                avisos,
            },
        };
    });
}

export async function listarServicos(data?: Date) {
    const servicos = await prisma.servico.findMany({ orderBy: { nome: 'asc' }, include: gruposComEnsaios });
    const gruposComMargem = await comMargem(servicos.flatMap(s => s.grupos), data);
    const porId = new Map(gruposComMargem.map(g => [g.id, g]));
    return servicos.map(({ grupos, ...servico }) => ({
        ...servico,
        grupos: grupos.map(g => porId.get(g.id)!),
    }));
}

export async function obterServico(id: string, data?: Date) {
    const servico = await prisma.servico.findUnique({ where: { id }, include: gruposComEnsaios });
    if (!servico) return null;
    const { grupos, ...resto } = servico;
    return { ...resto, grupos: await comMargem(grupos, data) };
}

function dadosGrupos(grupos: GrupoInput[]) {
    return grupos.map(g => ({
        nome: g.nome,
        setor: g.setor,
        precoVenda: g.precoVenda,
        nomeAllims: g.nomeAllims,
        pendencia: g.pendencia,
        ensaios: { create: g.ensaioIds.map(ensaioId => ({ ensaioId })) },
    }));
}

export async function criarServico(body: Record<string, unknown>) {
    const data = dadosServico(body);
    await garantirNomeLivre(data.chave);
    const grupos = validarGrupos(body.grupos);
    return prisma.servico.create({ data: { ...data, grupos: { create: dadosGrupos(grupos) } } });
}

export async function atualizarServico(id: string, body: Record<string, unknown>) {
    const data = dadosServico(body);
    await garantirNomeLivre(data.chave, id);
    const grupos = body.grupos === undefined ? null : validarGrupos(body.grupos);
    return prisma.$transaction(async tx => {
        const servico = await tx.servico.update({
            where: { id },
            data: { ...data, ativo: body.ativo === undefined ? undefined : Boolean(body.ativo) },
        });
        if (grupos) {
            await tx.grupoAnalitico.deleteMany({ where: { servicoId: id } });
            for (const g of dadosGrupos(grupos)) {
                await tx.grupoAnalitico.create({ data: { ...g, servicoId: id } });
            }
        }
        return servico;
    });
}

export async function excluirServico(id: string) {
    await prisma.servico.delete({ where: { id } });
}
