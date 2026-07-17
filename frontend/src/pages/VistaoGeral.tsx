import React, { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import {
    TrendingDown, AlertTriangle, Landmark, TrendingUp,
    ArrowUpRight, ArrowDownRight, Loader2, ChevronRight,
    SlidersHorizontal, Check,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import PeriodFilterBar from '../components/PeriodFilterBar';
import './Dashboard.css';

const API = '';
const fmt = (v: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v);
const fmtPct = (v: number) => `${v > 0 ? '+' : ''}${v.toFixed(1)}%`;
const fmtDateLabel = (iso: string) =>
    new Date(`${iso}T00:00:00`).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short', year: '2-digit' });

const THRESHOLD_DEVEDOR = 10_000;

// ── Filtro de período ────────────────────────────────────────────────────────
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
    const agora = new Date();
    const y = agora.getFullYear();
    const m = agora.getMonth();

    switch (preset) {
        case 'this_month':
            return { de: toISO(new Date(y, m, 1)), ate: toISO(agora) };
        case 'last_month':
            return { de: toISO(new Date(y, m - 1, 1)), ate: toISO(new Date(y, m, 0)) };
        case 'last_3m':
            return { de: toISO(new Date(y, m - 2, 1)), ate: toISO(agora) };
        case 'last_6m':
            return { de: toISO(new Date(y, m - 5, 1)), ate: toISO(agora) };
        case 'ytd':
            return { de: `${y}-01-01`, ate: toISO(agora) };
        case 'this_year':
            return { de: `${y}-01-01`, ate: `${y}-12-31` };
        case 'last_year':
            return { de: `${y - 1}-01-01`, ate: `${y - 1}-12-31` };
        default:
            return fallback;
    }
}

function agruparDevedores(lista: { cliente: string; valorDevido: number }[]) {
    const acima     = lista.filter(d => d.valorDevido >  THRESHOLD_DEVEDOR);
    const somaAbaixo = lista
        .filter(d => d.valorDevido <= THRESHOLD_DEVEDOR)
        .reduce((s, d) => s + d.valorDevido, 0);
    return somaAbaixo > 0
        ? [...acima, { cliente: 'Diversos', valorDevido: somaAbaixo }]
        : acima;
}

const hoje     = new Date();
const anoAtual = hoje.getFullYear();
const DEFAULT_DE  = `${anoAtual}-01-01`;
const DEFAULT_ATE = hoje.toISOString().split('T')[0];

interface CategoriaDespesa {
    categoria:     string;
    totalAtual:    number;
    totalAnterior: number;
}

interface KpiBase {
    totalAtraso:  number;
    riscoGrave:   number;
    topDevedores: { cliente: string; valorDevido: number }[];
}

const VistaoGeral: React.FC = () => {
    const navigate = useNavigate();

    // ── filtros de período ──────────────────────────────────────────────────
    const [preset,         setPreset]         = useState<PresetKey>('ytd');
    const [periodoInicio,  setPeriodoInicio]  = useState(DEFAULT_DE);
    const [periodoFim,     setPeriodoFim]     = useState(DEFAULT_ATE);
    const [periodoAplic,   setPeriodoAplic]   = useState({ de: DEFAULT_DE, ate: DEFAULT_ATE });

    // ── exclusão de categorias ─────────────────────────────────────────────
    const [categorias,         setCategorias]         = useState<CategoriaDespesa[]>([]);
    const [categoriasExcluidas, setCategoriasExcluidas] = useState<Set<string>>(new Set());
    const [showCatPanel,       setShowCatPanel]       = useState(false);
    const catRef = useRef<HTMLDivElement>(null);

    // ── dados base (aging — não muda com período) ──────────────────────────
    const [kpiBase,  setKpiBase]  = useState<KpiBase | null>(null);
    const [loadBase, setLoadBase] = useState(true);

    // ── dados do período ───────────────────────────────────────────────────
    const [recebidoPeriodo, setRecebidoPeriodo] = useState(0);
    const [loadPeriodo,     setLoadPeriodo]     = useState(false);

    // ── fetch base (aging) — uma vez ───────────────────────────────────────
    useEffect(() => {
        axios.get(`${API}/api/dashboard/inadimplencia/aging`)
            .then(r => {
                const { totalAtraso, aging, topDevedores } = r.data;
                setKpiBase({
                    totalAtraso,
                    riscoGrave:   aging?.mais_de_90 || 0,
                    topDevedores: agruparDevedores(topDevedores || []).slice(0, 7),
                });
            })
            .catch(console.error)
            .finally(() => setLoadBase(false));
    }, []);

    // ── fetch por período ──────────────────────────────────────────────────
    useEffect(() => {
        const { de, ate } = periodoAplic;
        setLoadPeriodo(true);
        Promise.all([
            axios.get(`${API}/api/dashboard/despesas/resumo-periodo?de=${de}&ate=${ate}`),
            axios.get(`${API}/api/dashboard/despesas/caixa-bancos?de=${de}&ate=${ate}`),
        ]).then(([resumo, bancos]) => {
            setCategorias(resumo.data.categorias || []);
            const rec = (bancos.data.data || []).find((b: any) => b.name === 'Recebido')?.valor || 0;
            setRecebidoPeriodo(rec);
        }).catch(console.error)
          .finally(() => setLoadPeriodo(false));
    }, [periodoAplic]);

    // fechar dropdown ao clicar fora
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (catRef.current && !catRef.current.contains(e.target as Node))
                setShowCatPanel(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    // ── cálculos derivados de categorias ──────────────────────────────────
    const ativas = categorias.filter(c => !categoriasExcluidas.has(c.categoria));
    const despesaAtual    = ativas.reduce((s, c) => s + c.totalAtual,    0);
    const despesaAnterior = ativas.reduce((s, c) => s + c.totalAnterior, 0);
    const varDespesa = despesaAnterior > 0
        ? ((despesaAtual - despesaAnterior) / despesaAnterior) * 100
        : 0;

    const qtdExcluidas = categoriasExcluidas.size;
    const periodoLabel = `${fmtDateLabel(periodoAplic.de)} – ${fmtDateLabel(periodoAplic.ate)}`;
    const anoAnterior  = new Date(`${periodoAplic.de}T00:00:00`).getFullYear() - 1;

    const handlePresetChange = (novo: PresetKey) => {
        setPreset(novo);
        if (novo === 'custom') return;
        const range = computeRange(novo, { de: periodoInicio, ate: periodoFim });
        setPeriodoInicio(range.de);
        setPeriodoFim(range.ate);
        setPeriodoAplic(range);
    };

    const handlePeriodoInicioChange = (valor: string) => {
        setPreset('custom');
        setPeriodoInicio(valor);
    };
    const handlePeriodoFimChange = (valor: string) => {
        setPreset('custom');
        setPeriodoFim(valor);
    };

    const periodoPendente = periodoInicio !== periodoAplic.de || periodoFim !== periodoAplic.ate;

    const aplicarFiltro = () => setPeriodoAplic({ de: periodoInicio, ate: periodoFim });

    const toggleCategoria = (cat: string) =>
        setCategoriasExcluidas(prev => {
            const next = new Set(prev);
            next.has(cat) ? next.delete(cat) : next.add(cat);
            return next;
        });

    // ── loading ────────────────────────────────────────────────────────────
    if (loadBase) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', gap: '0.625rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                <Loader2 size={18} className="animate-spin" /> Carregando indicadores...
            </div>
        );
    }
    if (!kpiBase) return null;

    // ── render ─────────────────────────────────────────────────────────────
    return (
        <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

            {/* Header */}
            <div>
                <h2 style={{ fontSize: '1.375rem', fontWeight: 700, color: 'var(--text-main)', letterSpacing: '-0.02em' }}>
                    Visão Geral
                </h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
                    Resumo financeiro · {hoje.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
            </div>

            {/* ── Barra de Filtros ── */}
            <div style={{
                display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap',
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius-lg)', padding: '0.875rem 1.25rem',
                boxShadow: 'var(--shadow-sm)',
            }}>
                <PeriodFilterBar
                    icon={<SlidersHorizontal size={15} color="var(--text-muted)" style={{ flexShrink: 0 }} />}
                    label="Período"
                    presets={PRESETS}
                    preset={preset}
                    onPresetChange={(key) => handlePresetChange(key as PresetKey)}
                    de={periodoInicio}
                    ate={periodoFim}
                    onDeChange={handlePeriodoInicioChange}
                    onAteChange={handlePeriodoFimChange}
                    onApply={aplicarFiltro}
                    pending={periodoPendente}
                    isLoading={loadPeriodo}
                />

                {/* Separador */}
                <div style={{ width: 1, height: 20, background: 'var(--border)', margin: '0 0.25rem' }} />

                {/* Filtro de categorias (relativo ao card de despesa) */}
                <div ref={catRef} style={{ position: 'relative' }}>
                    <button
                        onClick={() => setShowCatPanel(v => !v)}
                        style={{
                            ...btnSecStyle,
                            ...(qtdExcluidas > 0 ? { borderColor: 'var(--primary)', color: 'var(--primary)' } : {}),
                        }}
                    >
                        <TrendingDown size={13} />
                        Categorias de despesa
                        {qtdExcluidas > 0 && (
                            <span style={{ background: 'var(--primary)', color: '#fff', fontSize: '0.7rem', fontWeight: 700, borderRadius: '1rem', padding: '0.1rem 0.45rem' }}>
                                -{qtdExcluidas}
                            </span>
                        )}
                    </button>

                    {showCatPanel && categorias.length > 0 && (
                        <div style={{
                            position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 100,
                            background: 'var(--surface)', border: '1px solid var(--border)',
                            borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-md)',
                            minWidth: 280, maxHeight: 340, overflowY: 'auto', padding: '0.5rem',
                        }}>
                            {/* Ações rápidas */}
                            <div style={{ display: 'flex', gap: '0.375rem', padding: '0.375rem 0.5rem 0.625rem', borderBottom: '1px solid var(--border)', marginBottom: '0.375rem' }}>
                                <button onClick={() => setCategoriasExcluidas(new Set())} style={btnMicroStyle}>
                                    Incluir todas
                                </button>
                                <button
                                    onClick={() => setCategoriasExcluidas(new Set(categorias.map(c => c.categoria)))}
                                    style={btnMicroStyle}
                                >
                                    Excluir todas
                                </button>
                            </div>
                            {categorias.map(c => {
                                const excluida = categoriasExcluidas.has(c.categoria);
                                return (
                                    <button
                                        key={c.categoria}
                                        onClick={() => toggleCategoria(c.categoria)}
                                        style={{
                                            display: 'flex', alignItems: 'center', gap: '0.5rem',
                                            width: '100%', padding: '0.5rem 0.625rem',
                                            borderRadius: 'var(--radius-sm)', border: 'none',
                                            background: excluida ? 'var(--background)' : 'transparent',
                                            cursor: 'pointer', textAlign: 'left',
                                            opacity: excluida ? 0.45 : 1,
                                            transition: 'background 0.1s',
                                        }}
                                    >
                                        <div style={{
                                            width: 16, height: 16, borderRadius: 4, flexShrink: 0,
                                            border: `2px solid ${excluida ? 'var(--border)' : 'var(--primary)'}`,
                                            background: excluida ? 'transparent' : 'var(--primary)',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        }}>
                                            {!excluida && <Check size={10} color="#fff" strokeWidth={3} />}
                                        </div>
                                        <span style={{ flex: 1, fontSize: '0.8125rem', color: 'var(--text-main)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {c.categoria}
                                        </span>
                                        <span style={{ fontSize: '0.75rem', color: 'var(--text-subtle)', flexShrink: 0 }}>
                                            {fmt(c.totalAtual)}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* ── KPI Cards ── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>

                {/* Card 1: Despesa do Período */}
                <button onClick={() => navigate(`/despesas?de=${periodoAplic.de}&ate=${periodoAplic.ate}`)} className="kpi-card" style={cardStyle}>
                    <div style={cardHeaderRow}>
                        <div className="kpi-icon" style={{ background: 'var(--primary-light)' }}>
                            <TrendingUp size={18} color="var(--primary)" />
                        </div>
                        {varDespesa !== 0 && (
                            <span style={badgeStyle(varDespesa)}>
                                {varDespesa <= 0 ? <ArrowDownRight size={12} /> : <ArrowUpRight size={12} />}
                                {fmtPct(Math.abs(varDespesa))}
                            </span>
                        )}
                    </div>
                    <div style={cardLabel}>
                        Despesa Acumulada
                        {qtdExcluidas > 0 && <span style={{ color: 'var(--primary)', fontWeight: 700 }}> (-{qtdExcluidas} cat.)</span>}
                    </div>
                    <div style={cardValue(loadPeriodo)}>
                        {loadPeriodo ? '—' : fmt(despesaAtual)}
                    </div>
                    <div style={cardSubLabel}>
                        {periodoLabel}
                        {despesaAnterior > 0 && (
                            <span style={{ display: 'block', marginTop: 2 }}>
                                vs. {fmt(despesaAnterior)} em {anoAnterior}
                            </span>
                        )}
                    </div>
                </button>

                {/* Card 2: Total Vencido em Atraso */}
                <button onClick={() => navigate('/inadimplencia')} className="kpi-card" style={cardStyle}>
                    <div style={cardHeaderRow}>
                        <div className="kpi-icon" style={{ background: 'var(--danger-light)' }}>
                            <AlertTriangle size={18} color="var(--danger)" />
                        </div>
                    </div>
                    <div style={cardLabel}>Total Vencido em Atraso</div>
                    <div style={cardValue(false)}>{fmt(kpiBase.totalAtraso)}</div>
                    <div style={cardSubLabel}>Risco crítico (+90d): {fmt(kpiBase.riscoGrave)}</div>
                </button>

                {/* Card 3: Recebido no Período */}
                <button onClick={() => navigate('/evolucao')} className="kpi-card" style={cardStyle}>
                    <div style={cardHeaderRow}>
                        <div className="kpi-icon" style={{ background: 'var(--success-light)' }}>
                            <Landmark size={18} color="var(--success)" />
                        </div>
                    </div>
                    <div style={cardLabel}>Receitas Recebidas</div>
                    <div style={cardValue(loadPeriodo)}>
                        {loadPeriodo ? '—' : fmt(recebidoPeriodo)}
                    </div>
                    <div style={cardSubLabel}>{periodoLabel}</div>
                </button>

                {/* Card 4: Saldo Líquido do Período */}
                <button onClick={() => navigate('/evolucao')} className="kpi-card" style={cardStyle}>
                    {(() => {
                        const saldo = recebidoPeriodo - despesaAtual;
                        const positivo = saldo >= 0;
                        return (
                            <>
                                <div style={cardHeaderRow}>
                                    <div className="kpi-icon" style={{ background: positivo ? 'var(--success-light)' : 'var(--danger-light)' }}>
                                        {positivo
                                            ? <TrendingDown size={18} color="var(--success)" />
                                            : <TrendingDown size={18} color="var(--danger)" />}
                                    </div>
                                </div>
                                <div style={cardLabel}>Saldo Líquido</div>
                                <div style={{ ...cardValue(loadPeriodo), color: loadPeriodo ? 'var(--text-main)' : (positivo ? 'var(--success)' : 'var(--danger)') }}>
                                    {loadPeriodo ? '—' : fmt(saldo)}
                                </div>
                                <div style={cardSubLabel}>Receitas − Despesas · {periodoLabel}</div>
                            </>
                        );
                    })()}
                </button>
            </div>

            {/* ── Bottom row ── */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>

                {/* Maiores Devedores */}
                <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '1.5rem', boxShadow: 'var(--shadow-sm)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                        <div>
                            <h3 style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-main)' }}>Maiores Devedores</h3>
                            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.125rem' }}>
                                Acima de {fmt(THRESHOLD_DEVEDOR)} · demais agrupados como "Diversos"
                            </p>
                        </div>
                        <button onClick={() => navigate('/inadimplencia')} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.8125rem', color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500 }}>
                            Ver todos <ChevronRight size={14} />
                        </button>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                        {kpiBase.topDevedores.map((d, i) => {
                            const pct = kpiBase.totalAtraso > 0 ? (d.valorDevido / kpiBase.totalAtraso) * 100 : 0;
                            const isDiversos = d.cliente === 'Diversos';
                            return (
                                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                    <span style={{ fontSize: '0.75rem', color: 'var(--text-subtle)', width: 16, textAlign: 'right', flexShrink: 0 }}>{i + 1}</span>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                            <span style={{ fontSize: '0.8125rem', fontWeight: 500, color: isDiversos ? 'var(--text-muted)' : 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '60%', fontStyle: isDiversos ? 'italic' : 'normal' }}>
                                                {d.cliente}
                                            </span>
                                            <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--danger)', flexShrink: 0 }}>{fmt(d.valorDevido)}</span>
                                        </div>
                                        <div style={{ height: 4, background: 'var(--background)', borderRadius: 2, overflow: 'hidden' }}>
                                            <div style={{ height: '100%', width: `${Math.min(pct, 100)}%`, background: isDiversos ? '#94a3b8' : (i === 0 ? 'var(--danger)' : i <= 2 ? '#f97316' : '#fbbf24'), borderRadius: 2 }} />
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Módulos */}
                <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '1.5rem', boxShadow: 'var(--shadow-sm)' }}>
                    <h3 style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '1.25rem' }}>Módulos</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {[
                            { label: 'Risco e Inadimplência',  desc: 'Aging, devedores e carteira de risco',    path: '/inadimplencia', color: 'var(--danger)',  bg: 'var(--danger-light)' },
                            { label: 'Custos & Despesas',      desc: 'Pareto por categoria e centro de custo',   path: '/despesas',      color: 'var(--primary)', bg: 'var(--primary-light)' },
                            { label: 'Análise Avançada',       desc: 'Evolução mensal, lucros e caixa',           path: '/evolucao',      color: '#7c3aed',        bg: '#f5f3ff' },
                            { label: 'Sincronização',          desc: 'Atualizar dados via API Conta Azul',        path: '/importacao',    color: 'var(--success)', bg: 'var(--success-light)' },
                        ].map(m => (
                            <button key={m.path} onClick={() => navigate(m.path)}
                                style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem', borderRadius: 'var(--radius-md)', background: 'transparent', border: '1px solid var(--border)', cursor: 'pointer', textAlign: 'left', transition: 'background 0.15s' }}
                                onMouseEnter={e => (e.currentTarget.style.background = m.bg)}
                                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                            >
                                <div style={{ width: 32, height: 32, borderRadius: 7, background: m.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: m.color }} />
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-main)' }}>{m.label}</div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{m.desc}</div>
                                </div>
                                <ChevronRight size={14} color="var(--text-subtle)" />
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

// ── Estilos compartilhados ────────────────────────────────────────────────────

const btnSecStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: '0.375rem',
    padding: '0.375rem 0.75rem', borderRadius: 'var(--radius-sm)',
    background: 'transparent', border: '1px solid var(--border)',
    fontSize: '0.8125rem', fontWeight: 500, color: 'var(--text-muted)',
    cursor: 'pointer', transition: 'border-color 0.15s',
};

const btnMicroStyle: React.CSSProperties = {
    padding: '0.25rem 0.625rem', borderRadius: 'var(--radius-sm)',
    background: 'var(--background)', border: '1px solid var(--border)',
    fontSize: '0.75rem', color: 'var(--text-muted)', cursor: 'pointer',
};

// Sobrescreve o layout em linha (ícone-ao-lado-do-texto) de .kpi-card por um
// empilhado (ícone em cima, valor grande embaixo) — este card tem mais conteúdo
// (badge de variação, sublabel de comparação) do que o KPI padrão das outras telas.
const cardStyle: React.CSSProperties = {
    display: 'block', width: '100%', textAlign: 'left', cursor: 'pointer',
};

const cardHeaderRow: React.CSSProperties = {
    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.875rem',
};

const cardLabel: React.CSSProperties = {
    fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-muted)',
    textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem',
};

const cardValue = (dim: boolean): React.CSSProperties => ({
    fontSize: '1.4375rem', fontWeight: 700, color: dim ? 'var(--text-subtle)' : 'var(--text-main)',
    letterSpacing: '-0.025em', lineHeight: 1.1,
});

const cardSubLabel: React.CSSProperties = {
    fontSize: '0.75rem', color: 'var(--text-subtle)', marginTop: '0.375rem',
};

const badgeStyle = (delta: number): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', gap: 3,
    fontSize: '0.75rem', fontWeight: 600,
    color:       delta <= 0 ? 'var(--success)' : 'var(--danger)',
    background:  delta <= 0 ? 'var(--success-light)' : 'var(--danger-light)',
    padding: '0.2rem 0.5rem', borderRadius: '1rem',
});

export default VistaoGeral;
