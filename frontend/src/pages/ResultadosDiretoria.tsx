import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Loader2, TrendingUp, TrendingDown, Presentation, ArrowUpRight, ArrowDownRight, LayoutTemplate, Layers } from 'lucide-react';
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

// ── Componente Customizado para Tooltip do Gráfico ──────────────────────────
const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        return (
            <div style={{
                background: 'rgba(15, 23, 42, 0.95)',
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(255,255,255,0.1)',
                padding: '1rem',
                borderRadius: '12px',
                boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
                color: '#fff',
                minWidth: '200px'
            }}>
                <p style={{ margin: '0 0 0.75rem', fontWeight: 700, fontSize: '0.9375rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem' }}>{label}</p>
                {payload.map((entry: any, index: number) => (
                    <div key={index} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '0.5rem 0', fontSize: '0.875rem' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <div style={{ width: 10, height: 10, borderRadius: '50%', background: entry.color }}></div>
                            <span style={{ color: 'rgba(255,255,255,0.7)' }}>{entry.name}</span>
                        </span>
                        <span style={{ fontWeight: 600 }}>{fmt(entry.value)}</span>
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

    // Handlers do Filtro
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

    // Fetch API
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

    // Derivando dados para o UI
    const activeCCData = useMemo(() => {
        if (!data || !selectedCC) return null;
        return data.porCC.find((c: any) => c.centroDeCusto === selectedCC);
    }, [data, selectedCC]);

    const shortDate = (iso: string) => iso ? new Date(`${iso}T00:00:00`).toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' }).toUpperCase() : '';
    const labelA = `${shortDate(periodoA.de)} a ${shortDate(periodoA.ate)}`;
    const labelB = `${shortDate(periodoB.de)} a ${shortDate(periodoB.ate)}`;

    // Variáveis Globais
    const totalGeralA = data?.totais?.totalA || 0;
    const totalGeralB = data?.totais?.totalB || 0;
    const varGeralRS = totalGeralB - totalGeralA;
    const varGeralPct = totalGeralA > 0 ? (varGeralRS / totalGeralA) * 100 : 0;

    return (
        <div className="module-page fade-in" style={{ paddingBottom: '3rem' }}>
            
            {/* Header Premium */}
            <header style={{ 
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
                marginBottom: '2rem', paddingBottom: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)'
            }}>
                <div>
                    <h2 style={{ fontSize: '1.875rem', fontWeight: 800, margin: '0 0 0.5rem', background: 'linear-gradient(90deg, #fff, #94a3b8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                        Resultados & Desempenho
                    </h2>
                    <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: '0.9375rem' }}>Análise orçamentária avançada para reuniões de diretoria.</p>
                </div>
                <div style={{ 
                    background: 'linear-gradient(135deg, rgba(124, 58, 237, 0.2), rgba(37, 99, 235, 0.1))',
                    border: '1px solid rgba(124, 58, 237, 0.3)',
                    color: '#a78bfa', padding: '0.625rem 1.25rem', borderRadius: '3rem', 
                    display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700, fontSize: '0.8125rem',
                    boxShadow: '0 4px 12px rgba(124, 58, 237, 0.1)'
                }}>
                    <Presentation size={18} /> Visão Executiva
                </div>
            </header>

            {/* Filtros em Glassmorphism */}
            <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1px',
                background: 'rgba(255,255,255,0.05)', borderRadius: '16px', padding: '1px',
                boxShadow: '0 8px 32px rgba(0,0,0,0.2)', marginBottom: '2.5rem', overflow: 'hidden'
            }}>
                <div style={{ background: 'var(--surface)', padding: '1.25rem' }}>
                    <PeriodFilterBar
                        icon={<span />} label="Período Vigente"
                        presets={PRESETS} preset={presetA} onPresetChange={(k) => handlePresetA(k as PresetKey)}
                        de={customADe} ate={customAAte} onDeChange={setCustomADe} onAteChange={setCustomAAte}
                        onApply={aplicarCustomA} pending={pendingA} isLoading={isLoading}
                        trailing={<span style={{ fontWeight: 700, color: '#38bdf8' }}>{labelA}</span>}
                    />
                </div>
                <div style={{ background: 'var(--surface)', padding: '1.25rem' }}>
                    <PeriodFilterBar
                        icon={<span />} label="Período Base (Comparação)"
                        presets={COMPARISON_PRESETS} preset={presetB} onPresetChange={(k) => handlePresetB(k as PresetKeyB)}
                        de={customBDe} ate={customBAte} onDeChange={setCustomBDe} onAteChange={setCustomBAte}
                        onApply={aplicarCustomB} pending={pendingB} isLoading={isLoading}
                        trailing={<span style={{ fontWeight: 700, color: '#818cf8' }}>{labelB}</span>}
                    />
                </div>
            </div>

            {isLoading && !data ? (
                <div style={{ padding: '6rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', color: 'var(--text-muted)' }}>
                    <Loader2 className="animate-spin" size={40} color="var(--primary)" />
                    <span style={{ fontSize: '0.9375rem', fontWeight: 500 }}>Sintetizando base de dados...</span>
                </div>
            ) : (
                data && data.porCC.length > 0 && (
                    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
                        
                        {/* KPIs Globais da Empresa */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem' }}>
                            <div style={{ background: 'linear-gradient(145deg, var(--surface), rgba(15, 23, 42, 0.6))', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '16px', padding: '1.5rem', position: 'relative', overflow: 'hidden' }}>
                                <div style={{ position: 'absolute', top: '-20px', right: '-20px', width: '100px', height: '100px', background: '#38bdf8', filter: 'blur(50px)', opacity: 0.15 }}></div>
                                <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Vigente ({labelA})</span>
                                <h2 style={{ margin: '0.5rem 0 0', fontSize: '2rem', fontWeight: 800, color: '#f8fafc' }}>{fmt(totalGeralB)}</h2>
                            </div>
                            <div style={{ background: 'linear-gradient(145deg, var(--surface), rgba(15, 23, 42, 0.6))', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '16px', padding: '1.5rem', position: 'relative', overflow: 'hidden' }}>
                                <div style={{ position: 'absolute', top: '-20px', right: '-20px', width: '100px', height: '100px', background: '#818cf8', filter: 'blur(50px)', opacity: 0.15 }}></div>
                                <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Base de Referência ({labelB})</span>
                                <h2 style={{ margin: '0.5rem 0 0', fontSize: '2rem', fontWeight: 800, color: '#cbd5e1' }}>{fmt(totalGeralA)}</h2>
                            </div>
                            <div style={{ background: 'linear-gradient(145deg, var(--surface), rgba(15, 23, 42, 0.6))', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '16px', padding: '1.5rem', position: 'relative', overflow: 'hidden' }}>
                                <div style={{ position: 'absolute', top: '-20px', right: '-20px', width: '100px', height: '100px', background: varGeralPct <= 0 ? '#10b981' : '#ef4444', filter: 'blur(50px)', opacity: 0.15 }}></div>
                                <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Variação Global</span>
                                <div style={{ display: 'flex', alignItems: 'flex-end', gap: '1rem', marginTop: '0.5rem' }}>
                                    <h2 style={{ margin: 0, fontSize: '2rem', fontWeight: 800, color: varGeralPct <= 0 ? '#34d399' : '#f87171' }}>
                                        {varGeralRS > 0 ? '+' : ''}{fmt(varGeralRS)}
                                    </h2>
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', padding: '0.35rem 0.75rem', borderRadius: '2rem', background: varGeralPct <= 0 ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)', color: varGeralPct <= 0 ? '#34d399' : '#f87171', fontSize: '0.875rem', fontWeight: 700, marginBottom: '0.3rem' }}>
                                        {varGeralPct <= 0 ? <ArrowDownRight size={16} /> : <ArrowUpRight size={16} />}
                                        {Math.abs(varGeralPct).toFixed(1)}%
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Menu de Abas Horizontais para Centros de Custo */}
                        <div style={{ display: 'flex', gap: '0.75rem', overflowX: 'auto', paddingBottom: '0.5rem', borderBottom: '2px solid rgba(255,255,255,0.05)' }} className="hide-scrollbar">
                            {data.porCC.map((cc: any) => (
                                <button
                                    key={cc.centroDeCusto}
                                    onClick={() => setSelectedCC(cc.centroDeCusto)}
                                    style={{
                                        padding: '0.75rem 1.5rem', borderRadius: '12px 12px 0 0', border: 'none', cursor: 'pointer',
                                        background: selectedCC === cc.centroDeCusto ? 'var(--primary)' : 'transparent',
                                        color: selectedCC === cc.centroDeCusto ? '#fff' : 'var(--text-muted)',
                                        fontWeight: 700, fontSize: '0.9375rem', whiteSpace: 'nowrap', transition: 'all 0.2s',
                                        borderBottom: selectedCC === cc.centroDeCusto ? 'none' : '2px solid transparent'
                                    }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <Layers size={16} opacity={0.7} />
                                        {cc.centroDeCusto}
                                    </div>
                                </button>
                            ))}
                        </div>

                        {/* Conteúdo do CC Selecionado */}
                        {activeCCData && (
                            <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                                
                                {/* Top Header do CC */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <h3 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                        <LayoutTemplate color="var(--primary)" />
                                        Performance: {activeCCData.centroDeCusto}
                                    </h3>
                                    <div style={{ display: 'flex', gap: '1.5rem' }}>
                                        <div style={{ textAlign: 'right' }}>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Total Vigente</div>
                                            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#38bdf8' }}>{fmt(activeCCData.totalB)}</div>
                                        </div>
                                        <div style={{ width: '1px', background: 'var(--border)' }}></div>
                                        <div style={{ textAlign: 'left' }}>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Variação</div>
                                            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: activeCCData.variacao <= 0 ? '#34d399' : '#f87171' }}>
                                                {activeCCData.variacao > 0 ? '+' : ''}{activeCCData.variacao?.toFixed(1)}%
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Gráfico Premium */}
                                <div style={{ 
                                    background: 'linear-gradient(180deg, rgba(30, 41, 59, 0.4) 0%, rgba(15, 23, 42, 0.4) 100%)',
                                    border: '1px solid rgba(255,255,255,0.05)', borderRadius: '20px', padding: '2rem', height: 420
                                }}>
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={activeCCData.categorias} margin={{ top: 20, right: 0, left: -20, bottom: 0 }} barGap={6} barCategoryGap="25%">
                                            <defs>
                                                <linearGradient id="colorB" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="0%" stopColor="#38bdf8" stopOpacity={1}/>
                                                    <stop offset="100%" stopColor="#0284c7" stopOpacity={0.8}/>
                                                </linearGradient>
                                                <linearGradient id="colorA" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="0%" stopColor="#818cf8" stopOpacity={0.6}/>
                                                    <stop offset="100%" stopColor="#4f46e5" stopOpacity={0.3}/>
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                                            <XAxis 
                                                dataKey="categoria" axisLine={false} tickLine={false} 
                                                tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: 500 }} dy={10}
                                            />
                                            <YAxis 
                                                tickFormatter={(v) => fmtK(v)} axisLine={false} tickLine={false} 
                                                tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 11 }} dx={-10}
                                            />
                                            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                                            <Legend verticalAlign="top" align="right" wrapperStyle={{ paddingBottom: '20px', fontSize: '0.8125rem', opacity: 0.8 }} iconType="circle" />
                                            <Bar dataKey="valorA" name={labelB} fill="url(#colorA)" radius={[6, 6, 0, 0]} maxBarSize={40} />
                                            <Bar dataKey="valorB" name={labelA} fill="url(#colorB)" radius={[6, 6, 0, 0]} maxBarSize={40} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>

                                {/* Tabela Moderna */}
                                <div style={{ 
                                    background: 'var(--surface)', border: '1px solid rgba(255,255,255,0.05)', 
                                    borderRadius: '20px', overflow: 'hidden', boxShadow: '0 10px 40px rgba(0,0,0,0.2)' 
                                }}>
                                    <div style={{ overflowX: 'auto' }}>
                                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                                            <thead>
                                                <tr>
                                                    <th style={{ padding: '1.25rem 1.5rem', background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: '0.8125rem', fontWeight: 700, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Categoria / Rubrica</th>
                                                    <th style={{ padding: '1.25rem 1.5rem', background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: '0.8125rem', fontWeight: 700, color: '#38bdf8', textAlign: 'right', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{labelA}</th>
                                                    <th style={{ padding: '1.25rem 1.5rem', background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: '0.8125rem', fontWeight: 700, color: '#818cf8', textAlign: 'right', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{labelB}</th>
                                                    <th style={{ padding: '1.25rem 1.5rem', background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: '0.8125rem', fontWeight: 700, color: 'rgba(255,255,255,0.5)', textAlign: 'right', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Variação %</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {activeCCData.categorias.map((cat: any) => {
                                                    const varColor = cat.variacao === null ? 'rgba(255,255,255,0.3)' : cat.variacao <= 0 ? '#34d399' : '#f87171';
                                                    const varBg = cat.variacao === null ? 'rgba(255,255,255,0.05)' : cat.variacao <= 0 ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)';
                                                    
                                                    return (
                                                        <tr key={cat.categoria} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', transition: 'background 0.2s' }} className="table-row-hover">
                                                            <td style={{ padding: '1.125rem 1.5rem', fontSize: '0.9375rem', fontWeight: 600, color: '#f8fafc' }}>
                                                                {cat.categoria}
                                                            </td>
                                                            <td style={{ padding: '1.125rem 1.5rem', textAlign: 'right', fontSize: '0.9375rem', fontWeight: 700, color: cat.valorB > 0 ? '#fff' : 'rgba(255,255,255,0.2)' }}>
                                                                {cat.valorB > 0 ? fmt(cat.valorB) : '—'}
                                                            </td>
                                                            <td style={{ padding: '1.125rem 1.5rem', textAlign: 'right', fontSize: '0.9375rem', fontWeight: 500, color: cat.valorA > 0 ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.2)' }}>
                                                                {cat.valorA > 0 ? fmt(cat.valorA) : '—'}
                                                            </td>
                                                            <td style={{ padding: '1.125rem 1.5rem', textAlign: 'right' }}>
                                                                <span style={{ 
                                                                    display: 'inline-flex', alignItems: 'center', gap: '0.25rem', 
                                                                    padding: '0.35rem 0.75rem', borderRadius: '2rem', 
                                                                    background: varBg, color: varColor, fontSize: '0.8125rem', fontWeight: 700 
                                                                }}>
                                                                    {cat.variacao !== null && (cat.variacao <= 0 ? <TrendingDown size={14} /> : <TrendingUp size={14} />)}
                                                                    {cat.variacao === null ? 'Novo' : `${cat.variacao > 0 ? '+' : ''}${cat.variacao.toFixed(1)}%`}
                                                                </span>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                                {/* Total Row */}
                                                <tr style={{ background: 'rgba(30, 41, 59, 0.5)' }}>
                                                    <td style={{ padding: '1.25rem 1.5rem', fontSize: '1rem', fontWeight: 800, color: '#f8fafc', borderTop: '2px solid rgba(255,255,255,0.1)' }}>
                                                        Subtotal {activeCCData.centroDeCusto}
                                                    </td>
                                                    <td style={{ padding: '1.25rem 1.5rem', textAlign: 'right', fontSize: '1.125rem', fontWeight: 800, color: '#38bdf8', borderTop: '2px solid rgba(255,255,255,0.1)' }}>
                                                        {fmt(activeCCData.totalB)}
                                                    </td>
                                                    <td style={{ padding: '1.25rem 1.5rem', textAlign: 'right', fontSize: '1.125rem', fontWeight: 800, color: '#818cf8', borderTop: '2px solid rgba(255,255,255,0.1)' }}>
                                                        {fmt(activeCCData.totalA)}
                                                    </td>
                                                    <td style={{ padding: '1.25rem 1.5rem', textAlign: 'right', borderTop: '2px solid rgba(255,255,255,0.1)' }}>
                                                        <span style={{ 
                                                            display: 'inline-flex', alignItems: 'center', gap: '0.25rem', 
                                                            color: activeCCData.variacao <= 0 ? '#34d399' : '#f87171', fontSize: '0.9375rem', fontWeight: 800 
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
            
            {/* CSS inline para classe de hover da tabela */}
            <style dangerouslySetInnerHTML={{__html: `
                .table-row-hover:hover {
                    background: rgba(255,255,255,0.02) !important;
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
