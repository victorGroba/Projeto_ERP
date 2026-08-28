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
