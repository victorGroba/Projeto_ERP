import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
    Zap, CheckCircle2, AlertCircle, Loader2,
    ExternalLink, Key, RefreshCw, Copy, Check,
    ShieldCheck, Database, ArrowRight
} from 'lucide-react';
import './Dashboard.css';

const API = '';

const fmt = (v: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v);

const Configuracoes: React.FC = () => {
    const [status, setStatus] = useState<{ connected: boolean; updatedAt: string | null } | null>(null);
    const [auditData, setAuditData] = useState<any>(null);
    const [auditLoading, setAuditLoading] = useState(false);
    const [authUrl, setAuthUrl] = useState('');
    const [code, setCode] = useState('');
    const [step, setStep] = useState<'idle' | 'waiting_code' | 'exchanging' | 'done' | 'error'>('idle');
    const [message, setMessage] = useState('');
    const [copied, setCopied] = useState(false);

    useEffect(() => { fetchStatus(); }, []);

    const fetchStatus = async () => {
        try {
            const res = await axios.get(`${API}/api/oauth/status`);
            setStatus(res.data);
        } catch { setStatus({ connected: false, updatedAt: null }); }
    };

    const handleConnect = async () => {
        try {
            const res = await axios.get(`${API}/api/oauth/url`);
            setAuthUrl(res.data.url);
            setStep('waiting_code');
            // Tenta abrir automaticamente; se for bloqueado (preview/sandbox),
            // o usuário usa o link/botão de copiar que aparece no passo 1.
            try { window.open(res.data.url, '_blank', 'noopener'); } catch { /* bloqueado — ok */ }
        } catch {
            setStep('error');
            setMessage('Erro ao gerar URL de autorização.');
        }
    };

    const handleCopyUrl = async () => {
        await navigator.clipboard.writeText(authUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleExchange = async () => {
        const cleanCode = code.trim();
        if (!cleanCode) return;
        setStep('exchanging');
        try {
            const res = await axios.post(`${API}/api/oauth/exchange`, { code: cleanCode });
            setMessage(res.data.message);
            setStep('done');
            setCode('');
            setAuthUrl('');
            await fetchStatus();
        } catch (err: any) {
            setMessage(err.response?.data?.error || 'Falha ao trocar o código.');
            setStep('error');
        }
    };

    const handleReset = () => {
        setStep('idle');
        setCode('');
        setAuthUrl('');
        setMessage('');
    };

    const fmtDate = (d: string | null) => d
        ? new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
        : '—';

    return (
        <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: 640 }}>

            <div>
                <h2 style={{ fontSize: '1.375rem', fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--text-main)' }}>Configurações</h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
                    Gerencie a conexão com a API do Conta Azul.
                </p>
            </div>

            {/* Status da conexão */}
            <div style={{
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius-lg)', padding: '1.5rem',
                boxShadow: 'var(--shadow-sm)',
            }}>
                <h3 style={{ fontSize: '0.9375rem', fontWeight: 600, marginBottom: '1.25rem', color: 'var(--text-main)' }}>
                    Conta Azul — API v2
                </h3>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.875rem 1rem', background: 'var(--background)', borderRadius: 'var(--radius-md)', marginBottom: '1.25rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        {status?.connected
                            ? <CheckCircle2 size={18} color="#059669" />
                            : <AlertCircle size={18} color="#d97706" />
                        }
                        <div>
                            <div style={{ fontSize: '0.875rem', fontWeight: 600, color: status?.connected ? '#059669' : '#d97706' }}>
                                {status?.connected ? 'Conectado' : 'Não conectado'}
                            </div>
                            {status?.updatedAt && (
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-subtle)', marginTop: 2 }}>
                                    Tokens salvos em: {fmtDate(status.updatedAt)}
                                </div>
                            )}
                        </div>
                    </div>
                    <button
                        onClick={fetchStatus}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}
                        title="Verificar status"
                    >
                        <RefreshCw size={14} />
                    </button>
                </div>

                {/* Fluxo de autorização */}
                {step === 'idle' && (
                    <button
                        onClick={handleConnect}
                        style={{
                            width: '100%', padding: '0.875rem', borderRadius: 'var(--radius-md)',
                            background: '#2563eb', color: '#fff', fontWeight: 600, fontSize: '0.9375rem',
                            border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center',
                            justifyContent: 'center', gap: '0.5rem',
                            boxShadow: '0 4px 12px rgba(37,99,235,0.35)',
                        }}
                    >
                        <Zap size={16} />
                        {status?.connected ? 'Reconectar Conta Azul' : 'Conectar Conta Azul'}
                    </button>
                )}

                {step === 'waiting_code' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <div style={{ padding: '1rem', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 'var(--radius-md)' }}>
                            <p style={{ fontSize: '0.875rem', color: '#1e40af', fontWeight: 600, marginBottom: '0.5rem' }}>
                                Passo 1 — Abra o link de autenticação
                            </p>
                            <p style={{ fontSize: '0.8125rem', color: '#3b82f6', lineHeight: 1.5 }}>
                                Clique no botão abaixo (abre em nova aba). Faça login no Conta Azul. Você será
                                redirecionado para <strong>contaazul.com?code=XXXXXX</strong> — copie o valor do <code>code</code>.
                            </p>
                        </div>

                        {/* Botão grande de abrir + copiar (funciona mesmo se popup foi bloqueado) */}
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <a
                                href={authUrl}
                                target="_blank"
                                rel="noreferrer"
                                style={{
                                    flex: 1, padding: '0.75rem', borderRadius: 'var(--radius-md)',
                                    background: '#2563eb', color: '#fff', fontWeight: 600, fontSize: '0.875rem',
                                    textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                                }}
                            >
                                <ExternalLink size={15} /> Abrir login do Conta Azul
                            </a>
                            <button
                                onClick={handleCopyUrl}
                                style={{
                                    padding: '0.75rem 1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)',
                                    background: 'var(--background)', color: 'var(--text-muted)', cursor: 'pointer',
                                    fontWeight: 600, fontSize: '0.8125rem', display: 'flex', alignItems: 'center', gap: '0.375rem',
                                }}
                            >
                                {copied ? <><Check size={14} /> Copiado</> : <><Copy size={14} /> Copiar URL</>}
                            </button>
                        </div>
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-subtle)', margin: 0 }}>
                            Se o botão não abrir (preview/sandbox), use "Copiar URL" e cole numa nova aba do navegador.
                        </p>

                        <div>
                            <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '0.375rem' }}>
                                Passo 2 — Cole o code aqui:
                            </label>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <input
                                    value={code}
                                    onChange={e => setCode(e.target.value)}
                                    placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                                    style={{
                                        flex: 1, padding: '0.625rem 0.875rem', border: '1px solid var(--border)',
                                        borderRadius: 'var(--radius-sm)', fontSize: '0.8125rem',
                                        background: 'var(--surface)', color: 'var(--text-main)', outline: 'none',
                                        fontFamily: 'monospace',
                                    }}
                                    onKeyDown={e => e.key === 'Enter' && code.trim() && handleExchange()}
                                    autoFocus
                                />
                                <button
                                    onClick={handleExchange}
                                    disabled={!code.trim()}
                                    style={{
                                        padding: '0.625rem 1.25rem', borderRadius: 'var(--radius-sm)',
                                        background: code.trim() ? '#2563eb' : 'var(--background)',
                                        color: code.trim() ? '#fff' : 'var(--text-muted)',
                                        border: code.trim() ? 'none' : '1px solid var(--border)',
                                        fontWeight: 600, fontSize: '0.875rem', cursor: code.trim() ? 'pointer' : 'not-allowed',
                                        display: 'flex', alignItems: 'center', gap: '0.375rem',
                                    }}
                                >
                                    <Key size={14} /> Confirmar
                                </button>
                            </div>
                        </div>

                        <button onClick={handleReset} style={{ background: 'none', border: 'none', color: 'var(--text-subtle)', cursor: 'pointer', fontSize: '0.8125rem', padding: 0, textAlign: 'left' }}>
                            Cancelar
                        </button>
                    </div>
                )}

                {step === 'exchanging' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '1rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                        <Loader2 size={18} className="animate-spin" />
                        Trocando código por tokens...
                    </div>
                )}

                {step === 'done' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '1rem', background: '#f0fdf4', border: '1px solid #a7f3d0', borderRadius: 'var(--radius-md)' }}>
                            <CheckCircle2 size={20} color="#059669" />
                            <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#059669' }}>{message}</span>
                        </div>
                        <button onClick={handleReset} style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: '0.8125rem', fontWeight: 500, padding: 0, textAlign: 'left' }}>
                            Reconectar outra conta
                        </button>
                    </div>
                )}

                {step === 'error' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', padding: '1rem', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 'var(--radius-md)' }}>
                            <AlertCircle size={18} color="#dc2626" style={{ flexShrink: 0, marginTop: 1 }} />
                            <span style={{ fontSize: '0.875rem', color: '#dc2626' }}>{message}</span>
                        </div>
                        <button onClick={handleReset} style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: '0.8125rem', fontWeight: 500, padding: 0 }}>
                            Tentar novamente
                        </button>
                    </div>
                )}
            </div>

            {/* Info tokens */}
            <div style={{ padding: '1rem 1.25rem', background: 'var(--background)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: '0.8125rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
                <strong style={{ color: 'var(--text-main)' }}>Sobre os tokens:</strong> o Access Token expira em 1h e é renovado automaticamente.
                O Refresh Token dura semanas em apps de produção. No app de desenvolvimento atual pode ser necessário reconectar após alguns dias.
            </div>

            {/* ── Auditoria de Dados ── */}
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '1.5rem', boxShadow: 'var(--shadow-sm)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <ShieldCheck size={20} color="#2563eb" />
                        <div>
                            <h3 style={{ fontSize: '0.9375rem', fontWeight: 600, margin: 0, color: 'var(--text-main)' }}>Auditoria de Dados</h3>
                            <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', margin: '0.2rem 0 0' }}>
                                Compara o banco local com a API Conta Azul em tempo real
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={async () => {
                            setAuditLoading(true);
                            try {
                                const r = await axios.get(`${API}/api/audit/comparar?year=${new Date().getFullYear()}`);
                                setAuditData(r.data.data);
                            } catch { setAuditData(null); }
                            finally { setAuditLoading(false); }
                        }}
                        disabled={auditLoading}
                        style={{
                            padding: '0.5rem 1rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)',
                            background: 'var(--background)', cursor: auditLoading ? 'not-allowed' : 'pointer',
                            fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-muted)',
                            display: 'flex', alignItems: 'center', gap: '0.375rem',
                        }}
                    >
                        {auditLoading ? <><Loader2 size={14} className="animate-spin" /> Verificando...</> : <><RefreshCw size={14} /> Verificar Agora</>}
                    </button>
                </div>

                {!auditData && !auditLoading && (
                    <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem', background: 'var(--background)', borderRadius: 'var(--radius-md)' }}>
                        Clique em "Verificar Agora" para comparar os dados do banco com a API Conta Azul.
                    </div>
                )}

                {auditData && (() => {
                    const ano = auditData.ano;
                    const sync = auditData.ultimaSincronizacao
                        ? new Date(auditData.ultimaSincronizacao).toLocaleString('pt-BR')
                        : '—';

                    const linhas = [
                        {
                            label: 'Contas a Receber',
                            icon: <Database size={14} />,
                            banco: auditData.receitas.banco.registros,
                            api: auditData.receitas.api.registros,
                            confere: auditData.receitas.confere,
                            totalBanco: auditData.receitas.banco.total,
                            sublinhas: auditData.receitas.banco.porStatus?.map((s: any) => ({
                                label: s.status,
                                banco: `${s.registros} reg. — ${fmt(s.total)}`,
                            })),
                        },
                        {
                            label: 'Contas a Pagar (Despesas)',
                            icon: <Database size={14} />,
                            banco: auditData.despesas.banco.registros,
                            api: auditData.despesas.api.registros,
                            confere: auditData.despesas.confere,
                            totalBanco: auditData.despesas.banco.total,
                        },
                    ];

                    return (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
                            {/* Meta */}
                            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                                {[
                                    { label: 'Ano verificado', value: String(ano) },
                                    { label: 'Fonte', value: 'api-v2.contaazul.com' },
                                    { label: 'Última sincronização', value: sync },
                                ].map(m => (
                                    <div key={m.label} style={{ padding: '0.625rem 1rem', background: 'var(--background)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', flex: '1 1 160px' }}>
                                        <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-subtle)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{m.label}</div>
                                        <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-main)', marginTop: 2 }}>{m.value}</div>
                                    </div>
                                ))}
                            </div>

                            {/* Comparação linha a linha */}
                            {linhas.map(l => (
                                <div key={l.label} style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                                    {/* Header */}
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px 120px 80px', padding: '0.75rem 1rem', background: 'var(--background)', gap: '0.5rem', alignItems: 'center' }}>
                                        <span style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            {l.icon} {l.label}
                                        </span>
                                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', textAlign: 'right' }}>Banco local</span>
                                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', textAlign: 'right' }}>API (live)</span>
                                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', textAlign: 'right' }}>Status</span>
                                    </div>
                                    {/* Registros */}
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px 120px 80px', padding: '0.625rem 1rem', background: 'var(--surface)', gap: '0.5rem', alignItems: 'center', borderTop: '1px solid var(--border)' }}>
                                        <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Nº de registros</span>
                                        <span style={{ textAlign: 'right', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-main)' }}>{l.banco.toLocaleString('pt-BR')}</span>
                                        <span style={{ textAlign: 'right', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-main)' }}>
                                            {l.api !== null ? l.api.toLocaleString('pt-BR') : '—'}
                                        </span>
                                        <span style={{ textAlign: 'right' }}>
                                            {l.confere === true  && <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#059669' }}>✓ Igual</span>}
                                            {l.confere === false && <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#dc2626' }}>✗ Difere</span>}
                                            {l.confere === null  && <span style={{ fontSize: '0.8125rem', color: 'var(--text-subtle)' }}>—</span>}
                                        </span>
                                    </div>
                                    {/* Total */}
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px 120px 80px', padding: '0.625rem 1rem', background: 'var(--surface)', gap: '0.5rem', alignItems: 'center', borderTop: '1px solid var(--border)' }}>
                                        <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Valor total no banco</span>
                                        <span style={{ textAlign: 'right', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-main)' }}>{fmt(l.totalBanco)}</span>
                                        <span style={{ textAlign: 'right', fontSize: '0.8125rem', color: 'var(--text-subtle)' }}>N/D*</span>
                                        <span />
                                    </div>
                                    {/* Sublinhas (status breakdown) */}
                                    {l.sublinhas?.map((s: any) => (
                                        <div key={s.label} style={{ display: 'grid', gridTemplateColumns: '1fr 240px 80px', padding: '0.4rem 1rem 0.4rem 2rem', background: '#fafafa', gap: '0.5rem', borderTop: '1px solid var(--border)', alignItems: 'center' }}>
                                            <span style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                                <ArrowRight size={11} /> {s.label}
                                            </span>
                                            <span style={{ textAlign: 'right', fontSize: '0.8rem', color: 'var(--text-main)' }}>{s.banco}</span>
                                        </div>
                                    ))}
                                </div>
                            ))}

                            <p style={{ fontSize: '0.75rem', color: 'var(--text-subtle)', margin: 0 }}>
                                * A API Conta Azul não retorna totais de valor em uma única chamada; só o número de registros é comparado em tempo real.
                                Para verificar os valores, siga o guia abaixo.
                            </p>
                        </div>
                    );
                })()}
            </div>

            {/* ── Guia de verificação manual ── */}
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '1.5rem', boxShadow: 'var(--shadow-sm)' }}>
                <h3 style={{ fontSize: '0.9375rem', fontWeight: 600, marginBottom: '1rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <ArrowRight size={16} color="#2563eb" /> Como verificar manualmente no Conta Azul
                </h3>
                {[
                    {
                        modulo: 'Inadimplência / Contas a Receber',
                        passos: [
                            'No Conta Azul → aba "Financeiro" → "Contas a Receber"',
                            'Selecione o filtro "A receber" e o ano desejado (ex: 2026)',
                            'Compare: Vencidos, A Vencer e Recebidos com os KPIs da tela de Inadimplência',
                        ],
                    },
                    {
                        modulo: 'Custos & Despesas',
                        passos: [
                            'No Conta Azul → "Financeiro" → "Contas a Pagar"',
                            'Filtre por "Pagas" + ano desejado',
                            'O total deve corresponder ao "Total Acumulado" na tela de Custos & Despesas',
                        ],
                    },
                    {
                        modulo: 'Detalhamento por Centro de Custo',
                        passos: [
                            'No Conta Azul → "Relatórios" → "DRE" ou "Despesas por Centro de Custo"',
                            'Filtre pelo ano e por um centro específico (ex: Administrativo)',
                            'Compare as categorias (Salários, INSS, etc.) com o accordion na tela de Custos',
                        ],
                    },
                ].map(g => (
                    <div key={g.modulo} style={{ marginBottom: '1rem', padding: '0.875rem', background: 'var(--background)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                        <div style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '0.5rem' }}>{g.modulo}</div>
                        <ol style={{ paddingLeft: '1.25rem', margin: 0 }}>
                            {g.passos.map((p, i) => (
                                <li key={i} style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>{p}</li>
                            ))}
                        </ol>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default Configuracoes;
