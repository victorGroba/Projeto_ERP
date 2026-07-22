import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Loader2, TrendingUp, TrendingDown, Presentation, LayoutTemplate, Layers, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import PeriodFilterBar from '../components/PeriodFilterBar';
import './Dashboard.css';

// ── Funções de formatação ───────────────────────────────────────────────────
const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
const fmtK = (v: number) => `${(v / 1000).toFixed(1)}k`;

// ── Tipos ───────────────────────────────────────────────────────────────────
type PresetKey = 'this_month' | 'last_month' | 'last_3m' | 'last_6m' | 'ytd' | 'this_year' | 'last_year' | 'custom';
type PresetKeyB = PresetKey | 'auto';

const PRESETS: { key: PresetKey; label: string }[] = [
    { key: 'this_month', label: 'Este mês' },
    { key: 'last_month', label: 'Mês passado' },
    { key: 'last_3m',    label: 'Últimos 3 meses' },
    { key: 'last_6m',    label: 'Últimos 6 meses' },
    { key: 'ytd',        label: 'Ano até hoje' },
    { key: 'this_year',  label: 'Ano completo' },
    { key: 'last_year',  label: 'Ano passado' },
    { key: 'custom',     label: 'Personalizado' },
];

const COMPARISON_PRESETS: { key: PresetKeyB; label: string }[] = [
    { key: 'auto', label: 'Automático (ano anterior)' },
    ...PRESETS,
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

// ── Tooltip Customizado Clean ────────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        return (
            <div style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                padding: '1rem',
                borderRadius: '8px',
                boxShadow: 'var(--shadow-md)',
                color: 'var(--text-main)',
                minWidth: '220px'
            }}>
                <p style={{ margin: '0 0 0.75rem', fontWeight: 700, fontSize: '0.9375rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>{label}</p>
                {payload.map((entry: any, index: number) => (
                    <div key={index} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '0.5rem 0', fontSize: '0.875rem' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                            <div style={{ width: 10, height: 10, borderRadius: '2px', background: entry.color }}></div>
                            {entry.name}
                        </span>
                        <span style={{ fontWeight: 700 }}>{fmt(entry.value)}</span>
                    </div>
                ))}
            </div>
        );
    }
    return null;
};

// ── Componente Principal ────────────────────────────────────────────────────
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
        const range = novo === 'auto' ? { de: shiftYear(periodoA.de, -1), ate: shiftYear(periodoA.ate, -1) } : computeRange(novo as PresetKey, periodoB);
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
                if (!selectedCC && res.data.porCC.length > 0) {
                    setSelectedCC(res.data.porCC[0].centroDeCusto);
                }
            } catch (err) {
                console.error('Erro ao buscar comparativo CC', err);
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, [periodoA, periodoB, token]); // eslint-disable-line react-hooks/exhaustive-deps

    const activeCCData = useMemo(() => {
        if (!data || !selectedCC) return null;
        return data.porCC.find((c: any) => c.centroDeCusto === selectedCC);
    }, [data, selectedCC]);

    const shortDate = (iso: string) => iso ? new Date(`${iso}T00:00:00`).toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' }).toUpperCase() : '';
    const labelA = `${shortDate(periodoA.de)} a ${shortDate(periodoA.ate)}`;
    const labelB = `${shortDate(periodoB.de)} a ${shortDate(periodoB.ate)}`;

    const totalGeralA = data?.totais?.totalA || 0;
    const totalGeralB = data?.totais?.totalB || 0;
    const varGeralRS = totalGeralB - totalGeralA;
    const varGeralPct = totalGeralA > 0 ? (varGeralRS / totalGeralA) * 100 : 0;

    // Corporate Color Palette
    const COLOR_CURRENT = '#0ea5e9'; // Professional solid blue
    const COLOR_PREVIOUS = '#cbd5e1'; // Slate gray
    const COLOR_SUCCESS = '#10b981';
    const COLOR_DANGER = '#ef4444';

    return (
        <div className="module-page" style={{ paddingBottom: '3rem' }}>
            
            {/* Header Clean */}
            <header style={{ 
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
                marginBottom: '2rem', paddingBottom: '1.5rem', borderBottom: '1px solid var(--border)'
            }}>
                <div>
                    <h2 style={{ fontSize: '1.75rem', fontWeight: 800, margin: '0 0 0.25rem', color: 'var(--text-main)' }}>
                        Painel de Resultados
                    </h2>
                    <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: '0.9375rem', fontWeight: 500 }}>
                        Comparativo analítico de despesas por Centro de Custo
                    </p>
                </div>
                <div style={{ 
                    background: 'var(--primary-light)', color: 'var(--primary)', 
                    padding: '0.5rem 1rem', borderRadius: '4px', 
                    display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700, fontSize: '0.8125rem'
                }}>
                    <Presentation size={16} /> Visão Consolidada
                </div>
            </header>

            {/* Filtros */}
            <div style={{
                display: 'flex', flexDirection: 'column', gap: '0.75rem',
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: '8px', padding: '1rem 1.25rem',
                boxShadow: 'var(--shadow-sm)', marginBottom: '2rem',
            }}>
                <PeriodFilterBar
                    icon={<span />} label="Período Atual"
                    presets={PRESETS} preset={presetA} onPresetChange={(k) => handlePresetA(k as PresetKey)}
                    de={customADe} ate={customAAte} onDeChange={setCustomADe} onAteChange={setCustomAAte}
                    onApply={aplicarCustomA} pending={pendingA} isLoading={isLoading}
                    trailing={<span style={{ fontWeight: 700, color: COLOR_CURRENT }}>{labelA}</span>}
                />
                <div style={{ height: 1, background: 'var(--border)' }} />
                <PeriodFilterBar
                    icon={<span />} label="Período Anterior"
                    presets={COMPARISON_PRESETS} preset={presetB} onPresetChange={(k) => handlePresetB(k as PresetKeyB)}
                    de={customBDe} ate={customBAte} onDeChange={setCustomBDe} onAteChange={setCustomBAte}
                    onApply={aplicarCustomB} pending={pendingB} isLoading={isLoading}
                    trailing={<span style={{ fontWeight: 700, color: 'var(--text-muted)' }}>{labelB}</span>}
                />
            </div>

            {isLoading && !data ? (
                <div style={{ padding: '6rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', color: 'var(--text-muted)' }}>
                    <Loader2 className="animate-spin" size={40} />
                    <span style={{ fontSize: '0.9375rem', fontWeight: 500 }}>Carregando dados...</span>
                </div>
            ) : (
                data && data.porCC.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                        
                        {/* KPIs Globais */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem' }}>
                            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', padding: '1.5rem', boxShadow: 'var(--shadow-sm)' }}>
                                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Despesa Total ({labelA})</span>
                                <h2 style={{ margin: '0.5rem 0 0', fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-main)' }}>{fmt(totalGeralB)}</h2>
                            </div>
                            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', padding: '1.5rem', boxShadow: 'var(--shadow-sm)' }}>
                                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Despesa Total ({labelB})</span>
                                <h2 style={{ margin: '0.5rem 0 0', fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-main)' }}>{fmt(totalGeralA)}</h2>
                            </div>
                            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', padding: '1.5rem', boxShadow: 'var(--shadow-sm)' }}>
                                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Variação</span>
                                <div style={{ display: 'flex', alignItems: 'flex-end', gap: '1rem', marginTop: '0.5rem' }}>
                                    <h2 style={{ margin: 0, fontSize: '1.75rem', fontWeight: 800, color: varGeralPct <= 0 ? COLOR_SUCCESS : COLOR_DANGER }}>
                                        {varGeralRS > 0 ? '+' : ''}{fmt(varGeralRS)}
                                    </h2>
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: varGeralPct <= 0 ? COLOR_SUCCESS : COLOR_DANGER, fontSize: '0.875rem', fontWeight: 700, marginBottom: '0.25rem' }}>
                                        {varGeralPct <= 0 ? <ArrowDownRight size={16} /> : <ArrowUpRight size={16} />}
                                        {Math.abs(varGeralPct).toFixed(1)}%
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Abas Horizontais (Centros de Custo) */}
                        <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', paddingBottom: '0', borderBottom: '2px solid var(--border)' }} className="hide-scrollbar">
                            {data.porCC.map((cc: any) => (
                                <button
                                    key={cc.centroDeCusto}
                                    onClick={() => setSelectedCC(cc.centroDeCusto)}
                                    style={{
                                        padding: '0.75rem 1.25rem', borderRadius: '8px 8px 0 0', cursor: 'pointer',
                                        background: selectedCC === cc.centroDeCusto ? 'var(--surface)' : 'transparent',
                                        color: selectedCC === cc.centroDeCusto ? 'var(--primary)' : 'var(--text-muted)',
                                        border: '1px solid var(--border)', borderBottom: 'none',
                                        fontWeight: 700, fontSize: '0.875rem', whiteSpace: 'nowrap',
                                        borderBottomColor: selectedCC === cc.centroDeCusto ? 'var(--surface)' : 'var(--border)',
                                        position: 'relative', top: '1px' // puxar para sobrepor a borda do container
                                    }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <Layers size={16} opacity={selectedCC === cc.centroDeCusto ? 1 : 0.6} />
                                        {cc.centroDeCusto}
                                    </div>
                                </button>
                            ))}
                        </div>

                        {/* Painel do CC Selecionado */}
                        {activeCCData && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                                
                                {/* Header do CC */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 0.5rem' }}>
                                    <h3 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                        <LayoutTemplate color="var(--primary)" size={24} />
                                        {activeCCData.centroDeCusto}
                                    </h3>
                                    <div style={{ display: 'flex', gap: '2rem' }}>
                                        <div style={{ textAlign: 'right' }}>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Despesa Total</div>
                                            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)' }}>{fmt(activeCCData.totalB)}</div>
                                        </div>
                                    </div>
                                </div>

                                {/* Gráfico Corporativo */}
                                <div style={{ 
                                    background: 'var(--surface)', border: '1px solid var(--border)', 
                                    borderRadius: '8px', padding: '1.5rem', height: 420, boxShadow: 'var(--shadow-sm)'
                                }}>
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={activeCCData.categorias} margin={{ top: 20, right: 0, left: -20, bottom: 0 }} barGap={2} barCategoryGap="25%">
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                                            <XAxis 
                                                dataKey="categoria" axisLine={false} tickLine={false} 
                                                tick={{ fill: 'var(--text-muted)', fontSize: 12, fontWeight: 500 }} dy={10}
                                            />
                                            <YAxis 
                                                tickFormatter={(v) => fmtK(v)} axisLine={false} tickLine={false} 
                                                tick={{ fill: 'var(--text-muted)', fontSize: 12 }} dx={-10}
                                            />
                                            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'var(--surface-hover)' }} />
                                            <Legend verticalAlign="top" align="right" wrapperStyle={{ paddingBottom: '20px', fontSize: '0.875rem' }} iconType="circle" />
                                            <Bar dataKey="valorA" name={labelB} fill={COLOR_PREVIOUS} maxBarSize={45} />
                                            <Bar dataKey="valorB" name={labelA} fill={COLOR_CURRENT} maxBarSize={45} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>

                                {/* Tabela Clean */}
                                <div style={{ 
                                    background: 'var(--surface)', border: '1px solid var(--border)', 
                                    borderRadius: '8px', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' 
                                }}>
                                    <div style={{ overflowX: 'auto' }}>
                                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                                            <thead>
                                                <tr style={{ background: 'var(--background)' }}>
                                                    <th style={{ padding: '1.25rem 1.5rem', borderBottom: '2px solid var(--border)', fontSize: '0.8125rem', fontWeight: 700, color: 'var(--text-main)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Categoria / Rubrica</th>
                                                    <th style={{ padding: '1.25rem 1.5rem', borderBottom: '2px solid var(--border)', fontSize: '0.8125rem', fontWeight: 700, color: COLOR_CURRENT, textAlign: 'right', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{labelA}</th>
                                                    <th style={{ padding: '1.25rem 1.5rem', borderBottom: '2px solid var(--border)', fontSize: '0.8125rem', fontWeight: 700, color: 'var(--text-muted)', textAlign: 'right', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{labelB}</th>
                                                    <th style={{ padding: '1.25rem 1.5rem', borderBottom: '2px solid var(--border)', fontSize: '0.8125rem', fontWeight: 700, color: 'var(--text-main)', textAlign: 'right', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Variação %</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {activeCCData.categorias.map((cat: any) => {
                                                    const varColor = cat.variacao === null ? 'var(--text-subtle)' : cat.variacao <= 0 ? COLOR_SUCCESS : COLOR_DANGER;
                                                    
                                                    return (
                                                        <tr key={cat.categoria} style={{ borderBottom: '1px solid var(--border)' }} className="table-row-hover">
                                                            <td style={{ padding: '1rem 1.5rem', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-main)' }}>
                                                                {cat.categoria}
                                                            </td>
                                                            <td style={{ padding: '1rem 1.5rem', textAlign: 'right', fontSize: '0.9375rem', fontWeight: 700, color: cat.valorB > 0 ? 'var(--text-main)' : 'var(--text-subtle)' }}>
                                                                {cat.valorB > 0 ? fmt(cat.valorB) : '—'}
                                                            </td>
                                                            <td style={{ padding: '1rem 1.5rem', textAlign: 'right', fontSize: '0.9375rem', fontWeight: 500, color: cat.valorA > 0 ? 'var(--text-muted)' : 'var(--text-subtle)' }}>
                                                                {cat.valorA > 0 ? fmt(cat.valorA) : '—'}
                                                            </td>
                                                            <td style={{ padding: '1rem 1.5rem', textAlign: 'right' }}>
                                                                <span style={{ 
                                                                    display: 'inline-flex', alignItems: 'center', gap: '0.25rem', 
                                                                    color: varColor, fontSize: '0.875rem', fontWeight: 700 
                                                                }}>
                                                                    {cat.variacao !== null && (cat.variacao <= 0 ? <TrendingDown size={14} /> : <TrendingUp size={14} />)}
                                                                    {cat.variacao === null ? 'Novo' : `${cat.variacao > 0 ? '+' : ''}${cat.variacao.toFixed(1)}%`}
                                                                </span>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                                {/* Total Row */}
                                                <tr style={{ background: 'var(--surface-hover)' }}>
                                                    <td style={{ padding: '1.25rem 1.5rem', fontSize: '0.9375rem', fontWeight: 800, color: 'var(--text-main)' }}>
                                                        Subtotal {activeCCData.centroDeCusto}
                                                    </td>
                                                    <td style={{ padding: '1.25rem 1.5rem', textAlign: 'right', fontSize: '1rem', fontWeight: 800, color: COLOR_CURRENT }}>
                                                        {fmt(activeCCData.totalB)}
                                                    </td>
                                                    <td style={{ padding: '1.25rem 1.5rem', textAlign: 'right', fontSize: '1rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                                                        {fmt(activeCCData.totalA)}
                                                    </td>
                                                    <td style={{ padding: '1.25rem 1.5rem', textAlign: 'right' }}>
                                                        <span style={{ 
                                                            display: 'inline-flex', alignItems: 'center', gap: '0.25rem', 
                                                            color: activeCCData.variacao <= 0 ? COLOR_SUCCESS : COLOR_DANGER, fontSize: '0.9375rem', fontWeight: 800 
                                                        }}>
                                                            {activeCCData.variacao !== null && (activeCCData.variacao <= 0 ? <ArrowDownRight size={18} /> : <ArrowUpRight size={18} />)}
                                                            {activeCCData.variacao === null ? 'Novo' : `${activeCCData.variacao > 0 ? '+' : ''}${activeCCData.variacao.toFixed(1)}%`}
                                                        </span>
                                                    </td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )
            )}
            
            <style dangerouslySetInnerHTML={{__html: `
                .table-row-hover:hover {
                    background: var(--surface-hover) !important;
                }
                .hide-scrollbar::-webkit-scrollbar {
                    display: none;
                }
                .hide-scrollbar {
                    -ms-overflow-style: none;
                    scrollbar-width: none;
                }
            `}} />
        </div>
    );
};

export default ResultadosDiretoria;
