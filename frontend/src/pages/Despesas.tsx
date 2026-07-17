import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useSearchParams } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { DollarSign, TrendingUp, TrendingDown, Layers, ChevronDown, ChevronRight, SlidersHorizontal } from 'lucide-react';
import PeriodFilterBar from '../components/PeriodFilterBar';
import './Dashboard.css';

const API = '';

// ── Filtro de período inteligente ────────────────────────────────────────────
// 'ytd' (ano até hoje) é o padrão para bater com o acumulado mostrado na Visão Geral,
// que também soma de 1º de janeiro até hoje (evita contar lançamentos futuros já agendados).
type PresetKey = 'this_month' | 'last_month' | 'last_3m' | 'last_6m' | 'ytd' | 'this_year' | 'last_year' | 'custom';

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

const pad = (n: number) => String(n).padStart(2, '0');
const toISO = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

function computeRange(preset: PresetKey, fallback: { de: string; ate: string }): { de: string; ate: string } {
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

const shiftYear = (iso: string, delta: number) => {
    const d = new Date(`${iso}T00:00:00`);
    d.setFullYear(d.getFullYear() + delta);
    return toISO(d);
};

// Presets do período de comparação: 'auto' acompanha o período principal (mesmo
// intervalo, 1 ano antes) — qualquer outra escolha desconecta e vira independente.
type PresetKeyB = PresetKey | 'auto';
const COMPARISON_PRESETS: { key: PresetKeyB; label: string }[] = [
    { key: 'auto', label: 'Automático (mesmo intervalo, ano anterior)' },
    ...PRESETS,
];

const fmtDateLabel = (iso?: string) =>
    iso ? new Date(`${iso}T00:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }) : '';

const hoje = new Date();
const DEFAULT_PERIODO = { de: `${hoje.getFullYear()}-01-01`, ate: toISO(hoje) };

const Despesas: React.FC = () => {
    const token = localStorage.getItem('@ContaAzul:token');
    const [searchParams] = useSearchParams();
    // Se a Visão Geral navegar pra cá com ?de=&ate=, respeita o período exato que o usuário
    // já estava vendo lá (evita o card mostrar um total e a página de detalhe mostrar outro).
    const urlDe  = searchParams.get('de');
    const urlAte = searchParams.get('ate');
    const periodoInicial = (urlDe && urlAte) ? { de: urlDe, ate: urlAte } : DEFAULT_PERIODO;

    const [preset, setPreset] = useState<PresetKey>((urlDe && urlAte) ? 'custom' : 'ytd');
    const [customDe, setCustomDe] = useState(periodoInicial.de);
    const [customAte, setCustomAte] = useState(periodoInicial.ate);
    const [periodo, setPeriodo] = useState<{ de: string; ate: string }>(periodoInicial);

    // Período de comparação — totalmente independente e configurável. Por padrão
    // ('auto') segue o período principal, mesmo intervalo um ano antes.
    const periodoBInicial = { de: shiftYear(periodoInicial.de, -1), ate: shiftYear(periodoInicial.ate, -1) };
    const [presetB, setPresetB] = useState<PresetKeyB>('auto');
    const [customBDe, setCustomBDe] = useState(periodoBInicial.de);
    const [customBAte, setCustomBAte] = useState(periodoBInicial.ate);
    const [periodoB, setPeriodoB] = useState<{ de: string; ate: string }>(periodoBInicial);

    const [periodoInfo, setPeriodoInfo] = useState<{ de: string; ate: string; deAnterior: string; ateAnterior: string } | null>(null);
    const [data, setData] = useState<any[]>([]);
    const [chartData, setChartData] = useState<any[]>([]);
    const [deptChartData, setDeptChartData] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [detalheData, setDetalheData] = useState<any[]>([]);
    const [expandedCCs, setExpandedCCs] = useState<Set<string>>(new Set());

    const toggleCC = (cc: string) =>
        setExpandedCCs(prev => {
            const next = new Set(prev);
            next.has(cc) ? next.delete(cc) : next.add(cc);
            return next;
        });

    const expandAll = () => setExpandedCCs(new Set(detalheData.map(d => d.centroDeCusto)));
    const collapseAll = () => setExpandedCCs(new Set());

    // Se o período de comparação está em modo automático, ele acompanha o período principal.
    const syncAutoComparison = (novoA: { de: string; ate: string }) => {
        if (presetB !== 'auto') return;
        const rangeB = { de: shiftYear(novoA.de, -1), ate: shiftYear(novoA.ate, -1) };
        setCustomBDe(rangeB.de);
        setCustomBAte(rangeB.ate);
        setPeriodoB(rangeB);
    };

    const handlePresetChange = (novo: PresetKey) => {
        setPreset(novo);
        if (novo === 'custom') return;
        const range = computeRange(novo, periodo);
        setCustomDe(range.de);
        setCustomAte(range.ate);
        setPeriodo(range);
        syncAutoComparison(range);
    };

    // Editar as datas diretamente sempre vira "Personalizado" — o usuário pode
    // escolher qualquer dia, de qualquer mês, tanto no início quanto no fim.
    const handleCustomDeChange = (valor: string) => {
        setPreset('custom');
        setCustomDe(valor);
    };
    const handleCustomAteChange = (valor: string) => {
        setPreset('custom');
        setCustomAte(valor);
    };

    const periodoPendente = customDe !== periodo.de || customAte !== periodo.ate;

    const aplicarCustom = () => {
        if (!customDe || !customAte) return;
        setPeriodo({ de: customDe, ate: customAte });
        syncAutoComparison({ de: customDe, ate: customAte });
    };

    // ── Período de comparação (totalmente independente) ────────────────────
    const handlePresetBChange = (novo: PresetKeyB) => {
        setPresetB(novo);
        if (novo === 'custom') return;
        const range = novo === 'auto'
            ? { de: shiftYear(periodo.de, -1), ate: shiftYear(periodo.ate, -1) }
            : computeRange(novo, periodoB);
        setCustomBDe(range.de);
        setCustomBAte(range.ate);
        setPeriodoB(range);
    };

    const handleCustomBDeChange = (valor: string) => {
        setPresetB('custom');
        setCustomBDe(valor);
    };
    const handleCustomBAteChange = (valor: string) => {
        setPresetB('custom');
        setCustomBAte(valor);
    };

    const periodoBPendente = customBDe !== periodoB.de || customBAte !== periodoB.ate;

    const aplicarCustomB = () => {
        if (!customBDe || !customBAte) return;
        setPeriodoB({ de: customBDe, ate: customBAte });
    };

    useEffect(() => {
        fetchDados();
    }, [periodo, periodoB]);

    const fetchDados = async () => {
        setIsLoading(true);
        try {
            const { de, ate } = periodo;
            const { de: de2, ate: ate2 } = periodoB;
            const response = await axios.get(`/api/dashboard/despesas/agrupado?de=${de}&ate=${ate}&de2=${de2}&ate2=${ate2}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            const rawData = response.data.data;
            setData(rawData);
            if (response.data.filtro) setPeriodoInfo(response.data.filtro);

            const categoriasKeys = Array.from(new Set(rawData.map((d: any) => d.categoria))) as string[];

            const cData = categoriasKeys.map(cat => {
                const linhasCat = rawData.filter((r: any) => r.categoria === cat);
                const totalAtual = linhasCat.reduce((acc: number, curr: any) => acc + curr.totalAnual, 0);
                const totalAnterior = linhasCat.reduce((acc: number, curr: any) => acc + curr.totalAnterior, 0);
                return {
                    name: cat.length > 22 ? cat.substring(0, 22) + '…' : cat,
                    periodoAnterior: totalAnterior,
                    periodoAtual: totalAtual,
                };
            }).sort((a, b) => b.periodoAtual - a.periodoAtual).slice(0, 7);

            setChartData(cData);

            const deptKeys = Array.from(new Set(rawData.map((d: any) => d.centroDeCusto))) as string[];
            const dData = deptKeys.map(cc => {
                const linhasCat = rawData.filter((r: any) => r.centroDeCusto === cc);
                const totalAtual = linhasCat.reduce((acc: number, curr: any) => acc + curr.totalAnual, 0);
                const totalAnterior = linhasCat.reduce((acc: number, curr: any) => acc + curr.totalAnterior, 0);
                return {
                    name: cc,
                    periodoAnterior: totalAnterior,
                    periodoAtual: totalAtual,
                };
            }).sort((a, b) => b.periodoAtual - a.periodoAtual).slice(0, 10);

            setDeptChartData(dData);

            // Detalhe por CC
            const rDetalhe = await axios.get(
                `${API}/api/dashboard/despesas/detalhe-por-cc?de=${de}&ate=${ate}&de2=${de2}&ate2=${ate2}`,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setDetalheData(rDetalhe.data.data || []);

        } catch (error) {
            console.error('Erro ao buscar dados de despesas', error);
        } finally {
            setIsLoading(false);
        }
    };

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
    };

    const totalAtual = data.reduce((acc, curr) => acc + curr.totalAnual, 0);
    const totalAnterior = data.reduce((acc, curr) => acc + curr.totalAnterior, 0);
    const evolucaoRSGeral = totalAtual - totalAnterior;
    const evolucaoPercentGeral = totalAnterior > 0 ? (evolucaoRSGeral / totalAnterior) * 100 : 0;

    const periodoAtualLabel = periodoInfo
        ? `${fmtDateLabel(periodoInfo.de)} – ${fmtDateLabel(periodoInfo.ate)}`
        : `${fmtDateLabel(periodo.de)} – ${fmtDateLabel(periodo.ate)}`;
    const periodoAnteriorLabel = periodoInfo
        ? `${fmtDateLabel(periodoInfo.deAnterior)} – ${fmtDateLabel(periodoInfo.ateAnterior)}`
        : '';

    const shortDate = (iso?: string) =>
        iso ? new Date(`${iso}T00:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '';
    const periodoAtualShort = periodoInfo
        ? `${shortDate(periodoInfo.de)}–${shortDate(periodoInfo.ate)}`
        : `${shortDate(periodo.de)}–${shortDate(periodo.ate)}`;
    const periodoAnteriorShort = periodoInfo
        ? `${shortDate(periodoInfo.deAnterior)}–${shortDate(periodoInfo.ateAnterior)}`
        : 'Anterior';

    return (
        <div className="module-page fade-in">
            <header className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                    <h2>Despesas e Custos</h2>
                    <p>Compare dois períodos quaisquer, com evolução por categoria e centro de custo</p>
                </div>
            </header>

            {/* ── Barra de filtro: dois períodos totalmente independentes ── */}
            <div style={{
                display: 'flex', flexDirection: 'column', gap: '0.75rem',
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius-lg)', padding: '1rem 1.25rem',
                boxShadow: 'var(--shadow-sm)', margin: '1rem 0 1.5rem',
            }}>
                <PeriodFilterBar
                    icon={<SlidersHorizontal size={15} color="var(--text-muted)" style={{ flexShrink: 0 }} />}
                    label="Período"
                    presets={PRESETS}
                    preset={preset}
                    onPresetChange={(key) => handlePresetChange(key as PresetKey)}
                    de={customDe}
                    ate={customAte}
                    onDeChange={handleCustomDeChange}
                    onAteChange={handleCustomAteChange}
                    onApply={aplicarCustom}
                    pending={periodoPendente}
                    isLoading={isLoading}
                    trailing={<span style={{ color: 'var(--text-main)', fontWeight: 600 }}>{periodoAtualLabel}</span>}
                />

                <div style={{ height: 1, background: 'var(--border)' }} />

                <PeriodFilterBar
                    icon={<TrendingUp size={15} color="var(--text-subtle)" style={{ flexShrink: 0 }} />}
                    label="Comparar com"
                    presets={COMPARISON_PRESETS}
                    preset={presetB}
                    onPresetChange={(key) => handlePresetBChange(key as PresetKeyB)}
                    de={customBDe}
                    ate={customBAte}
                    onDeChange={handleCustomBDeChange}
                    onAteChange={handleCustomBAteChange}
                    onApply={aplicarCustomB}
                    pending={periodoBPendente}
                    isLoading={isLoading}
                    trailing={periodoAnteriorLabel}
                />
            </div>

            {isLoading ? (
                <div className="loading-state">
                    <div className="animate-spin" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '40px', height: '40px', borderRadius: '50%', border: '3px solid rgba(37, 99, 235, 0.2)', borderTopColor: 'var(--primary)', marginBottom: '1rem' }}></div>
                    <span style={{ marginLeft: '1rem' }}>Processando motor matricial...</span>
                </div>
            ) : (
                <>
                    <div className="metrics-grid">
                        <div className="kpi-card highlight">
                            <div className="kpi-icon" style={{ background: 'var(--primary-light)', color: 'var(--primary)' }}>
                                <DollarSign size={28} />
                            </div>
                            <div className="kpi-content">
                                <h4>Despesa Total Acumulada ({periodoAtualLabel})</h4>
                                <h2>{formatCurrency(totalAtual)}</h2>
                            </div>
                        </div>

                        <div className="kpi-card">
                            <div className="kpi-icon" style={{ background: 'var(--surface-hover)', color: 'var(--text-muted)' }}>
                                <Layers size={28} />
                            </div>
                            <div className="kpi-content">
                                <h4>Total Consolidado ({periodoAnteriorLabel || 'período anterior'})</h4>
                                <h2 style={{ fontSize: '1.4rem', color: 'var(--text-muted)' }}>{formatCurrency(totalAnterior)}</h2>
                            </div>
                        </div>

                        <div className="kpi-card">
                            <div className="kpi-icon" style={{ background: evolucaoPercentGeral <= 0 ? 'var(--success-light)' : 'var(--danger-light)', color: evolucaoPercentGeral <= 0 ? 'var(--success)' : 'var(--danger)' }}>
                                {evolucaoPercentGeral <= 0 ? <TrendingDown size={28} /> : <TrendingUp size={28} />}
                            </div>
                            <div className="kpi-content">
                                <div>
                                    <h4>Variação do Período</h4>
                                </div>
                                <h2 style={{ color: evolucaoPercentGeral <= 0 ? 'var(--success)' : 'var(--danger)' }}>
                                    {evolucaoRSGeral > 0 ? '+' : ''}{formatCurrency(evolucaoRSGeral)}
                                </h2>
                                <span style={{
                                    display: 'inline-block', marginTop: '0.25rem', padding: '0.15rem 0.6rem',
                                    borderRadius: '2rem', fontSize: '0.75rem', fontWeight: 700,
                                    background: evolucaoPercentGeral <= 0 ? 'var(--success-light)' : 'var(--danger-light)',
                                    color: evolucaoPercentGeral <= 0 ? 'var(--success)' : 'var(--danger)'
                                }}>
                                    {evolucaoPercentGeral > 0 ? 'Custo Inflado ' : 'Redução de '}{evolucaoPercentGeral > 0 ? '+' : ''}{evolucaoPercentGeral.toFixed(2)}%
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="charts-grid" style={{ gridTemplateColumns: '1fr', marginBottom: '2rem' }}>
                        <div className="chart-container">
                            <h3>Maiores Despesas por Categoria</h3>
                            <p style={{ margin: '0.2rem 0 0', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                                Top 7 categorias no período, comparadas ao período de referência
                            </p>
                            <div style={{ width: '100%', height: '380px', marginTop: '0.75rem' }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={chartData} margin={{ top: 8, right: 12, left: 4, bottom: 68 }} barGap={4} barCategoryGap="28%">
                                        <CartesianGrid stroke="var(--border)" vertical={false} />
                                        <XAxis
                                            dataKey="name" tick={{ fill: 'var(--text-muted)', fontSize: 12 }}
                                            axisLine={{ stroke: 'var(--border)' }} tickLine={false}
                                            angle={-30} textAnchor="end" interval={0}
                                        />
                                        <YAxis
                                            tickFormatter={(val) => `${(val / 1000).toFixed(0)}k`} width={44}
                                            tick={{ fill: 'var(--text-subtle)', fontSize: 11 }} axisLine={false} tickLine={false}
                                        />
                                        <Tooltip
                                            formatter={(value: any) => formatCurrency(Number(value))}
                                            cursor={{ fill: 'var(--background)' }}
                                            contentStyle={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-md)', fontSize: '0.8125rem' }}
                                            labelStyle={{ color: 'var(--text-main)', fontWeight: 600, marginBottom: 4 }}
                                        />
                                        <Legend
                                            verticalAlign="top" align="right" height={28} iconType="circle" iconSize={8}
                                            wrapperStyle={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}
                                        />
                                        <Bar dataKey="periodoAnterior" name={periodoAnteriorShort || 'Período de referência'} fill="var(--text-subtle)" radius={[4, 4, 0, 0]} maxBarSize={22} />
                                        <Bar dataKey="periodoAtual" name={periodoAtualShort} fill="var(--primary)" radius={[4, 4, 0, 0]} maxBarSize={22} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>

                    <div className="charts-grid" style={{ gridTemplateColumns: '1fr', marginBottom: '2rem' }}>
                        <div className="chart-container">
                            <h3>Despesas por Centro de Custo</h3>
                            <p style={{ margin: '0.2rem 0 0', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                                Todos os setores no período, do maior para o menor
                            </p>
                            <div style={{ width: '100%', height: Math.max(280, deptChartData.length * 42), marginTop: '0.75rem' }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={deptChartData} layout="vertical" margin={{ top: 4, right: 24, left: 4, bottom: 4 }} barGap={4} barCategoryGap="30%">
                                        <CartesianGrid stroke="var(--border)" horizontal={false} vertical={true} />
                                        <XAxis
                                            type="number" tickFormatter={(val) => `${(val / 1000).toFixed(0)}k`}
                                            tick={{ fill: 'var(--text-subtle)', fontSize: 11 }} axisLine={false} tickLine={false}
                                        />
                                        <YAxis
                                            dataKey="name" type="category" width={130}
                                            tick={{ fill: 'var(--text-main)', fontSize: 12, fontWeight: 500 }} axisLine={false} tickLine={false}
                                        />
                                        <Tooltip
                                            formatter={(value: any) => formatCurrency(Number(value))}
                                            cursor={{ fill: 'var(--background)' }}
                                            contentStyle={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-md)', fontSize: '0.8125rem' }}
                                            labelStyle={{ color: 'var(--text-main)', fontWeight: 600, marginBottom: 4 }}
                                        />
                                        <Legend
                                            verticalAlign="top" align="right" height={28} iconType="circle" iconSize={8}
                                            wrapperStyle={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}
                                        />
                                        <Bar dataKey="periodoAnterior" name={periodoAnteriorShort || 'Período de referência'} fill="var(--text-subtle)" radius={[0, 4, 4, 0]} maxBarSize={18} />
                                        <Bar dataKey="periodoAtual" name={periodoAtualShort} fill="var(--primary)" radius={[0, 4, 4, 0]} maxBarSize={18} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>

                    {/* ── Matriz de Alocação por Centro de Custo ── */}
                    {detalheData.length > 0 && (
                        <div className="chart-container" style={{ padding: 0 }}>
                            {/* Header */}
                            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
                                <div>
                                    <h3 style={{ margin: 0 }}>Matriz de Alocação por Centro de Custo</h3>
                                    <p style={{ margin: '0.2rem 0 0', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                                        Clique em um centro de custo (ex.: Diretoria) para abrir o detalhe por categoria
                                    </p>
                                </div>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <button onClick={expandAll} style={{ padding: '0.375rem 0.75rem', fontSize: '0.8125rem', fontWeight: 500, background: 'var(--background)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', color: 'var(--text-muted)' }}>
                                        Expandir tudo
                                    </button>
                                    <button onClick={collapseAll} style={{ padding: '0.375rem 0.75rem', fontSize: '0.8125rem', fontWeight: 500, background: 'var(--background)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', color: 'var(--text-muted)' }}>
                                        Recolher tudo
                                    </button>
                                </div>
                            </div>

                            {/* Tabela header */}
                            <div style={{ overflowX: 'auto' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 130px 130px 130px 90px', minWidth: 720, padding: '0.625rem 1.5rem', background: 'var(--background)', borderBottom: '1px solid var(--border)' }}>
                                    {['Centro de Custo / Categoria', periodoAnteriorShort, periodoAtualShort, 'Evolução', 'Var %'].map((h, i) => (
                                        <span key={h} style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: i === 0 ? 'left' : 'right' }}>{h}</span>
                                    ))}
                                </div>

                                {/* Rows */}
                                {detalheData.map(cc => {
                                    const isOpen = expandedCCs.has(cc.centroDeCusto);
                                    const ccEvolucaoRS = cc.totalAtual - cc.totalAnterior;
                                    const ccIsNova = cc.totalAnterior === 0 && cc.totalAtual > 0;
                                    const varPct = cc.variacao * 100;
                                    const varColor = varPct <= 0 ? 'var(--success)' : 'var(--danger)';

                                    return (
                                        <div key={cc.centroDeCusto} style={{ borderBottom: '1px solid var(--border)', minWidth: 720 }}>
                                            {/* CC row */}
                                            <button
                                                onClick={() => toggleCC(cc.centroDeCusto)}
                                                style={{
                                                    width: '100%', display: 'grid', gridTemplateColumns: '1fr 130px 130px 130px 90px',
                                                    padding: '0.875rem 1.5rem', background: isOpen ? 'var(--primary-light)' : 'var(--surface)',
                                                    border: 'none', cursor: 'pointer', transition: 'background 0.15s', alignItems: 'center',
                                                }}
                                            >
                                                <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9375rem', fontWeight: 700, color: isOpen ? 'var(--primary)' : 'var(--text-main)', textAlign: 'left' }}>
                                                    {isOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                                                    {cc.centroDeCusto}
                                                    <span style={{ fontSize: '0.75rem', color: 'var(--text-subtle)', fontWeight: 400 }}>({cc.categorias.length} categorias)</span>
                                                </span>
                                                <span style={{ textAlign: 'right', fontSize: '0.875rem', color: 'var(--text-muted)', fontWeight: 500 }}>{formatCurrency(cc.totalAnterior)}</span>
                                                <span style={{ textAlign: 'right', fontSize: '0.9375rem', color: 'var(--text-main)', fontWeight: 700 }}>{formatCurrency(cc.totalAtual)}</span>
                                                <span style={{ textAlign: 'right', fontSize: '0.8125rem', fontWeight: 600, color: ccEvolucaoRS > 0 ? 'var(--danger)' : 'var(--success)' }}>
                                                    {ccEvolucaoRS > 0 ? '+' : ''}{formatCurrency(ccEvolucaoRS)}
                                                </span>
                                                <span style={{ textAlign: 'right', fontSize: '0.8125rem', fontWeight: 700, color: ccIsNova ? 'var(--text-subtle)' : varColor }}>
                                                    {ccIsNova ? 'novo' : `${varPct > 0 ? '+' : ''}${varPct.toFixed(1)}%`}
                                                </span>
                                            </button>

                                            {/* Category rows */}
                                            {isOpen && (
                                                <div style={{ background: 'var(--background)' }}>
                                                    {cc.categorias.map((cat: any, i: number) => {
                                                        const catEvolucaoRS = cat.atual - cat.anterior;
                                                        const catVar = cat.variacao * 100;
                                                        const catColor = catVar <= 0 ? 'var(--success)' : 'var(--danger)';
                                                        return (
                                                            <div
                                                                key={cat.categoria}
                                                                style={{
                                                                    display: 'grid', gridTemplateColumns: '1fr 130px 130px 130px 90px',
                                                                    padding: '0.5rem 1.5rem 0.5rem 3rem',
                                                                    borderTop: '1px solid var(--border)',
                                                                    background: i % 2 === 0 ? 'var(--background)' : 'var(--surface)',
                                                                    alignItems: 'center',
                                                                }}
                                                            >
                                                                <span style={{ fontSize: '0.8125rem', color: 'var(--text-main)', fontWeight: 500 }}>
                                                                    {cat.categoria}
                                                                </span>
                                                                <span style={{ textAlign: 'right', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                                                                    {cat.anterior > 0 ? formatCurrency(cat.anterior) : '—'}
                                                                </span>
                                                                <span style={{ textAlign: 'right', fontSize: '0.8125rem', color: 'var(--text-main)', fontWeight: 600 }}>
                                                                    {cat.atual > 0 ? formatCurrency(cat.atual) : '—'}
                                                                </span>
                                                                <span style={{ textAlign: 'right', fontSize: '0.8125rem', fontWeight: 600, color: catEvolucaoRS > 0 ? 'var(--danger)' : 'var(--success)' }}>
                                                                    {catEvolucaoRS !== 0 ? `${catEvolucaoRS > 0 ? '+' : ''}${formatCurrency(catEvolucaoRS)}` : '—'}
                                                                </span>
                                                                <span style={{ textAlign: 'right', fontSize: '0.8125rem', fontWeight: 600, color: cat.anterior === 0 ? 'var(--text-subtle)' : catColor }}>
                                                                    {cat.anterior === 0 ? 'novo' : `${catVar > 0 ? '+' : ''}${catVar.toFixed(1)}%`}
                                                                </span>
                                                            </div>
                                                        );
                                                    })}
                                                    {/* Total row */}
                                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 130px 130px 130px 90px', padding: '0.625rem 1.5rem 0.625rem 3rem', borderTop: '2px solid var(--border)', background: 'var(--primary-light)', alignItems: 'center' }}>
                                                        <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--primary)' }}>Total {cc.centroDeCusto}</span>
                                                        <span style={{ textAlign: 'right', fontSize: '0.875rem', color: 'var(--text-muted)', fontWeight: 600 }}>{formatCurrency(cc.totalAnterior)}</span>
                                                        <span style={{ textAlign: 'right', fontSize: '0.875rem', color: 'var(--primary)', fontWeight: 700 }}>{formatCurrency(cc.totalAtual)}</span>
                                                        <span style={{ textAlign: 'right', fontSize: '0.8125rem', fontWeight: 700, color: ccEvolucaoRS > 0 ? 'var(--danger)' : 'var(--success)' }}>
                                                            {ccEvolucaoRS > 0 ? '+' : ''}{formatCurrency(ccEvolucaoRS)}
                                                        </span>
                                                        <span style={{ textAlign: 'right', fontSize: '0.875rem', fontWeight: 700, color: ccIsNova ? 'var(--text-subtle)' : varColor }}>
                                                            {ccIsNova ? 'novo' : `${varPct > 0 ? '+' : ''}${varPct.toFixed(1)}%`}
                                                        </span>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                    {detalheData.length === 0 && (
                        <div className="chart-container" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                            O robô não encontrou dados para esta Carga Matricial. Importe um CSV ou ajuste o período.
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export default Despesas;

