import React from 'react';
import { Loader2 } from 'lucide-react';

export interface PeriodPreset {
    key: string;
    label: string;
}

interface PeriodFilterBarProps {
    icon?: React.ReactNode;
    label: string;
    presets: PeriodPreset[];
    preset: string;
    onPresetChange: (key: string) => void;
    de: string;
    ate: string;
    onDeChange: (value: string) => void;
    onAteChange: (value: string) => void;
    onApply: () => void;
    pending: boolean;
    isLoading?: boolean;
    trailing?: React.ReactNode;
}

/**
 * Linha de filtro de período reutilizável: preset + duas datas + "Aplicar" (só quando
 * há alteração pendente). O componente não guarda o período aplicado nem a lógica de
 * derivação preset→datas — isso fica com a página, que pode ter semânticas diferentes
 * (ex.: Despesas usa duas instâncias independentes, para período principal e de comparação).
 */
const PeriodFilterBar: React.FC<PeriodFilterBarProps> = ({
    icon, label, presets, preset, onPresetChange,
    de, ate, onDeChange, onAteChange, onApply, pending, isLoading, trailing,
}) => {
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            {icon}
            <span style={{
                color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 600,
                letterSpacing: '0.05em', textTransform: 'uppercase', width: 92, flexShrink: 0,
            }}>
                {label}
            </span>

            <select className="select" value={preset} onChange={(e) => onPresetChange(e.target.value)}>
                {presets.map(p => (
                    <option key={p.key} value={p.key}>{p.label}</option>
                ))}
            </select>

            <span style={{ color: 'var(--text-subtle)', fontSize: '0.875rem' }}>de</span>
            <input
                type="date" className="date-input" value={de} max={ate || undefined}
                onChange={(e) => onDeChange(e.target.value)}
            />
            <span style={{ color: 'var(--text-subtle)', fontSize: '0.875rem' }}>até</span>
            <input
                type="date" className="date-input" value={ate} min={de || undefined}
                onChange={(e) => onAteChange(e.target.value)}
            />

            {pending && (
                <button className="btn btn-primary" onClick={onApply} disabled={!de || !ate}>
                    {isLoading ? <Loader2 size={14} className="animate-spin" /> : 'Aplicar'}
                </button>
            )}

            {trailing && (
                <span style={{ marginLeft: 'auto', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                    {trailing}
                </span>
            )}
        </div>
    );
};

export default PeriodFilterBar;
