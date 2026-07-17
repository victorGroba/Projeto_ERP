import React, { useEffect, useState } from 'react';
import axios from 'axios';
import {
    BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid,
    Tooltip, ResponsiveContainer,
} from 'recharts';
import {
    ShoppingCart, FileText, Landmark, Users, TrendingDown, AlertTriangle,
    SlidersHorizontal, Loader2, WifiOff, Wallet,
} from 'lucide-react';
import PeriodFilterBar from '../components/PeriodFilterBar';
import './Dashboard.css';

const fmt = (v: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
const fmtCompact = (v: number) => `${v < 0 ? '-' : ''}R$ ${(Math.abs(v) / 1000).toFixed(0)}k`;

const tooltipStyle = {
    backgroundColor: 'var(--surface)', borderColor: 'var(--border)',
    borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-md)', fontSize: '0.8125rem',
};

type PresetKey = 'this_month' | 'last_month' | 'last_3m' | 'ytd' | 'custom';

const PRESETS: { key: PresetKey; label: string }[] = [
    { key: 'this_month', label: 'Este mês' },
    { key: 'last_month', label: 'Mês passado' },
    { key: 'last_3m',    label: 'Últimos 3 meses' },
    { key: 'ytd',        label: 'Ano até hoje' },
    { key: 'custom',     label: 'Personalizado' },
];

const pad = (n: number) => String(n).padStart(2, '0');
const toISO = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

function computeRange(preset: PresetKey, fallback: { de: string; ate: string }): { de: string; ate: string } {
    const agora = new Date();
    const y = agora.getFullYear();
    const m = agora.getMonth();
    switch (preset) {
        case 'this_month': return { de: toISO(new Date(y, m, 1)), ate: toISO(agora) };
        case 'last_month': return { de: toISO(new Date(y, m - 1, 1)), ate: toISO(new Date(y, m, 0)) };
        case 'last_3m':    return { de: toISO(new Date(y, m - 2, 1)), ate: toISO(agora) };
        case 'ytd':        return { de: `${y}-01-01`, ate: toISO(agora) };
        default:           return fallback;
    }
}

const hoje = new Date();
const DEFAULT_DE = `${hoje.getFullYear()}-${pad(hoje.getMonth() + 1)}-01`;
const DEFAULT_ATE = toISO(hoje);

interface Indicadores {
    periodo: { de: string; ate: string };
    vendas: any;
    notasFiscais: any;
    cadastros: any;
    despesasTendencia: any;
    inadimplencia: any;
}

/** Indica se o bloco vem de chamada ao vivo na API ou de dados já sincronizados no banco. */
const FonteBadge: React.FC<{ tipo: 'api' | 'db' }> = ({ tipo }) => (
    <span className={`badge ${tipo === 'api' ? 'badge-success' : 'badge-neutral'}`}>
        {tipo === 'api' ? 'Ao vivo · API' : 'Banco local'}
    </span>
);

const CardHeader: React.FC<{ icon: React.ReactNode; title: string; fonte: 'api' | 'db' }> = ({ icon, title, fonte }) => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
        <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>{icon}{title}</h3>
        <FonteBadge tipo={fonte} />
    </div>
);

const Indisponivel: React.FC<{ msg?: string }> = ({ msg }) => (
    <div className="section-unavailable">
        <WifiOff size={15} /> {msg || 'Indisponível no momento'}
    </div>
);

const ApiContaAzul: React.FC = () => {
    const [preset, setPreset] = useState<PresetKey>('this_month');
    const [periodoInicio, setPeriodoInicio] = useState(DEFAULT_DE);
    const [periodoFim, setPeriodoFim] = useState(DEFAULT_ATE);
    const [periodoAplic, setPeriodoAplic] = useState({ de: DEFAULT_DE, ate: DEFAULT_ATE });

    const [dados, setDados] = useState<Indicadores | null>(null);
    const [loading, setLoading] = useState(true);
    const [erroGeral, setErroGeral] = useState<string | null>(null);

    useEffect(() => {
        const { de, ate } = periodoAplic;
        setLoading(true);
        setErroGeral(null);
        axios.get(`/api/dashboard/conta-azul/indicadores?de=${de}&ate=${ate}`)
            .then(r => setDados(r.data))
            .catch(() => setErroGeral('Não foi possível carregar os indicadores da API do Conta Azul.'))
            .finally(() => setLoading(false));
    }, [periodoAplic]);

    const handlePresetChange = (novo: PresetKey) => {
        setPreset(novo);
        if (novo === 'custom') return;
        const range = computeRange(novo, { de: periodoInicio, ate: periodoFim });
        setPeriodoInicio(range.de);
        setPeriodoFim(range.ate);
        setPeriodoAplic(range);
    };
    const handleDeChange = (v: string) => { setPreset('custom'); setPeriodoInicio(v); };
    const handleAteChange = (v: string) => { setPreset('custom'); setPeriodoFim(v); };
    const periodoPendente = periodoInicio !== periodoAplic.de || periodoFim !== periodoAplic.ate;
    const aplicarFiltro = () => setPeriodoAplic({ de: periodoInicio, ate: periodoFim });

    // ── dados derivados para os gráficos ──────────────────────────────────
    const categoriaChart = (dados?.despesasTendencia?.porCategoria || [])
        .slice(0, 7)
        .map((c: any) => ({ name: c.categoria, valor: c.total }));

    const ccChart = (dados?.despesasTendencia?.porCentroDeCusto || [])
        .map((c: any) => ({ name: c.centroDeCusto, valor: c.total }));

    const contasChart = (dados?.cadastros?.contasFinanceiras || [])
        .filter((c: any) => c.saldo !== null)
        .map((c: any) => ({ name: c.nome, valor: c.saldo }));

    const totalVencido = dados?.inadimplencia?.totalVencido || 0;
    const totalAVencer = Math.max((dados?.inadimplencia?.totalEmAberto || 0) - totalVencido, 0);
    const inadimplenciaDonut = [
        { name: 'A Vencer', value: totalAVencer, color: 'var(--primary)' },
        { name: 'Vencido', value: totalVencido, color: 'var(--danger)' },
    ].filter(d => d.value > 0);

    return (
        <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div>
                <h2 style={{ fontSize: '1.375rem', fontWeight: 700, color: 'var(--text-main)', letterSpacing: '-0.02em' }}>
                    Indicadores via API
                </h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
                    Blocos marcados <FonteBadge tipo="api" /> vêm ao vivo da API v2 do Conta Azul; blocos <FonteBadge tipo="db" /> vêm
                    do banco já sincronizado. Nenhum aqui tem quebra por conta bancária/rateio — esse dado só existe por parcela individual.
                </p>
            </div>

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
                    onDeChange={handleDeChange}
                    onAteChange={handleAteChange}
                    onApply={aplicarFiltro}
                    pending={periodoPendente}
                    isLoading={loading}
                />
            </div>

            {loading && !dados && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '40vh', gap: '0.625rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                    <Loader2 size={18} className="animate-spin" /> Consultando API do Conta Azul...
                </div>
            )}

            {erroGeral && <Indisponivel msg={erroGeral} />}

            {dados && (
                <>
                    {/* ── KPIs de topo ── */}
                    <div className="metrics-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
                        <div className="kpi-card highlight">
                            <div className="kpi-icon"><ShoppingCart size={18} color="var(--success)" /></div>
                            <div className="kpi-content">
                                <h4>Vendas no período</h4>
                                <h2>{dados.vendas?.disponivel ? fmt(dados.vendas.total) : '—'}</h2>
                                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                    {dados.vendas?.disponivel
                                        ? `${dados.vendas.quantidade} venda(s) · ticket médio ${fmt(dados.vendas.ticketMedio)}`
                                        : 'indisponível'}
                                </span>
                            </div>
                        </div>

                        <div className="kpi-card danger">
                            <div className="kpi-icon"><TrendingDown size={18} color="var(--danger)" /></div>
                            <div className="kpi-content">
                                <h4>Despesas no período</h4>
                                <h2>{dados.despesasTendencia?.disponivel ? fmt(dados.despesasTendencia.total) : '—'}</h2>
                                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>sem quebra por conta bancária</span>
                            </div>
                        </div>

                        <div className="kpi-card">
                            <div className="kpi-icon"><Wallet size={18} color="var(--primary)" /></div>
                            <div className="kpi-content">
                                <h4>Saldo em contas</h4>
                                <h2>{dados.cadastros?.disponivel ? fmt(dados.cadastros.saldoTotalContas) : '—'}</h2>
                                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>posição atual, todas as contas</span>
                            </div>
                        </div>

                        <div className="kpi-card warning">
                            <div className="kpi-icon"><AlertTriangle size={18} color="var(--warning)" /></div>
                            <div className="kpi-content">
                                <h4>Inadimplência vencida</h4>
                                <h2>{dados.inadimplencia?.disponivel ? fmt(dados.inadimplencia.totalVencido) : '—'}</h2>
                                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                    {dados.inadimplencia?.disponivel ? `${dados.inadimplencia.qtdVencido} título(s)` : 'indisponível'}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* ── Despesas por categoria / CC ── */}
                    <div className="charts-grid">
                        <div className="chart-container">
                            <CardHeader icon={<TrendingDown size={15} color="var(--text-muted)" />} title="Despesas por Categoria" fonte="db" />
                            {!dados.despesasTendencia?.disponivel ? <Indisponivel msg={dados.despesasTendencia?.erro} /> : categoriaChart.length === 0 ? (
                                <Indisponivel msg="Sem despesas no período" />
                            ) : (
                                <div style={{ width: '100%', height: Math.max(240, categoriaChart.length * 38) }}>
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={categoriaChart} layout="vertical" margin={{ top: 4, right: 24, left: 4, bottom: 4 }}>
                                            <CartesianGrid stroke="var(--border)" horizontal={false} />
                                            <XAxis type="number" tickFormatter={fmtCompact} tick={{ fill: 'var(--text-subtle)', fontSize: 11 }} axisLine={false} tickLine={false} />
                                            <YAxis dataKey="name" type="category" width={140} tick={{ fill: 'var(--text-main)', fontSize: 12, fontWeight: 500 }} axisLine={false} tickLine={false} />
                                            <Tooltip formatter={(v: any) => fmt(Number(v))} cursor={{ fill: 'var(--background)' }} contentStyle={tooltipStyle} labelStyle={{ color: 'var(--text-main)', fontWeight: 600 }} />
                                            <Bar dataKey="valor" name="Despesa" fill="var(--primary)" radius={[0, 4, 4, 0]} maxBarSize={18} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            )}
                        </div>

                        <div className="chart-container">
                            <CardHeader icon={<TrendingDown size={15} color="var(--text-muted)" />} title="Despesas por Centro de Custo" fonte="db" />
                            {!dados.despesasTendencia?.disponivel ? <Indisponivel msg={dados.despesasTendencia?.erro} /> : ccChart.length === 0 ? (
                                <Indisponivel msg="Sem despesas no período" />
                            ) : (
                                <div style={{ width: '100%', height: Math.max(240, ccChart.length * 38) }}>
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={ccChart} layout="vertical" margin={{ top: 4, right: 24, left: 4, bottom: 4 }}>
                                            <CartesianGrid stroke="var(--border)" horizontal={false} />
                                            <XAxis type="number" tickFormatter={fmtCompact} tick={{ fill: 'var(--text-subtle)', fontSize: 11 }} axisLine={false} tickLine={false} />
                                            <YAxis dataKey="name" type="category" width={140} tick={{ fill: 'var(--text-main)', fontSize: 12, fontWeight: 500 }} axisLine={false} tickLine={false} />
                                            <Tooltip formatter={(v: any) => fmt(Number(v))} cursor={{ fill: 'var(--background)' }} contentStyle={tooltipStyle} labelStyle={{ color: 'var(--text-main)', fontWeight: 600 }} />
                                            <Bar dataKey="valor" name="Despesa" fill="var(--primary)" radius={[0, 4, 4, 0]} maxBarSize={18} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* ── Contas financeiras / Inadimplência ── */}
                    <div className="charts-grid" style={{ gridTemplateColumns: '3fr 2fr' }}>
                        <div className="chart-container">
                            <CardHeader icon={<Landmark size={15} color="var(--text-muted)" />} title="Contas Financeiras (saldo atual)" fonte="api" />
                            {!dados.cadastros?.disponivel ? <Indisponivel msg={dados.cadastros?.erro} /> : contasChart.length === 0 ? (
                                <Indisponivel msg="Sem contas cadastradas" />
                            ) : (
                                <>
                                    <div style={{ width: '100%', height: Math.max(220, contasChart.length * 38) }}>
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={contasChart} layout="vertical" margin={{ top: 4, right: 24, left: 4, bottom: 4 }}>
                                                <CartesianGrid stroke="var(--border)" horizontal={false} />
                                                <XAxis type="number" tickFormatter={fmtCompact} tick={{ fill: 'var(--text-subtle)', fontSize: 11 }} axisLine={false} tickLine={false} />
                                                <YAxis dataKey="name" type="category" width={160} tick={{ fill: 'var(--text-main)', fontSize: 12, fontWeight: 500 }} axisLine={false} tickLine={false} />
                                                <Tooltip formatter={(v: any) => fmt(Number(v))} cursor={{ fill: 'var(--background)' }} contentStyle={tooltipStyle} labelStyle={{ color: 'var(--text-main)', fontWeight: 600 }} />
                                                <Bar dataKey="valor" name="Saldo" radius={[0, 4, 4, 0]} maxBarSize={18}>
                                                    {contasChart.map((c: any, i: number) => (
                                                        <Cell key={i} fill={c.valor >= 0 ? 'var(--success)' : 'var(--danger)'} />
                                                    ))}
                                                </Bar>
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.75rem' }}>
                                        Posição pontual (agora) — a API não expõe extrato/histórico de saldo ao longo do tempo.
                                    </p>
                                </>
                            )}
                        </div>

                        <div className="chart-container">
                            <CardHeader icon={<AlertTriangle size={15} color="var(--text-muted)" />} title="Inadimplência" fonte="db" />
                            {!dados.inadimplencia?.disponivel ? <Indisponivel msg={dados.inadimplencia?.erro} /> : inadimplenciaDonut.length === 0 ? (
                                <Indisponivel msg="Sem contas a receber em aberto" />
                            ) : (
                                <>
                                    <div style={{ height: 200 }}>
                                        <ResponsiveContainer width="100%" height="100%">
                                            <PieChart>
                                                <Pie
                                                    data={inadimplenciaDonut} cx="50%" cy="50%" innerRadius={55} outerRadius={80}
                                                    paddingAngle={4} dataKey="value" stroke="none"
                                                    label={({ percent }) => (percent || 0) > 0.05 ? `${((percent || 0) * 100).toFixed(0)}%` : ''}
                                                    labelLine={false}
                                                >
                                                    {inadimplenciaDonut.map((d, i) => <Cell key={i} fill={d.color} />)}
                                                </Pie>
                                                <Tooltip formatter={(v: any) => fmt(Number(v))} contentStyle={tooltipStyle} />
                                            </PieChart>
                                        </ResponsiveContainer>
                                    </div>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', justifyContent: 'center', marginTop: '0.5rem' }}>
                                        {inadimplenciaDonut.map(d => (
                                            <div key={d.name} style={{ display: 'flex', alignItems: 'center', fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                                                <div style={{ width: 10, height: 10, borderRadius: '50%', marginRight: 6, background: d.color }} />
                                                {d.name}: {fmt(d.value)}
                                            </div>
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>
                    </div>

                    {/* ── Cadastros / Notas fiscais ── */}
                    <div className="charts-grid">
                        <div className="chart-container">
                            <CardHeader icon={<Users size={15} color="var(--text-muted)" />} title="Cadastros" fonte="api" />
                            {!dados.cadastros?.disponivel ? <Indisponivel msg={dados.cadastros?.erro} /> : (
                                <div className="mini-stats-grid">
                                    <div className="mini-stat">
                                        <div className="mini-stat-value">{dados.cadastros.categorias}</div>
                                        <div className="mini-stat-label">Categorias</div>
                                    </div>
                                    <div className="mini-stat">
                                        <div className="mini-stat-value">{dados.cadastros.centrosDeCusto}</div>
                                        <div className="mini-stat-label">Centros de Custo</div>
                                    </div>
                                    <div className="mini-stat">
                                        <div className="mini-stat-value">{dados.cadastros.pessoas}</div>
                                        <div className="mini-stat-label">Clientes/Fornecedores</div>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="chart-container">
                            <CardHeader icon={<FileText size={15} color="var(--text-muted)" />} title="Notas Fiscais" fonte="api" />
                            {!dados.notasFiscais?.disponivel ? <Indisponivel msg={dados.notasFiscais?.erro} /> : (
                                <>
                                    <div className="mini-stats-grid">
                                        <div className="mini-stat">
                                            <div className="mini-stat-value">{dados.notasFiscais.total}</div>
                                            <div className="mini-stat-label">Total cadastrado</div>
                                        </div>
                                    </div>
                                    {dados.notasFiscais.obs && (
                                        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.75rem' }}>{dados.notasFiscais.obs}</p>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default ApiContaAzul;
