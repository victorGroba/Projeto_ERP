import React, { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import {
    TrendingDown, AlertTriangle, Landmark, TrendingUp,
    ArrowUpRight, ArrowDownRight, Loader2, ChevronRight,
    SlidersHorizontal, Check, RefreshCw, ShieldCheck, ArrowRight,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import PeriodFilterBar from '../components/PeriodFilterBar';
import { usePrefersReducedMotion, useCountUp, initials, Ring, LastPointDot } from '../components/softUi';
import '../components/SoftUI.css';
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

interface ResultadoMes {
    mes: string;
    resultado: number;
}

const VistaoGeral: React.FC = () => {
    const navigate = useNavigate();
    const reducedMotion = usePrefersReducedMotion();

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

    // ── resultado mensal do ano corrente (alimenta a curva de saldo) ───────
    const [resultadoMensal, setResultadoMensal] = useState<ResultadoMes[]>([]);

    // ── idade dos dados ────────────────────────────────────────────────────
    const [ultimoSync, setUltimoSync] = useState<{ em: string; modo: string } | null>(null);
    const [syncCarregado, setSyncCarregado] = useState(false);

    // ── fetch do aging — acompanha o período selecionado ───────────────────
    // Antes rodava uma vez só e sem parâmetros, então o card ficava preso no ano
    // corrente e não reagia ao filtro: escolher "de 01/01/2025 até hoje" não mudava
    // nada, e a dívida vencida no ano anterior simplesmente não aparecia.
    useEffect(() => {
        const { de, ate } = periodoAplic;
        axios.get(`${API}/api/dashboard/inadimplencia/aging?de=${de}&ate=${ate}`)
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
    }, [periodoAplic]);

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

    // ── fetch do resultado mensal (ano corrente) para a curva de saldo ─────
    useEffect(() => {
        axios.get(`${API}/api/dashboard/resultado/mensal?year=${anoAtual}`)
            .then(r => setResultadoMensal((r.data.data || []).map((d: any) => ({ mes: d.mes, resultado: d.resultado }))))
            .catch(console.error);
    }, []);

    // Quando o token OAuth expira, o sync para de rodar sem avisar ninguém e a tela
    // continua mostrando dado velho com cara de dado fresco — foi assim que o
    // dashboard exibiu números de dois meses antes. Aqui a idade fica explícita.
    useEffect(() => {
        axios.get(`${API}/api/sync/status`)
            .then(r => setUltimoSync(r.data?.ultimoSync || null))
            .catch(() => setUltimoSync(null))
            .finally(() => setSyncCarregado(true));
    }, []);

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
    const saldoPeriodo = recebidoPeriodo - despesaAtual;
    const saldoPositivo = saldoPeriodo >= 0;
    const saudeRecebimento = (recebidoPeriodo + (kpiBase?.totalAtraso || 0)) > 0
        ? (recebidoPeriodo / (recebidoPeriodo + (kpiBase?.totalAtraso || 0))) * 100
        : 100;

    // Incremental é feito para uso diário: passando de 1 dia já vale destacar,
    // e acima de 7 o número na tela provavelmente já não descreve a realidade.
    const diasDesdeSync = ultimoSync
        ? Math.floor((Date.now() - new Date(ultimoSync.em).getTime()) / 86_400_000)
        : null;
    const nivelSync: 'ok' | 'atencao' | 'alerta' | 'nunca' =
        diasDesdeSync === null ? 'nunca'
        : diasDesdeSync <= 1   ? 'ok'
        : diasDesdeSync <= 7   ? 'atencao'
        : 'alerta';

    const qtdExcluidas = categoriasExcluidas.size;
    const periodoLabel = `${fmtDateLabel(periodoAplic.de)} – ${fmtDateLabel(periodoAplic.ate)}`;

    // ── animações de contagem (números dos cards) ──────────────────────────
    const despesaAnim = useCountUp(despesaAtual, 900, reducedMotion || loadPeriodo);
    const atrasoAnim  = useCountUp(kpiBase?.totalAtraso || 0, 900, reducedMotion);
    const recebidoAnim = useCountUp(recebidoPeriodo, 900, reducedMotion || loadPeriodo);
    const saldoAnim   = useCountUp(saldoPeriodo, 900, reducedMotion || loadPeriodo);

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

    // dot customizado: só o último mês ganha destaque, igual à referência.
    const SaldoDot = LastPointDot(resultadoMensal.length - 1);

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
        <div className="fade-in su-shell">

            {/* Header */}
            <div>
                <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.875rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.02em' }}>
                    Visão Geral
                </h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', flexWrap: 'wrap', marginTop: '0.375rem' }}>
                    <p style={{ color: 'var(--text-muted)', fontSize: '1rem' }}>
                        Resumo financeiro · {hoje.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </p>
                    {syncCarregado && (
                        <button
                            onClick={() => navigate('/importacao')}
                            title={ultimoSync
                                ? `Última sincronização com a Conta Azul: ${new Date(ultimoSync.em).toLocaleString('pt-BR')} (${ultimoSync.modo})`
                                : 'Nenhuma sincronização registrada'}
                            style={chipSyncStyle(nivelSync)}
                        >
                            <RefreshCw size={12} />
                            {nivelSync === 'nunca'
                                ? 'Dados nunca sincronizados'
                                : `Dados de ${fmtIdade(diasDesdeSync as number)}`}
                        </button>
                    )}
                </div>
            </div>

            {/* ── Barra de Filtros (pílula) ── */}
            <div className="su-toolbar">
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

                <div className="su-toolbar-sep" />

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

            {/* ── Tiles compactos ── */}
            <div className="su-tiles">
                <button onClick={() => navigate(`/despesas?de=${periodoAplic.de}&ate=${periodoAplic.ate}`)} className="su-tile su-tile--primary">
                    <div className="su-tile-icon"><TrendingUp size={19} color="var(--primary)" /></div>
                    <div className="su-tile-label">
                        Despesa acumulada
                        {qtdExcluidas > 0 && <span style={{ color: 'var(--primary)', fontWeight: 700 }}> (-{qtdExcluidas} cat.)</span>}
                    </div>
                    <div className="su-tile-value">{fmt(despesaAnim)}</div>
                    {varDespesa !== 0 && (
                        <span className="su-tile-badge" style={{ color: varDespesa <= 0 ? 'var(--success)' : 'var(--danger)', background: 'rgba(255,255,255,0.6)' }}>
                            {varDespesa <= 0 ? <ArrowDownRight size={12} /> : <ArrowUpRight size={12} />}
                            {fmtPct(Math.abs(varDespesa))}
                        </span>
                    )}
                </button>

                <button onClick={() => navigate('/inadimplencia')} className="su-tile su-tile--danger">
                    <div className="su-tile-icon"><AlertTriangle size={19} color="var(--danger)" /></div>
                    <div className="su-tile-label">Total vencido em atraso</div>
                    <div className="su-tile-value">{fmt(atrasoAnim)}</div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Risco crítico (+90d): {fmt(kpiBase.riscoGrave)}</span>
                </button>

                <button onClick={() => navigate('/evolucao')} className="su-tile su-tile--success">
                    <div className="su-tile-icon"><Landmark size={19} color="var(--success)" /></div>
                    <div className="su-tile-label">Receitas recebidas</div>
                    <div className="su-tile-value">{fmt(recebidoAnim)}</div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{periodoLabel}</span>
                </button>
            </div>

            {/* ── Composição: saldo em destaque + curva/saúde de recebimento ── */}
            <div className="su-composite">

                {/* Hero: saldo líquido */}
                <div className="su-hero">
                    <div>
                        <h3>{saldoPositivo ? 'Período no azul' : 'Atenção ao caixa'}</h3>
                        <p>
                            {saldoPositivo
                                ? `As receitas recebidas superaram as despesas em ${periodoLabel}. Saldo acumulado disponível para reserva ou distribuição.`
                                : `As despesas superaram as receitas recebidas em ${periodoLabel}. Vale revisar categorias de custo ou acelerar o recebimento em atraso.`}
                        </p>
                    </div>
                    <button className="su-pill-btn" onClick={() => navigate('/evolucao')}>
                        Ver análise completa <ArrowRight size={15} />
                    </button>
                    <div className="su-gradient-card">
                        <div className="su-gradient-label">Saldo líquido do período</div>
                        <div className="su-gradient-value" style={{ color: saldoPositivo ? '#fff' : '#ffd9d9' }}>
                            {saldoPositivo ? '+' : ''}{fmt(saldoAnim)}
                        </div>
                        <div className="su-gradient-foot">Receitas − Despesas · {periodoLabel}</div>
                    </div>
                </div>

                {/* Coluna direita: curva de saldo mensal + saúde de recebimento */}
                <div className="su-side-stack">
                    <div className="su-chart-card">
                        <h3>Saldo mensal — {anoAtual}</h3>
                        <p>Receitas − despesas operacionais, mês a mês</p>
                        {resultadoMensal.length > 0 ? (
                            <ResponsiveContainer width="100%" height={150}>
                                <AreaChart data={resultadoMensal} margin={{ top: 4, right: 8, left: -22, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="vgSaldoFill" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor="#0b6b76" stopOpacity={0.3} />
                                            <stop offset="100%" stopColor="#0b6b76" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <XAxis dataKey="mes" tick={{ fontSize: 11, fill: '#8b969a' }} axisLine={false} tickLine={false} />
                                    <YAxis hide domain={['dataMin - 5000', 'dataMax + 5000']} />
                                    <Tooltip formatter={(v?: number) => v !== undefined ? fmt(v) : ''} contentStyle={{ borderRadius: 10, border: '1px solid #dde6e6', fontSize: 12 }} />
                                    <Area
                                        type="monotone" dataKey="resultado" stroke="#0b6b76" strokeWidth={2.5}
                                        fill="url(#vgSaldoFill)" dot={SaldoDot}
                                        isAnimationActive={false}
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        ) : (
                            <div style={{ height: 150, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-subtle)', fontSize: '0.8125rem' }}>
                                Sem dados suficientes para a curva.
                            </div>
                        )}
                    </div>

                    <div className="su-ring-card">
                        <Ring pct={saudeRecebimento} reduced={reducedMotion} />
                        <div>
                            <div className="su-ring-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <ShieldCheck size={14} /> Saúde de recebimento
                            </div>
                            <div className="su-ring-desc">
                                {saudeRecebimento >= 85 ? 'Carteira saudável' : saudeRecebimento >= 60 ? 'Atenção moderada' : 'Risco elevado'}
                            </div>
                            <div style={{ fontSize: '0.8125rem', opacity: 0.75, marginTop: 4 }}>
                                {fmt(recebidoPeriodo)} recebido vs. {fmt(kpiBase.totalAtraso)} em atraso
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Bottom row ── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '1.25rem' }}>

                {/* Maiores Devedores */}
                <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '20px', padding: '1.75rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                        <div>
                            <h3 style={{ fontSize: '1.0625rem', fontWeight: 700, color: 'var(--text-main)' }}>Maiores Devedores</h3>
                            <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '0.1875rem' }}>
                                Acima de {fmt(THRESHOLD_DEVEDOR)} · demais agrupados como "Diversos"
                            </p>
                        </div>
                        <button onClick={() => navigate('/inadimplencia')} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.875rem', color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
                            Ver todos <ChevronRight size={15} />
                        </button>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9375rem' }}>
                        {kpiBase.topDevedores.map((d, i) => {
                            const pct = kpiBase.totalAtraso > 0 ? (d.valorDevido / kpiBase.totalAtraso) * 100 : 0;
                            const isDiversos = d.cliente === 'Diversos';
                            return (
                                <div key={i} className="su-row">
                                    <div className={`su-avatar su-avatar--danger${isDiversos ? ' su-avatar--muted' : ''}`}>{initials(d.cliente)}</div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                                            <span style={{ fontSize: '0.9375rem', fontWeight: 500, color: isDiversos ? 'var(--text-muted)' : 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '60%', fontStyle: isDiversos ? 'italic' : 'normal' }}>
                                                {d.cliente}
                                            </span>
                                            <span style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--danger)', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>{fmt(d.valorDevido)}</span>
                                        </div>
                                        <div style={{ height: 7, background: 'var(--background)', borderRadius: 4, overflow: 'hidden' }}>
                                            <div style={{ height: '100%', width: `${Math.min(pct, 100)}%`, background: isDiversos ? 'var(--text-subtle)' : 'var(--danger)', opacity: isDiversos ? 0.6 : (1 - i * 0.1), borderRadius: 4 }} />
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Módulos */}
                <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '20px', padding: '1.75rem' }}>
                    <h3 style={{ fontSize: '1.0625rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '1.5rem' }}>Módulos</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                        {[
                            { label: 'Risco e Inadimplência',  desc: 'Aging, devedores e carteira de risco',    path: '/inadimplencia', color: 'var(--danger)',         bg: 'var(--danger-light)' },
                            { label: 'Custos & Despesas',      desc: 'Pareto por categoria e centro de custo',   path: '/despesas',      color: 'var(--warning)',        bg: 'var(--warning-light)' },
                            { label: 'Análise Avançada',       desc: 'Evolução mensal, lucros e caixa',           path: '/evolucao',      color: 'var(--primary)',        bg: 'var(--primary-light)' },
                            { label: 'Sincronização',          desc: 'Atualizar dados via API Conta Azul',        path: '/importacao',    color: 'var(--brand-graphite)', bg: 'var(--background)' },
                        ].map(m => (
                            <button key={m.path} onClick={() => navigate(m.path)} className="su-row-link"
                                onMouseEnter={e => (e.currentTarget.style.background = m.bg)}
                                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                            >
                                <div className="su-row-icon" style={{ background: m.bg }}>
                                    <div style={{ width: 9, height: 9, borderRadius: '50%', background: m.color }} />
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-main)' }}>{m.label}</div>
                                    <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{m.desc}</div>
                                </div>
                                <ChevronRight size={16} color="var(--text-subtle)" />
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

// ── Estilos compartilhados ────────────────────────────────────────────────────

const fmtIdade = (dias: number) =>
    dias <= 0 ? 'hoje' : dias === 1 ? 'ontem' : `${dias} dias atrás`;

const CORES_SYNC = {
    ok:      { fg: 'var(--success)', bg: 'var(--success-light)', bd: 'var(--success)' },
    atencao: { fg: '#b45309',        bg: '#fef3c7',              bd: '#f59e0b'        },
    alerta:  { fg: 'var(--danger)',  bg: 'var(--danger-light)',  bd: 'var(--danger)'  },
    nunca:   { fg: 'var(--danger)',  bg: 'var(--danger-light)',  bd: 'var(--danger)'  },
} as const;

const chipSyncStyle = (nivel: keyof typeof CORES_SYNC): React.CSSProperties => {
    const c = CORES_SYNC[nivel];
    return {
        display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
        padding: '0.15rem 0.5rem', borderRadius: '1rem',
        fontSize: '0.75rem', fontWeight: 600,
        color: c.fg, background: c.bg,
        border: `1px solid ${nivel === 'ok' ? 'transparent' : c.bd}`,
        cursor: 'pointer',
    };
};

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

export default VistaoGeral;
