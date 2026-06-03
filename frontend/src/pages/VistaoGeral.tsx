import React, { useEffect, useState } from 'react';
import axios from 'axios';
import {
    TrendingDown, AlertTriangle, Landmark, TrendingUp,
    ArrowUpRight, ArrowDownRight, Loader2, ChevronRight
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import './Dashboard.css';

const API = '';
const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v);
const fmtPct = (v: number) => `${v > 0 ? '+' : ''}${v.toFixed(1)}%`;

interface KPI {
    despesaAno: number;
    despesaMes: number;
    despesaAnterior: number;
    totalAtraso: number;
    riscoGrave: number;
    totalBancos: number;
    topDevedores: { cliente: string; valorDevido: number }[];
}

const VistaoGeral: React.FC = () => {
    const [kpi, setKpi] = useState<KPI | null>(null);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();
    const ano = new Date().getFullYear();
    const mesAtual = new Date().getMonth(); // 0-based

    useEffect(() => {
        Promise.all([
            axios.get(`${API}/api/dashboard/despesas/evolucao-mensal?year=${ano}`),
            axios.get(`${API}/api/dashboard/inadimplencia/aging`),
            axios.get(`${API}/api/dashboard/despesas/caixa-bancos?year=${ano}`),
        ]).then(([evolucao, aging, bancos]) => {
            const meses: any[] = evolucao.data.data || [];
            const despesaAno = meses.reduce((s: number, m: any) => s + (m.anoAtual || 0), 0);
            const despesaMes = meses[mesAtual]?.anoAtual || 0;
            const despesaAnterior = meses[mesAtual]?.anoAnterior || 0;

            const { totalAtraso, aging: agingBuckets, topDevedores } = aging.data;
            const riscoGrave = (agingBuckets?.mais_de_90 || 0);

            const recebido = (bancos.data.data || []).find((b: any) => b.name === 'Recebido')?.valor || 0;

            setKpi({ despesaAno, despesaMes, despesaAnterior, totalAtraso, riscoGrave, totalBancos: recebido, topDevedores: topDevedores?.slice(0, 6) || [] });
        }).catch(console.error).finally(() => setLoading(false));
    }, []);

    if (loading) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', gap: '0.625rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                <Loader2 size={18} className="animate-spin" /> Carregando indicadores...
            </div>
        );
    }

    if (!kpi) return null;

    const varMes = kpi.despesaAnterior > 0 ? ((kpi.despesaMes - kpi.despesaAnterior) / kpi.despesaAnterior) * 100 : 0;
    const mesNome = new Date(ano, mesAtual).toLocaleString('pt-BR', { month: 'long' });

    const kpiCards = [
        {
            icon: <TrendingDown size={18} color="#2563eb" />,
            label: `Despesa ${mesNome.charAt(0).toUpperCase() + mesNome.slice(1)}`,
            value: fmt(kpi.despesaMes),
            delta: varMes,
            deltaLabel: 'vs. mesmo mês em 2025',
            color: '#2563eb',
            bg: '#eff6ff',
            path: '/despesas',
        },
        {
            icon: <AlertTriangle size={18} color="#dc2626" />,
            label: 'Total Vencido em Atraso',
            value: fmt(kpi.totalAtraso),
            delta: null,
            deltaLabel: `Risco crítico (+90d): ${fmt(kpi.riscoGrave)}`,
            color: '#dc2626',
            bg: '#fef2f2',
            path: '/inadimplencia',
        },
        {
            icon: <Landmark size={18} color="#059669" />,
            label: `Recebido em ${ano}`,
            value: fmt(kpi.totalBancos),
            delta: null,
            deltaLabel: 'Total de receitas já recebidas',
            color: '#059669',
            bg: '#f0fdf4',
            path: '/evolucao',
        },
        {
            icon: <TrendingUp size={18} color="#7c3aed" />,
            label: `Despesa Acumulada ${ano}`,
            value: fmt(kpi.despesaAno),
            delta: null,
            deltaLabel: `Jan – ${mesNome.charAt(0).toUpperCase() + mesNome.slice(1)} de ${ano}`,
            color: '#7c3aed',
            bg: '#f5f3ff',
            path: '/despesas',
        },
    ];

    return (
        <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

            {/* Header */}
            <div>
                <h2 style={{ fontSize: '1.375rem', fontWeight: 700, color: 'var(--text-main)', letterSpacing: '-0.02em' }}>
                    Visão Geral
                </h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
                    Resumo financeiro · {new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
            </div>

            {/* KPI Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
                {kpiCards.map(card => (
                    <button
                        key={card.label}
                        onClick={() => navigate(card.path)}
                        style={{
                            background: 'var(--surface)', border: '1px solid var(--border)',
                            borderRadius: 'var(--radius-lg)', padding: '1.25rem',
                            textAlign: 'left', cursor: 'pointer', transition: 'box-shadow 0.15s',
                            boxShadow: 'var(--shadow-sm)',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.boxShadow = 'var(--shadow-md)')}
                        onMouseLeave={e => (e.currentTarget.style.boxShadow = 'var(--shadow-sm)')}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.875rem' }}>
                            <div style={{ width: 36, height: 36, borderRadius: 8, background: card.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                {card.icon}
                            </div>
                            {card.delta !== null && (
                                <span style={{
                                    display: 'flex', alignItems: 'center', gap: 3,
                                    fontSize: '0.75rem', fontWeight: 600,
                                    color: card.delta <= 0 ? '#059669' : '#dc2626',
                                    background: card.delta <= 0 ? '#f0fdf4' : '#fef2f2',
                                    padding: '0.2rem 0.5rem', borderRadius: '1rem',
                                }}>
                                    {card.delta <= 0
                                        ? <ArrowDownRight size={12} />
                                        : <ArrowUpRight size={12} />
                                    }
                                    {fmtPct(Math.abs(card.delta))}
                                </span>
                            )}
                        </div>
                        <div style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>
                            {card.label}
                        </div>
                        <div style={{ fontSize: '1.4375rem', fontWeight: 700, color: 'var(--text-main)', letterSpacing: '-0.025em', lineHeight: 1.1 }}>
                            {card.value}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-subtle)', marginTop: '0.375rem' }}>
                            {card.deltaLabel}
                        </div>
                    </button>
                ))}
            </div>

            {/* Bottom row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>

                {/* Top devedores */}
                <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '1.5rem', boxShadow: 'var(--shadow-sm)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                        <h3 style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-main)' }}>Maiores Devedores</h3>
                        <button onClick={() => navigate('/inadimplencia')} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.8125rem', color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500 }}>
                            Ver todos <ChevronRight size={14} />
                        </button>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                        {kpi.topDevedores.map((d, i) => {
                            const pct = kpi.totalAtraso > 0 ? (d.valorDevido / kpi.totalAtraso) * 100 : 0;
                            return (
                                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                    <span style={{ fontSize: '0.75rem', color: 'var(--text-subtle)', width: 16, textAlign: 'right', flexShrink: 0 }}>{i + 1}</span>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                            <span style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '60%' }}>{d.cliente}</span>
                                            <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#dc2626', flexShrink: 0 }}>{fmt(d.valorDevido)}</span>
                                        </div>
                                        <div style={{ height: 4, background: 'var(--background)', borderRadius: 2, overflow: 'hidden' }}>
                                            <div style={{ height: '100%', width: `${Math.min(pct, 100)}%`, background: i === 0 ? '#dc2626' : i <= 2 ? '#f97316' : '#fbbf24', borderRadius: 2 }} />
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Atalhos de módulos */}
                <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '1.5rem', boxShadow: 'var(--shadow-sm)' }}>
                    <h3 style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '1.25rem' }}>Módulos</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {[
                            { label: 'Risco e Inadimplência', desc: 'Aging, devedores e carteira de risco', path: '/inadimplencia', color: '#dc2626', bg: '#fef2f2' },
                            { label: 'Custos & Despesas', desc: 'Pareto por categoria e centro de custo', path: '/despesas', color: '#2563eb', bg: '#eff6ff' },
                            { label: 'Análise Avançada', desc: 'Evolução mensal, lucros e caixa', path: '/evolucao', color: '#7c3aed', bg: '#f5f3ff' },
                            { label: 'Sincronização', desc: 'Atualizar dados via API Conta Azul', path: '/importacao', color: '#059669', bg: '#f0fdf4' },
                        ].map(m => (
                            <button
                                key={m.path}
                                onClick={() => navigate(m.path)}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '0.75rem',
                                    padding: '0.75rem', borderRadius: 'var(--radius-md)',
                                    background: 'transparent', border: '1px solid var(--border)',
                                    cursor: 'pointer', textAlign: 'left', transition: 'background 0.15s',
                                }}
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

export default VistaoGeral;
