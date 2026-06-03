import React, { useState, useRef } from 'react';
import axios from 'axios';
import {
    RefreshCw, CheckCircle2, AlertCircle, Loader2,
    ArrowRight, Database, FileSpreadsheet, Zap, UploadCloud, ChevronDown, ChevronUp, History
} from 'lucide-react';
import './Dashboard.css';

const API = '';

const Importacao: React.FC = () => {
    // ── API Sync state ──────────────────────────────────────────────
    const [syncLoading, setSyncLoading] = useState<'incremental' | 'full' | null>(null);
    const [syncStatus, setSyncStatus] = useState<{
        type: 'success' | 'error' | null;
        message: string;
        details?: any;
    }>({ type: null, message: '' });
    const [lastSync, setLastSync] = useState<string | null>(null);

    // ── CSV state ───────────────────────────────────────────────────
    const [csvOpen, setCsvOpen] = useState(false);
    const [file, setFile] = useState<File | null>(null);
    const [tipo, setTipo] = useState<string>('DESPESAS');
    const [isDragging, setIsDragging] = useState(false);
    const [csvLoading, setCsvLoading] = useState(false);
    const [csvStatus, setCsvStatus] = useState<{ type: 'success' | 'error' | null; message: string; details?: string }>({ type: null, message: '' });
    const fileInputRef = useRef<HTMLInputElement>(null);

    // ── API Sync handlers ───────────────────────────────────────────
    const handleSync = async (mode: 'incremental' | 'full') => {
        setSyncLoading(mode);
        setSyncStatus({ type: null, message: '' });
        const endpoint = mode === 'full' ? `${API}/api/etl/sync/full` : `${API}/api/etl/sync`;
        try {
            const res = await axios.post(endpoint);
            setSyncStatus({ type: 'success', message: res.data.message, details: res.data.details });
            setLastSync(new Date().toLocaleString('pt-BR'));
        } catch (err: any) {
            setSyncStatus({ type: 'error', message: err.response?.data?.message || 'Falha na sincronização.' });
        } finally {
            setSyncLoading(null);
        }
    };

    // ── CSV handlers ────────────────────────────────────────────────
    const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
    const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); };
    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const f = e.dataTransfer.files?.[0];
        if (f && f.name.endsWith('.csv')) { setFile(f); setCsvStatus({ type: null, message: '' }); }
        else setCsvStatus({ type: 'error', message: 'Formato inválido. Envie um arquivo .CSV exportado do Conta Azul.' });
    };
    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files?.[0]) { setFile(e.target.files[0]); setCsvStatus({ type: null, message: '' }); }
    };
    const handleUpload = async () => {
        if (!file) return;
        setCsvLoading(true);
        setCsvStatus({ type: null, message: '' });
        const formData = new FormData();
        formData.append('file', file);
        formData.append('tipo', tipo);
        try {
            const res = await axios.post(`${API}/api/etl/upload`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            setCsvStatus({ type: 'success', message: 'Base Atualizada!', details: `${res.data.totalInserido} registros importados.` });
            setFile(null);
        } catch (err: any) {
            setCsvStatus({ type: 'error', message: 'Falha na Importação', details: err.response?.data?.error || 'Erro de comunicação.' });
        } finally {
            setCsvLoading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    return (
        <div className="module-page fade-in">

            {/* Header */}
            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem' }}>
                <div>
                    <h2 style={{ fontSize: '2rem', color: 'var(--text-main)', fontWeight: 800, margin: 0 }}>Sincronização de Dados</h2>
                    <p style={{ color: 'var(--text-muted)', marginTop: '0.5rem', fontSize: '1.1rem' }}>
                        Conecte diretamente ao Conta Azul ou importe via CSV como fallback.
                    </p>
                </div>
                <div style={{ padding: '0.75rem 1.25rem', background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.3)', borderRadius: '1rem', display: 'flex', alignItems: 'center', gap: '0.75rem', color: '#60a5fa' }}>
                    <Database size={20} />
                    <span style={{ fontWeight: 600 }}>Motor Online</span>
                </div>
            </header>

            {/* ── BLOCO PRINCIPAL: API Conta Azul ── */}
            <div className="chart-container" style={{ marginBottom: '2rem' }}>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div style={{ width: 48, height: 48, borderRadius: '1rem', background: 'rgba(59,130,246,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <Zap size={26} color="#60a5fa" />
                        </div>
                        <div>
                            <h3 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 700 }}>Sincronizar via API Conta Azul</h3>
                            <p style={{ margin: '0.25rem 0 0', color: 'var(--text-muted)', fontSize: '0.95rem' }}>
                                Puxa despesas, receitas e saldos bancários diretamente da sua conta.
                            </p>
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                        {/* Incremental — uso diário */}
                        <button
                            onClick={() => handleSync('incremental')}
                            disabled={!!syncLoading}
                            style={{
                                padding: '0.9rem 1.5rem', borderRadius: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.625rem',
                                background: syncLoading ? 'var(--background)' : '#2563eb',
                                color: syncLoading ? 'var(--text-muted)' : '#fff',
                                fontSize: '0.95rem', fontWeight: 600, cursor: syncLoading ? 'not-allowed' : 'pointer',
                                border: syncLoading ? '1px solid var(--border)' : 'none',
                                boxShadow: syncLoading ? 'none' : '0 4px 14px rgba(37,99,235,0.4)',
                                transition: 'all 0.3s', whiteSpace: 'nowrap',
                            }}
                        >
                            {syncLoading === 'incremental'
                                ? <><Loader2 size={16} className="animate-spin" /> Sincronizando...</>
                                : <><RefreshCw size={16} /> Atualizar (60 dias)</>
                            }
                        </button>
                        {/* Full — carga histórica */}
                        <button
                            onClick={() => handleSync('full')}
                            disabled={!!syncLoading}
                            title="Sincroniza 2 anos completos — pode levar alguns minutos"
                            style={{
                                padding: '0.9rem 1.5rem', borderRadius: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.625rem',
                                background: syncLoading ? 'var(--background)' : 'transparent',
                                color: syncLoading ? 'var(--text-muted)' : '#94a3b8',
                                fontSize: '0.95rem', fontWeight: 600, cursor: syncLoading ? 'not-allowed' : 'pointer',
                                border: `1px solid ${syncLoading ? 'var(--border)' : '#475569'}`,
                                transition: 'all 0.3s', whiteSpace: 'nowrap',
                            }}
                        >
                            {syncLoading === 'full'
                                ? <><Loader2 size={16} className="animate-spin" /> Carregando histórico...</>
                                : <><History size={16} /> Carga Completa (2 anos)</>
                            }
                        </button>
                    </div>
                </div>

                {/* Última sync */}
                {lastSync && (
                    <p style={{ color: '#64748b', fontSize: '0.85rem', marginTop: '1rem', marginBottom: 0 }}>
                        Última sincronização: <strong style={{ color: 'var(--text-muted)' }}>{lastSync}</strong>
                    </p>
                )}

                {/* Resultado */}
                {syncStatus.type && (
                    <div style={{
                        marginTop: '1.5rem', padding: '1.25rem', borderRadius: '0.875rem',
                        background: syncStatus.type === 'success' ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)',
                        border: `1px solid ${syncStatus.type === 'success' ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
                        display: 'flex', alignItems: 'flex-start', gap: '1rem',
                    }}>
                        {syncStatus.type === 'success'
                            ? <CheckCircle2 size={22} color="#34d399" style={{ flexShrink: 0, marginTop: 2 }} />
                            : <AlertCircle size={22} color="#f87171" style={{ flexShrink: 0, marginTop: 2 }} />
                        }
                        <div style={{ flex: 1 }}>
                            <p style={{ margin: 0, fontWeight: 600, color: syncStatus.type === 'success' ? '#34d399' : '#f87171' }}>
                                {syncStatus.message}
                            </p>
                            {syncStatus.details && (
                                <div style={{ display: 'flex', gap: '2rem', marginTop: '0.75rem', flexWrap: 'wrap' }}>
                                    {[
                                        { label: 'Despesas', value: syncStatus.details.despesas, color: '#f87171' },
                                        { label: 'Receitas', value: syncStatus.details.receitas, color: '#34d399' },
                                        { label: 'Saldos Bancários', value: syncStatus.details.saldos, color: '#60a5fa' },
                                    ].map(item => (
                                        <div key={item.label} style={{ textAlign: 'center' }}>
                                            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: item.color }}>{item.value}</div>
                                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 2 }}>{item.label}</div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* O que é sincronizado */}
                <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem', flexWrap: 'wrap' }}>
                    {[
                        { icon: <ArrowRight size={14} />, label: 'Contas a Pagar', desc: 'Despesas por categoria e centro de custo', color: '#f87171' },
                        { icon: <ArrowRight size={14} style={{ transform: 'scaleX(-1)' }} />, label: 'Contas a Receber', desc: 'Receitas e inadimplência', color: '#34d399' },
                        { icon: <Database size={14} />, label: 'Saldos Bancários', desc: 'BTG, XP, Itaú, Santander…', color: '#60a5fa' },
                    ].map(item => (
                        <div key={item.label} style={{
                            flex: '1 1 180px', padding: '0.875rem 1rem', background: 'var(--background)',
                            border: '1px solid var(--border)', borderRadius: '0.75rem',
                            display: 'flex', alignItems: 'flex-start', gap: '0.75rem',
                        }}>
                            <span style={{ color: item.color, marginTop: 2 }}>{item.icon}</span>
                            <div>
                                <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-main)' }}>{item.label}</div>
                                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 2 }}>{item.desc}</div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* ── BLOCO SECUNDÁRIO: CSV fallback (colapsável) ── */}
            <div className="chart-container" style={{ background: 'var(--background)' }}>
                <button
                    onClick={() => setCsvOpen(o => !o)}
                    style={{
                        width: '100%', background: 'none', border: 'none', cursor: 'pointer',
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        color: 'var(--text-muted)', padding: 0,
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <UploadCloud size={20} />
                        <span style={{ fontWeight: 600, fontSize: '1rem' }}>Importação via CSV (fallback)</span>
                        <span style={{ fontSize: '0.8rem', background: 'rgba(245,158,11,0.12)', color: '#fbbf24', padding: '0.2rem 0.6rem', borderRadius: '0.5rem', fontWeight: 600 }}>
                            Dados históricos
                        </span>
                    </div>
                    {csvOpen ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                </button>

                {csvOpen && (
                    <div style={{ marginTop: '1.5rem' }}>
                        <div className="charts-grid" style={{ gridTemplateColumns: '1.5fr 1fr' }}>

                            {/* Upload */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                                <div style={{ display: 'flex', gap: '1rem' }}>
                                    {[
                                        { key: 'DESPESAS', label: 'Saídas & Custos', desc: 'Planilha de Lançamentos Pagos', color: '#60a5fa' },
                                        { key: 'RECEITAS', label: 'Contas a Receber', desc: 'Planilha de Inadimplência', color: '#c084fc' },
                                    ].map(opt => (
                                        <button key={opt.key} onClick={() => setTipo(opt.key)} style={{
                                            flex: 1, padding: '1rem', borderRadius: '0.875rem', textAlign: 'left', cursor: 'pointer',
                                            background: tipo === opt.key ? `rgba(${opt.key === 'DESPESAS' ? '59,130,246' : '168,85,247'},0.08)` : 'var(--surface)',
                                            border: `1px solid ${tipo === opt.key ? opt.color + '80' : 'var(--border)'}`,
                                        }}>
                                            <div style={{ color: tipo === opt.key ? opt.color : '#94a3b8', fontWeight: 600, marginBottom: '0.25rem' }}>{opt.label}</div>
                                            <div style={{ color: '#64748b', fontSize: '0.85rem' }}>{opt.desc}</div>
                                        </button>
                                    ))}
                                </div>

                                <div
                                    onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}
                                    onClick={() => !csvLoading && fileInputRef.current?.click()}
                                    style={{
                                        minHeight: '200px', border: `2px dashed ${isDragging ? '#3b82f6' : 'var(--border)'}`,
                                        borderRadius: '0.875rem', background: isDragging ? 'rgba(59,130,246,0.05)' : 'var(--surface)',
                                        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                                        cursor: csvLoading ? 'not-allowed' : 'pointer', transition: 'all 0.3s',
                                    }}
                                >
                                    <input ref={fileInputRef} type="file" style={{ display: 'none' }} accept=".csv" onChange={handleFileSelect} disabled={csvLoading} />
                                    {file ? (
                                        <div style={{ textAlign: 'center' }}>
                                            <FileSpreadsheet size={40} color="#60a5fa" style={{ margin: '0 auto 0.75rem' }} />
                                            <div style={{ color: 'var(--text-main)', fontWeight: 600 }}>{file.name}</div>
                                            <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.25rem' }}>{(file.size / 1024).toFixed(1)} KB</div>
                                            <button onClick={e => { e.stopPropagation(); setFile(null); }} style={{ marginTop: '1rem', padding: '0.4rem 0.9rem', background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-main)', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.85rem' }}>
                                                Trocar
                                            </button>
                                        </div>
                                    ) : (
                                        <div style={{ textAlign: 'center' }}>
                                            <UploadCloud size={40} color="#64748b" style={{ margin: '0 auto 0.75rem' }} />
                                            <div style={{ color: 'var(--text-main)', fontWeight: 500 }}>Arraste seu CSV aqui</div>
                                            <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.25rem' }}>ou clique para procurar</div>
                                        </div>
                                    )}
                                </div>

                                {csvStatus.type && (
                                    <div style={{
                                        padding: '1rem', borderRadius: '0.75rem', display: 'flex', gap: '0.75rem',
                                        background: csvStatus.type === 'success' ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)',
                                        border: `1px solid ${csvStatus.type === 'success' ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
                                    }}>
                                        {csvStatus.type === 'success' ? <CheckCircle2 size={20} color="#34d399" /> : <AlertCircle size={20} color="#f87171" />}
                                        <div>
                                            <div style={{ fontWeight: 600, color: csvStatus.type === 'success' ? '#34d399' : '#f87171' }}>{csvStatus.message}</div>
                                            {csvStatus.details && <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.2rem' }}>{csvStatus.details}</div>}
                                        </div>
                                    </div>
                                )}

                                <button
                                    disabled={!file || csvLoading}
                                    onClick={handleUpload}
                                    style={{
                                        padding: '1rem', borderRadius: '0.875rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem',
                                        background: !file || csvLoading ? 'var(--background)' : '#2563eb',
                                        color: !file || csvLoading ? 'var(--text-muted)' : '#fff',
                                        fontSize: '1rem', fontWeight: 600, cursor: !file || csvLoading ? 'not-allowed' : 'pointer',
                                        border: !file || csvLoading ? '1px solid var(--border)' : 'none',
                                        boxShadow: !file || csvLoading ? 'none' : '0 4px 14px rgba(37,99,235,0.39)',
                                        transition: 'all 0.3s',
                                    }}
                                >
                                    {csvLoading ? <><Loader2 size={18} className="animate-spin" /> Importando...</> : 'Importar CSV'}
                                </button>
                            </div>

                            {/* Instruções CSV */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                {[
                                    { label: 'Contas a Receber', color: '#60a5fa', text: 'Exporte filtrando pendências "A Vencer/Vencidas". O sistema agrupa CNPJs pelo campo Grupo Econômico.' },
                                    { label: 'Lançamentos', color: '#c084fc', text: 'Exporte Saídas Liquidadas em múltiplos anos. A matriz agrupa Categoria × Centro de Custo mês a mês.' },
                                ].map(item => (
                                    <div key={item.label} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '0.875rem', padding: '1.25rem' }}>
                                        <div style={{ color: item.color, fontWeight: 600, fontSize: '0.95rem', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            <ArrowRight size={14} /> {item.label}
                                        </div>
                                        <p style={{ color: '#94a3b8', fontSize: '0.9rem', lineHeight: 1.6, margin: 0 }}>{item.text}</p>
                                    </div>
                                ))}
                                <div style={{ padding: '0.875rem 1rem', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: '0.875rem', display: 'flex', gap: '0.75rem' }}>
                                    <AlertCircle size={18} color="#fbbf24" style={{ flexShrink: 0, marginTop: 2 }} />
                                    <div>
                                        <div style={{ color: '#fbbf24', fontWeight: 600, fontSize: '0.85rem' }}>Carga total (Full Load)</div>
                                        <div style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginTop: '0.2rem', lineHeight: 1.5 }}>
                                            Cada importação substitui toda a base anterior do módulo.
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Importacao;
