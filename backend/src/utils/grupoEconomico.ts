import { PrismaClient } from '@prisma/client';

/**
 * Valores de `grupo` que nao sao grupo economico de verdade — sao o default do
 * ETL/sync ou rotulos genericos de centro de custo.
 */
const GRUPOS_GENERICOS = new Set(['sem grupo', 'cliente diversos', 'diversos', 'financeiro', '']);

const ehGenerico = (grupo: string) => GRUPOS_GENERICOS.has(grupo.trim().toLowerCase());

/**
 * Resolve UM grupo economico por cliente.
 *
 * O sync grava em `grupo` o primeiro centro de custo do titulo, e esse
 * preenchimento varia de titulo para titulo: o mesmo cliente aparece ora como
 * "SODEXO", ora como "Sem Grupo", ora como "CLIENTE DIVERSOS". Como o ranking de
 * devedores montava a chave titulo a titulo, um unico devedor se partia em
 * varias linhas (a Sodexo aparecia tres vezes, somando R$ 117 mil divididos).
 *
 * Aqui olhamos todos os titulos de cada cliente e elegemos o grupo por voto
 * majoritario entre os nao-genericos; empate resolve por ordem alfabetica, so
 * para o resultado ser deterministico. Nao ha mapeamento inventado: se o Conta
 * Azul nunca associou aquele cliente a um grupo, ele fica sem grupo e o ranking
 * usa o nome do cliente.
 */
export async function resolverGruposPorCliente(prisma: PrismaClient): Promise<Map<string, string>> {
    const titulos = await prisma.contaReceber.findMany({ select: { cliente: true, grupo: true } });

    const votos = new Map<string, Map<string, number>>();
    for (const t of titulos) {
        const cliente = (t.cliente || '').trim();
        const grupo = (t.grupo || '').trim();
        if (!cliente || !grupo || ehGenerico(grupo)) continue;

        if (!votos.has(cliente)) votos.set(cliente, new Map());
        const doCliente = votos.get(cliente)!;
        doCliente.set(grupo, (doCliente.get(grupo) || 0) + 1);
    }

    const resolvido = new Map<string, string>();
    for (const [cliente, contagem] of votos) {
        const vencedor = [...contagem.entries()]
            .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0][0];
        resolvido.set(cliente, vencedor);
    }
    return resolvido;
}

/**
 * Chave de agrupamento do ranking de devedores: grupo economico quando o cliente
 * pertence a um, senao o nome do proprio cliente.
 */
export function chaveDevedor(cliente: string | null, grupos: Map<string, string>): string {
    const nome = (cliente || '').trim();
    if (!nome) return 'Sem Cliente';
    const grupo = grupos.get(nome);
    return grupo ? `${grupo} (Grupo)` : nome;
}
