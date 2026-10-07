// Presets de período compartilhados pelas telas com comparativo (Despesas, Clientes).
// 'ytd' (ano até hoje) é o padrão para bater com o acumulado mostrado na Visão Geral,
// que também soma de 1º de janeiro até hoje (evita contar lançamentos futuros já agendados).
export type PresetKey = 'this_month' | 'last_month' | 'last_3m' | 'last_6m' | 'ytd' | 'this_year' | 'last_year' | 'custom';

export const PRESETS: { key: PresetKey; label: string }[] = [
    { key: 'this_month', label: 'Este mês' },
    { key: 'last_month', label: 'Mês passado' },
    { key: 'last_3m',    label: 'Últimos 3 meses' },
    { key: 'last_6m',    label: 'Últimos 6 meses' },
    { key: 'ytd',        label: 'Ano até hoje' },
    { key: 'this_year',  label: 'Ano completo' },
    { key: 'last_year',  label: 'Ano passado' },
    { key: 'custom',     label: 'Personalizado' },
];

const pad = (n: number) => String(n).padStart(2, '0');
export const toISO = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export function computeRange(preset: PresetKey, fallback: { de: string; ate: string }): { de: string; ate: string } {
    const hoje = new Date();
    const y = hoje.getFullYear();
    const m = hoje.getMonth();

    switch (preset) {
        case 'this_month':
            return { de: toISO(new Date(y, m, 1)), ate: toISO(hoje) };
        case 'last_month':
            return { de: toISO(new Date(y, m - 1, 1)), ate: toISO(new Date(y, m, 0)) };
        case 'last_3m':
            return { de: toISO(new Date(y, m - 2, 1)), ate: toISO(hoje) };
        case 'last_6m':
            return { de: toISO(new Date(y, m - 5, 1)), ate: toISO(hoje) };
        case 'ytd':
            return { de: `${y}-01-01`, ate: toISO(hoje) };
        case 'this_year':
            return { de: `${y}-01-01`, ate: `${y}-12-31` };
        case 'last_year':
            return { de: `${y - 1}-01-01`, ate: `${y - 1}-12-31` };
        default:
            return fallback;
    }
}

export const shiftYear = (iso: string, delta: number) => {
    const d = new Date(`${iso}T00:00:00`);
    d.setFullYear(d.getFullYear() + delta);
    return toISO(d);
};

// Presets do período de comparação: 'auto' acompanha o período principal (mesmo
// intervalo, 1 ano antes) — qualquer outra escolha desconecta e vira independente.
export type PresetKeyB = PresetKey | 'auto';
export const COMPARISON_PRESETS: { key: PresetKeyB; label: string }[] = [
    { key: 'auto', label: 'Automático (mesmo intervalo, ano anterior)' },
    ...PRESETS,
];

export const fmtDateLabel = (iso?: string) =>
    iso ? new Date(`${iso}T00:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }) : '';
