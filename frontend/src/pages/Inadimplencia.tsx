import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import {
    AlertCircle, CheckCircle2, ShieldAlert, ChevronDown, ChevronRight,
    GitCompare, BarChart2, User, Users, Loader2,
} from 'lucide-react';
import './Dashboard.css';

const AGING_COLORS = ['#60a5fa', '#f59e0b', '#f97316', '#dc2626', '#7f1d1d'];
const fmt  = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
const fmtS = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v);

const anoAtual = new Date().getFullYear();
const hojeISO  = new Date().toISOString().split('T')[0];

// ─────────────────────────────────────────────────────────────────────────────

const Inadimplencia: React.FC = () => {
    const token = localStorage.getItem('@ContaAzul:token');
    const headers = { Authorization: `Bearer ${token}` };

    // ── modo ──────────────────────────────────────────────────────────────
    const [mode, setMode] = useState<'analise' | 'comparativo'>('analise');

    // ── threshold ─────────────────────────────────────────────────────────
    const [threshold,      setThreshold]      = useState(6000);
    const [thresholdInput, setThresholdInput] = useState('6000');

    // ── análise: estado principal ─────────────────────────────────────────
    const [year,        setYear]        = useState(anoAtual);
    const [agingData,   setAgingData]   = useState<any[]>([]);
    const [topDevedores,setTopDevedores]= useState<any[]>([]);
    const [totalAtraso, setTotalAtraso] = useState(0);
    const [aVencer,     setAVencer]     = useState(0);
    const [isLoading,   setIsLoading]   = useState(true);

    // ── análise: detalhamento individual ─────────────────────────────────
    const [viewMode,          setViewMode]          = useState<'grupo' | 'individual'>('grupo');
    const [devedoresDetalhe,  setDevedoresDetalhe]  = useState<any[]>([]);
    const [expandedDevedores, setExpandedDevedores] = useState<Set<string>>(new Set());
    const [loadingDetalhe,    setLoadingDetalhe]    = useState(false);

    // ── comparativo ───────────────────────────────────────────────────────
    const [compDeA,  setCompDeA]  = useState(`${anoAtual - 1}-01-01`);
    const [compAteA, setCompAteA] = useState(`${anoAtual - 1}-06-30`);
    const [compDeB,  setCompDeB]  = useState(`${anoAtual}-01-01`);
    const [compAteB, setCompAteB] = useState(hojeISO);
    const [compData, setCompData] = useState<any>(null);
    const [loadingComp, setLoadingComp] = useState(false);

    // ── fetches ───────────────────────────────────────────────────────────
    useEffect(() => { if (mode === 'analise') fetchAnalise(); }, [year, mode]);

    const fetchAnalise = async () => {
        setIsLoading(true);
        setExpandedDevedores(new Set());
        try {
            const res = await axios.get(
                `/api/dashboard/inadimplencia/aging?year=${year}`, { headers }
            );
            const { aging, totalAtraso, topDevedores } = res.data;
            setAgingData([
                { name: 'A Vencer',        value: aging.a_vencer    },
                { name: '1 a 30 dias',     value: aging.ate_30      },
                { name: '31 a 60 dias',    value: aging.de_31_a_60  },
                { name: '61 a 90 dias',    value: aging.de_61_a_90  },
                { name: 'Mais de 90 dias', value: aging.mais_de_90  },
            ].filter(d => d.value > 0));
            setTotalAtraso(totalAtraso);
            setAVencer(aging.a_vencer || 0);
            setTopDevedores(topDevedores || []);
        } catch (e) { console.error(e); }
        finally      { setIsLoading(false); }
    };

    // Detalhamento individual — carregado quando o usuário muda para esse modo
    useEffect(() => {
        if (viewMode === 'individual' && devedoresDetalhe.length === 0) {
            fetchDetalhe();
        }
    }, [viewMode, year]);

    const fetchDetalhe = async () => {
        setLoadingDetalhe(true);
        try {
            const res = await axios.get(
                `/api/dashboard/inadimplencia/devedores-detalhe?de=${year}-01-01&ate=${year}-12-31`,
                { headers }
            );
            setDevedoresDetalhe(res.data.devedores || []);
        } catch (e) { console.error(e); }
        finally     { setLoadingDetalhe(false); }
    };

    const fetchComparativo = async () => {
        setLoadingComp(true);
        try {
            const res = await axios.get(
                `/api/dashboard/inadimplencia/comparativo?deA=${compDeA}&ateA=${compAteA}&deB=${compDeB}&ateB=${compAteB}`,
                { headers }
            );
            setCompData(res.data);
        } catch (e) { console.error(e); }
        finally     { setLoadingComp(false); }
    };

    // ── helpers ───────────────────────────────────────────────────────────
    const toggleDevedor = (key: string) =>
        setExpandedDevedores(prev => {
            const next = new Set(prev);
            next.has(key) ? next.delete(key) : next.add(key);
            return next;
        });

    const commitThreshold = (raw: string) => {
        const v = parseFloat(raw.replace(',', '.'));
        if (!isNaN(v) && v >= 0) setThreshold(v);
        else setThresholdInput(String(threshold));
    };

    const percentVencido = totalAtraso / (totalAtraso + aVencer) * 100 || 0;
    const riscoMaisde90  = agingData.find(d => d.name === 'Mais de 90 dias')?.value || 0;

    // ── render ────────────────────────────────────────────────────────────
    return (
        <div className="module-page fade-in">

            {/* ── Header ── */}
            <header className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                    <h2>Risco e Inadimplência</h2>
                    <p>Monitoramento de atrasos, devedores e carteira de risco</p>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                    {/* Toggle modo */}
                    <div className="segmented-control">
                        {([['analise', BarChart2, 'Análise'], ['comparativo', GitCompare, 'A × B']] as const).map(([m, Icon, label]) => (
                            <button key={m} onClick={() => setMode(m)} className={mode === m ? 'active' : ''}>
                                <Icon size={13} /> {label}
                            </button>
                        ))}
                    </div>

                    {/* Threshold */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Min.:</span>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>R$</span>
                        <input type="number" value={thresholdInput}
                            onChange={e => setThresholdInput(e.target.value)}
                            onBlur={e  => commitThreshold(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && commitThreshold(thresholdInput)}
                            className="date-input"
                            style={{ width: '86px', textAlign: 'right', fontWeight: 600, cursor: 'text' }}
                        />
                    </div>

                    {/* Seletor de ano (só no modo análise) */}
                    {mode === 'analise' && (
                        <select value={year} onChange={e => { setYear(Number(e.target.value)); setDevedoresDetalhe([]); }} className="select">
                            <option value={anoAtual - 1}>{anoAtual - 1}</option>
                            <option value={anoAtual}>{anoAtual}</option>
                            <option value={anoAtual + 1}>{anoAtual + 1}</option>
                        </select>
                    )}
                </div>
            </header>

            {/* ══════════════════════════════════════════════════════════════
                MODO ANÁLISE
            ══════════════════════════════════════════════════════════════ */}
            {mode === 'analise' && (
                isLoading ? <LoadingState label="Processando carteira de Recebíveis..." /> : (
                <>
                    {/* KPIs */}
                    <div className="metrics-grid">
                        <div className="kpi-card danger">
                            <div className="kpi-icon" style={{ background: 'var(--danger-light)', color: 'var(--danger)' }}><AlertCircle size={28} /></div>
                            <div className="kpi-content">
                                <h4>Total Vencido em Atraso</h4>
                                <h2 style={{ color: 'var(--danger)' }}>{fmt(totalAtraso)}</h2>
                            </div>
                        </div>
                        <div className="kpi-card highlight">
                            <div className="kpi-icon" style={{ background: 'var(--success-light)', color: 'var(--success)' }}><CheckCircle2 size={28} /></div>
                            <div className="kpi-content">
                                <h4>A Vencer (Saudável)</h4>
                                <h2>{fmt(aVencer)}</h2>
                            </div>
                        </div>
                        <div className="kpi-card warning">
                            <div className="kpi-icon" style={{ background: 'var(--warning-light)', color: 'var(--warning)' }}><ShieldAlert size={28} /></div>
                            <div className="kpi-content">
                                <h4>Risco Crítico (&gt; 90 dias)</h4>
                                <h2 style={{ color: 'var(--warning)' }}>{fmt(riscoMaisde90)}</h2>
                                <span style={{ display: 'inline-block', marginTop: '0.25rem', padding: '0.15rem 0.6rem', borderRadius: '2rem', fontSize: '0.75rem', fontWeight: 700, background: 'var(--surface-hover)', color: 'var(--text-muted)' }}>
                                    Taxa Inadimplência: {percentVencido.toFixed(1)}%
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Gráficos */}
                    <div className="charts-grid" style={{ gridTemplateColumns: 'minmax(320px, 1fr) 2fr', marginBottom: '1.5rem' }}>
                        {/* Pie */}
                        <div className="chart-container">
                            <h3>Idade da Dívida</h3>
                            <div style={{ height: 250, marginTop: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                {agingData.length > 0 ? (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie data={agingData} cx="50%" cy="50%" innerRadius={65} outerRadius={90} paddingAngle={4} dataKey="value" stroke="none"
                                                label={({ percent }) => (percent || 0) > 0.05 ? `${((percent || 0) * 100).toFixed(0)}%` : ''} labelLine={false}>
                                                {agingData.map((_e, i) => <Cell key={i} fill={AGING_COLORS[i % AGING_COLORS.length]} />)}
                                            </Pie>
                                            <Tooltip formatter={(v: any) => fmt(Number(v))} contentStyle={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)', borderRadius: 12, color: 'var(--text-main)' }} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                ) : <span style={{ color: 'var(--text-muted)' }}>Sem dados</span>}
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', justifyContent: 'center', marginTop: '1rem' }}>
                                {agingData.map((d, i) => (
                                    <div key={d.name} style={{ display: 'flex', alignItems: 'center', fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                                        <div style={{ width: 10, height: 10, borderRadius: '50%', marginRight: 6, background: AGING_COLORS[i % AGING_COLORS.length] }} />
                                        {d.name}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Tabela de devedores com toggle grupo/individual */}
                        <div className="chart-container" style={{ padding: 0, display: 'flex', flexDirection: 'column' }}>
                            <div style={{ padding: '1.25rem 1.75rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
                                <div>
                                    <h3 style={{ marginBottom: 0 }}>Devedores em Atraso</h3>
                                    <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                                        Acima de {fmtS(threshold)} · apenas vencidos antes de hoje
                                    </p>
                                </div>
                                {/* Toggle grupo / individual */}
                                <div className="segmented-control sm">
                                    {([['grupo', Users, 'Por grupo'], ['individual', User, 'Individual']] as const).map(([v, Icon, lbl]) => (
                                        <button key={v} onClick={() => setViewMode(v)} className={viewMode === v ? 'active' : ''}>
                                            <Icon size={12} /> {lbl}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* ── Por grupo ── */}
                            {viewMode === 'grupo' && (
                                <div style={{ flex: 1, overflowY: 'auto' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                                        <thead style={{ position: 'sticky', top: 0, background: 'var(--surface)', zIndex: 10 }}>
                                            <tr>
                                                <th style={thStyle}>Devedor / Grupo Econômico</th>
                                                <th style={{ ...thStyle, textAlign: 'right' }}>Dívida em Aberto</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {topDevedores.filter(d => d.valorDevido >= threshold).map((dev, idx) => (
                                                <tr key={idx} style={{ borderBottom: '1px solid var(--border)' }}>
                                                    <td style={{ padding: '0.875rem 1.75rem', color: 'var(--text-main)', fontSize: '0.9375rem', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                                                        {dev.cliente.includes('(Grupo)')
                                                            ? <Badge bg="#e0e7ff" color="#4f46e5">GRUPO</Badge>
                                                            : <Badge bg="var(--surface-hover)" color="var(--text-muted)">CLIENTE</Badge>}
                                                        {dev.cliente.replace(' (Grupo)', '')}
                                                    </td>
                                                    <td style={{ padding: '0.875rem 1.75rem', textAlign: 'right' }}>
                                                        <div style={{ color: 'var(--text-main)', fontWeight: 600, marginBottom: 4 }}>{fmt(dev.valorDevido)}</div>
                                                        <div style={{ height: 6, background: 'var(--surface-hover)', borderRadius: 100, overflow: 'hidden' }}>
                                                            <div style={{ height: '100%', width: `${Math.min((dev.valorDevido / (topDevedores[0]?.valorDevido || 1)) * 100, 100)}%`, background: idx < 3 ? 'var(--danger)' : 'var(--warning)', borderRadius: 100 }} />
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                            {topDevedores.filter(d => d.valorDevido >= threshold).length === 0 && (
                                                <tr><td colSpan={2} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>Nenhum devedor acima do limite.</td></tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            {/* ── Individual ── */}
                            {viewMode === 'individual' && (
                                loadingDetalhe
                                    ? <LoadingState label="Carregando títulos individuais..." />
                                    : <TabelaIndividual
                                        devedores={devedoresDetalhe.filter(d => d.valorTotal >= threshold)}
                                        expanded={expandedDevedores}
                                        onToggle={toggleDevedor}
                                        topValor={devedoresDetalhe[0]?.valorTotal || 1}
                                      />
                            )}
                        </div>
                    </div>
                </>
            ))}

            {/* ══════════════════════════════════════════════════════════════
                MODO COMPARATIVO
            ══════════════════════════════════════════════════════════════ */}
            {mode === 'comparativo' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    {/* Seletores de período */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        {[
                            { label: 'Período A', de: compDeA, setDe: setCompDeA, ate: compAteA, setAte: setCompAteA, cor: '#7c3aed', bg: '#f5f3ff' },
                            { label: 'Período B', de: compDeB, setDe: setCompDeB, ate: compAteB, setAte: setCompAteB, cor: '#2563eb', bg: '#eff6ff' },
                        ].map(p => (
                            <div key={p.label} style={{ background: 'var(--surface)', border: `2px solid ${p.cor}22`, borderRadius: 'var(--radius-lg)', padding: '1.125rem 1.5rem', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                                <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: p.cor, textTransform: 'uppercase', letterSpacing: '0.06em', minWidth: 76 }}>{p.label}</span>
                                <input type="date" value={p.de} onChange={e => p.setDe(e.target.value)} className="date-input" style={{ borderColor: `${p.cor}44` }} />
                                <span style={{ color: 'var(--text-subtle)' }}>→</span>
                                <input type="date" value={p.ate} onChange={e => p.setAte(e.target.value)} className="date-input" style={{ borderColor: `${p.cor}44` }} />
                            </div>
                        ))}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'center' }}>
                        <button onClick={fetchComparativo} disabled={loadingComp} className="btn btn-primary" style={{ padding: '0.625rem 2rem', fontSize: '0.9375rem' }}>
                            {loadingComp ? <><Loader2 size={15} className="animate-spin" /> Calculando...</> : <><GitCompare size={15} /> Comparar períodos</>}
                        </button>
                    </div>

                    {compData && !loadingComp && (
                        <ComparativoView data={compData} threshold={threshold} />
                    )}

                    {!compData && !loadingComp && (
                        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)', fontSize: '0.9375rem' }}>
                            Selecione os períodos e clique em <strong>Comparar</strong>.
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

// ─────────────────────────────────────────────────────────────────────────────
// Sub-componentes
// ─────────────────────────────────────────────────────────────────────────────

const LoadingState: React.FC<{ label: string }> = ({ label }) => (
    <div className="loading-state" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', padding: '4rem', color: 'var(--text-muted)' }}>
        <Loader2 size={20} className="animate-spin" />
        <span>{label}</span>
    </div>
);

const Badge: React.FC<{ bg: string; color: string; children: React.ReactNode }> = ({ bg, color, children }) => (
    <span style={{ background: bg, color, fontSize: '0.7rem', padding: '0.2rem 0.45rem', borderRadius: '0.3rem', fontWeight: 700, letterSpacing: '0.05em', flexShrink: 0 }}>
        {children}
    </span>
);

const thStyle: React.CSSProperties = {
    padding: '0.875rem 1.75rem', borderBottom: '1px solid var(--border)',
    color: 'var(--text-muted)', fontSize: '0.8125rem', fontWeight: 600,
};

// ── Tabela individual com accordion ──────────────────────────────────────────
interface DevedorDetalhe {
    cliente:      string;
    grupo:        string | null;
    valorTotal:   number;
    diasMaxAtraso: number;
    qtdTitulos:   number;
    titulos:      { id: string; dataVencimento: string; valor: number; diasAtraso: number; descricao: string | null; numeroNF: string | null }[];
}

const TabelaIndividual: React.FC<{
    devedores:   DevedorDetalhe[];
    expanded:    Set<string>;
    onToggle:    (k: string) => void;
    topValor:    number;
}> = ({ devedores, expanded, onToggle }) => {
    const fmt  = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
    const fmtS = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v);

    const diasColor = (d: number) =>
        d > 90 ? '#7f1d1d' : d > 60 ? '#dc2626' : d > 30 ? '#f97316' : '#f59e0b';

    if (devedores.length === 0)
        return <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>Nenhum devedor individual acima do limite.</div>;

    return (
        <div style={{ flex: 1, overflowY: 'auto' }}>
            {/* Cabeçalho */}
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 130px 80px 60px', padding: '0.625rem 1.75rem', background: 'var(--background)', borderBottom: '1px solid var(--border)' }}>
                {['Cliente', 'Total em Aberto', 'Títulos', 'Dias'].map((h, i) => (
                    <span key={h} style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: i === 0 ? 'left' : 'right' }}>{h}</span>
                ))}
            </div>

            {devedores.map(dev => {
                const key    = dev.cliente;
                const isOpen = expanded.has(key);
                return (
                    <div key={key} style={{ borderBottom: '1px solid var(--border)' }}>
                        {/* Linha do devedor */}
                        <button onClick={() => onToggle(key)}
                            style={{ width: '100%', display: 'grid', gridTemplateColumns: '2fr 130px 80px 60px', padding: '0.875rem 1.75rem', border: 'none', cursor: 'pointer', background: isOpen ? 'var(--primary-light)' : 'var(--surface)', transition: 'background 0.15s', alignItems: 'center' }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', textAlign: 'left' }}>
                                {isOpen ? <ChevronDown size={14} color="var(--primary)" /> : <ChevronRight size={14} color="var(--text-muted)" />}
                                <span style={{ fontSize: '0.9rem', fontWeight: 600, color: isOpen ? 'var(--primary)' : 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{dev.cliente}</span>
                                {dev.grupo && <Badge bg="#e0e7ff" color="#4f46e5">{dev.grupo}</Badge>}
                            </span>
                            <span style={{ textAlign: 'right', fontWeight: 700, color: 'var(--text-main)', fontSize: '0.9rem' }}>
                                {fmtS(dev.valorTotal)}
                            </span>
                            <span style={{ textAlign: 'right', color: 'var(--text-muted)', fontSize: '0.8125rem' }}>{dev.qtdTitulos}</span>
                            <span style={{ textAlign: 'right', fontWeight: 700, fontSize: '0.8125rem', color: diasColor(dev.diasMaxAtraso) }}>
                                {dev.diasMaxAtraso}d
                            </span>
                        </button>

                        {/* Títulos expandidos */}
                        {isOpen && (
                            <div style={{ background: 'var(--background)', borderTop: '1px solid var(--border)' }}>
                                {/* Mini-header */}
                                <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr 110px 60px', padding: '0.5rem 1.75rem 0.5rem 3.5rem', borderBottom: '1px solid var(--border)' }}>
                                    {['Vencimento', 'Descrição / NF', 'Valor', 'Atraso'].map((h, i) => (
                                        <span key={h} style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-subtle)', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: i >= 2 ? 'right' : 'left' }}>{h}</span>
                                    ))}
                                </div>
                                {dev.titulos.map((t, ti) => (
                                    <div key={t.id} style={{ display: 'grid', gridTemplateColumns: '120px 1fr 110px 60px', padding: '0.5rem 1.75rem 0.5rem 3.5rem', background: ti % 2 === 0 ? 'var(--background)' : 'var(--surface)', alignItems: 'center', borderBottom: '1px solid var(--border)' }}>
                                        <span style={{ fontSize: '0.8125rem', color: 'var(--text-main)', fontWeight: 500 }}>{new Date(`${t.dataVencimento}T00:00:00`).toLocaleDateString('pt-BR')}</span>
                                        <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: '0.5rem' }}>
                                            {t.descricao || (t.numeroNF ? `NF ${t.numeroNF}` : '—')}
                                        </span>
                                        <span style={{ textAlign: 'right', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-main)' }}>{fmt(t.valor)}</span>
                                        <span style={{ textAlign: 'right', fontSize: '0.8125rem', fontWeight: 700, color: diasColor(t.diasAtraso) }}>{t.diasAtraso}d</span>
                                    </div>
                                ))}
                                {/* Total do cliente */}
                                <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr 110px 60px', padding: '0.5rem 1.75rem 0.625rem 3.5rem', background: 'var(--primary-light)', borderTop: '2px solid var(--border)', alignItems: 'center' }}>
                                    <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--primary)', gridColumn: '1 / 3' }}>Total {dev.cliente}</span>
                                    <span style={{ textAlign: 'right', fontWeight: 700, color: 'var(--primary)', fontSize: '0.875rem' }}>{fmt(dev.valorTotal)}</span>
                                    <span />
                                </div>
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
};

// ── Vista comparativa ─────────────────────────────────────────────────────────
const ComparativoView: React.FC<{ data: any; threshold: number }> = ({ data, threshold }) => {
    const fmt  = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
    const fmtS = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v);
    const { periodoA, periodoB, tabelaComparativa } = data;

    const KpiComp = ({ label, vA, vB }: { label: string; vA: number; vB: number }) => {
        const var_ = vA > 0 ? ((vB - vA) / vA) * 100 : null;
        return (
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '1.125rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                    <div>
                        <div style={{ fontSize: '0.7rem', color: '#7c3aed', fontWeight: 700, marginBottom: 2 }}>Período A</div>
                        <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-main)' }}>{fmtS(vA)}</div>
                    </div>
                    <div>
                        <div style={{ fontSize: '0.7rem', color: '#2563eb', fontWeight: 700, marginBottom: 2 }}>Período B</div>
                        <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-main)' }}>{fmtS(vB)}</div>
                    </div>
                </div>
                {var_ !== null && (
                    <span style={{ alignSelf: 'flex-start', fontSize: '0.75rem', fontWeight: 700, padding: '0.15rem 0.5rem', borderRadius: '1rem', background: var_ <= 0 ? 'var(--success-light)' : 'var(--danger-light)', color: var_ <= 0 ? 'var(--success)' : 'var(--danger)' }}>
                        {var_ > 0 ? '+' : ''}{var_.toFixed(1)}%
                    </span>
                )}
            </div>
        );
    };

    const tabela = tabelaComparativa.filter((r: any) => Math.max(r.valorA, r.valorB) >= threshold);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* Labels dos períodos */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                {[periodoA, periodoB].map((p: any, i: number) => (
                    <div key={i} style={{ padding: '0.625rem 1rem', background: i === 0 ? '#f5f3ff' : '#eff6ff', borderRadius: 'var(--radius-md)', borderLeft: `3px solid ${i === 0 ? '#7c3aed' : '#2563eb'}` }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: i === 0 ? '#7c3aed' : '#2563eb', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Período {i === 0 ? 'A' : 'B'}</span>
                        <span style={{ fontSize: '0.875rem', color: 'var(--text-main)', marginLeft: '0.75rem' }}>{p.label}</span>
                    </div>
                ))}
            </div>

            {/* KPIs comparativos */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
                <KpiComp label="Total Vencido em Atraso" vA={periodoA.totalAtraso} vB={periodoB.totalAtraso} />
                <KpiComp label="A Vencer (Saudável)"     vA={periodoA.aVencer}     vB={periodoB.aVencer}     />
                <KpiComp label="Risco Crítico > 90 dias" vA={periodoA.aging.mais_de_90} vB={periodoB.aging.mais_de_90} />
            </div>

            {/* Tabela de devedores lado a lado */}
            <div className="chart-container" style={{ padding: 0 }}>
                <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border)' }}>
                    <h3 style={{ margin: 0 }}>Comparativo por Devedor</h3>
                    <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                        Acima de {fmtS(threshold)} em pelo menos um dos períodos.
                    </p>
                </div>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                        <thead style={{ background: 'var(--background)' }}>
                            <tr>
                                <th style={{ padding: '0.75rem 1.5rem', borderBottom: '1px solid var(--border)', fontSize: '0.8125rem', color: 'var(--text-muted)', fontWeight: 600 }}>Devedor</th>
                                <th style={{ padding: '0.75rem 1.5rem', borderBottom: '1px solid var(--border)', fontSize: '0.8125rem', color: '#7c3aed', fontWeight: 700, textAlign: 'right' }}>Período A</th>
                                <th style={{ padding: '0.75rem 1.5rem', borderBottom: '1px solid var(--border)', fontSize: '0.8125rem', color: '#2563eb', fontWeight: 700, textAlign: 'right' }}>Período B</th>
                                <th style={{ padding: '0.75rem 1.5rem', borderBottom: '1px solid var(--border)', fontSize: '0.8125rem', color: 'var(--text-muted)', fontWeight: 600, textAlign: 'right' }}>Variação</th>
                            </tr>
                        </thead>
                        <tbody>
                            {tabela.map((row: any, idx: number) => {
                                const var_ = row.variacao;
                                const varColor = var_ === null ? 'var(--text-subtle)' : var_ <= 0 ? 'var(--success)' : 'var(--danger)';
                                const varLabel = var_ === null ? 'novo' : `${var_ > 0 ? '+' : ''}${var_.toFixed(1)}%`;
                                const isGrupo = row.cliente.includes('(Grupo)');
                                return (
                                    <tr key={idx} style={{ borderBottom: '1px solid var(--border)', background: idx % 2 === 0 ? 'var(--surface)' : 'var(--background)' }}>
                                        <td style={{ padding: '0.875rem 1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            {isGrupo
                                                ? <Badge bg="#e0e7ff" color="#4f46e5">GRUPO</Badge>
                                                : <Badge bg="var(--surface-hover)" color="var(--text-muted)">CLIENTE</Badge>}
                                            <span style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-main)' }}>{row.cliente.replace(' (Grupo)', '')}</span>
                                        </td>
                                        <td style={{ padding: '0.875rem 1.5rem', textAlign: 'right', fontWeight: 600, color: row.valorA > 0 ? '#7c3aed' : 'var(--text-subtle)', fontSize: '0.875rem' }}>
                                            {row.valorA > 0 ? fmt(row.valorA) : '—'}
                                        </td>
                                        <td style={{ padding: '0.875rem 1.5rem', textAlign: 'right', fontWeight: 600, color: row.valorB > 0 ? '#2563eb' : 'var(--text-subtle)', fontSize: '0.875rem' }}>
                                            {row.valorB > 0 ? fmt(row.valorB) : '—'}
                                        </td>
                                        <td style={{ padding: '0.875rem 1.5rem', textAlign: 'right', fontWeight: 700, color: varColor, fontSize: '0.875rem' }}>
                                            {varLabel}
                                        </td>
                                    </tr>
                                );
                            })}
                            {tabela.length === 0 && (
                                <tr><td colSpan={4} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>Nenhum devedor encontrado nos períodos selecionados.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default Inadimplencia;
