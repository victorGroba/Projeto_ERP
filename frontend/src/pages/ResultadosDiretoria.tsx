import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList,
} from 'recharts';
import {
    Loader2, Presentation, ArrowUpRight, ArrowDownRight, Minus,
    CalendarRange, GitCompareArrows, BarChart3, Table2, Inbox,
} from 'lucide-react';
import './Dashboard.css';
import './ResultadosDiretoria.css';

// ── Formatação ──────────────────────────────────────────────────────────────
const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
const fmtCompact = (v: number) => {
    const abs = Math.abs(v);
    if (abs >= 1_000_000) return `${(v / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 1)}M`;
    if (abs >= 1_000) return `${(v / 1_000).toFixed(abs >= 10_000 ? 0 : 1)}k`;
    return String(Math.round(v));
};

// ── Tipos e presets ─────────────────────────────────────────────────────────
type PresetKey = 'this_month' | 'last_month' | 'last_3m' | 'last_6m' | 'ytd' | 'this_year' | 'last_year' | 'custom';
type PresetKeyB = PresetKey | 'auto';

const PRESETS: { key: PresetKey; label: string }[] = [
    { key: 'this_month', label: 'Este mês' },
    { key: 'last_month', label: 'Mês passado' },
    { key: 'last_3m',    label: '3 meses' },
    { key: 'last_6m',    label: '6 meses' },
    { key: 'ytd',        label: 'Ano até hoje' },
    { key: 'this_year',  label: 'Ano completo' },
    { key: 'last_year',  label: 'Ano passado' },
    { key: 'custom',     label: 'Personalizado' },
];

const COMPARISON_PRESETS: { key: PresetKeyB; label: string }[] = [
    { key: 'auto',       label: 'Ano anterior' },
    { key: 'last_month', label: 'Mês passado' },
    { key: 'last_3m',    label: '3 meses' },
    { key: 'last_year',  label: 'Ano passado' },
    { key: 'custom',     label: 'Personalizado' },
];

const pad = (n: number) => String(n).padStart(2, '0');
const toISO = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

function computeRange(preset: PresetKey, fallback: { de: string; ate: string }): { de: string; ate: string } {
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

const shiftYear = (iso: string, delta: number) => {
    const d = new Date(`${iso}T00:00:00`);
    d.setFullYear(d.getFullYear() + delta);
    return toISO(d);
};

const shortDate = (iso: string) =>
    iso ? new Date(`${iso}T00:00:00`).toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' }).replace('.', '').toUpperCase() : '';

// ── Paleta ──────────────────────────────────────────────────────────────────
const COLOR_CURRENT = '#2563eb';
const COLOR_PREVIOUS = '#cbd5e1';
const COLOR_SUCCESS = '#059669';
const COLOR_DANGER = '#dc2626';

// ── Badge de variação ───────────────────────────────────────────────────────
const Delta: React.FC<{ pct: number | null; size?: number }> = ({ pct, size = 13 }) => {
    if (pct === null) return <span className="res-delta flat">Novo</span>;
    const cls = Math.abs(pct) < 0.05 ? 'flat' : pct > 0 ? 'up' : 'down';
    const Icon = cls === 'flat' ? Minus : pct > 0 ? ArrowUpRight : ArrowDownRight;
    return (
        <span className={`res-delta ${cls}`}>
            <Icon size={size} />
            {pct > 0 ? '+' : ''}{pct.toFixed(1)}%
        </span>
    );
};

// ── Tooltip ─────────────────────────────────────────────────────────────────
const ChartTooltip = ({ active, payload, label, labelA, labelB }: any) => {
    if (!active || !payload?.length) return null;
    const row = payload[0].payload;
    const variacao: number | null = row.variacao;
    return (
        <div style={{
            background: 'var(--surface)', border: '1px solid var(--border)',
            padding: '0.75rem 0.875rem', borderRadius: 'var(--radius-md)',
            boxShadow: 'var(--shadow-lg)', minWidth: 230,
        }}>
            <div style={{ fontWeight: 700, fontSize: '0.8125rem', marginBottom: '0.5rem', color: 'var(--text-main)' }}>{label}</div>
            {[
                { name: labelA, value: row.valorB, color: COLOR_CURRENT },
                { name: labelB, value: row.valorA, color: COLOR_PREVIOUS },
            ].map((e) => (
                <div key={e.name} style={{ display: 'flex', justifyContent: 'space-between', gap: '1.5rem', alignItems: 'center', padding: '0.1875rem 0', fontSize: '0.8125rem' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-muted)' }}>
                        <i style={{ width: 9, height: 9, borderRadius: 3, background: e.color, display: 'inline-block' }} />
                        {e.name}
                    </span>
                    <strong style={{ color: 'var(--text-main)' }}>{fmt(e.value)}</strong>
                </div>
            ))}
            <div style={{ marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                <span>Variação</span>
                <Delta pct={variacao} size={12} />
            </div>
        </div>
    );
};

// ── Linha de filtro ─────────────────────────────────────────────────────────
interface FilterRowProps {
    icon: React.ReactNode;
    label: string;
    presets: { key: string; label: string }[];
    preset: string;
    onPreset: (k: string) => void;
    de: string; ate: string;
    onDe: (v: string) => void; onAte: (v: string) => void;
    onApply: () => void;
    pending: boolean;
    isLoading?: boolean;
    summary: React.ReactNode;
}

const FilterRow: React.FC<FilterRowProps> = ({
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

// ── Componente principal ────────────────────────────────────────────────────
const ResultadosDiretoria: React.FC = () => {
    const token = localStorage.getItem('@ContaAzul:token');

    const [presetA, setPresetA] = useState<PresetKey>('this_year');
    const [periodoA, setPeriodoA] = useState(() => computeRange('this_year', { de: '', ate: '' }));
    const [customADe, setCustomADe] = useState(periodoA.de);
    const [customAAte, setCustomAAte] = useState(periodoA.ate);

    const [presetB, setPresetB] = useState<PresetKeyB>('auto');
    const [periodoB, setPeriodoB] = useState(() => ({ de: shiftYear(periodoA.de, -1), ate: shiftYear(periodoA.ate, -1) }));
    const [customBDe, setCustomBDe] = useState(periodoB.de);
    const [customBAte, setCustomBAte] = useState(periodoB.ate);

    const [isLoading, setIsLoading] = useState(false);
    const [data, setData] = useState<any>(null);
    const [selectedCC, setSelectedCC] = useState<string>('');

    const handlePresetA = (novo: PresetKey) => {
        setPresetA(novo);
        if (novo === 'custom') return;
        const range = computeRange(novo, periodoA);
        setPeriodoA(range); setCustomADe(range.de); setCustomAAte(range.ate);
        if (presetB === 'auto') {
            const rangeB = { de: shiftYear(range.de, -1), ate: shiftYear(range.ate, -1) };
            setPeriodoB(rangeB); setCustomBDe(rangeB.de); setCustomBAte(rangeB.ate);
        }
    };
    const aplicarCustomA = () => {
        setPeriodoA({ de: customADe, ate: customAAte });
        if (presetB === 'auto') {
            const rangeB = { de: shiftYear(customADe, -1), ate: shiftYear(customAAte, -1) };
            setPeriodoB(rangeB); setCustomBDe(rangeB.de); setCustomBAte(rangeB.ate);
        }
    };

    const handlePresetB = (novo: PresetKeyB) => {
        setPresetB(novo);
        if (novo === 'custom') return;
        const range = novo === 'auto'
            ? { de: shiftYear(periodoA.de, -1), ate: shiftYear(periodoA.ate, -1) }
            : computeRange(novo as PresetKey, periodoB);
        setPeriodoB(range); setCustomBDe(range.de); setCustomBAte(range.ate);
    };
    const aplicarCustomB = () => setPeriodoB({ de: customBDe, ate: customBAte });

    const pendingA = customADe !== periodoA.de || customAAte !== periodoA.ate;
    const pendingB = customBDe !== periodoB.de || customBAte !== periodoB.ate;

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            try {
                const res = await axios.get(
                    `/api/dashboard/despesas/comparativo-cc?deA=${periodoB.de}&ateA=${periodoB.ate}&deB=${periodoA.de}&ateB=${periodoA.ate}`,
                    { headers: { Authorization: `Bearer ${token}` } }
                );
                setData(res.data);
                if (res.data.porCC.length > 0) {
                    const aindaExiste = res.data.porCC.some((c: any) => c.centroDeCusto === selectedCC);
                    if (!aindaExiste) setSelectedCC(res.data.porCC[0].centroDeCusto);
                }
            } catch (err) {
                console.error('Erro ao buscar comparativo CC', err);
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, [periodoA, periodoB, token]); // eslint-disable-line react-hooks/exhaustive-deps

    const labelA = `${shortDate(periodoA.de)} – ${shortDate(periodoA.ate)}`;
    const labelB = `${shortDate(periodoB.de)} – ${shortDate(periodoB.ate)}`;

    const totalAnterior = data?.totais?.totalA || 0;
    const totalAtual = data?.totais?.totalB || 0;
    const varRS = totalAtual - totalAnterior;
    const varPct = totalAnterior > 0 ? (varRS / totalAnterior) * 100 : null;

    const activeCCData = useMemo(
        () => (data && selectedCC ? data.porCC.find((c: any) => c.centroDeCusto === selectedCC) : null),
        [data, selectedCC]
    );

    // Categorias ordenadas por relevância (maior gasto atual primeiro)
    const categorias = useMemo(() => {
        if (!activeCCData) return [];
        return [...activeCCData.categorias].sort((a: any, b: any) => (b.valorB || 0) - (a.valorB || 0));
    }, [activeCCData]);

    const maiorCategoria = categorias[0];
    const chartHeight = Math.max(280, categorias.length * 56 + 40);

    return (
        <div className="module-page res-page">

            {/* Header */}
            <header className="res-header">
                <div>
                    <h2>Painel de Resultados</h2>
                    <p>Comparativo analítico de despesas por Centro de Custo</p>
                </div>
                <div className="res-period-badge">
                    <Presentation size={15} />
                    <strong>{labelA}</strong> vs {labelB}
                </div>
            </header>

            {/* Filtros */}
            <div className="res-filters">
                <FilterRow
                    icon={<CalendarRange size={14} />} label="Período"
                    presets={PRESETS} preset={presetA} onPreset={k => handlePresetA(k as PresetKey)}
                    de={customADe} ate={customAAte} onDe={setCustomADe} onAte={setCustomAAte}
                    onApply={aplicarCustomA} pending={pendingA} isLoading={isLoading}
                    summary={<span style={{ color: COLOR_CURRENT }}>{labelA}</span>}
                />
                <FilterRow
                    icon={<GitCompareArrows size={14} />} label="Comparar com"
                    presets={COMPARISON_PRESETS} preset={presetB} onPreset={k => handlePresetB(k as PresetKeyB)}
                    de={customBDe} ate={customBAte} onDe={setCustomBDe} onAte={setCustomBAte}
                    onApply={aplicarCustomB} pending={pendingB} isLoading={isLoading}
                    summary={<span style={{ color: 'var(--text-muted)' }}>{labelB}</span>}
                />
            </div>

            {isLoading && !data ? (
                <div className="res-state">
                    <Loader2 className="animate-spin" size={32} />
                    Carregando dados...
                </div>
            ) : !data || data.porCC.length === 0 ? (
                <div className="res-state">
                    <Inbox size={32} />
                    Nenhuma despesa encontrada para o período selecionado.
                </div>
            ) : (
                <div className={isLoading ? 'res-loading-overlay' : ''} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

                    {/* KPIs */}
                    <div className="res-kpis">
                        <div className="res-kpi" style={{ ['--kpi-accent' as any]: COLOR_CURRENT }}>
                            <span className="res-kpi-label">Despesa total — período atual</span>
                            <div className="res-kpi-value">{fmt(totalAtual)}</div>
                            <div className="res-kpi-foot">{labelA}</div>
                        </div>

                        <div className="res-kpi" style={{ ['--kpi-accent' as any]: COLOR_PREVIOUS }}>
                            <span className="res-kpi-label">Despesa total — comparativo</span>
                            <div className="res-kpi-value" style={{ color: 'var(--text-muted)' }}>{fmt(totalAnterior)}</div>
                            <div className="res-kpi-foot">{labelB}</div>
                        </div>

                        <div className="res-kpi" style={{ ['--kpi-accent' as any]: varRS > 0 ? COLOR_DANGER : COLOR_SUCCESS }}>
                            <span className="res-kpi-label">Variação no período</span>
                            <div className="res-kpi-value" style={{ color: varRS > 0 ? COLOR_DANGER : COLOR_SUCCESS }}>
                                {varRS > 0 ? '+' : ''}{fmt(varRS)}
                            </div>
                            <div className="res-kpi-foot">
                                <Delta pct={varPct} />
                                <span>frente ao comparativo</span>
                            </div>
                        </div>

                        <div className="res-kpi" style={{ ['--kpi-accent' as any]: 'var(--warning)' }}>
                            <span className="res-kpi-label">Centros de custo</span>
                            <div className="res-kpi-value">{data.porCC.length}</div>
                            <div className="res-kpi-foot">
                                {maiorCategoria ? `Maior rubrica: ${maiorCategoria.categoria}` : 'Sem rubricas'}
                            </div>
                        </div>
                    </div>

                    {/* Abas de Centro de Custo */}
                    <div className="res-tabs">
                        {data.porCC.map((cc: any) => (
                            <button
                                key={cc.centroDeCusto}
                                className={`res-tab${selectedCC === cc.centroDeCusto ? ' is-active' : ''}`}
                                onClick={() => setSelectedCC(cc.centroDeCusto)}
                                title={cc.centroDeCusto}
                            >
                                <span className="res-tab-name">{cc.centroDeCusto}</span>
                                <span className="res-tab-value">{fmt(cc.totalB)}</span>
                            </button>
                        ))}
                    </div>

                    {activeCCData && (
                        <>
                            {/* Gráfico */}
                            <section className="res-panel">
                                <div className="res-panel-head">
                                    <h3>
                                        <BarChart3 size={16} color="var(--primary)" />
                                        {activeCCData.centroDeCusto}
                                        <span className="res-hint">· {categorias.length} rubricas, maiores primeiro</span>
                                    </h3>
                                    <div className="res-legend">
                                        <span><i style={{ background: COLOR_CURRENT }} />{labelA}</span>
                                        <span><i style={{ background: COLOR_PREVIOUS }} />{labelB}</span>
                                    </div>
                                </div>
                                <div className="res-chart-body" style={{ height: chartHeight }}>
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart
                                            data={categorias}
                                            layout="vertical"
                                            margin={{ top: 4, right: 72, left: 8, bottom: 4 }}
                                            barGap={4}
                                            barCategoryGap="28%"
                                        >
                                            <CartesianGrid horizontal={false} stroke="var(--border)" strokeDasharray="3 3" />
                                            <XAxis
                                                type="number" tickFormatter={fmtCompact}
                                                axisLine={false} tickLine={false}
                                                tick={{ fill: 'var(--text-subtle)', fontSize: 11 }}
                                            />
                                            <YAxis
                                                type="category" dataKey="categoria" width={168}
                                                axisLine={false} tickLine={false}
                                                tick={{ fill: 'var(--text-main)', fontSize: 12, fontWeight: 500 }}
                                            />
                                            <Tooltip
                                                content={<ChartTooltip labelA={labelA} labelB={labelB} />}
                                                cursor={{ fill: 'var(--surface-hover)' }}
                                            />
                                            <Bar dataKey="valorA" name={labelB} fill={COLOR_PREVIOUS} barSize={14} radius={[0, 3, 3, 0]} />
                                            <Bar dataKey="valorB" name={labelA} fill={COLOR_CURRENT} barSize={14} radius={[0, 3, 3, 0]}>
                                                <LabelList
                                                    dataKey="valorB" position="right" offset={8}
                                                    formatter={(v: any) => (v > 0 ? fmtCompact(Number(v)) : '')}
                                                    style={{ fill: 'var(--text-muted)', fontSize: 11, fontWeight: 700 }}
                                                />
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </section>

                            {/* Tabela */}
                            <section className="res-panel">
                                <div className="res-panel-head">
                                    <h3><Table2 size={16} color="var(--primary)" /> Detalhamento por rubrica</h3>
                                    <span className="res-hint">A barra indica o peso da rubrica no centro de custo</span>
                                </div>
                                <div className="res-table-wrap">
                                    <table className="res-table">
                                        <thead>
                                            <tr>
                                                <th>Categoria / Rubrica</th>
                                                <th style={{ color: COLOR_CURRENT }}>{labelA}</th>
                                                <th>{labelB}</th>
                                                <th>Variação</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {categorias.map((cat: any) => {
                                                const peso = activeCCData.totalB > 0 ? (cat.valorB / activeCCData.totalB) * 100 : 0;
                                                return (
                                                    <tr key={cat.categoria}>
                                                        <td>
                                                            <div className="res-cat">
                                                                <span className="res-cat-name">{cat.categoria}</span>
                                                                <div className="res-cat-bar"><i style={{ width: `${Math.max(peso, 1)}%` }} /></div>
                                                            </div>
                                                        </td>
                                                        <td className={cat.valorB > 0 ? 'res-val-strong' : 'res-val-empty'}>
                                                            {cat.valorB > 0 ? fmt(cat.valorB) : '—'}
                                                        </td>
                                                        <td className={cat.valorA > 0 ? 'res-val-muted' : 'res-val-empty'}>
                                                            {cat.valorA > 0 ? fmt(cat.valorA) : '—'}
                                                        </td>
                                                        <td><Delta pct={cat.variacao} /></td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                        <tfoot>
                                            <tr>
                                                <td>Subtotal · {activeCCData.centroDeCusto}</td>
                                                <td style={{ color: COLOR_CURRENT }}>{fmt(activeCCData.totalB)}</td>
                                                <td style={{ color: 'var(--text-muted)' }}>{fmt(activeCCData.totalA)}</td>
                                                <td><Delta pct={activeCCData.variacao} /></td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>
                            </section>
                        </>
                    )}
                </div>
            )}
        </div>
    );
};

export default ResultadosDiretoria;
