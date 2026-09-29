import { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { AlertTriangle, Building2, CheckCircle2, ChevronDown, ChevronRight, Download, FileSpreadsheet, Loader2, RefreshCw, Search, UploadCloud, UsersRound, WalletCards } from 'lucide-react';
import './Clientes.css';

const pad = (value: number) => String(value).padStart(2, '0');
const toISO = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const hoje = new Date();
const inicioAno = `${hoje.getFullYear()}-01-01`;
const fmt = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
const fmtNumber = (value: number) => new Intl.NumberFormat('pt-BR').format(value || 0);

interface Cliente {
    id: string; codigo: string | null; nome: string; nomeEmpresa: string | null; documento: string | null;
    email: string | null; cidade: string | null; uf: string | null; ativo: boolean;
    faturamento: number; recebido: number; aberto: number; titulos: number;
}
interface Grupo { codigo: string | null; clientes: Cliente[]; faturamento: number; recebido: number; aberto: number; titulos: number; }
interface VisaoClientes {
    atualizadoEm: string | null;
    fiscal: { mesesImportados: string[]; notasNoPeriodo: number; naoConciliadasNoPeriodo: number; ultimaImportacao: string | null };
    resumo: { cadastros: number; grupos: number; faturamento: number; recebido: number; aberto: number; titulos: number };
    grupos: Grupo[];
}
interface ImportacaoFiscal {
    id: string; competencia: string; arquivoNome: string; qtdNotas: number; valorTotal: number;
    qtdNaoConciliadas: number; createdAt: string;
}

const csvCell = (value: unknown) => {
    const raw = String(value ?? '');
    const safe = /^[=+\-@]/.test(raw) ? `'${raw}` : raw;
    return `"${safe.replace(/"/g, '""')}"`;
};

export default function Clientes() {
    const [de, setDe] = useState(inicioAno);
    const [ate, setAte] = useState(toISO(hoje));
    const [periodo, setPeriodo] = useState({ de: inicioAno, ate: toISO(hoje) });
    const [busca, setBusca] = useState('');
    const [dados, setDados] = useState<VisaoClientes | null>(null);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [syncProgress, setSyncProgress] = useState<{ processados: number; total: number } | null>(null);
    const [erro, setErro] = useState<string | null>(null);
    const [mensagem, setMensagem] = useState<string | null>(null);
    const [abertos, setAbertos] = useState<Set<string>>(new Set());
    const [arquivoFiscal, setArquivoFiscal] = useState<File | null>(null);
    const [importandoFiscal, setImportandoFiscal] = useState(false);
    const [importacoesFiscais, setImportacoesFiscais] = useState<ImportacaoFiscal[]>([]);
    const fiscalInput = useRef<HTMLInputElement>(null);

    const carregar = async (range = periodo, termo = busca) => {
        setLoading(true);
        setErro(null);
        try {
            const response = await axios.get('/api/clientes', { params: { ...range, busca: termo } });
            setDados(response.data);
        } catch (error: any) {
            setErro(error.response?.data?.message || 'Não foi possível carregar os clientes.');
        } finally { setLoading(false); }
    };

    useEffect(() => {
        const timer = window.setTimeout(() => { void carregar(periodo, busca); }, 350);
        return () => window.clearTimeout(timer);
    }, [periodo, busca]);

    const carregarImportacoesFiscais = async () => {
        try {
            const response = await axios.get('/api/clientes/faturamento-fiscal');
            setImportacoesFiscais(response.data.importacoes || []);
        } catch { /* o carregamento principal continua disponível */ }
    };

    useEffect(() => { void carregarImportacoesFiscais(); }, []);

    useEffect(() => {
        let active = true;
        const consultar = async () => {
            try {
                const response = await axios.get('/api/clientes/sync/status');
                if (!active) return;
                const status = response.data;
                setSyncing(Boolean(status.emAndamento));
                setSyncProgress(status.emAndamento ? { processados: status.processados || 0, total: status.total || 0 } : null);
                if (!status.emAndamento && status.finalizadoEm) {
                    if (status.error) setErro(status.error);
                    else if (status.message) setMensagem(status.message);
                    await carregar();
                    return;
                }
            } catch { /* o carregamento principal exibe erros de conexão */ }
            if (active) window.setTimeout(consultar, 2000);
        };
        void consultar();
        return () => { active = false; };
    }, [syncing]);

    const sincronizar = async () => {
        setSyncing(true); setErro(null); setMensagem(null);
        try {
            const response = await axios.post('/api/clientes/sync');
            setMensagem(response.data.message);
            setSyncProgress({ processados: response.data.processados || 0, total: response.data.total || 0 });
        } catch (error: any) {
            setErro(error.response?.data?.message || 'A sincronização dos cadastros falhou.');
        } finally { setSyncing(false); }
    };

    const importarFiscal = async () => {
        if (!arquivoFiscal) return;
        setImportandoFiscal(true); setErro(null); setMensagem(null);
        try {
            const form = new FormData();
            form.append('file', arquivoFiscal);
            const response = await axios.post('/api/clientes/faturamento-fiscal', form);
            const aviso = response.data.avisoTotal ? ` ${response.data.avisoTotal}` : '';
            setMensagem(`${response.data.message}${aviso}`);
            setArquivoFiscal(null);
            if (fiscalInput.current) fiscalInput.current.value = '';
            await Promise.all([carregar(periodo, busca), carregarImportacoesFiscais()]);
        } catch (error: any) {
            setErro(error.response?.data?.message || 'Não foi possível importar o CSV da prefeitura.');
        } finally { setImportandoFiscal(false); }
    };

    const toggle = (key: string) => setAbertos(current => {
        const next = new Set(current);
        if (next.has(key)) next.delete(key); else next.add(key);
        return next;
    });

    const clientesVisiveis = useMemo(() => dados?.grupos.flatMap(g => g.clientes) || [], [dados]);
    const exportar = () => {
        if (!dados) return;
        const header = ['Código do grupo', 'Cliente', 'Empresa', 'CPF/CNPJ', 'E-mail', 'Cidade', 'UF', 'Ativo', 'Faturamento bruto', 'Títulos'];
        const rows = dados.grupos.flatMap(grupo => grupo.clientes.map(cliente => [
            grupo.codigo || '', cliente.nome, cliente.nomeEmpresa, cliente.documento, cliente.email,
            cliente.cidade, cliente.uf, cliente.ativo ? 'Sim' : 'Não', cliente.faturamento.toFixed(2), cliente.titulos,
        ]));
        const content = [header, ...rows].map(row => row.map(csvCell).join(';')).join('\n');
        const url = URL.createObjectURL(new Blob([`\uFEFF${content}`], { type: 'text/csv;charset=utf-8' }));
        const link = document.createElement('a');
        link.href = url; link.download = `clientes-conta-azul-${periodo.de}-${periodo.ate}.csv`; link.click();
        URL.revokeObjectURL(url);
    };

    return <div className="clientes-page fade-in">
        <section className="clientes-intro">
            <div><h2>Faturamento bruto por grupo</h2><p>O fechamento fiscal vem das NFS-e da prefeitura; recebido e em aberto continuam sendo atualizados pela API Conta Azul.</p></div>
            <div className="clientes-actions">
                <button className="clientes-btn secondary" onClick={exportar} disabled={!clientesVisiveis.length}><Download size={16} /> Exportar CSV</button>
                <button className="clientes-btn primary" onClick={sincronizar} disabled={syncing}>
                    {syncing ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                    {syncing
                        ? `Sincronizando${syncProgress?.total ? ` ${syncProgress.processados}/${syncProgress.total}` : '…'}`
                        : 'Sincronizar cadastros'}
                </button>
            </div>
        </section>

        <section className="fiscal-import" aria-labelledby="fiscal-import-title">
            <div className="fiscal-import-copy">
                <span className="fiscal-icon"><FileSpreadsheet size={21} /></span>
                <div>
                    <h3 id="fiscal-import-title">Fechamento fiscal mensal</h3>
                    <p>Anexe o CSV da prefeitura. Se o mês já foi importado, o arquivo anterior será substituído.</p>
                </div>
            </div>
            <div className="fiscal-import-action">
                <input ref={fiscalInput} type="file" accept=".csv,text/csv" onChange={event => setArquivoFiscal(event.target.files?.[0] || null)} />
                <span title={arquivoFiscal?.name}>{arquivoFiscal?.name || 'Nenhum arquivo selecionado'}</span>
                <button onClick={importarFiscal} disabled={!arquivoFiscal || importandoFiscal}>
                    {importandoFiscal ? <Loader2 size={16} className="animate-spin" /> : <UploadCloud size={16} />}
                    {importandoFiscal ? 'Conferindo…' : 'Importar CSV'}
                </button>
            </div>
            <div className="fiscal-history">
                {importacoesFiscais.length === 0
                    ? <span className="fiscal-history-empty">Ainda não há fechamento fiscal importado.</span>
                    : importacoesFiscais.slice(0, 6).map(item => <span className="fiscal-month" key={item.id}>
                        <CheckCircle2 size={14} />
                        <strong>{new Date(item.competencia).toLocaleDateString('pt-BR', { month: 'short', year: 'numeric', timeZone: 'UTC' })}</strong>
                        {item.qtdNotas} notas · {fmt(item.valorTotal)}
                    </span>)}
            </div>
        </section>

        <section className="clientes-toolbar" aria-label="Filtros da visão de clientes">
            <label className="clientes-search"><Search size={16} /><input value={busca} onChange={event => setBusca(event.target.value)} placeholder="Buscar código, cliente, CNPJ ou e-mail" /></label>
            <div className="clientes-periodo">
                <label>De <input type="date" value={de} onChange={event => setDe(event.target.value)} /></label>
                <label>Até <input type="date" value={ate} onChange={event => setAte(event.target.value)} /></label>
                <button onClick={() => setPeriodo({ de, ate })} disabled={loading || !de || !ate || de > ate}>Aplicar</button>
            </div>
        </section>

        {mensagem && <div className="clientes-feedback success">{mensagem}</div>}
        {erro && <div className="clientes-feedback error">{erro}</div>}

        {dados && <>
            <section className="clientes-summary">
                <article><UsersRound size={18} /><span>Cadastros</span><strong>{fmtNumber(dados.resumo.cadastros)}</strong></article>
                <article><Building2 size={18} /><span>Grupos com código</span><strong>{fmtNumber(dados.resumo.grupos)}</strong></article>
                <article><span>Notas/títulos</span><strong>{fmtNumber(dados.resumo.titulos)}</strong><small>{dados.fiscal.notasNoPeriodo ? 'NFS-e por competência fiscal' : 'API como fonte provisória'}</small></article>
                <article className="money"><WalletCards size={18} /><span>Faturamento bruto</span><strong>{fmt(dados.resumo.faturamento)}</strong></article>
            </section>
            {dados.fiscal.naoConciliadasNoPeriodo > 0 && <div className="clientes-feedback warning"><AlertTriangle size={16} /> {dados.fiscal.naoConciliadasNoPeriodo} nota(s) não foram vinculadas a um cadastro do Conta Azul pelo CNPJ. Elas continuam incluídas no faturamento.</div>}
            <section className="clientes-ledger">
                <header><div><h3>Faturamento consolidado</h3><p>{dados.grupos.length} agrupamentos · competência de {new Date(`${periodo.de}T12:00:00`).toLocaleDateString('pt-BR')} a {new Date(`${periodo.ate}T12:00:00`).toLocaleDateString('pt-BR')}</p></div><span>{dados.fiscal.notasNoPeriodo ? `${dados.fiscal.notasNoPeriodo} NFS-e da prefeitura no período` : 'Sem CSV fiscal no período · usando API'}</span></header>
                {loading ? <div className="clientes-empty"><Loader2 size={18} className="animate-spin" /> Atualizando visão…</div>
                    : dados.grupos.length === 0 ? <div className="clientes-empty">Nenhum cliente encontrado. Sincronize os cadastros ou ajuste os filtros.</div>
                    : dados.grupos.map((grupo, index) => {
                        const key = grupo.codigo || grupo.clientes[0]?.id || String(index);
                        const aberto = abertos.has(key);
                        return <div className="clientes-group" key={key}>
                            <button className="clientes-group-row gross-only" onClick={() => toggle(key)} aria-expanded={aberto}>
                                <span className="clientes-chevron">{aberto ? <ChevronDown size={17} /> : <ChevronRight size={17} />}</span>
                                <span className={`clientes-code${grupo.codigo ? '' : ' missing'}`}>{grupo.codigo || 'Sem código'}</span>
                                <span className="clientes-group-name"><strong>{grupo.clientes.length === 1 ? grupo.clientes[0].nomeEmpresa || grupo.clientes[0].nome : `${grupo.clientes.length} clientes vinculados`}</strong><small>{grupo.titulos} nota(s)/título(s)</small></span>
                                <span><small>Faturamento bruto</small><strong>{fmt(grupo.faturamento)}</strong></span>
                            </button>
                            {aberto && <div className="clientes-detail-wrap"><table>
                                <thead><tr><th>Cliente</th><th>CPF/CNPJ</th><th>Contato</th><th>Local</th><th>Faturamento bruto</th></tr></thead>
                                <tbody>{grupo.clientes.map(cliente => <tr key={cliente.id}>
                                    <td><strong>{cliente.nomeEmpresa || cliente.nome}</strong>{cliente.nomeEmpresa && <small>{cliente.nome}</small>}</td>
                                    <td>{cliente.documento || '—'}</td><td>{cliente.email || '—'}</td><td>{[cliente.cidade, cliente.uf].filter(Boolean).join(' / ') || '—'}</td>
                                    <td>{fmt(cliente.faturamento)}</td>
                                </tr>)}</tbody>
                            </table></div>}
                        </div>;
                    })}
            </section>
        </>}
        {loading && !dados && <div className="clientes-empty"><Loader2 size={18} className="animate-spin" /> Carregando clientes…</div>}
    </div>;
}
