import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
    ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import {
    Loader2, Gauge, CalendarRange, GitCompareArrows, Inbox, Info,
    TrendingUp, TrendingDown, Users, Truck, Layers, Wallet, Activity, PieChart,
} from 'lucide-react';
import Delta from '../components/Delta';
import PeriodoChips, {
    PRESETS, COMPARISON_PRESETS, computeRange, shiftYear, shortDate,
    type PresetKey, type PresetKeyB,
} from '../components/PeriodoChips';
import './Dashboard.css';
import '../styles/painel.css';
import './Indices.css';

// ── Formatação ──────────────────────────────────────────────────────────────
const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
const fmtCurto = (v: number) => {
    const abs = Math.abs(v);
    const sinal = v < 0 ? '-' : '';
    if (abs >= 1_000_000) return `${sinal}R$ ${(abs / 1_000_000).toFixed(1)}M`;
    if (abs >= 1_000) return `${sinal}R$ ${(abs / 1_000).toFixed(0)}k`;
    return `${sinal}R$ ${abs.toFixed(0)}`;
};
const fmtPct = (v: number | null, casas = 1) =>
    v === null || !isFinite(v) ? '—' : `${v.toFixed(casas).replace('.', ',')}%`;
const fmtNum = (v: number | null, casas = 1) =>
    v === null || !isFinite(v) ? '—' : v.toFixed(casas).replace('.', ',');

const mesLegivel = (iso: string) => {
    const [ano, mes] = iso.split('-');
    return `${['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'][Number(mes) - 1]}/${ano.slice(2)}`;
};

const COR_DESPESA = '#2563eb';
const COR_RECEITA = '#059669';
const COR_ALERTA = '#dc2626';
const COR_NEUTRA = '#cbd5e1';

// ── Sparkline ───────────────────────────────────────────────────────────────
const Sparkline: React.FC<{ valores: number[]; cor?: string; largura?: number; altura?: number }> = ({
    valores, cor = COR_DESPESA, largura = 72, altura = 22,
}) => {
    if (valores.length < 2) return <span style={{ color: 'var(--text-subtle)', fontSize: '0.75rem' }}>—</span>;
    const max = Math.max(...valores);
    const min = Math.min(...valores);
    const amplitude = max - min || 1;
    const pontos = valores.map((v, i) => {
        const x = (i / (valores.length - 1)) * largura;
        const y = altura - ((v - min) / amplitude) * altura;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
    });
    return (
        <svg className="ind-spark" width={largura} height={altura} viewBox={`0 0 ${largura} ${altura}`}>
            <path d={`M${pontos.join(' L')}`} stroke={cor} />
        </svg>
    );
};

// ── Barra de ranking ────────────────────────────────────────────────────────
interface RankItem {
    nome: string;
    detalhe?: string | null;
    valor: string;
    subvalor?: string;
    proporcao: number;   // 0..1 — largura da barra
    cor: string;
    classeValor?: string;
}

const Ranking: React.FC<{ itens: RankItem[]; vazio: string }> = ({ itens, vazio }) => {
    if (itens.length === 0) return <div className="ind-vazio">{vazio}</div>;
    return (
        <div className="ind-rank">
            {itens.map(it => (
                <div className="ind-rank-item" key={it.nome}>
                    <div className="ind-rank-nome" title={it.nome}>
                        {it.nome}
                        {it.detalhe && <small>{it.detalhe}</small>}
                    </div>
                    <div className={`ind-rank-valor ${it.classeValor || ''}`}>
                        {it.valor}
                        {it.subvalor && <small>{it.subvalor}</small>}
                    </div>
                    <div className="ind-rank-bar">
                        <i style={{ width: `${Math.max(2, it.proporcao * 100)}%`, background: it.cor }} />
                    </div>
                </div>
            ))}
        </div>
    );
};

// ── Tooltip da série mensal ─────────────────────────────────────────────────
const SerieTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    const row = payload[0].payload;
    return (
        <div style={{
            background: 'var(--surface)', border: '1px solid var(--border)', padding: '0.625rem 0.75rem',
            borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-lg)', minWidth: 200, fontSize: '0.75rem',
        }}>
            <div style={{ fontWeight: 700, marginBottom: '0.375rem', color: 'var(--text-main)', fontSize: '0.8125rem' }}>
                {mesLegivel(label)}
            </div>
            {[
                { nome: 'Receita', valor: row.receita, cor: COR_RECEITA },
                { nome: 'Despesa', valor: row.despesa, cor: COR_DESPESA },
            ].map(l => (
                <div key={l.nome} style={{ display: 'flex', justifyContent: 'space-between', gap: '1.5rem', padding: '0.125rem 0' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                        <i style={{ width: 9, height: 9, borderRadius: 2, background: l.cor, display: 'inline-block' }} />
                        {l.nome}
                    </span>
                    <strong>{fmt(l.valor)}</strong>
                </div>
            ))}
            <div style={{
                display: 'flex', justifyContent: 'space-between', gap: '1.5rem', marginTop: '0.375rem',
                paddingTop: '0.375rem', borderTop: '1px solid var(--border)', fontWeight: 700,
                color: row.resultado >= 0 ? 'var(--success)' : 'var(--danger)',
            }}>
                <span style={{ color: 'var(--text-muted)' }}>Resultado</span>
                <span>{fmt(row.resultado)}</span>
            </div>
        </div>
    );
};

// ── Página ──────────────────────────────────────────────────────────────────
const Indices: React.FC = () => {
    const token = localStorage.getItem('@ContaAzul:token');

    const [presetA, setPresetA] = useState<PresetKey>('ytd');
    const [periodoA, setPeriodoA] = useState(() => computeRange('ytd', { de: '', ate: '' }));
    const [customADe, setCustomADe] = useState(periodoA.de);
    const [customAAte, setCustomAAte] = useState(periodoA.ate);

    const [presetB, setPresetB] = useState<PresetKeyB>('auto');
    const [periodoB, setPeriodoB] = useState(() => ({ de: shiftYear(periodoA.de, -1), ate: shiftYear(periodoA.ate, -1) }));
    const [customBDe, setCustomBDe] = useState(periodoB.de);
    const [customBAte, setCustomBAte] = useState(periodoB.ate);

    const [isLoading, setIsLoading] = useState(false);
    const [data, setData] = useState<any>(null);
    const [erro, setErro] = useState<string | null>(null);
    const [verCategoriasPessoal, setVerCategoriasPessoal] = useState(false);

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
        const buscar = async () => {
            setIsLoading(true);
            setErro(null);
            try {
                const res = await axios.get(
                    `/api/dashboard/indices?deA=${periodoB.de}&ateA=${periodoB.ate}&deB=${periodoA.de}&ateB=${periodoA.ate}`,
                    { headers: { Authorization: `Bearer ${token}` } }
                );
                setData(res.data);
            } catch (err: any) {
                console.error('Erro ao buscar índices', err);
                setErro(err?.response?.data?.error || 'Não foi possível carregar os índices.');
            } finally {
                setIsLoading(false);
            }
        };
        buscar();
    }, [periodoA, periodoB, token]);

    const labelA = `${shortDate(periodoA.de)} – ${shortDate(periodoA.ate)}`;
    const labelB = `${shortDate(periodoB.de)} – ${shortDate(periodoB.ate)}`;

    const g = data?.global;
    const porCC: any[] = data?.porCC || [];

    // Escalas dos rankings — a maior barra do bloco vira 100%.
    const maiorOfensor = Math.max(1, ...(g?.ofensores || []).map((o: any) => Math.abs(o.deltaRS)));
    const maiorEconomia = Math.max(1, ...(g?.economias || []).map((o: any) => Math.abs(o.deltaRS)));
    const maiorFornecedor = Math.max(1, ...(g?.fornecedores?.top || []).map((f: any) => f.valorB));

    return (
        <div className="module-page ind-page">

            <header className="res-header">
                <div>
                    <h2>Índices Gerenciais</h2>
                    <p>Composição, concentração e fôlego financeiro — visão da empresa e por centro de custo</p>
                </div>
                <div className="res-period-badge">
                    <Gauge size={15} />
                    <strong>{labelA}</strong> vs {labelB}
                </div>
            </header>

            <div className="res-filters">
                <PeriodoChips
                    icon={<CalendarRange size={14} />} label="Período"
                    presets={PRESETS} preset={presetA} onPreset={k => handlePresetA(k as PresetKey)}
                    de={customADe} ate={customAAte} onDe={setCustomADe} onAte={setCustomAAte}
                    onApply={aplicarCustomA} pending={pendingA} isLoading={isLoading}
                    summary={<span style={{ color: COR_DESPESA }}>{labelA}</span>}
                />
                <PeriodoChips
                    icon={<GitCompareArrows size={14} />} label="Comparar com"
                    presets={COMPARISON_PRESETS} preset={presetB} onPreset={k => handlePresetB(k as PresetKeyB)}
                    de={customBDe} ate={customBAte} onDe={setCustomBDe} onAte={setCustomBAte}
                    onApply={aplicarCustomB} pending={pendingB} isLoading={isLoading}
                    summary={<span style={{ color: 'var(--text-muted)' }}>{labelB}</span>}
                />
            </div>

            {isLoading && !data ? (
                <div className="res-state"><Loader2 className="animate-spin" size={32} />Calculando índices...</div>
            ) : erro ? (
                <div className="res-state"><Inbox size={32} />{erro}</div>
            ) : !g || (g.despesaB === 0 && g.receitaB === 0) ? (
                <div className="res-state"><Inbox size={32} />Sem movimento no período selecionado.</div>
            ) : (
                <div className={isLoading ? 'res-loading-overlay' : ''} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

                    {/* ── Leitura do período ───────────────────────────────── */}
                    <div className="res-kpis">
                        <div className="res-kpi" style={{ ['--kpi-accent' as any]: COR_DESPESA }}>
                            <span className="res-kpi-label">Despesa do período</span>
                            <div className="res-kpi-value">{fmt(g.despesaB)}</div>
                            <div className="res-kpi-foot">
                                <Delta pct={g.variacao} />
                                <span>{g.deltaRS >= 0 ? '+' : ''}{fmtCurto(g.deltaRS)} vs anterior</span>
                            </div>
                        </div>

                        <div className="res-kpi" style={{ ['--kpi-accent' as any]: COR_RECEITA }}>
                            <span className="res-kpi-label">Receita (competência)</span>
                            <div className="res-kpi-value">{fmt(g.receitaB)}</div>
                            <div className="res-kpi-foot">
                                <Delta pct={g.receitaA > 0 ? ((g.receitaB - g.receitaA) / g.receitaA) * 100 : null} inverso />
                                <span>vs {fmtCurto(g.receitaA)}</span>
                            </div>
                        </div>

                        <div className="res-kpi" style={{ ['--kpi-accent' as any]: g.resultadoB >= 0 ? COR_RECEITA : COR_ALERTA }}>
                            <span className="res-kpi-label">Resultado e margem</span>
                            <div className="res-kpi-value" style={{ color: g.resultadoB >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                                {fmt(g.resultadoB)}
                            </div>
                            <div className="res-kpi-foot">
                                Margem {fmtPct(g.margem)} · cobertura {fmtNum(g.cobertura, 2)}×
                            </div>
                        </div>

                        <div className="res-kpi" style={{ ['--kpi-accent' as any]: '#7c3aed' }}>
                            <span className="res-kpi-label">Run-rate mensal</span>
                            <div className="res-kpi-value">{fmt(g.runRate)}</div>
                            <div className="res-kpi-foot">
                                Projeção 12m: {fmtCurto(g.projecaoAnual)}
                            </div>
                        </div>

                        <div className="res-kpi" style={{ ['--kpi-accent' as any]: 'var(--warning)' }}>
                            <span className="res-kpi-label">Fôlego de caixa</span>
                            <div className="res-kpi-value">
                                {g.caixa.mesesDeCaixa === null ? '—' : `${fmtNum(g.caixa.mesesDeCaixa)} meses`}
                            </div>
                            <div className="res-kpi-foot">
                                {g.caixa.saldoTotal > 0
                                    ? `${fmtCurto(g.caixa.saldoTotal)} em ${g.caixa.instituicoes.length} conta(s)`
                                    : 'Sem saldo bancário registrado'}
                            </div>
                        </div>
                    </div>

                    {/* ── Ofensores e economias ───────────────────────────── */}
                    <div className="ind-grid-2">
                        <section className="res-panel">
                            <div className="res-panel-head">
                                <h3><TrendingUp size={16} color={COR_ALERTA} /> Onde a despesa cresceu</h3>
                                <span className="res-hint">Em R$, não em %</span>
                            </div>
                            <div className="ind-body">
                                <Ranking
                                    vazio="Nenhuma rubrica cresceu no período."
                                    itens={(g.ofensores || []).map((o: any) => ({
                                        nome: o.categoria,
                                        detalhe: o.centroDeCusto ? `principal CC: ${o.centroDeCusto}` : null,
                                        valor: `+${fmtCurto(o.deltaRS)}`,
                                        subvalor: `${fmtPct(o.contribuicao, 0)} da variação · ${fmtPct(o.variacao)}`,
                                        proporcao: Math.abs(o.deltaRS) / maiorOfensor,
                                        cor: COR_ALERTA,
                                        classeValor: 'is-up',
                                    }))}
                                />
                            </div>
                        </section>

                        <section className="res-panel">
                            <div className="res-panel-head">
                                <h3><TrendingDown size={16} color={COR_RECEITA} /> Onde a despesa caiu</h3>
                                <span className="res-hint">Economias do período</span>
                            </div>
                            <div className="ind-body">
                                <Ranking
                                    vazio="Nenhuma rubrica caiu no período."
                                    itens={(g.economias || []).map((o: any) => ({
                                        nome: o.categoria,
                                        detalhe: o.centroDeCusto ? `principal CC: ${o.centroDeCusto}` : null,
                                        valor: fmtCurto(o.deltaRS),
                                        subvalor: `${fmtPct(o.variacao)} vs anterior`,
                                        proporcao: Math.abs(o.deltaRS) / maiorEconomia,
                                        cor: COR_RECEITA,
                                        classeValor: 'is-down',
                                    }))}
                                />
                            </div>
                        </section>
                    </div>

                    {/* ── Concentração e difusão ──────────────────────────── */}
                    <div className="ind-grid-2">
                        <section className="res-panel">
                            <div className="res-panel-head">
                                <h3><Layers size={16} color="var(--primary)" /> Concentração de custo</h3>
                            </div>
                            <div className="ind-body">
                                <div className="ind-meter">
                                    <i style={{ width: `${g.concentracao.top5}%`, background: COR_DESPESA }} />
                                    <i style={{ width: `${100 - g.concentracao.top5}%`, background: COR_NEUTRA }} />
                                </div>
                                <div className="ind-meter-legend">
                                    <span><i style={{ background: COR_DESPESA }} />Top 5 rubricas · {fmtPct(g.concentracao.top5, 0)}</span>
                                    <span><i style={{ background: COR_NEUTRA }} />Demais {Math.max(0, g.concentracao.totalItens - 5)} rubricas</span>
                                </div>

                                <div className="ind-defs" style={{ marginTop: '1.25rem' }}>
                                    <div className="ind-def">
                                        <span className="ind-def-nome">Regra 80/20</span>
                                        <span className="ind-def-valor">{g.concentracao.itensPara80} de {g.concentracao.totalItens}</span>
                                        <span className="ind-def-desc">
                                            Bastam {g.concentracao.itensPara80} rubricas para explicar 80% da despesa —
                                            é onde uma negociação tem efeito real.
                                        </span>
                                    </div>
                                    <div className="ind-def">
                                        <span className="ind-def-nome">Maior rubrica isolada</span>
                                        <span className="ind-def-valor">{fmtPct(g.concentracao.top1, 0)}</span>
                                        <span className="ind-def-desc">Participação da maior rubrica na despesa total do período.</span>
                                    </div>
                                </div>
                            </div>
                        </section>

                        <section className="res-panel">
                            <div className="res-panel-head">
                                <h3><Activity size={16} color="var(--primary)" /> Difusão da variação</h3>
                                <span className="res-hint">Alta generalizada ou pontual?</span>
                            </div>
                            <div className="ind-body">
                                <div className="ind-meter">
                                    <i style={{ width: `${g.difusao.pctSubiram}%`, background: COR_ALERTA }} />
                                    <i style={{ width: `${100 - g.difusao.pctSubiram}%`, background: COR_RECEITA }} />
                                </div>
                                <div className="ind-meter-legend">
                                    <span><i style={{ background: COR_ALERTA }} />{g.difusao.subiram} subiram</span>
                                    <span><i style={{ background: COR_RECEITA }} />{g.difusao.cairam} caíram</span>
                                    <span><i style={{ background: COR_NEUTRA }} />{g.difusao.estaveis} estáveis</span>
                                </div>

                                <div className="ind-defs" style={{ marginTop: '1.25rem' }}>
                                    <div className="ind-def">
                                        <span className="ind-def-nome">Índice de difusão</span>
                                        <span className="ind-def-valor">{fmtPct(g.difusao.pctSubiram, 0)}</span>
                                        <span className="ind-def-desc">
                                            {g.difusao.pctSubiram >= 60
                                                ? 'Alta espalhada pela maioria das rubricas — indica pressão geral de custo, não um evento isolado.'
                                                : g.difusao.pctSubiram <= 40
                                                    ? 'Maioria das rubricas estável ou em queda — o que subiu tende a ser pontual.'
                                                    : 'Movimento equilibrado entre altas e quedas.'}
                                        </span>
                                    </div>
                                    <div className="ind-def">
                                        <span className="ind-def-nome">Rubricas novas / encerradas</span>
                                        <span className="ind-def-valor">{g.difusao.novas} / {g.difusao.descontinuadas}</span>
                                        <span className="ind-def-desc">
                                            Gastos que não existiam no período anterior e gastos que deixaram de ocorrer.
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </section>
                    </div>

                    {/* ── Pessoal e fornecedores ──────────────────────────── */}
                    <div className="ind-grid-2">
                        <section className="res-panel">
                            <div className="res-panel-head">
                                <h3><Users size={16} color="var(--primary)" /> Custo de pessoal</h3>
                                <Delta pct={g.pessoal.variacao} />
                            </div>
                            <div className="ind-body">
                                <div className="ind-meter">
                                    <i style={{ width: `${g.pessoal.pctDespesa}%`, background: COR_DESPESA }} />
                                    <i style={{ width: `${100 - g.pessoal.pctDespesa}%`, background: COR_NEUTRA }} />
                                </div>
                                <div className="ind-meter-legend">
                                    <span><i style={{ background: COR_DESPESA }} />Pessoal · {fmtPct(g.pessoal.pctDespesa, 0)} da despesa</span>
                                </div>

                                <div className="ind-defs" style={{ marginTop: '1.25rem' }}>
                                    <div className="ind-def">
                                        <span className="ind-def-nome">Total de pessoal</span>
                                        <span className="ind-def-valor">{fmt(g.pessoal.valorB)}</span>
                                        <span className="ind-def-desc">Salários, encargos, benefícios, férias e rescisões somados.</span>
                                    </div>
                                    <div className="ind-def">
                                        <span className="ind-def-nome">Pessoal sobre receita</span>
                                        <span className="ind-def-valor">{fmtPct(g.pessoal.pctReceita, 0)}</span>
                                        <span className="ind-def-desc">
                                            Quanto de cada real faturado é consumido pela folha.
                                        </span>
                                    </div>
                                </div>

                                {g.pessoal.categorias.length > 0 && (
                                    <>
                                        <button className="ind-toggle" onClick={() => setVerCategoriasPessoal(v => !v)}>
                                            {verCategoriasPessoal ? 'Ocultar' : 'Ver'} as {g.pessoal.categorias.length} categorias classificadas
                                        </button>
                                        {verCategoriasPessoal && (
                                            <div className="ind-tags">
                                                {g.pessoal.categorias.map((c: string) => (
                                                    <span className="ind-tag" key={c}>{c}</span>
                                                ))}
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        </section>

                        <section className="res-panel">
                            <div className="res-panel-head">
                                <h3><Truck size={16} color="var(--primary)" /> Dependência de fornecedores</h3>
                                <span className="res-hint">{fmtPct(g.fornecedores.coberturaPct, 0)} da despesa tem fornecedor</span>
                            </div>
                            <div className="ind-body">
                                <div className="ind-defs" style={{ marginBottom: '0.75rem' }}>
                                    <div className="ind-def">
                                        <span className="ind-def-nome">Concentração nos 5 maiores</span>
                                        <span className="ind-def-valor">{fmtPct(g.fornecedores.top5, 0)}</span>
                                        <span className="ind-def-desc">
                                            {g.fornecedores.identificados} fornecedores identificados; o maior sozinho responde
                                            por {fmtPct(g.fornecedores.top1, 0)} do gasto com fornecedor.
                                        </span>
                                    </div>
                                </div>
                                <Ranking
                                    vazio="Nenhum fornecedor preenchido nos lançamentos do período."
                                    itens={(g.fornecedores.top || []).map((f: any) => ({
                                        nome: f.fornecedor,
                                        valor: fmtCurto(f.valorB),
                                        subvalor: `${fmtPct(f.participacao, 0)} do total`,
                                        proporcao: f.valorB / maiorFornecedor,
                                        cor: COR_DESPESA,
                                    }))}
                                />
                            </div>
                        </section>
                    </div>

                    {/* ── Série mensal ────────────────────────────────────── */}
                    {g.serie.length > 1 && (
                        <section className="res-panel">
                            <div className="res-panel-head">
                                <h3><PieChart size={16} color="var(--primary)" /> Receita × despesa mês a mês</h3>
                                <div className="res-legend">
                                    <span><i style={{ background: COR_DESPESA }} />Despesa</span>
                                    <span><i style={{ background: COR_RECEITA }} />Receita</span>
                                </div>
                            </div>
                            <div className="res-chart-body" style={{ height: 280 }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <ComposedChart data={g.serie} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
                                        <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" />
                                        <XAxis
                                            dataKey="mes" tickFormatter={mesLegivel} axisLine={false} tickLine={false}
                                            tick={{ fill: 'var(--text-subtle)', fontSize: 11 }}
                                        />
                                        <YAxis
                                            tickFormatter={(v) => fmtCurto(Number(v))} axisLine={false} tickLine={false}
                                            tick={{ fill: 'var(--text-subtle)', fontSize: 11 }} width={70}
                                        />
                                        <Tooltip content={<SerieTooltip />} cursor={{ fill: 'var(--surface-hover)' }} />
                                        <Bar dataKey="despesa" fill={COR_DESPESA} radius={[3, 3, 0, 0]} maxBarSize={38} />
                                        <Line type="monotone" dataKey="receita" stroke={COR_RECEITA} strokeWidth={2} dot={{ r: 3 }} />
                                    </ComposedChart>
                                </ResponsiveContainer>
                            </div>
                        </section>
                    )}

                    {/* ── Índices por centro de custo ─────────────────────── */}
                    <section className="res-panel">
                        <div className="res-panel-head">
                            <h3><Wallet size={16} color="var(--primary)" /> Índices por centro de custo</h3>
                            <span className="res-hint">Volatilidade alta = gasto irregular mês a mês</span>
                        </div>
                        <div className="res-table-wrap">
                            <table className="res-table">
                                <thead>
                                    <tr>
                                        <th>Centro de custo</th>
                                        <th>Despesa</th>
                                        <th>Variação</th>
                                        <th>Peso</th>
                                        <th>% da receita</th>
                                        <th>% pessoal</th>
                                        <th>Run-rate</th>
                                        <th>Volatilidade</th>
                                        <th>Top 5</th>
                                        <th>Tendência</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {porCC.map(cc => (
                                        <tr key={cc.centroDeCusto}>
                                            <td className="ind-cc-nome">
                                                {cc.centroDeCusto}
                                                <div style={{ fontSize: '0.6875rem', fontWeight: 500, color: 'var(--text-subtle)', marginTop: 2 }}>
                                                    {cc.difusao.subiram} de {cc.difusao.comparaveis} rubricas subiram
                                                </div>
                                            </td>
                                            <td className="res-val-strong">{fmt(cc.totalB)}</td>
                                            <td><Delta pct={cc.variacao} /></td>
                                            <td>
                                                <div className="ind-bar-cell">
                                                    <span>{fmtPct(cc.peso, 0)}</span>
                                                    <div className="ind-bar-mini"><i style={{ width: `${cc.peso}%` }} /></div>
                                                </div>
                                            </td>
                                            <td className="res-val-muted">{fmtPct(cc.consumoReceita, 0)}</td>
                                            <td className="res-val-muted">{fmtPct(cc.pessoalPct, 0)}</td>
                                            <td className="res-val-muted">{fmtCurto(cc.runRate)}</td>
                                            <td style={{
                                                color: cc.volatilidade === null ? 'var(--text-subtle)'
                                                    : cc.volatilidade > 60 ? 'var(--danger)'
                                                        : cc.volatilidade > 30 ? 'var(--warning)' : 'var(--success)',
                                                fontWeight: 700,
                                            }}>
                                                {fmtPct(cc.volatilidade, 0)}
                                            </td>
                                            <td className="res-val-muted">{fmtPct(cc.concentracao.top5, 0)}</td>
                                            <td>
                                                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                                    <Sparkline valores={cc.serie} />
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot>
                                    <tr>
                                        <td>Consolidado</td>
                                        <td>{fmt(g.despesaB)}</td>
                                        <td><Delta pct={g.variacao} /></td>
                                        <td>100%</td>
                                        <td>{fmtPct(g.receitaB > 0 ? (g.despesaB / g.receitaB) * 100 : null, 0)}</td>
                                        <td>{fmtPct(g.pessoal.pctDespesa, 0)}</td>
                                        <td>{fmtCurto(g.runRate)}</td>
                                        <td>—</td>
                                        <td>{fmtPct(g.concentracao.top5, 0)}</td>
                                        <td>
                                            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                                <Sparkline valores={g.serie.map((s: any) => s.despesa)} />
                                            </div>
                                        </td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </section>

                    {/* ── Nota metodológica ───────────────────────────────── */}
                    <div className="ind-nota">
                        <Info size={16} />
                        <div>
                            <strong>Como estes números são apurados.</strong>{' '}
                            Despesas entram pela data de pagamento (regime de caixa) e receitas pela data de competência,
                            com queda para o vencimento quando a competência não está preenchida — por isso os totais de
                            receita podem divergir das telas que usam vencimento. O custo de pessoal é classificado por
                            nome de categoria (veja a lista no painel), então categorias novas precisam entrar na regra
                            para serem contabilizadas. Run-rate e projeção assumem ritmo constante e não consideram
                            sazonalidade.
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Indices;