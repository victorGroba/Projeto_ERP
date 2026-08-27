import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import {
    Loader2, Inbox, FileText, ChevronDown, ChevronRight,
    TrendingUp, Layers, Briefcase, Calculator,
    Upload, History, Trash2, CheckCircle2,
} from 'lucide-react';
import Delta from '../components/Delta';
import './Dashboard.css';
import '../styles/painel.css';
import './RelatorioAnual.css';

const fmt = (v: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

interface CatRow {
    categoria: string;
    totalAnterior: number;
    totalAtual: number;
    variacao: number | null;
}

interface CCBlock {
    nome: string;
    categorias: CatRow[];
    total: { totalAnterior: number; totalAtual: number; variacao: number | null };
}

interface CCGroup {
    centrosDeCusto: CCBlock[];
    total: { totalAnterior: number; totalAtual: number; variacao: number | null };
}

interface ReportData {
    anoAtual: number;
    anoAnterior: number;
    periodoAtual: { de: string; ate: string };
    periodoAnterior: { de: string; ate: string };
    entradas: { categorias: CatRow[]; total: { totalAnterior: number; totalAtual: number; variacao: number | null } };
    materiaisServicos: CCGroup;
    despesas: CCGroup;
    outros?: CCGroup;
    resultadoOperacional: { totalAnterior: number; totalAtual: number; variacao: number | null };
}

interface ImportRecord {
    id: string;
    tipo: string;
    arquivoNome: string | null;
    dataInicio: string | null;
    dataFim: string | null;
    qtdRegistros: number;
    createdAt: string;
}

const fmtDate = (iso: string | null) => {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const fmtDateTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const pad = (n: number) => String(n).padStart(2, '0');
const currentYear = new Date().getFullYear();
const currentMonth = new Date().getMonth(); // 0-indexed
const defaultDe = `${currentYear}-01-01`;
const defaultAte = `${currentYear}-${pad(currentMonth + 1)}-${pad(new Date(currentYear, currentMonth + 1, 0).getDate())}`;

const shiftYear = (dateStr: string, delta: number) => {
    const d = new Date(dateStr);
    d.setFullYear(d.getFullYear() + delta);
    return d.toISOString().split('T')[0];
};

const shortLabel = (de: string, ate: string) => {
    const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const [aD, mD] = de.split('-').map(Number);
    const [aA, mA] = ate.split('-').map(Number);
    if (mD === 1 && mA === 12) return `${aD}`;
    return `${MESES[mD - 1]}–${MESES[mA - 1]} ${aA}`;
};

const RelatorioAnual: React.FC = () => {
    const token = localStorage.getItem('@ContaAzul:token');

    const [de, setDe] = useState(defaultDe);
    const [ate, setAte] = useState(defaultAte);
    const [isLoading, setIsLoading] = useState(false);
    const [data, setData] = useState<ReportData | null>(null);

    const deAnterior = shiftYear(de, -1);
    const ateAnterior = shiftYear(ate, -1);
    const anoAtual = parseInt(de.split('-')[0]);
    const anoAnterior = anoAtual - 1;

    // Upload state
    const [uploadFile, setUploadFile] = useState<File | null>(null);
    const [uploadTipo, setUploadTipo] = useState<string>('ENTRADAS');
    const [uploadLoading, setUploadLoading] = useState(false);
    const [uploadMsg, setUploadMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    // Import history
    const [historico, setHistorico] = useState<ImportRecord[]>([]);
    const [showHistorico, setShowHistorico] = useState(true);

    // Collapsible sections
    const [openSections, setOpenSections] = useState<Record<string, boolean>>({
        entradas: true,
        matsServ: true,
        despesas: true,
        outros: false,
    });

    const toggle = (key: string) =>
        setOpenSections(prev => ({ ...prev, [key]: !prev[key] }));

    const fetchHistorico = useCallback(async () => {
        try {
            const res = await axios.get('/api/etl/historico', {
                headers: { Authorization: `Bearer ${token}` },
            });
            setHistorico((res.data as ImportRecord[]).filter(
                h => h.tipo === 'ENTRADAS' || h.tipo === 'DESPESAS'
            ));
        } catch { /* silent */ }
    }, [token]);

    const deleteImportacao = async (id: string) => {
        try {
            await axios.delete(`/api/etl/historico/${id}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            fetchHistorico();
            fetchData();
        } catch { /* silent */ }
    };

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        try {
            const res = await axios.get(
                `/api/dashboard/relatorio-anual?de=${de}&ate=${ate}`,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setData(res.data);
        } catch (err) {
            console.error('Erro ao buscar relatório anual', err);
        } finally {
            setIsLoading(false);
        }
    }, [de, ate, token]);

    useEffect(() => { fetchData(); fetchHistorico(); }, [fetchData, fetchHistorico]);

    const handleUpload = async () => {
        if (!uploadFile) return;
        setUploadLoading(true);
        setUploadMsg(null);
        const formData = new FormData();
        formData.append('file', uploadFile);
        formData.append('tipo', uploadTipo);
        try {
            const res = await axios.post('/api/etl/upload', formData, {
                headers: { 'Content-Type': 'multipart/form-data', Authorization: `Bearer ${token}` },
            });
            setUploadMsg({ type: 'success', text: `${res.data.totalInserido} registros importados.` });
            setUploadFile(null);
            fetchData();
            fetchHistorico();
        } catch (err: any) {
            setUploadMsg({ type: 'error', text: err.response?.data?.error || 'Erro na importação.' });
        } finally {
            setUploadLoading(false);
        }
    };

    const renderTable = (rows: CatRow[], totalRow: { totalAnterior: number; totalAtual: number; variacao: number | null }, totalLabel: string, isExpense: boolean) => (
        <div className="rel-table-wrap">
            <table className="rel-table">
                <thead>
                    <tr>
                        <th style={{ width: '40%' }}>Categoria</th>
                        <th>Total {data?.anoAnterior}</th>
                        <th>Total {data?.anoAtual}</th>
                        <th>Var % Ano</th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map(row => (
                        <tr key={row.categoria}>
                            <td>{row.categoria}</td>
                            <td className={isExpense ? 'rel-val-neg' : ''}>
                                {fmt(isExpense ? -row.totalAnterior : row.totalAnterior)}
                            </td>
                            <td className={isExpense ? 'rel-val-neg' : ''}>
                                {fmt(isExpense ? -row.totalAtual : row.totalAtual)}
                            </td>
                            <td><Delta pct={row.variacao} inverso={!isExpense} /></td>
                        </tr>
                    ))}
                </tbody>
                <tfoot>
                    <tr>
                        <td>{totalLabel}</td>
                        <td className={isExpense ? 'rel-val-neg' : 'rel-val-pos'}>
                            {fmt(isExpense ? -totalRow.totalAnterior : totalRow.totalAnterior)}
                        </td>
                        <td className={isExpense ? 'rel-val-neg' : 'rel-val-pos'}>
                            {fmt(isExpense ? -totalRow.totalAtual : totalRow.totalAtual)}
                        </td>
                        <td><Delta pct={totalRow.variacao} inverso={!isExpense} /></td>
                    </tr>
                </tfoot>
            </table>
        </div>
    );

    const renderCCGroup = (group: CCGroup, groupLabel: string) => (
        <>
            {group.centrosDeCusto.map(cc => (
                <div key={cc.nome} style={{ marginBottom: '0.25rem' }}>
                    <div className="rel-cc-badge">{cc.nome}</div>
                    {renderTable(cc.categorias, cc.total, `Total ${cc.nome}`, true)}
                </div>
            ))}
            {group.centrosDeCusto.length > 0 && (
                <div className="rel-table-wrap">
                    <table className="rel-table">
                        <tbody>
                            <tr className="rel-group-total">
                                <td style={{ width: '40%' }}>{groupLabel}</td>
                                <td className="rel-val-neg">{fmt(-group.total.totalAnterior)}</td>
                                <td className="rel-val-neg">{fmt(-group.total.totalAtual)}</td>
                                <td><Delta pct={group.total.variacao} /></td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            )}
        </>
    );

    const SectionHead: React.FC<{
        sectionKey: string; icon: React.ReactNode; title: string;
        totalAnterior?: number; totalAtual?: number; isExpense?: boolean;
    }> = ({ sectionKey, icon, title, totalAnterior, totalAtual, isExpense }) => (
        <div className="rel-section-head" onClick={() => toggle(sectionKey)}>
            <h3>
                {openSections[sectionKey] ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                {icon}
                {title}
            </h3>
            {totalAnterior !== undefined && totalAtual !== undefined && (
                <div className="rel-section-totals">
                    <span style={{ color: 'var(--text-muted)' }}>{data?.anoAnterior}: <strong>{fmt(isExpense ? -totalAnterior : totalAnterior)}</strong></span>
                    <span style={{ color: 'var(--primary)' }}>{data?.anoAtual}: <strong>{fmt(isExpense ? -totalAtual : totalAtual)}</strong></span>
                </div>
            )}
        </div>
    );

    return (
        <div className="module-page rel-page">
            {/* Header */}
            <header className="res-header">
                <div>
                    <h2>Relatório Anual Comparativo</h2>
                    <p>Entradas, Despesas por Centro de Custo e Resultado Operacional</p>
                </div>
                <div className="res-period-badge">
                    <FileText size={15} />
                    <strong>{shortLabel(de, ate)}</strong> vs {shortLabel(deAnterior, ateAnterior)}
                </div>
            </header>

            {/* Filtros */}
            <div className="rel-year-filter">
                <label>De:</label>
                <input type="date" className="date-input" value={de} onChange={e => setDe(e.target.value)} />
                <label>Até:</label>
                <input type="date" className="date-input" value={ate} onChange={e => setAte(e.target.value)} />
                <span style={{ fontSize: '0.75rem', color: 'var(--text-subtle)', fontStyle: 'italic' }}>
                    Comparativo automático: {shortLabel(deAnterior, ateAnterior)}
                </span>
            </div>

            {/* Upload rápido */}
            <div className="rel-upload-section">
                <Upload size={18} color="var(--primary)" />
                <select className="select" value={uploadTipo} onChange={e => setUploadTipo(e.target.value)}>
                    <option value="ENTRADAS">Entradas (Receitas)</option>
                    <option value="DESPESAS">Despesas</option>
                </select>
                <input
                    type="file"
                    accept=".csv"
                    onChange={e => { if (e.target.files?.[0]) { setUploadFile(e.target.files[0]); setUploadMsg(null); } }}
                    style={{ fontSize: '0.8125rem' }}
                />
                <button className="btn btn-primary" onClick={handleUpload} disabled={!uploadFile || uploadLoading}>
                    {uploadLoading ? <Loader2 size={14} className="animate-spin" /> : 'Importar'}
                </button>
                {uploadMsg && (
                    <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: uploadMsg.type === 'success' ? 'var(--success)' : 'var(--danger)' }}>
                        {uploadMsg.text}
                    </span>
                )}
                <span className="rel-upload-hint">CSV exportado do Conta Azul (Análise de Pagamentos)</span>
            </div>

            {/* Histórico de importações */}
            {historico.length > 0 && (
                <div className="rel-section">
                    <div className="rel-section-head" onClick={() => setShowHistorico(p => !p)}>
                        <h3>
                            {showHistorico ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                            <History size={16} color="var(--primary)" />
                            Importações Realizadas
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-subtle)', fontWeight: 500 }}>
                                ({historico.length})
                            </span>
                        </h3>
                    </div>
                    {showHistorico && (
                        <div className="rel-table-wrap">
                            <table className="rel-table">
                                <thead>
                                    <tr>
                                        <th>Tipo</th>
                                        <th>Arquivo</th>
                                        <th>Período</th>
                                        <th>Registros</th>
                                        <th>Importado em</th>
                                        <th style={{ width: 60 }}></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {historico.map(h => (
                                        <tr key={h.id}>
                                            <td>
                                                <span style={{
                                                    display: 'inline-flex', alignItems: 'center', gap: '0.375rem',
                                                    padding: '0.125rem 0.5rem', borderRadius: '1rem', fontSize: '0.6875rem',
                                                    fontWeight: 700, letterSpacing: '0.03em',
                                                    background: h.tipo === 'ENTRADAS' ? 'color-mix(in srgb, #059669 12%, transparent)' : 'color-mix(in srgb, #dc2626 12%, transparent)',
                                                    color: h.tipo === 'ENTRADAS' ? '#059669' : '#dc2626',
                                                }}>
                                                    <CheckCircle2 size={11} />
                                                    {h.tipo}
                                                </span>
                                            </td>
                                            <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{h.arquivoNome || '—'}</td>
                                            <td>{fmtDate(h.dataInicio)} — {fmtDate(h.dataFim)}</td>
                                            <td>{h.qtdRegistros}</td>
                                            <td style={{ fontSize: '0.75rem' }}>{fmtDateTime(h.createdAt)}</td>
                                            <td>
                                                <button
                                                    title="Excluir importação e seus registros"
                                                    onClick={() => deleteImportacao(h.id)}
                                                    style={{
                                                        background: 'none', border: 'none', cursor: 'pointer',
                                                        color: 'var(--text-subtle)', padding: '0.25rem',
                                                    }}
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {isLoading && !data ? (
                <div className="res-state">
                    <Loader2 className="animate-spin" size={32} />
                    Carregando relatório...
                </div>
            ) : !data ? (
                <div className="res-state">
                    <Inbox size={32} />
                    Nenhum dado encontrado. Importe os CSVs de entradas e despesas.
                </div>
            ) : (
                <div className={isLoading ? 'res-loading-overlay' : ''} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

                    {/* KPIs */}
                    <div className="rel-kpis">
                        <div className="rel-kpi" style={{ ['--kpi-accent' as any]: '#059669' }}>
                            <span className="rel-kpi-label">Total Entradas {anoAtual}</span>
                            <div className="rel-kpi-value" style={{ color: '#059669' }}>
                                {fmt(data.entradas.total.totalAtual)}
                            </div>
                            <div className="rel-kpi-foot">
                                <Delta pct={data.entradas.total.variacao} inverso />
                                <span>vs {anoAnterior}</span>
                            </div>
                        </div>

                        <div className="rel-kpi" style={{ ['--kpi-accent' as any]: '#dc2626' }}>
                            <span className="rel-kpi-label">Total Mats/Serv {anoAtual}</span>
                            <div className="rel-kpi-value" style={{ color: '#dc2626' }}>
                                {fmt(-data.materiaisServicos.total.totalAtual)}
                            </div>
                            <div className="rel-kpi-foot">
                                <Delta pct={data.materiaisServicos.total.variacao} />
                                <span>vs {anoAnterior}</span>
                            </div>
                        </div>

                        <div className="rel-kpi" style={{ ['--kpi-accent' as any]: '#e97316' }}>
                            <span className="rel-kpi-label">Total Despesas {anoAtual}</span>
                            <div className="rel-kpi-value" style={{ color: '#e97316' }}>
                                {fmt(-data.despesas.total.totalAtual)}
                            </div>
                            <div className="rel-kpi-foot">
                                <Delta pct={data.despesas.total.variacao} />
                                <span>vs {anoAnterior}</span>
                            </div>
                        </div>

                        <div className="rel-kpi" style={{ ['--kpi-accent' as any]: data.resultadoOperacional.totalAtual >= 0 ? '#059669' : '#dc2626' }}>
                            <span className="rel-kpi-label">Resultado Operacional {anoAtual}</span>
                            <div className="rel-kpi-value" style={{ color: data.resultadoOperacional.totalAtual >= 0 ? '#059669' : '#dc2626' }}>
                                {fmt(data.resultadoOperacional.totalAtual)}
                            </div>
                            <div className="rel-kpi-foot">
                                <Delta pct={data.resultadoOperacional.variacao} inverso />
                                <span>vs {anoAnterior}</span>
                            </div>
                        </div>
                    </div>

                    {/* ENTRADAS */}
                    <div className="rel-section">
                        <SectionHead
                            sectionKey="entradas"
                            icon={<TrendingUp size={16} color="#059669" />}
                            title="Entradas"
                            totalAnterior={data.entradas.total.totalAnterior}
                            totalAtual={data.entradas.total.totalAtual}
                        />
                        {openSections.entradas && renderTable(
                            data.entradas.categorias,
                            data.entradas.total,
                            'Total das Entradas',
                            false
                        )}
                    </div>

                    {/* MATERIAIS E SERVIÇOS */}
                    <div className="rel-section">
                        <SectionHead
                            sectionKey="matsServ"
                            icon={<Layers size={16} color="#dc2626" />}
                            title="Materiais e Serviços"
                            totalAnterior={data.materiaisServicos.total.totalAnterior}
                            totalAtual={data.materiaisServicos.total.totalAtual}
                            isExpense
                        />
                        {openSections.matsServ && renderCCGroup(data.materiaisServicos, 'Total Mats/Serv')}
                    </div>

                    {/* DESPESAS */}
                    <div className="rel-section">
                        <SectionHead
                            sectionKey="despesas"
                            icon={<Briefcase size={16} color="#e97316" />}
                            title="Despesas"
                            totalAnterior={data.despesas.total.totalAnterior}
                            totalAtual={data.despesas.total.totalAtual}
                            isExpense
                        />
                        {openSections.despesas && renderCCGroup(data.despesas, 'Total Despesas')}
                    </div>

                    {/* OUTROS (se houver CCs não classificados) */}
                    {data.outros && data.outros.centrosDeCusto.length > 0 && (
                        <div className="rel-section">
                            <SectionHead
                                sectionKey="outros"
                                icon={<Layers size={16} color="var(--text-muted)" />}
                                title="Outros Centros de Custo"
                                totalAnterior={data.outros.total.totalAnterior}
                                totalAtual={data.outros.total.totalAtual}
                                isExpense
                            />
                            {openSections.outros && renderCCGroup(data.outros, 'Total Outros')}
                        </div>
                    )}

                    {/* RESULTADO OPERACIONAL */}
                    <div className="rel-resultado">
                        <div className="rel-table-wrap">
                            <table className="rel-table">
                                <thead>
                                    <tr>
                                        <th style={{ width: '40%' }}>
                                            <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                <Calculator size={14} />
                                                Resultado Financeiro Operacional
                                            </span>
                                        </th>
                                        <th>Total {data.anoAnterior}</th>
                                        <th>Total {data.anoAtual}</th>
                                        <th>Var % Ano</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <td>Total das Entradas</td>
                                        <td className="rel-val-pos">{fmt(data.entradas.total.totalAnterior)}</td>
                                        <td className="rel-val-pos">{fmt(data.entradas.total.totalAtual)}</td>
                                        <td><Delta pct={data.entradas.total.variacao} inverso /></td>
                                    </tr>
                                    <tr>
                                        <td>Total Materiais e Serviços</td>
                                        <td className="rel-val-neg">{fmt(-data.materiaisServicos.total.totalAnterior)}</td>
                                        <td className="rel-val-neg">{fmt(-data.materiaisServicos.total.totalAtual)}</td>
                                        <td><Delta pct={data.materiaisServicos.total.variacao} /></td>
                                    </tr>
                                    <tr>
                                        <td>Total Despesas</td>
                                        <td className="rel-val-neg">{fmt(-data.despesas.total.totalAnterior)}</td>
                                        <td className="rel-val-neg">{fmt(-data.despesas.total.totalAtual)}</td>
                                        <td><Delta pct={data.despesas.total.variacao} /></td>
                                    </tr>
                                    {data.outros && data.outros.centrosDeCusto.length > 0 && (
                                        <tr>
                                            <td>Total Outros</td>
                                            <td className="rel-val-neg">{fmt(-data.outros.total.totalAnterior)}</td>
                                            <td className="rel-val-neg">{fmt(-data.outros.total.totalAtual)}</td>
                                            <td><Delta pct={data.outros.total.variacao} /></td>
                                        </tr>
                                    )}
                                </tbody>
                                <tfoot>
                                    <tr>
                                        <td style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            <Calculator size={16} color="var(--primary)" />
                                            Resultado Operacional
                                        </td>
                                        <td style={{ color: data.resultadoOperacional.totalAnterior >= 0 ? '#059669' : '#dc2626' }}>
                                            {fmt(data.resultadoOperacional.totalAnterior)}
                                        </td>
                                        <td style={{ color: data.resultadoOperacional.totalAtual >= 0 ? '#059669' : '#dc2626' }}>
                                            {fmt(data.resultadoOperacional.totalAtual)}
                                        </td>
                                        <td><Delta pct={data.resultadoOperacional.variacao} inverso /></td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default RelatorioAnual;
