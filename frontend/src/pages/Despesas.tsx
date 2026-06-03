import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { DollarSign, TrendingUp, TrendingDown, Layers, ChevronDown, ChevronRight } from 'lucide-react';
import './Dashboard.css';

const API = '';

const Despesas: React.FC = () => {
    const token = localStorage.getItem('@ContaAzul:token');
    const [year, setYear] = useState<number>(new Date().getFullYear());
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

    useEffect(() => {
        fetchDados();
    }, [year]);

    const fetchDados = async () => {
        setIsLoading(true);
        try {
            const response = await axios.get(`/api/dashboard/despesas/agrupado?year=${year}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            const rawData = response.data.data;
            setData(rawData);

            const categoriasKeys = Array.from(new Set(rawData.map((d: any) => d.categoria))) as string[];

            const cData = categoriasKeys.map(cat => {
                const linhasCat = rawData.filter((r: any) => r.categoria === cat);
                const totalAtual = linhasCat.reduce((acc: number, curr: any) => acc + curr.totalAnual, 0);
                const totalAnterior = linhasCat.reduce((acc: number, curr: any) => acc + curr.totalAnterior, 0);
                return {
                    name: cat.length > 25 ? cat.substring(0, 25) + '...' : cat,
                    'Ano Anterior': totalAnterior,
                    'Ano Atual': totalAtual
                };
            }).sort((a, b) => b['Ano Atual'] - a['Ano Atual']).slice(0, 7);

            setChartData(cData);

            const deptKeys = Array.from(new Set(rawData.map((d: any) => d.centroDeCusto))) as string[];
            const dData = deptKeys.map(cc => {
                const linhasCat = rawData.filter((r: any) => r.centroDeCusto === cc);
                const totalAtual = linhasCat.reduce((acc: number, curr: any) => acc + curr.totalAnual, 0);
                const totalAnterior = linhasCat.reduce((acc: number, curr: any) => acc + curr.totalAnterior, 0);
                return {
                    name: cc,
                    'Ano Anterior': totalAnterior,
                    'Ano Atual': totalAtual
                };
            }).sort((a, b) => b['Ano Atual'] - a['Ano Atual']).slice(0, 10);
            
            setDeptChartData(dData);

            // Detalhe por CC
            const rDetalhe = await axios.get(
                `${API}/api/dashboard/despesas/detalhe-por-cc?year=${year}`,
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

    return (
        <div className="module-page fade-in">
            <header className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h2>Despesas e Custos</h2>
                    <p>Evolução Anual (Mês a Mês)</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>Período:</span>
                    <select
                        value={year}
                        onChange={(e) => setYear(Number(e.target.value))}
                        style={{
                            background: 'var(--surface)',
                            border: '1px solid var(--border)',
                            borderRadius: '0.75rem',
                            padding: '0.6rem 1.25rem',
                            color: 'var(--text-main)',
                            fontWeight: 600,
                            outline: 'none',
                            cursor: 'pointer',
                            fontSize: '1rem'
                        }}
                    >
                        <option value={new Date().getFullYear() - 1}>{new Date().getFullYear() - 1}</option>
                        <option value={new Date().getFullYear()}>{new Date().getFullYear()}</option>
                        <option value={new Date().getFullYear() + 1}>{new Date().getFullYear() + 1}</option>
                    </select>
                </div>
            </header>

            {isLoading ? (
                <div className="loading-state">
                    <div className="animate-spin" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '40px', height: '40px', borderRadius: '50%', border: '3px solid rgba(59, 130, 246, 0.2)', borderTopColor: '#3b82f6', marginBottom: '1rem' }}></div>
                    <span style={{ marginLeft: '1rem' }}>Processando motor matricial...</span>
                </div>
            ) : (
                <>
                    <div className="metrics-grid">
                        <div className="kpi-card highlight">
                            <div className="kpi-icon" style={{ background: '#eff6ff', color: '#2563eb' }}>
                                <DollarSign size={28} />
                            </div>
                            <div className="kpi-content">
                                <h4>Despesa Total Acumulada ({year})</h4>
                                <h2>{formatCurrency(totalAtual)}</h2>
                            </div>
                        </div>

                        <div className="kpi-card">
                            <div className="kpi-icon" style={{ background: 'var(--surface-hover)', color: 'var(--text-muted)' }}>
                                <Layers size={28} />
                            </div>
                            <div className="kpi-content">
                                <h4>Total Consolidado ({year - 1})</h4>
                                <h2 style={{ fontSize: '1.4rem', color: 'var(--text-muted)' }}>{formatCurrency(totalAnterior)}</h2>
                            </div>
                        </div>

                        <div className="kpi-card">
                            <div className="kpi-icon" style={{ background: evolucaoPercentGeral <= 0 ? '#ecfdf5' : '#fff1f2', color: evolucaoPercentGeral <= 0 ? '#059669' : '#e11d48' }}>
                                {evolucaoPercentGeral <= 0 ? <TrendingDown size={28} /> : <TrendingUp size={28} />}
                            </div>
                            <div className="kpi-content">
                                <div>
                                    <h4>Variação Anual</h4>
                                </div>
                                <h2 style={{ color: evolucaoPercentGeral <= 0 ? '#059669' : '#e11d48' }}>
                                    {evolucaoRSGeral > 0 ? '+' : ''}{formatCurrency(evolucaoRSGeral)}
                                </h2>
                                <span style={{
                                    display: 'inline-block', marginTop: '0.25rem', padding: '0.15rem 0.6rem',
                                    borderRadius: '2rem', fontSize: '0.75rem', fontWeight: 700,
                                    background: evolucaoPercentGeral <= 0 ? '#ecfdf5' : '#fff1f2',
                                    color: evolucaoPercentGeral <= 0 ? '#059669' : '#e11d48'
                                }}>
                                    {evolucaoPercentGeral > 0 ? 'Custo Inflado ' : 'Redução de '}{evolucaoPercentGeral > 0 ? '+' : ''}{evolucaoPercentGeral.toFixed(2)}%
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="charts-grid" style={{ gridTemplateColumns: '1fr', marginBottom: '2rem' }}>
                        <div className="chart-container">
                            <h3>Curva de Pareto: Maiores Despesas Anuais</h3>
                            <div style={{ width: '100%', height: '350px', marginTop: '1rem' }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 80 }}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                                        <XAxis dataKey="name" tick={{ fill: 'var(--text-muted)', fontSize: 13 }} axisLine={false} tickLine={false} angle={-30} textAnchor="end" />
                                        <YAxis tickFormatter={(val) => `R$ ${(val / 1000).toFixed(0)}k`} width={80} tick={{ fill: 'var(--text-muted)', fontSize: 12 }} axisLine={false} tickLine={false} />
                                        <Tooltip formatter={(value: any) => formatCurrency(Number(value))} cursor={{ fill: 'var(--surface-hover)' }} contentStyle={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)', borderRadius: '12px', color: 'var(--text-main)' }} />
                                        <Legend wrapperStyle={{ paddingTop: '20px' }} />
                                        <Bar dataKey="Ano Anterior" fill="#94a3b8" radius={[6, 6, 0, 0]} barSize={24} />
                                        <Bar dataKey="Ano Atual" fill="#2563eb" radius={[6, 6, 0, 0]} barSize={24} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>

                    <div className="charts-grid" style={{ gridTemplateColumns: 'minmax(350px, 1fr) 2fr', gap: '1.5rem', marginBottom: '2rem' }}>
                        <div className="chart-container">
                            <h3>Composição Departamental</h3>
                            <div style={{ width: '100%', height: '350px', marginTop: '1rem' }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={deptChartData} layout="vertical" margin={{ top: 20, right: 30, left: 40, bottom: 5 }}>
                                        <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="var(--border)" />
                                        <XAxis type="number" tickFormatter={(val) => `R$ ${(val / 1000).toFixed(0)}k`} tick={{ fill: 'var(--text-muted)', fontSize: 12 }} axisLine={false} tickLine={false} />
                                        <YAxis dataKey="name" type="category" width={80} tick={{ fill: 'var(--text-main)', fontSize: 12, fontWeight: 500 }} axisLine={false} tickLine={false} />
                                        <Tooltip formatter={(value: any) => formatCurrency(Number(value))} cursor={{ fill: 'var(--surface-hover)' }} contentStyle={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)', borderRadius: '12px', color: 'var(--text-main)' }} />
                                        <Legend wrapperStyle={{ paddingTop: '10px' }} />
                                        <Bar dataKey="Ano Anterior" fill="#94a3b8" radius={[0, 4, 4, 0]} barSize={16} />
                                        <Bar dataKey="Ano Atual" fill="#1e40af" radius={[0, 4, 4, 0]} barSize={16} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>

                    <div className="chart-container" style={{ padding: 0 }}>
                        <div style={{ padding: '1.75rem', borderBottom: '1px solid var(--border)' }}>
                            <h3 style={{ marginBottom: 0 }}>Matriz de Alocação por Centro de Custo</h3>
                        </div>
                        <div style={{ overflowX: 'auto', padding: '0 1.75rem 1.75rem' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '1rem', textAlign: 'left' }}>
                                <thead>
                                    <tr>
                                        <th style={{ padding: '1rem', borderBottom: '1px solid var(--border)', color: 'var(--text-muted)', fontSize: '0.85rem' }}>Categoria</th>
                                        <th style={{ padding: '1rem', borderBottom: '1px solid var(--border)', color: 'var(--text-muted)', fontSize: '0.85rem' }}>Setor / Centro de Custo</th>
                                        <th style={{ padding: '1rem', borderBottom: '1px solid var(--border)', color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'right' }}>{year - 1}</th>
                                        <th style={{ padding: '1rem', borderBottom: '1px solid var(--border)', color: '#2563eb', fontSize: '0.85rem', textAlign: 'right' }}>{year}</th>
                                        <th style={{ padding: '1rem', borderBottom: '1px solid var(--border)', color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'right' }}>Evolução $</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {data.map((row) => (
                                        <tr key={row.id} style={{ borderBottom: '1px solid var(--border)' }}>
                                            <td style={{ padding: '1rem', color: 'var(--text-main)', fontSize: '0.95rem', fontWeight: 500 }}>{row.categoria}</td>
                                            <td style={{ padding: '1rem' }}>
                                                <span style={{ background: 'var(--surface-hover)', border: '1px solid var(--border)', color: 'var(--text-muted)', fontSize: '0.8rem', padding: '0.3rem 0.6rem', borderRadius: '0.4rem' }}>{row.centroDeCusto}</span>
                                            </td>
                                            <td style={{ padding: '1rem', textAlign: 'right', color: 'var(--text-muted)', fontSize: '0.95rem' }}>{formatCurrency(row.totalAnterior)}</td>
                                            <td style={{ padding: '1rem', textAlign: 'right', color: 'var(--text-main)', fontSize: '0.95rem', fontWeight: 600 }}>{formatCurrency(row.totalAnual)}</td>
                                            <td style={{ padding: '1rem', textAlign: 'right', fontSize: '0.9rem', color: row.evolucaoRS > 0 ? '#e11d48' : '#059669', fontWeight: 600 }}>
                                                {row.evolucaoRS > 0 ? '+' : ''}{formatCurrency(row.evolucaoRS)}
                                            </td>
                                        </tr>
                                    ))}
                                    {data.length === 0 && (
                                        <tr><td colSpan={5} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>O robô não encontrou dados para esta Carga Matricial. Importe um CSV.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                    {/* ── Detalhamento por Centro de Custo ── */}
                    {detalheData.length > 0 && (
                        <div className="chart-container" style={{ padding: 0 }}>
                            {/* Header */}
                            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                    <h3 style={{ margin: 0 }}>Detalhamento por Centro de Custo</h3>
                                    <p style={{ margin: '0.2rem 0 0', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                                        Clique em um centro de custo para ver o breakdown por categoria
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
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px 140px 90px', padding: '0.625rem 1.5rem', background: 'var(--background)', borderBottom: '1px solid var(--border)' }}>
                                {['Centro de Custo / Categoria', String(year - 1), String(year), 'Var %'].map((h, i) => (
                                    <span key={h} style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: i === 0 ? 'left' : 'right' }}>{h}</span>
                                ))}
                            </div>

                            {/* Rows */}
                            {detalheData.map(cc => {
                                const isOpen = expandedCCs.has(cc.centroDeCusto);
                                const varPct = cc.variacao * 100;
                                const varColor = varPct <= 0 ? '#059669' : '#dc2626';

                                return (
                                    <div key={cc.centroDeCusto} style={{ borderBottom: '1px solid var(--border)' }}>
                                        {/* CC row */}
                                        <button
                                            onClick={() => toggleCC(cc.centroDeCusto)}
                                            style={{
                                                width: '100%', display: 'grid', gridTemplateColumns: '1fr 140px 140px 90px',
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
                                            <span style={{ textAlign: 'right', fontSize: '0.8125rem', fontWeight: 700, color: varColor }}>
                                                {varPct > 0 ? '+' : ''}{varPct.toFixed(1)}%
                                            </span>
                                        </button>

                                        {/* Category rows */}
                                        {isOpen && (
                                            <div style={{ background: 'var(--background)' }}>
                                                {cc.categorias.map((cat: any, i: number) => {
                                                    const catVar = cat.variacao * 100;
                                                    const catColor = catVar <= 0 ? '#059669' : '#dc2626';
                                                    return (
                                                        <div
                                                            key={cat.categoria}
                                                            style={{
                                                                display: 'grid', gridTemplateColumns: '1fr 140px 140px 90px',
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
                                                            <span style={{ textAlign: 'right', fontSize: '0.8125rem', fontWeight: 600, color: cat.anterior === 0 ? 'var(--text-subtle)' : catColor }}>
                                                                {cat.anterior === 0 ? 'novo' : `${catVar > 0 ? '+' : ''}${catVar.toFixed(1)}%`}
                                                            </span>
                                                        </div>
                                                    );
                                                })}
                                                {/* Total row */}
                                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px 140px 90px', padding: '0.625rem 1.5rem 0.625rem 3rem', borderTop: '2px solid var(--border)', background: 'var(--primary-light)', alignItems: 'center' }}>
                                                    <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--primary)' }}>Total {cc.centroDeCusto}</span>
                                                    <span style={{ textAlign: 'right', fontSize: '0.875rem', color: 'var(--text-muted)', fontWeight: 600 }}>{formatCurrency(cc.totalAnterior)}</span>
                                                    <span style={{ textAlign: 'right', fontSize: '0.875rem', color: 'var(--primary)', fontWeight: 700 }}>{formatCurrency(cc.totalAtual)}</span>
                                                    <span style={{ textAlign: 'right', fontSize: '0.875rem', fontWeight: 700, color: varColor }}>{varPct > 0 ? '+' : ''}{varPct.toFixed(1)}%</span>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export default Despesas;

