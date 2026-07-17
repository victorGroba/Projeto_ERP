import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
    ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
    ResponsiveContainer
} from 'recharts';
import { TrendingUp, TrendingDown, BarChart2, PieChart as PieIcon, Landmark } from 'lucide-react';
import './Dashboard.css';
import './EvolucaoMensal.css';

const API = '/api/dashboard';

const COLORS = ['#2563eb', '#7c3aed', '#059669', '#d97706', '#0891b2', '#dc2626', '#9333ea', '#0f766e'];

const formatCurrency = (v: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

const formatK = (v: number) => `R$ ${(v / 1000).toFixed(0)}k`;



const EvolucaoMensal: React.FC = () => {
    const token = localStorage.getItem('@ContaAzul:token');
    const [year, setYear] = useState<number>(new Date().getFullYear());

    const [evolData, setEvolData] = useState<any[]>([]);
    const [lucrosData, setLucrosData] = useState<any[]>([]);
    const [bancosData, setBancosData] = useState<any[]>([]);
    const [totalLucros, setTotalLucros] = useState(0);
    const [totalSaldo, setTotalSaldo] = useState(0);
    const [saldoLiquido, setSaldoLiquido] = useState(0);
    const [resultadoMensal, setResultadoMensal] = useState<any[]>([]);
    const [resultadoAno, setResultadoAno] = useState(0);
    const [receitasTipo, setReceitasTipo] = useState<any[]>([]);
    const [totalReceitasTipo, setTotalReceitasTipo] = useState(0);
    const [outrasSaidas, setOutrasSaidas] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => { fetchAll(); }, [year]);

    const fetchAll = async () => {
        setIsLoading(true);
        try {
            const headers = { Authorization: `Bearer ${token}` };
            const [rEvol, rLucros, rBancos, rResMes, rRecTipo, rOutras] = await Promise.all([
                axios.get(`${API}/despesas/evolucao-mensal?year=${year}`, { headers }),
                axios.get(`${API}/despesas/distribuicao-lucros?year=${year}`, { headers }),
                axios.get(`${API}/despesas/caixa-bancos?year=${year}`, { headers }),
                axios.get(`${API}/resultado/mensal?year=${year}`, { headers }),
                axios.get(`${API}/resultado/receitas-tipo?year=${year}`, { headers }),
                axios.get(`${API}/resultado/outras-saidas?year=${year}`, { headers }),
            ]);
            setEvolData(rEvol.data.data || []);
            setLucrosData(rLucros.data.data || []);
            setTotalLucros(rLucros.data.totalDistribuido || 0);
            setBancosData(rBancos.data.data || []);
            setTotalSaldo(rBancos.data.totalReceitas || rBancos.data.totalSaldo || 0);
            setSaldoLiquido(rBancos.data.saldoLiquido || 0);
            setResultadoMensal(rResMes.data.data || []);
            setResultadoAno(rResMes.data.resultadoAno || 0);
            setReceitasTipo(rRecTipo.data.data || []);
            setTotalReceitasTipo(rRecTipo.data.total || 0);
            setOutrasSaidas(rOutras.data.data || null);
        } catch (e) {
            console.error('Erro ao buscar dados analíticos:', e);
        } finally {
            setIsLoading(false);
        }
    };

    // Métricas derivadas da evolução mensal
    const mesesComDados = evolData.filter(m => m.anoAtual > 0).length;
    const totalAtual = evolData.reduce((a, m) => a + m.anoAtual, 0);
    const totalAnterior = evolData.reduce((a, m) => a + m.anoAnterior, 0);
    const variacaoGeral = totalAnterior > 0 ? ((totalAtual - totalAnterior) / totalAnterior) * 100 : 0;
    const mediaMensal = mesesComDados > 0 ? totalAtual / mesesComDados : 0;


    return (
        <div className="module-page fade-in">
            <header className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h2>Análise Financeira Avançada</h2>
                    <p>Evolução Mensal · Distribuição de Lucros · Caixa & Bancos</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>Período:</span>
                    <select
                        value={year}
                        onChange={e => setYear(Number(e.target.value))}
                        style={{
                            background: 'var(--surface)', border: '1px solid var(--border)',
                            borderRadius: '0.75rem', padding: '0.6rem 1.25rem',
                            color: 'var(--text-main)', fontWeight: 600, outline: 'none',
                            cursor: 'pointer', fontSize: '1rem'
                        }}
                    >
                        {[year - 2, year - 1, year, year + 1].map(y => (
                            <option key={y} value={y}>{y}</option>
                        ))}
                    </select>
                </div>
            </header>

            {isLoading ? (
                <div className="loading-state">
                    <div className="animate-spin" style={{ width: 40, height: 40, borderRadius: '50%', border: '3px solid rgba(37,99,235,0.2)', borderTopColor: 'var(--primary)' }} />
                    <span style={{ marginLeft: '1rem' }}>Carregando análise financeira...</span>
                </div>
            ) : (
                <>
                    {/* ── KPIs Evolução Mensal ── */}
                    <div className="metrics-grid" style={{ marginBottom: '2rem' }}>
                        <div className="kpi-card highlight">
                            <div className="kpi-icon" style={{ background: 'var(--primary-light)', color: 'var(--primary)' }}>
                                <BarChart2 size={28} />
                            </div>
                            <div className="kpi-content">
                                <h4>Total Acumulado {year}</h4>
                                <h2>{formatCurrency(totalAtual)}</h2>
                            </div>
                        </div>
                        <div className="kpi-card">
                            <div className="kpi-icon" style={{ background: 'var(--surface-hover)', color: 'var(--text-muted)' }}>
                                <BarChart2 size={28} />
                            </div>
                            <div className="kpi-content">
                                <h4>Média Mensal ({mesesComDados} meses)</h4>
                                <h2 style={{ fontSize: '1.4rem' }}>{formatCurrency(mediaMensal)}</h2>
                            </div>
                        </div>
                        <div className="kpi-card">
                            <div className="kpi-icon" style={{ background: variacaoGeral <= 0 ? 'var(--success-light)' : 'var(--danger-light)', color: variacaoGeral <= 0 ? 'var(--success)' : 'var(--danger)' }}>
                                {variacaoGeral <= 0 ? <TrendingDown size={28} /> : <TrendingUp size={28} />}
                            </div>
                            <div className="kpi-content">
                                <h4>Variação vs {year - 1}</h4>
                                <h2 style={{ color: variacaoGeral <= 0 ? 'var(--success)' : 'var(--danger)' }}>
                                    {variacaoGeral > 0 ? '+' : ''}{variacaoGeral.toFixed(1)}%
                                </h2>
                            </div>
                        </div>
                        <div className="kpi-card">
                            <div className="kpi-icon" style={{ background: '#faf5ff', color: '#7c3aed' }}>
                                <PieIcon size={28} />
                            </div>
                            <div className="kpi-content">
                                <h4>Distribuição de Lucros</h4>
                                <h2 style={{ fontSize: '1.4rem', color: '#7c3aed' }}>{formatCurrency(totalLucros)}</h2>
                            </div>
                        </div>
                    </div>

                    {/* ── Gráfico: Evolução Mensal Comparativa ── */}
                    <div className="chart-container" style={{ marginBottom: '2rem' }}>
                        <div className="chart-section-header">
                            <BarChart2 size={20} />
                            <h3>Evolução Mensal Comparativa — {year} vs {year - 1}</h3>
                        </div>
                        <div style={{ width: '100%', height: 360, marginTop: '1rem' }}>
                            <ResponsiveContainer>
                                <ComposedChart data={evolData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }} barGap={4} barCategoryGap="28%">
                                    <CartesianGrid vertical={false} stroke="var(--border)" />
                                    <XAxis dataKey="mes" tick={{ fill: 'var(--text-muted)', fontSize: 13 }} axisLine={false} tickLine={false} />
                                    <YAxis tickFormatter={formatK} width={85} tick={{ fill: 'var(--text-muted)', fontSize: 12 }} axisLine={false} tickLine={false} />
                                    <Tooltip
                                        formatter={(value: any, name: any) => [formatCurrency(Number(value)), name]}
                                        contentStyle={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)', borderRadius: '12px', color: 'var(--text-main)' }}
                                    />
                                    <Legend wrapperStyle={{ paddingTop: 16 }} />
                                    <Bar dataKey="anoAnterior" name={`${year - 1}`} fill="#94a3b8" radius={[4, 4, 0, 0]} maxBarSize={22} />
                                    <Bar dataKey="anoAtual" name={`${year}`} fill="var(--primary)" radius={[4, 4, 0, 0]} maxBarSize={22} />
                                </ComposedChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* ── Linha 2: Lucros + Bancos ── */}
                    <div className="charts-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '1.25rem', marginBottom: '2rem' }}>

                        {/* Distribuição de Lucros — barras horizontais */}
                        <div className="chart-container">
                            <div className="chart-section-header">
                                <PieIcon size={18} />
                                <h3>Distribuição de Lucros — {year}</h3>
                            </div>
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '1.25rem' }}>
                                Total distribuído: <strong style={{ color: 'var(--text-main)' }}>{formatCurrency(totalLucros)}</strong>
                            </p>
                            {lucrosData.length === 0 ? (
                                <div className="empty-state">
                                    <p>Nenhum lançamento de "Distribuição de Lucro" ou "Pro-Labore" encontrado.</p>
                                    <span>Verifique se a categoria está preenchida no Conta Azul.</span>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                    {lucrosData.map((item: any, i: number) => {
                                        const pct = item.pct ?? 0;
                                        return (
                                            <div key={i}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.3rem' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0 }}>
                                                        <span style={{ width: 10, height: 10, borderRadius: '50%', background: COLORS[i % COLORS.length], flexShrink: 0 }} />
                                                        <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 160 }}>{item.name}</span>
                                                    </div>
                                                    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'baseline', flexShrink: 0 }}>
                                                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 500 }}>{pct.toFixed(1)}%</span>
                                                        <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--text-main)' }}>{formatCurrency(item.value)}</span>
                                                    </div>
                                                </div>
                                                <div style={{ height: 6, background: 'var(--background)', borderRadius: 999, overflow: 'hidden' }}>
                                                    <div style={{ height: '100%', width: `${Math.min(pct, 100)}%`, background: COLORS[i % COLORS.length], borderRadius: 999, transition: 'width 0.6s ease' }} />
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {/* Resumo de Receitas por Status */}
                        <div className="chart-container">
                            <div className="chart-section-header">
                                <Landmark size={18} />
                                <h3>Receitas por Status — {year}</h3>
                            </div>
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
                                Total em carteira: <strong style={{ color: 'var(--text-main)' }}>{formatCurrency(totalSaldo)}</strong>
                            </p>
                            {bancosData.length === 0 ? (
                                <div className="empty-state">
                                    <p>Nenhuma receita encontrada para {year}.</p>
                                    <span>Execute uma sincronização para carregar os dados.</span>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                    {bancosData.map((item: any) => {
                                        const pct = totalSaldo > 0 ? (item.valor / totalSaldo) * 100 : 0;
                                        return (
                                            <div key={item.name}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.375rem' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                        <span style={{ width: 10, height: 10, borderRadius: '50%', background: item.color, flexShrink: 0 }} />
                                                        <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-main)' }}>{item.name}</span>
                                                    </div>
                                                    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'baseline' }}>
                                                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{pct.toFixed(1)}%</span>
                                                        <span style={{ fontSize: '0.875rem', fontWeight: 700, color: item.color }}>{formatCurrency(item.valor)}</span>
                                                    </div>
                                                </div>
                                                <div style={{ height: 8, background: 'var(--background)', borderRadius: 999, overflow: 'hidden' }}>
                                                    <div style={{ height: '100%', width: `${Math.min(pct, 100)}%`, background: item.color, borderRadius: 999, transition: 'width 0.6s ease' }} />
                                                </div>
                                            </div>
                                        );
                                    })}
                                    <div style={{ marginTop: '0.5rem', padding: '0.875rem', background: 'var(--background)', borderRadius: 'var(--radius-md)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', fontWeight: 500 }}>Saldo Líquido (Rec. − Desp.)</span>
                                        <span style={{ fontSize: '1rem', fontWeight: 700, color: saldoLiquido >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                                            {saldoLiquido >= 0 ? '+' : ''}{formatCurrency(saldoLiquido)}
                                        </span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* ── Resultado Financeiro Mensal ── */}
                    <div className="chart-container" style={{ marginBottom: '2rem' }}>
                        <div className="chart-section-header" style={{ justifyContent: 'space-between' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                <BarChart2 size={18} />
                                <h3>Resultado Financeiro Mensal — {year}</h3>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                                <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-subtle)', textTransform: 'uppercase' }}>Resultado do Ano</div>
                                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: resultadoAno >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                                    {resultadoAno >= 0 ? '+' : ''}{formatCurrency(resultadoAno)}
                                </div>
                            </div>
                        </div>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.8125rem', marginBottom: '0.5rem' }}>
                            Receitas − Despesas operacionais, mês a mês (distribuição de lucros vai em "Outras Saídas")
                        </p>
                        <div style={{ width: '100%', height: 320 }}>
                            <ResponsiveContainer>
                                <ComposedChart data={resultadoMensal} margin={{ top: 16, right: 16, left: 8, bottom: 0 }} barGap={4} barCategoryGap="28%">
                                    <CartesianGrid vertical={false} stroke="var(--border)" />
                                    <XAxis dataKey="mes" tick={{ fill: 'var(--text-muted)', fontSize: 12 }} axisLine={false} tickLine={false} />
                                    <YAxis tickFormatter={formatK} width={70} tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                                    <Tooltip formatter={(v: any, n: any) => [formatCurrency(Number(v)), n]} contentStyle={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)', borderRadius: '10px', fontSize: '0.8125rem' }} />
                                    <Legend wrapperStyle={{ paddingTop: 12, fontSize: '0.8125rem' }} />
                                    <Bar dataKey="receitas" name="Receitas" fill="var(--success)" radius={[4, 4, 0, 0]} maxBarSize={16} />
                                    <Bar dataKey="despesas" name="Despesas" fill="var(--danger)" radius={[4, 4, 0, 0]} maxBarSize={16} />
                                    <Line dataKey="resultado" name="Resultado" type="monotone" stroke="var(--primary)" strokeWidth={2.5} dot={{ r: 3, fill: 'var(--primary)' }} />
                                </ComposedChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* ── Receitas por Tipo + Outras Saídas (DRE) ── */}
                    <div className="charts-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>

                        {/* Receitas por Tipo */}
                        <div className="chart-container">
                            <div className="chart-section-header">
                                <PieIcon size={18} />
                                <h3>Receitas por Tipo — {year}</h3>
                            </div>
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '1.25rem' }}>
                                Total: <strong style={{ color: 'var(--text-main)' }}>{formatCurrency(totalReceitasTipo)}</strong>
                            </p>
                            {receitasTipo.length === 0 ? (
                                <div className="empty-state"><p>Nenhuma receita encontrada para {year}.</p></div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                    {receitasTipo.slice(0, 8).map((item: any, i: number) => (
                                        <div key={item.nome}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.3rem' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0 }}>
                                                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: COLORS[i % COLORS.length], flexShrink: 0 }} />
                                                    <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 170 }}>{item.nome}</span>
                                                </div>
                                                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'baseline', flexShrink: 0 }}>
                                                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{item.pct?.toFixed(1)}%</span>
                                                    <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--text-main)' }}>{formatCurrency(item.valor)}</span>
                                                </div>
                                            </div>
                                            <div style={{ height: 6, background: 'var(--background)', borderRadius: 999, overflow: 'hidden' }}>
                                                <div style={{ height: '100%', width: `${Math.min(item.pct || 0, 100)}%`, background: COLORS[i % COLORS.length], borderRadius: 999 }} />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Outras Saídas (DRE em cascata) */}
                        <div className="chart-container">
                            <div className="chart-section-header">
                                <Landmark size={18} />
                                <h3>Outras Saídas / Resultado — {year}</h3>
                            </div>
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '1.25rem' }}>
                                Cascata até o resultado do exercício
                            </p>
                            {outrasSaidas && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                    {[
                                        { label: 'Receitas (faturadas)', valor: outrasSaidas.receitas, op: '+', forte: false },
                                        { label: 'Despesas Operacionais', valor: -outrasSaidas.despesaOperacional, op: '−', forte: false },
                                        { label: 'Lucro Financeiro Operacional', valor: outrasSaidas.lucroFinOperacional, op: '=', forte: true },
                                        { label: 'Depósito Judicial (ISS)', valor: -outrasSaidas.depositoJudicial, op: '−', forte: false },
                                        { label: 'Imobilizações', valor: -outrasSaidas.imobilizacoes, op: '−', forte: false },
                                        { label: 'Distribuição de Lucros', valor: -outrasSaidas.distribuicaoLucros, op: '−', forte: false },
                                        { label: 'Resultado do Exercício', valor: outrasSaidas.resultadoExercicio, op: '=', forte: true },
                                    ].map((linha) => (
                                        <div key={linha.label} style={{
                                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                            padding: linha.forte ? '0.625rem 0.875rem' : '0.4rem 0.875rem',
                                            background: linha.forte ? 'var(--primary-light)' : 'transparent',
                                            borderRadius: 'var(--radius-sm)',
                                            borderTop: linha.op === '=' ? '1px solid var(--border)' : 'none',
                                        }}>
                                            <span style={{ fontSize: linha.forte ? '0.875rem' : '0.8125rem', fontWeight: linha.forte ? 700 : 500, color: linha.forte ? 'var(--primary)' : 'var(--text-muted)' }}>
                                                {linha.label}
                                            </span>
                                            <span style={{ fontSize: linha.forte ? '0.9375rem' : '0.8125rem', fontWeight: linha.forte ? 800 : 600, color: linha.valor >= 0 ? (linha.forte ? 'var(--success)' : 'var(--text-main)') : 'var(--danger)' }}>
                                                {linha.valor >= 0 ? '' : '−'}{formatCurrency(Math.abs(linha.valor))}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default EvolucaoMensal;
