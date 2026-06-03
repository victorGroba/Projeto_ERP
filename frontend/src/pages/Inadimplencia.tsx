import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { AlertCircle, CheckCircle2, ShieldAlert } from 'lucide-react';
import './Dashboard.css';

const AGING_COLORS = ['#3b82f6', '#f59e0b', '#f97316', '#ef4444', '#7f1d1d'];

const Inadimplencia: React.FC = () => {
    const token = localStorage.getItem('@ContaAzul:token');
    const [year, setYear] = useState<number>(new Date().getFullYear());
    const [agingData, setAgingData] = useState<any[]>([]);
    const [topDevedores, setTopDevedores] = useState<any[]>([]);
    const [totalAtraso, setTotalAtraso] = useState<number>(0);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        fetchDados();
    }, [year]);

    const fetchDados = async () => {
        setIsLoading(true);
        try {
            const response = await axios.get(`/api/dashboard/inadimplencia/aging?year=${year}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            const { aging, totalAtraso, topDevedores } = response.data;

            const agingArray = [
                { name: 'A Vencer', value: aging.a_vencer },
                { name: '1 a 30 dias', value: aging.ate_30 },
                { name: '31 a 60 dias', value: aging.de_31_a_60 },
                { name: '61 a 90 dias', value: aging.de_61_a_90 },
                { name: 'Mais de 90 dias', value: aging.mais_de_90 }
            ].filter(item => item.value > 0);

            setAgingData(agingArray);
            setTotalAtraso(totalAtraso);
            setTopDevedores(topDevedores);
        } catch (error) {
            console.error('Erro ao buscar dados de inadimplência', error);
        } finally {
            setIsLoading(false);
        }
    };

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
    };

    const percentVencido = totalAtraso / (totalAtraso + (agingData.find(d => d.name === 'A Vencer')?.value || 0)) * 100 || 0;

    return (
        <div className="module-page fade-in">
            <header className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h2>Risco e Inadimplência</h2>
                    <p>Monitoramento do Tempo de Atraso e Risco por Grupos</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>Ano Base:</span>
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
                    <span style={{ marginLeft: '1rem' }}>Processando carteira de Recebíveis...</span>
                </div>
            ) : (
                <>
                    <div className="metrics-grid">
                        <div className="kpi-card highlight">
                            <div className="kpi-icon" style={{ background: '#fff1f2', color: '#e11d48' }}>
                                <AlertCircle size={28} />
                            </div>
                            <div className="kpi-content">
                                <h4>Total Vencido em Atraso</h4>
                                <h2 style={{ color: '#e11d48' }}>{formatCurrency(totalAtraso)}</h2>
                            </div>
                        </div>

                        <div className="kpi-card">
                            <div className="kpi-icon" style={{ background: '#ecfdf5', color: '#059669' }}>
                                <CheckCircle2 size={28} />
                            </div>
                            <div className="kpi-content">
                                <h4>A Vencer (Saudável)</h4>
                                <h2>{formatCurrency(agingData.find(d => d.name === 'A Vencer')?.value || 0)}</h2>
                            </div>
                        </div>

                        <div className="kpi-card">
                            <div className="kpi-icon" style={{ background: '#fef3c7', color: '#d97706' }}>
                                <ShieldAlert size={28} />
                            </div>
                            <div className="kpi-content">
                                <div>
                                    <h4>Risco Crítico (&gt; 90 dias)</h4>
                                </div>
                                <h2 style={{ color: '#d97706' }}>
                                    {formatCurrency(agingData.find(d => d.name === 'Mais de 90 dias')?.value || 0)}
                                </h2>
                                <span style={{
                                    display: 'inline-block', marginTop: '0.25rem', padding: '0.15rem 0.6rem',
                                    borderRadius: '2rem', fontSize: '0.75rem', fontWeight: 700,
                                    background: 'var(--surface-hover)',
                                    color: 'var(--text-muted)'
                                }}>
                                    Taxa Inadimplência: {percentVencido.toFixed(1)}%
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="charts-grid" style={{ gridTemplateColumns: 'minmax(350px, 1fr) 2fr', marginBottom: '2rem' }}>
                        <div className="chart-container">
                            <h3>Idade da Dívida e Atrasos</h3>
                            <div style={{ height: '250px', marginTop: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                {agingData.length > 0 ? (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie
                                                data={agingData}
                                                cx="50%" cy="50%"
                                                innerRadius={65} outerRadius={90}
                                                paddingAngle={4}
                                                dataKey="value" stroke="none"
                                                label={({ percent }) => (percent || 0) > 0.05 ? `${((percent || 0) * 100).toFixed(0)}%` : ''}
                                                labelLine={false}
                                            >
                                                {agingData.map((_entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={AGING_COLORS[index % AGING_COLORS.length]} />
                                                ))}
                                            </Pie>
                                            <Tooltip formatter={(value: any) => formatCurrency(Number(value))} contentStyle={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)', borderRadius: '12px', color: 'var(--text-main)' }} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <div style={{ color: 'var(--text-muted)' }}>Sem dados</div>
                                )}
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', justifyContent: 'center', marginTop: '1rem' }}>
                                {agingData.map((d, i) => (
                                    <div key={d.name} style={{ display: 'flex', alignItems: 'center', fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                                        <div style={{ width: '10px', height: '10px', borderRadius: '50%', marginRight: '6px', backgroundColor: AGING_COLORS[i % AGING_COLORS.length] }}></div>
                                        {d.name}
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="chart-container" style={{ padding: 0, display: 'flex', flexDirection: 'column' }}>
                            <div style={{ padding: '1.75rem', borderBottom: '1px solid var(--border)' }}>
                                <h3 style={{ marginBottom: 0 }}>Maiores Devedores por Grupo (Top 15)</h3>
                                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>Visão total consolidada.</p>
                            </div>
                            <div style={{ flex: 1, overflowY: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                                    <thead style={{ position: 'sticky', top: 0, backgroundColor: 'var(--surface)', backdropFilter: 'blur(10px)', zIndex: 10 }}>
                                        <tr>
                                            <th style={{ padding: '1rem 1.75rem', borderBottom: '1px solid var(--border)', color: 'var(--text-muted)', fontSize: '0.85rem' }}>Devedor / Grupo Econômico</th>
                                            <th style={{ padding: '1rem 1.75rem', borderBottom: '1px solid var(--border)', color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'right' }}>Dívida Existente</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {topDevedores.map((dev, idx) => (
                                            <tr key={idx} style={{ borderBottom: '1px solid var(--border)' }}>
                                                <td style={{ padding: '1rem 1.75rem', color: 'var(--text-main)', fontSize: '0.95rem', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                                    {dev.cliente.includes('(Grupo)') ? (
                                                        <span style={{ background: '#e0e7ff', color: '#4f46e5', fontSize: '0.7rem', padding: '0.25rem 0.5rem', borderRadius: '0.3rem', fontWeight: 700, letterSpacing: '0.05em' }}>GRUPO</span>
                                                    ) : (
                                                        <span style={{ background: 'var(--surface-hover)', color: 'var(--text-muted)', fontSize: '0.7rem', padding: '0.25rem 0.5rem', borderRadius: '0.3rem', fontWeight: 700, letterSpacing: '0.05em' }}>CLIENTE</span>
                                                    )}
                                                    {dev.cliente.replace(' (Grupo)', '')}
                                                </td>
                                                <td style={{ padding: '1rem 1.75rem', textAlign: 'right' }}>
                                                    <div style={{ color: 'var(--text-main)', fontSize: '1rem', fontWeight: 600, marginBottom: '0.5rem' }}>{formatCurrency(dev.valorDevido)}</div>
                                                    <div style={{ width: '100%', backgroundColor: 'var(--surface-hover)', height: '6px', borderRadius: '100px', overflow: 'hidden', display: 'flex', justifyContent: 'flex-end' }}>
                                                        <div
                                                            style={{
                                                                backgroundColor: idx < 3 ? '#e11d48' : '#d97706',
                                                                height: '100%',
                                                                borderRadius: '100px',
                                                                width: `${Math.min((dev.valorDevido / (topDevedores[0]?.valorDevido || 1)) * 100, 100)}%`
                                                            }}
                                                        ></div>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                        {topDevedores.length === 0 && (
                                            <tr>
                                                <td colSpan={2} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                                                    Nenhum risco detectado. Importe o fechamento via painel de Importação.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default Inadimplencia;
