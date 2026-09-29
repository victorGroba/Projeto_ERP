import { PrismaClient } from '@prisma/client';
import { getAPI, persistTokens } from './contaAzulSyncService';

const prisma = new PrismaClient();
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

function optionalString(value: unknown): string | null {
    if (value === undefined || value === null) return null;
    const normalized = String(value).trim();
    return normalized || null;
}

function optionalDate(value: unknown): Date | null {
    if (!value) return null;
    const parsed = new Date(String(value));
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function mapPessoa(item: any) {
    const endereco = item.enderecos?.[0] || item.endereco || {};
    const id = optionalString(item.id || item.uuid);
    if (!id) return null;

    return {
        id,
        codigo: optionalString(item.codigo || item.codigo_pessoa || item.codigo_identificador),
        nome: optionalString(item.nome || item.nome_empresa) || 'Sem nome',
        nomeEmpresa: optionalString(item.nome_empresa),
        documento: optionalString(item.documento),
        email: optionalString(item.email),
        telefoneCelular: optionalString(item.telefone_celular || item.telefone),
        telefoneComercial: optionalString(item.telefone_comercial),
        cidade: optionalString(endereco.cidade),
        uf: optionalString(endereco.uf || endereco.estado),
        tipoPessoa: optionalString(item.tipo_pessoa),
        ativo: item.ativo !== false,
        criadoEm: optionalDate(item.criado_em || item.data_criacao),
        alteradoEm: optionalDate(item.data_alteracao || item.alterado_em),
        sincronizadoEm: new Date(),
    };
}

/** Baixa o cadastro completo de clientes e substitui o espelho local atomicamente. */
export async function sincronizarClientes(
    onProgress?: (processados: number, total: number) => void,
): Promise<{ quantidade: number; comCodigo: number }> {
    const api = await getAPI();
    await api.tryRefreshToken();

    const pessoas: any[] = [];
    let pagina = 1;
    let total = Infinity;

    while (pessoas.length < total) {
        if (pagina > 1) await sleep(300);
        const resposta = await api.getPessoas({
            pagina,
            tamanhoPagina: 200,
            tipoPerfil: 'Cliente',
            comEndereco: true,
        });
        if (!Array.isArray(resposta?.items) && !Array.isArray(resposta?.itens)) {
            throw new Error('A API de Pessoas retornou um formato inesperado; o cadastro local foi preservado.');
        }
        const itens = resposta?.items || resposta?.itens || [];
        if (pagina === 1) total = resposta?.totalItems ?? resposta?.itens_totais ?? itens.length;
        if (itens.length === 0) break;
        pessoas.push(...itens);
        pagina++;
    }

    // A listagem de Pessoas pode devolver apenas o resumo, sem o campo `codigo`.
    // Nesses casos buscamos o detalhe, onde a API documenta e retorna esse campo.
    // A pausa mantém a rotina abaixo do limite de 10 requisições por segundo.
    const pessoasCompletas: any[] = [];
    onProgress?.(0, pessoas.length);
    for (const pessoa of pessoas) {
        const resumo = mapPessoa(pessoa);
        if (!resumo || resumo.codigo) {
            pessoasCompletas.push(pessoa);
            onProgress?.(pessoasCompletas.length, pessoas.length);
            continue;
        }

        if (pessoasCompletas.length > 0) await sleep(150);
        const detalhe = await api.getPessoaById(resumo.id);
        pessoasCompletas.push({ ...pessoa, ...detalhe, id: detalhe?.id || resumo.id });
        onProgress?.(pessoasCompletas.length, pessoas.length);
    }

    const registros = pessoasCompletas.map(mapPessoa).filter((p): p is NonNullable<ReturnType<typeof mapPessoa>> => Boolean(p));
    await prisma.$transaction([
        prisma.clienteContaAzul.deleteMany(),
        prisma.clienteContaAzul.createMany({ data: registros }),
    ]);
    await persistTokens(api);
    return { quantidade: registros.length, comCodigo: registros.filter(registro => Boolean(registro.codigo)).length };
}
