import React, { useEffect, useState } from 'react';
import axios from 'axios';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, Cell, Legend, PieChart, Pie
} from 'recharts';
import { DollarSign, TrendingUp, Users } from 'lucide-react';
import './Faturamento.css';

interface MonthlyEvolution { month: number; receitaBruta: number; monthName?: string; }
interface ClientMetric { nome: string; total: number; isGroup: boolean; }
interface FaturamentoMetrics { faturamentoAcumulado: number; monthlyEvolution: MonthlyEvolution[]; }
interface TopClientsMetrics { top5: ClientMetric[]; top20: ClientMetric[]; caudaLonga: ClientMetric[]; }
interface SegmentMetric { name: string; value: number; }

const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const COLORS = ['#818cf8', '#34d399', '#94a3b8'];

export const Faturamento = () => {
    const [metrics, setMetrics] = useState<FaturamentoMetrics | null>(null);
    const [mix, setMix] = useState<TopClientsMetrics | null>(null);
    const [segments, setSegments] = useState<SegmentMetric[]>([]);
    const [loading, setLoading] = useState(true);
    const [year, setYear] = useState('2025');

    useEffect(() => {
        const fetchData = async () => {
            try {
                const config = { headers: { Authorization: `Bearer ${localStorage.getItem('@ContaAzul:token')}` } };
                const [resEvolucao, resMix, resSeg] = await Promise.all([
                    axios.get(`http://localhost:3001/api/faturamento/metrics?year=${year}`, config),
                    axios.get(`http://localhost:3001/api/faturamento/top-clients?year=${year}`, config),
                    axios.get(`http://localhost:3001/api/faturamento/public-private?year=${year}`, config)
                ]);

                const formattedData = resEvolucao.data.monthlyEvolution.map((item: any) => ({
                    ...item, monthName: monthNames[item.month - 1]
                }));

                setMetrics({ ...resEvolucao.data, monthlyEvolution: formattedData });
                setMix(resMix.data);
                setSegments(resSeg.data.data);
            } catch (err) {
                console.error('Failed to load Faturamento', err);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [year]);

    if (loading) return <div className="loading-state">Carregando Faturamento...</div>;

    const formatterBRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
    const caudaLongaTotal = mix?.caudaLonga.reduce((acc, curr) => acc + curr.total, 0) || 0;

    const top5Total = mix?.top5.reduce((a, b) => a + b.total, 0) || 0;
    const composicaoData = [{
        name: 'Participação Top 5 vs Cauda Longa',
        Top5: top5Total,
        CaudaLonga: caudaLongaTotal
    }];

    return (
        <div className="module-page fade-in">
            <header className="page-header">
                <div>
                    <h2>Faturamento e Receita</h2>
                    <p>Análise de Evolução e Concentração de Receita Base (Valor Bruto)</p>
                </div>
                <select value={year} onChange={(e) => { setLoading(true); setYear(e.target.value); }} style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.08)', color: '#f8fafc', fontSize: '14px', cursor: 'pointer' }}>
                    <option value="2025">2025</option>
                    <option value="2026">2026</option>
                </select>
            </header>

            <div className="metrics-grid">
                <div className="kpi-card highlight">
                    <div className="kpi-icon">
                        <DollarSign size={24} color="#f8fafc" />
                    </div>
                    <div className="kpi-content">
                        <h4>Receita Bruta ({year})</h4>
                        <h2>{metrics ? formatterBRL.format(metrics.faturamentoAcumulado) : 'R$ 0,00'}</h2>
                    </div>
                </div>

                <div className="kpi-card">
                    <div className="kpi-icon">
                        <TrendingUp size={24} color="#34d399" />
                    </div>
                    <div className="kpi-content">
                        <h4>Média Mensal</h4>
                        <h2>{metrics ? formatterBRL.format(metrics.faturamentoAcumulado / 12) : 'R$ 0,00'}</h2>
                    </div>
                </div>

                <div className="kpi-card">
                    <div className="kpi-icon">
                        <Users size={24} color="#818cf8" />
                    </div>
                    <div className="kpi-content">
                        <h4>Cauda Longa (Acima de 10k)</h4>
                        <h2>{formatterBRL.format(caudaLongaTotal)}</h2>
                    </div>
                </div>
            </div>

            <div className="charts-grid">
                <div className="chart-container" style={{ gridColumn: '1 / -1' }}>
                    <h3>Evolução do Faturamento Anual</h3>
                    <div style={{ width: '100%', height: 350 }}>
                        <ResponsiveContainer>
                            <AreaChart data={metrics?.monthlyEvolution || []} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                                <defs>
                                    <linearGradient id="colorGross" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8} />
                                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                                <XAxis dataKey="monthName" stroke="#94a3b8" />
                                <YAxis stroke="#94a3b8" tickFormatter={(val: any) => `R$ ${(val / 1000).toFixed(0)}k`} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#f8fafc' }}
                                    formatter={(val: any) => formatterBRL.format(Number(val))}
                                    labelStyle={{ color: '#94a3b8' }}
                                />
                                <Area type="monotone" dataKey="receitaBruta" name="Receita Bruta" stroke="#3b82f6" fillOpacity={1} fill="url(#colorGross)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="chart-container">
                    <h3>Top 5 Clientes / Grupos</h3>
                    <div style={{ width: '100%', height: 300 }}>
                        <ResponsiveContainer>
                            <BarChart data={mix?.top5 || []} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={true} vertical={false} />
                                <XAxis type="number" stroke="#94a3b8" tickFormatter={(val: any) => `${(val / 1000).toFixed(0)}k`} />
                                <YAxis dataKey="nome" type="category" stroke="#94a3b8" width={100} tick={{ fontSize: 12 }} />
                                <Tooltip
                                    cursor={{ fill: '#334155', opacity: 0.4 }}
                                    contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#f8fafc' }}
                                    formatter={(val: any) => formatterBRL.format(Number(val))}
                                />
                                <Bar dataKey="total" name="Faturamento" radius={[0, 4, 4, 0]}>
                                    {mix?.top5.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.isGroup ? '#8b5cf6' : '#38bdf8'} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="chart-container">
                    <h3>Composição Receita (Top 5 vs Cauda Longa)</h3>
                    <div style={{ width: '100%', height: 300 }}>
                        <ResponsiveContainer>
                            <BarChart data={composicaoData} layout="vertical" margin={{ top: 40, right: 30, left: 20, bottom: 40 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} vertical={true} />
                                <XAxis type="number" hide />
                                <YAxis dataKey="name" type="category" hide />
                                <Tooltip
                                    cursor={{ fill: 'none' }}
                                    contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#f8fafc' }}
                                    formatter={(val: any) => formatterBRL.format(Number(val))}
                                />
                                <Legend verticalAlign="top" height={36} />
                                <Bar dataKey="Top5" name="Top 5 Clientes" stackId="a" fill="#3b82f6" radius={[4, 0, 0, 4]} barSize={60} />
                                <Bar dataKey="CaudaLonga" name="Cauda Longa (Demais)" stackId="a" fill="#6366f1" radius={[0, 4, 4, 0]} barSize={60} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="chart-container">
                    <h3>Público vs Privado</h3>
                    <div style={{ width: '100%', height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={segments}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={80}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {segments.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip formatter={(val: any) => formatterBRL.format(Number(val))} contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px' }} />
                                <Legend />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>
        </div>
    );
};
