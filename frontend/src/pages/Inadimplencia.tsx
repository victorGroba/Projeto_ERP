import React, { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import { AuthContext } from '../context/AuthContext';
import {
    ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
    PieChart, Pie, Cell, Legend, BarChart, Bar
} from 'recharts';
import { Filter, DollarSign, AlertCircle, TrendingUp, Clock } from 'lucide-react';
import './Inadimplencia.css';

interface InadimplenciaOverview {
    totalFaturado: number;
    totalRecebido: number;
    totalEmAberto: number;
    detalheEmAberto: {
        vencido: number;
        aVencer: number;
    }
}

interface InadimplenciaComposicao {
    composicao: Array<{ nome: string; total: number; isGroup: boolean }>;
}

interface InadimplenciaEvolution {
    evolution: Array<{ data: string; Vencido: number; AVencer: number }>;
}

export const Inadimplencia = () => {
    const { token } = useContext(AuthContext);
    const storedToken = localStorage.getItem('@ContaAzul:token') || token;

    const [year, setYear] = useState('2025');
    const [overview, setOverview] = useState<InadimplenciaOverview | null>(null);
    const [composicao, setComposicao] = useState<InadimplenciaComposicao | null>(null);
    const [evolution, setEvolution] = useState<InadimplenciaEvolution | null>(null);
    const [loading, setLoading] = useState(true);

    const formatterBRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
    const COLORS = ['#ef4444', '#f97316', '#eab308', '#8b5cf6', '#3b82f6', '#10b981', '#14b8a6', '#64748b', '#94a3b8', '#cbd5e1', '#f1f5f9'];

    useEffect(() => {
        const fetchData = async () => {
            if (!storedToken) return;
            setLoading(true);
            try {
                const config = { headers: { Authorization: `Bearer ${storedToken}` } };
                const qs = `?year=${year}`;

                const [res1, res2, res3] = await Promise.all([
                    axios.get(`http://localhost:3001/api/inadimplencia/overview${qs}`, config),
                    axios.get(`http://localhost:3001/api/inadimplencia/composition${qs}`, config),
                    axios.get(`http://localhost:3001/api/inadimplencia/evolution${qs}`, config)
                ]);

                setOverview(res1.data);
                setComposicao(res2.data);
                setEvolution(res3.data);
            } catch (error) {
                console.error("Erro ao buscar dados de inadimplência:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [year, storedToken]);

    if (loading) {
        return (
            <div className="inadimplencia-container">
                <div className="loading-state">
                    <div className="spinner"></div>
                    <p>Processando Matriz de Inadimplência...</p>
                </div>
            </div>
        );
    }

    // Pie chart Data (Composição)
    const pieData = composicao?.composicao.map((item, index) => ({
        name: item.nome,
        value: item.total,
        color: COLORS[index % COLORS.length]
    })) || [];

    // Formatter para tooltip
    const renderTooltipContent = (props: any) => {
        const { payload } = props;
        if (payload && payload.length) {
            return (
                <div style={{ background: 'rgba(15,23,42,0.9)', padding: '10px 15px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)' }}>
                    <p style={{ margin: 0, fontWeight: 700, color: '#f8fafc', marginBottom: '5px' }}>{payload[0].payload.name || payload[0].payload.data}</p>
                    {payload.map((entry: any, index: number) => (
                        <p key={index} style={{ margin: 0, color: entry.color || entry.stroke || '#94a3b8', fontSize: '0.9rem' }}>
                            {entry.name}: {formatterBRL.format(entry.value)}
                        </p>
                    ))}
                </div>
            );
        }
        return null;
    };

    return (
        <div className="inadimplencia-container">
            <header className="inadimplencia-header">
                <h2>Gestão de Inadimplência</h2>
                <div className="filter-controls">
                    <div style={{ position: 'relative' }}>
                        <Filter size={16} style={{ position: 'absolute', left: 12, top: 12, color: '#94a3b8' }} />
                        <select
                            className="filter-select"
                            value={year}
                            onChange={(e) => setYear(e.target.value)}
                            style={{ paddingLeft: '2.2rem' }}
                        >
                            <option value="2026">2026</option>
                            <option value="2025">2025</option>
                            <option value="2024">2024</option>
                        </select>
                    </div>
                </div>
            </header>

            <div className="kpi-grid">
                <div className="kpi-card">
                    <div className="kpi-icon-wrapper primary"><DollarSign size={24} /></div>
                    <div className="kpi-title">Faturamento Total Bruto</div>
                    <div className="kpi-value">{formatterBRL.format(overview?.totalFaturado || 0)}</div>
                    <div className="kpi-subtitle">Emitido no ano referenciado</div>
                </div>

                <div className="kpi-card">
                    <div className="kpi-icon-wrapper success"><TrendingUp size={24} /></div>
                    <div className="kpi-title">Recebido Liquidado</div>
                    <div className="kpi-value">{formatterBRL.format(overview?.totalRecebido || 0)}</div>
                    <div className="kpi-subtitle">
                        <span className="positive">{overview?.totalFaturado ? Math.round((overview.totalRecebido! / overview.totalFaturado!) * 100) : 0}%</span>
                        do Faturado
                    </div>
                </div>

                <div className="kpi-card alert">
                    <div className="kpi-icon-wrapper warning"><AlertCircle size={24} /></div>
                    <div className="kpi-title">Total Vencido em Aberto</div>
                    <div className="kpi-value">{formatterBRL.format(overview?.detalheEmAberto.vencido || 0)}</div>
                    <div className="kpi-subtitle">
                        <span className="negative">{overview?.totalFaturado ? Math.round((overview.detalheEmAberto.vencido! / overview.totalFaturado!) * 100) : 0}%</span>
                        Representatividade da Dívida Real
                    </div>
                </div>

                <div className="kpi-card">
                    <div className="kpi-icon-wrapper" style={{ background: 'rgba(94, 234, 212, 0.2)', color: '#2dd4bf', border: '1px solid rgba(94, 234, 212, 0.3)' }}>
                        <Clock size={24} />
                    </div>
                    <div className="kpi-title">A Vencer (Fluxo Futuro)</div>
                    <div className="kpi-value">{formatterBRL.format(overview?.detalheEmAberto.aVencer || 0)}</div>
                    <div className="kpi-subtitle">Provisão de Entradas</div>
                </div>
            </div>

            <div className="charts-grid">
                <div className="chart-container" style={{ gridColumn: '1 / -1' }}>
                    <div className="chart-header">
                        <div className="chart-title-group">
                            <h3>Evolução Semanal do Contas a Receber</h3>
                            <p>Base construída através do registro de fotografias semanais sobre Vencimento e Inadimplência</p>
                        </div>
                    </div>
                    <div style={{ width: '100%', height: 350 }}>
                        <ResponsiveContainer>
                            <AreaChart data={evolution?.evolution || []} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                                <defs>
                                    <linearGradient id="colorVencido" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.5} />
                                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id="colorAVencer" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.5} />
                                        <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                                <XAxis
                                    dataKey="data"
                                    stroke="#94a3b8"
                                    tickFormatter={(val) => {
                                        const d = new Date(val);
                                        return `${d.getDate()}/${d.getMonth() + 1}`;
                                    }}
                                />
                                <YAxis stroke="#94a3b8" tickFormatter={(val: any) => `R$ ${(val / 1000).toFixed(0)}k`} />
                                <Tooltip content={renderTooltipContent} cursor={{ stroke: '#475569', strokeWidth: 1, strokeDasharray: '4 4' }} />
                                <Legend wrapperStyle={{ paddingTop: '20px' }} />
                                <Area type="monotone" dataKey="Vencido" stroke="#ef4444" fillOpacity={1} fill="url(#colorVencido)" />
                                <Area type="monotone" dataKey="AVencer" name="A Vencer" stroke="#8b5cf6" fillOpacity={1} fill="url(#colorAVencer)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="chart-container">
                    <div className="chart-header">
                        <div className="chart-title-group">
                            <h3>Composição da Inadimplência</h3>
                            <p>Peso Financeiro por Devedores Top 10</p>
                        </div>
                    </div>
                    <div style={{ width: '100%', height: 300 }}>
                        <ResponsiveContainer>
                            <PieChart>
                                <Pie
                                    data={pieData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={70}
                                    outerRadius={100}
                                    paddingAngle={3}
                                    dataKey="value"
                                    stroke="none"
                                >
                                    {pieData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Pie>
                                <Tooltip content={renderTooltipContent} />
                                <Legend layout="vertical" verticalAlign="middle" align="right"
                                    formatter={(value, entry: any) => <span style={{ color: '#cbd5e1', fontSize: '0.85rem' }}>{value}</span>}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="chart-container">
                    <div className="chart-header">
                        <div className="chart-title-group">
                            <h3>Concentração Percentual</h3>
                            <p>Proporção do Top 10 vs Restante da Carteira</p>
                        </div>
                    </div>
                    <div style={{ width: '100%', height: 300 }}>
                        <ResponsiveContainer>
                            <BarChart data={pieData} layout="vertical" margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={true} vertical={false} />
                                <XAxis type="number" stroke="#94a3b8" tickFormatter={(val: any) => `${(val / 1000).toFixed(0)}k`} />
                                <YAxis dataKey="name" type="category" stroke="#94a3b8" width={90} tick={{ fontSize: 11 }} />
                                <Tooltip content={renderTooltipContent} cursor={{ fill: '#334155', opacity: 0.4 }} />
                                <Bar dataKey="value" name="Dívida" radius={[0, 4, 4, 0]}>
                                    {pieData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>
        </div>
    );
};
