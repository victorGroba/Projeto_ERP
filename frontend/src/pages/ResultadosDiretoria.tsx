import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Loader2, TrendingUp, TrendingDown, Presentation, Building2 } from 'lucide-react';
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

// ── Componente Principal ────────────────────────────────────────────────────
const ResultadosDiretoria: React.FC = () => {
    const token = localStorage.getItem('@ContaAzul:token');
    
    // Período Principal (A)
    const [presetA, setPresetA] = useState<PresetKey>('this_year');
    const [periodoA, setPeriodoA] = useState(() => computeRange('this_year', { de: '', ate: '' }));
    const [customADe, setCustomADe] = useState(periodoA.de);
    const [customAAte, setCustomAAte] = useState(periodoA.ate);

    // Período de Comparação (B)
    const [presetB, setPresetB] = useState<PresetKeyB>('auto');
    const [periodoB, setPeriodoB] = useState(() => ({ de: shiftYear(periodoA.de, -1), ate: shiftYear(periodoA.ate, -1) }));
    const [customBDe, setCustomBDe] = useState(periodoB.de);
    const [customBAte, setCustomBAte] = useState(periodoB.ate);

    // Dados
    const [isLoading, setIsLoading] = useState(false);
    const [data, setData] = useState<any>(null);
    const [selectedCC, setSelectedCC] = useState<string>('');

    // Handlers do Filtro A
    const handlePresetA = (novo: PresetKey) => {
        setPresetA(novo);
        if (novo === 'custom') return;
        const range = computeRange(novo, periodoA);
        setPeriodoA(range);
        setCustomADe(range.de);
        setCustomAAte(range.ate);
        if (presetB === 'auto') {
            const rangeB = { de: shiftYear(range.de, -1), ate: shiftYear(range.ate, -1) };
            setPeriodoB(rangeB);
            setCustomBDe(rangeB.de);
            setCustomBAte(rangeB.ate);
        }
    };
    const aplicarCustomA = () => {
        setPeriodoA({ de: customADe, ate: customAAte });
        if (presetB === 'auto') {
            const rangeB = { de: shiftYear(customADe, -1), ate: shiftYear(customAAte, -1) };
            setPeriodoB(rangeB);
            setCustomBDe(rangeB.de);
            setCustomBAte(rangeB.ate);
        }
    };

    // Handlers do Filtro B
    const handlePresetB = (novo: PresetKeyB) => {
        setPresetB(novo);
        if (novo === 'custom') return;
        const range = novo === 'auto'
            ? { de: shiftYear(periodoA.de, -1), ate: shiftYear(periodoA.ate, -1) }
            : computeRange(novo as PresetKey, periodoB);
        setPeriodoB(range);
        setCustomBDe(range.de);
        setCustomBAte(range.ate);
    };
    const aplicarCustomB = () => setPeriodoB({ de: customBDe, ate: customBAte });

    const pendingA = customADe !== periodoA.de || customAAte !== periodoA.ate;
    const pendingB = customBDe !== periodoB.de || customBAte !== periodoB.ate;

    // Fetch API
    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            try {
                const res = await axios.get(
                    `/api/dashboard/despesas/comparativo-cc?deA=${periodoB.de}&ateA=${periodoB.ate}&deB=${periodoA.de}&ateB=${periodoA.ate}`,
                    { headers: { Authorization: `Bearer ${token}` } }
                );
                // Nota: o comparativo-cc espera que A = periodo mais antigo, B = mais recente para cálculo de variação.
                // Por isso enviamos deA=periodoB e deB=periodoA.
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

    // Derivando dados para o UI
    const activeCCData = useMemo(() => {
        if (!data || !selectedCC) return null;
        return data.porCC.find((c: any) => c.centroDeCusto === selectedCC);
    }, [data, selectedCC]);

    const shortDate = (iso: string) => iso ? new Date(`${iso}T00:00:00`).toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' }).toUpperCase() : '';
    const labelA = `${shortDate(periodoA.de)} a ${shortDate(periodoA.ate)}`;
    const labelB = `${shortDate(periodoB.de)} a ${shortDate(periodoB.ate)}`;

    return (
        <div className="module-page fade-in">
            {/* Header */}
            <header className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h2>Painel de Resultados da Diretoria</h2>
                    <p>Análise detalhada e comparativo orçamentário por Centro de Custo</p>
                </div>
                <div style={{ background: 'var(--primary-light)', color: 'var(--primary)', padding: '0.5rem 1rem', borderRadius: '2rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, fontSize: '0.8125rem' }}>
                    <Presentation size={16} /> Visão Executiva
                </div>
            </header>

            {/* Filtros */}
            <div style={{
                display: 'flex', flexDirection: 'column', gap: '0.75rem',
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius-lg)', padding: '1rem 1.25rem',
                boxShadow: 'var(--shadow-sm)', marginBottom: '1.5rem',
            }}>
                <PeriodFilterBar
                    icon={<span />} label="Período Atual"
                    presets={PRESETS} preset={presetA} onPresetChange={(k) => handlePresetA(k as PresetKey)}
                    de={customADe} ate={customAAte} onDeChange={setCustomADe} onAteChange={setCustomAAte}
                    onApply={aplicarCustomA} pending={pendingA} isLoading={isLoading}
                    trailing={<span style={{ fontWeight: 600 }}>{labelA}</span>}
                />
                <div style={{ height: 1, background: 'var(--border)' }} />
                <PeriodFilterBar
                    icon={<span />} label="Período Comparativo"
                    presets={COMPARISON_PRESETS} preset={presetB} onPresetChange={(k) => handlePresetB(k as PresetKeyB)}
                    de={customBDe} ate={customBAte} onDeChange={setCustomBDe} onAteChange={setCustomBAte}
                    onApply={aplicarCustomB} pending={pendingB} isLoading={isLoading}
                    trailing={labelB}
                />
            </div>

            {isLoading && !data ? (
                <div className="loading-state" style={{ padding: '4rem', display: 'flex', justifyContent: 'center' }}>
                    <Loader2 className="animate-spin" size={32} />
                </div>
            ) : (
                data && data.porCC.length > 0 && (
                    <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'flex-start' }}>
                        
                        {/* Menu Lateral de Centros de Custo */}
                        <div style={{
                            width: '240px', flexShrink: 0, background: 'var(--surface)',
                            border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)',
                            overflow: 'hidden'
                        }}>
                            <div style={{ padding: '1rem', borderBottom: '1px solid var(--border)', background: 'var(--background)' }}>
                                <h4 style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <Building2 size={14} /> Centros de Custo
                                </h4>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                {data.porCC.map((cc: any) => (
                                    <button
                                        key={cc.centroDeCusto}
                                        onClick={() => setSelectedCC(cc.centroDeCusto)}
                                        style={{
                                            padding: '1rem', border: 'none', borderBottom: '1px solid var(--border)',
                                            background: selectedCC === cc.centroDeCusto ? 'var(--primary-light)' : 'transparent',
                                            cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s',
                                            display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                                        }}
                                    >
                                        <span style={{ fontWeight: selectedCC === cc.centroDeCusto ? 700 : 500, color: selectedCC === cc.centroDeCusto ? 'var(--primary)' : 'var(--text-main)', fontSize: '0.875rem' }}>
                                            {cc.centroDeCusto}
                                        </span>
                                        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                                            {fmtK(cc.totalB)}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Visão de Detalhe do CC Selecionado */}
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                            
                            {/* Card de Gráfico */}
                            <div className="chart-container" style={{ padding: '1.5rem' }}>
                                <h3 style={{ margin: '0 0 1.5rem' }}>Comparativo {activeCCData?.centroDeCusto} (em Reais)</h3>
                                <div style={{ height: 350, width: '100%' }}>
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={activeCCData?.categorias || []} margin={{ top: 10, right: 10, left: 10, bottom: 40 }} barGap={2} barCategoryGap="20%">
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                                            <XAxis 
                                                dataKey="categoria" 
                                                axisLine={{ stroke: 'var(--border)' }} tickLine={false} 
                                                tick={{ fill: 'var(--text-main)', fontSize: 11 }}
                                                angle={-30} textAnchor="end" interval={0}
                                            />
                                            <YAxis 
                                                tickFormatter={(v) => fmtK(v)} 
                                                axisLine={false} tickLine={false} tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                                            />
                                            <Tooltip 
                                                formatter={(value: any) => fmt(Number(value))}
                                                cursor={{ fill: 'var(--surface-hover)' }}
                                                contentStyle={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)', borderRadius: '8px' }}
                                            />
                                            <Legend verticalAlign="top" align="right" wrapperStyle={{ paddingBottom: '20px', fontSize: '0.8125rem' }} />
                                            <Bar dataKey="valorA" name={labelB} fill="#dc2626" radius={[4, 4, 0, 0]} maxBarSize={30} />
                                            <Bar dataKey="valorB" name={labelA} fill="#2563eb" radius={[4, 4, 0, 0]} maxBarSize={30} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                            {/* Tabela Excel-Like */}
                            <div className="chart-container" style={{ padding: 0, overflow: 'hidden' }}>
                                <div style={{ overflowX: 'auto' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                                        <thead>
                                            <tr style={{ background: 'var(--background)' }}>
                                                <th style={{ padding: '1rem', borderBottom: '2px solid var(--border)', borderRight: '1px solid var(--border)', fontSize: '0.8125rem', fontWeight: 700, color: 'var(--text-main)', textTransform: 'uppercase' }}>
                                                    {activeCCData?.centroDeCusto}
                                                </th>
                                                <th style={{ padding: '1rem', borderBottom: '2px solid var(--border)', borderRight: '1px solid var(--border)', fontSize: '0.8125rem', fontWeight: 700, color: '#2563eb', textAlign: 'right' }}>
                                                    {labelA}
                                                </th>
                                                <th style={{ padding: '1rem', borderBottom: '2px solid var(--border)', borderRight: '1px solid var(--border)', fontSize: '0.8125rem', fontWeight: 700, color: '#dc2626', textAlign: 'right' }}>
                                                    {labelB}
                                                </th>
                                                <th style={{ padding: '1rem', borderBottom: '2px solid var(--border)', fontSize: '0.8125rem', fontWeight: 700, color: 'var(--text-main)', textAlign: 'right' }}>
                                                    VAR %
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {activeCCData?.categorias.map((cat: any, idx: number) => {
                                                const varColor = cat.variacao === null ? 'var(--text-subtle)' : cat.variacao <= 0 ? 'var(--success)' : 'var(--danger)';
                                                const bg = idx % 2 === 0 ? 'var(--surface)' : 'var(--background)';
                                                return (
                                                    <tr key={cat.categoria} style={{ background: bg }}>
                                                        <td style={{ padding: '0.875rem 1rem', borderBottom: '1px solid var(--border)', borderRight: '1px solid var(--border)', fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-main)' }}>
                                                            {cat.categoria}
                                                        </td>
                                                        <td style={{ padding: '0.875rem 1rem', borderBottom: '1px solid var(--border)', borderRight: '1px solid var(--border)', textAlign: 'right', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-main)' }}>
                                                            {cat.valorB > 0 ? fmt(cat.valorB) : '-'}
                                                        </td>
                                                        <td style={{ padding: '0.875rem 1rem', borderBottom: '1px solid var(--border)', borderRight: '1px solid var(--border)', textAlign: 'right', fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-muted)' }}>
                                                            {cat.valorA > 0 ? fmt(cat.valorA) : '-'}
                                                        </td>
                                                        <td style={{ padding: '0.875rem 1rem', borderBottom: '1px solid var(--border)', textAlign: 'right', fontSize: '0.875rem', fontWeight: 700, color: varColor, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.25rem' }}>
                                                            {cat.variacao !== null && (cat.variacao <= 0 ? <TrendingDown size={14} /> : <TrendingUp size={14} />)}
                                                            {cat.variacao === null ? 'novo' : `${cat.variacao > 0 ? '+' : ''}${cat.variacao.toFixed(1)}%`}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                            <tr style={{ background: 'var(--surface-hover)' }}>
                                                <td style={{ padding: '1rem', borderTop: '2px solid var(--border)', borderRight: '1px solid var(--border)', fontSize: '0.9375rem', fontWeight: 700, color: 'var(--text-main)' }}>
                                                    Total {activeCCData?.centroDeCusto}
                                                </td>
                                                <td style={{ padding: '1rem', borderTop: '2px solid var(--border)', borderRight: '1px solid var(--border)', textAlign: 'right', fontSize: '0.9375rem', fontWeight: 800, color: '#2563eb' }}>
                                                    {fmt(activeCCData?.totalB || 0)}
                                                </td>
                                                <td style={{ padding: '1rem', borderTop: '2px solid var(--border)', borderRight: '1px solid var(--border)', textAlign: 'right', fontSize: '0.9375rem', fontWeight: 700, color: '#dc2626' }}>
                                                    {fmt(activeCCData?.totalA || 0)}
                                                </td>
                                                <td style={{ padding: '1rem', borderTop: '2px solid var(--border)', textAlign: 'right', fontSize: '0.9375rem', fontWeight: 800, color: activeCCData?.variacao <= 0 ? 'var(--success)' : 'var(--danger)' }}>
                                                    {activeCCData?.variacao === null ? 'novo' : `${activeCCData?.variacao > 0 ? '+' : ''}${activeCCData?.variacao.toFixed(1)}%`}
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                        </div>
                    </div>
                )
            )}
        </div>
    );
};

export default ResultadosDiretoria;
