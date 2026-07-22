import React from 'react';
import { Loader2 } from 'lucide-react';
import './PeriodoChips.css';

/**
 * Filtro de período em chips, compartilhado pelas telas de diretoria
 * (Resultados e Índices). Cada tela guarda o próprio estado — aqui fica só a
 * apresentação e as funções de derivação preset → intervalo de datas.
 */

export type PresetKey =
    | 'this_month' | 'last_month' | 'last_3m' | 'last_6m'
    | 'ytd' | 'this_year' | 'last_year' | 'custom';

export type PresetKeyB = PresetKey | 'auto';

export const PRESETS: { key: PresetKey; label: string }[] = [
    { key: 'this_month', label: 'Este mês' },
    { key: 'last_month', label: 'Mês passado' },
    { key: 'last_3m',    label: '3 meses' },
    { key: 'last_6m',    label: '6 meses' },
    { key: 'ytd',        label: 'Ano até hoje' },
    { key: 'this_year',  label: 'Ano completo' },
    { key: 'last_year',  label: 'Ano passado' },
    { key: 'custom',     label: 'Personalizado' },
];

export const COMPARISON_PRESETS: { key: PresetKeyB; label: string }[] = [
    { key: 'auto',       label: 'Ano anterior' },
    { key: 'last_month', label: 'Mês passado' },
    { key: 'last_3m',    label: '3 meses' },
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
        case 'this_month': return { de: toISO(new Date(y, m, 1)), ate: toISO(hoje) };
        case 'last_month': return { de: toISO(new Date(y, m - 1, 1)), ate: toISO(new Date(y, m, 0)) };
        case 'last_3m':    return { de: toISO(new Date(y, m - 2, 1)), ate: toISO(hoje) };
        case 'last_6m':    return { de: toISO(new Date(y, m - 5, 1)), ate: toISO(hoje) };
        case 'ytd':        return { de: `${y}-01-01`, ate: toISO(hoje) };
        case 'this_year':  return { de: `${y}-01-01`, ate: `${y}-12-31` };
        case 'last_year':  return { de: `${y - 1}-01-01`, ate: `${y - 1}-12-31` };
        default:           return fallback;
    }
}

export const shiftYear = (iso: string, delta: number) => {
    const d = new Date(`${iso}T00:00:00`);
    d.setFullYear(d.getFullYear() + delta);
    return toISO(d);
};

export const shortDate = (iso: string) =>
    iso
        ? new Date(`${iso}T00:00:00`)
            .toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' })
            .replace('.', '')
            .toUpperCase()
        : '';

interface Props {
    icon: React.ReactNode;
    label: string;
    presets: { key: string; label: string }[];
    preset: string;
    onPreset: (k: string) => void;
    de: string;
    ate: string;
    onDe: (v: string) => void;
    onAte: (v: string) => void;
    onApply: () => void;
    pending: boolean;
    isLoading?: boolean;
    summary: React.ReactNode;
}

const PeriodoChips: React.FC<Props> = ({
    icon, label, presets, preset, onPreset, de, ate, onDe, onAte, onApply, pending, isLoading, summary,
}) => (
    <div className="res-filter-row">
        <span className="res-filter-label">{icon}{label}</span>
        <div className="res-chips">
            {presets.map(p => (
                <button
                    key={p.key}
                    className={`res-chip${preset === p.key ? ' is-active' : ''}`}
                    onClick={() => onPreset(p.key)}
                >
                    {p.label}
                </button>
            ))}
        </div>
        {preset === 'custom' && (
            <div className="res-dates">
                <input type="date" className="date-input" value={de} max={ate || undefined} onChange={e => onDe(e.target.value)} />
                <span>até</span>
                <input type="date" className="date-input" value={ate} min={de || undefined} onChange={e => onAte(e.target.value)} />
                <button className="btn btn-primary" onClick={onApply} disabled={!de || !ate || !pending}>
                    {isLoading ? <Loader2 size={14} className="animate-spin" /> : 'Aplicar'}
                </button>
            </div>
        )}
        <span className="res-filter-summary">{summary}</span>
    </div>
);

export default PeriodoChips;
