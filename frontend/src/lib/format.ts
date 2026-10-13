// Formatação central de moeda — generaliza o padrão que já existia espalhado
// (fmt/fmtCurto/fmtS duplicados em várias páginas) num único lugar.
//
// Convenção do projeto:
//   - KPI em destaque: formatCurrencyCompact (ex: "R$ 8,67 mi") + valor exato
//     no tooltip (ver <CompactCurrency /> em components/ui/compact-currency).
//   - Colunas de tabela: formatCurrencyFull (com centavos).
//   - Toda coluna numérica leva a classe Tailwind `tabular-nums`.

const currencyFull = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const currencyRounded = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

export function formatCurrencyFull(v: number): string {
    return currencyFull.format(v);
}

export function formatCurrencyRounded(v: number): string {
    return currencyRounded.format(v);
}

/** Formato compacto pra números grandes em KPI: "R$ 8,67 mi", "R$ 950 mil", "-R$ 1,20 bi". */
export function formatCurrencyCompact(v: number): string {
    const abs = Math.abs(v);
    const sign = v < 0 ? '-' : '';
    if (abs >= 1_000_000_000) return `${sign}R$ ${(abs / 1_000_000_000).toFixed(2).replace('.', ',')} bi`;
    if (abs >= 1_000_000) return `${sign}R$ ${(abs / 1_000_000).toFixed(2).replace('.', ',')} mi`;
    if (abs >= 1_000) return `${sign}R$ ${(abs / 1_000).toFixed(0)} mil`;
    return currencyRounded.format(v);
}

export function formatPercent(v: number | null | undefined, casas = 1): string {
    return v === null || v === undefined || !isFinite(v) ? '—' : `${v.toFixed(casas).replace('.', ',')}%`;
}
