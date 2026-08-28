/**
 * Vocabulario canonico de status de ContaReceber, gravado tanto pelo sync da API
 * (contaAzulSyncService.mapStatus) quanto pela importacao de CSV
 * (ImportacaoService.normalizeStatusReceita): 'Pago' | 'Vencido' | 'A Vencer'.
 */
export const STATUS_RECEITA = {
    PAGO: 'Pago',
    VENCIDO: 'Vencido',
    A_VENCER: 'A Vencer',
} as const;

/**
 * Titulos ainda em aberto — os unicos que compoem inadimplencia/pendencias.
 *
 * E uma lista branca de proposito: com lista negra (`notIn: ['Recebido','Pago',...]`)
 * qualquer status desconhecido ou com caixa diferente virava divida silenciosamente.
 */
export const STATUS_PENDENTES: string[] = [STATUS_RECEITA.VENCIDO, STATUS_RECEITA.A_VENCER];

/** Filtro Prisma para titulos em aberto. */
export const wherePendentes = () => ({ status: { in: STATUS_PENDENTES } });

/**
 * Valores de `grupo` que nao sao grupo economico de verdade — sao o default do
 * ETL/sync ou nomes genericos de centro de custo. O sync grava em `grupo` o
 * primeiro centro de custo do titulo, entao rotulos assim aparecem no lugar do
 * nome do cliente e tornam o ranking de devedores inutil.
 */
const GRUPOS_GENERICOS = new Set(['sem grupo', 'cliente diversos', 'diversos', 'financeiro', '']);

/**
 * Chave de agrupamento do ranking de devedores: usa o grupo economico quando ele
 * existe de fato, senao o nome do cliente.
 */
export const chaveDevedor = (grupo: string | null, cliente: string | null): string => {
    const g = (grupo || '').trim();
    if (g && !GRUPOS_GENERICOS.has(g.toLowerCase())) return `${g} (Grupo)`;
    return (cliente || '').trim() || 'Sem Cliente';
};
