import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Building2, ChevronDown, ChevronRight, Download, Loader2, RefreshCw, Search, UsersRound, WalletCards } from 'lucide-react';
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
    resumo: { cadastros: number; grupos: number; faturamento: number; recebido: number; aberto: number };
    grupos: Grupo[];
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
    const [erro, setErro] = useState<string | null>(null);
    const [mensagem, setMensagem] = useState<string | null>(null);
    const [abertos, setAbertos] = useState<Set<string>>(new Set());

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

    const sincronizar = async () => {
        setSyncing(true); setErro(null); setMensagem(null);
        try {
            const response = await axios.post('/api/clientes/sync');
            setMensagem(response.data.message);
            await carregar();
        } catch (error: any) {
            setErro(error.response?.data?.message || 'A sincronização dos cadastros falhou.');
        } finally { setSyncing(false); }
    };

    const toggle = (key: string) => setAbertos(current => {
        const next = new Set(current);
        if (next.has(key)) next.delete(key); else next.add(key);
        return next;
    });

    const clientesVisiveis = useMemo(() => dados?.grupos.flatMap(g => g.clientes) || [], [dados]);
    const exportar = () => {
        if (!dados) return;
        const header = ['Código do grupo', 'Cliente', 'Empresa', 'CPF/CNPJ', 'E-mail', 'Cidade', 'UF', 'Ativo', 'Faturamento', 'Recebido', 'Em aberto', 'Títulos'];
        const rows = dados.grupos.flatMap(grupo => grupo.clientes.map(cliente => [
            grupo.codigo || '', cliente.nome, cliente.nomeEmpresa, cliente.documento, cliente.email,
            cliente.cidade, cliente.uf, cliente.ativo ? 'Sim' : 'Não', cliente.faturamento.toFixed(2),
            cliente.recebido.toFixed(2), cliente.aberto.toFixed(2), cliente.titulos,
        ]));
        const content = [header, ...rows].map(row => row.map(csvCell).join(';')).join('\n');
        const url = URL.createObjectURL(new Blob([`\uFEFF${content}`], { type: 'text/csv;charset=utf-8' }));
        const link = document.createElement('a');
        link.href = url; link.download = `clientes-conta-azul-${periodo.de}-${periodo.ate}.csv`; link.click();
        URL.revokeObjectURL(url);
    };

    return <div className="clientes-page fade-in">
        <section className="clientes-intro">
            <div><h2>Clientes por grupo cadastral</h2><p>O código do cliente reúne cadastros com nomes ou documentos diferentes e mostra a receita consolidada do grupo.</p></div>
            <div className="clientes-actions">
                <button className="clientes-btn secondary" onClick={exportar} disabled={!clientesVisiveis.length}><Download size={16} /> Exportar CSV</button>
                <button className="clientes-btn primary" onClick={sincronizar} disabled={syncing}>
                    {syncing ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}{syncing ? 'Sincronizando…' : 'Sincronizar cadastros'}
                </button>
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
                <article className="money"><WalletCards size={18} /><span>Faturamento no período</span><strong>{fmt(dados.resumo.faturamento)}</strong></article>
                <article><span>Recebido</span><strong>{fmt(dados.resumo.recebido)}</strong><small>Em aberto: {fmt(dados.resumo.aberto)}</small></article>
            </section>
            <section className="clientes-ledger">
                <header><div><h3>Faturamento consolidado</h3><p>{dados.grupos.length} agrupamentos no período selecionado</p></div><span>{dados.atualizadoEm ? `Cadastros atualizados em ${new Date(dados.atualizadoEm).toLocaleString('pt-BR')}` : 'Cadastros ainda não sincronizados'}</span></header>
                {loading ? <div className="clientes-empty"><Loader2 size={18} className="animate-spin" /> Atualizando visão…</div>
                    : dados.grupos.length === 0 ? <div className="clientes-empty">Nenhum cliente encontrado. Sincronize os cadastros ou ajuste os filtros.</div>
                    : dados.grupos.map((grupo, index) => {
                        const key = grupo.codigo || grupo.clientes[0]?.id || String(index);
                        const aberto = abertos.has(key);
                        return <div className="clientes-group" key={key}>
                            <button className="clientes-group-row" onClick={() => toggle(key)} aria-expanded={aberto}>
                                <span className="clientes-chevron">{aberto ? <ChevronDown size={17} /> : <ChevronRight size={17} />}</span>
                                <span className={`clientes-code${grupo.codigo ? '' : ' missing'}`}>{grupo.codigo || 'Sem código'}</span>
                                <span className="clientes-group-name"><strong>{grupo.clientes.length === 1 ? grupo.clientes[0].nomeEmpresa || grupo.clientes[0].nome : `${grupo.clientes.length} clientes vinculados`}</strong><small>{grupo.titulos} título(s)</small></span>
                                <span><small>Faturamento</small><strong>{fmt(grupo.faturamento)}</strong></span>
                                <span><small>Recebido</small><strong className="received">{fmt(grupo.recebido)}</strong></span>
                                <span><small>Em aberto</small><strong className={grupo.aberto > 0 ? 'open' : ''}>{fmt(grupo.aberto)}</strong></span>
                            </button>
                            {aberto && <div className="clientes-detail-wrap"><table>
                                <thead><tr><th>Cliente</th><th>CPF/CNPJ</th><th>Contato</th><th>Local</th><th>Faturamento</th><th>Em aberto</th></tr></thead>
                                <tbody>{grupo.clientes.map(cliente => <tr key={cliente.id}>
                                    <td><strong>{cliente.nomeEmpresa || cliente.nome}</strong>{cliente.nomeEmpresa && <small>{cliente.nome}</small>}</td>
                                    <td>{cliente.documento || '—'}</td><td>{cliente.email || '—'}</td><td>{[cliente.cidade, cliente.uf].filter(Boolean).join(' / ') || '—'}</td>
                                    <td>{fmt(cliente.faturamento)}</td><td>{fmt(cliente.aberto)}</td>
                                </tr>)}</tbody>
                            </table></div>}
                        </div>;
                    })}
            </section>
        </>}
        {loading && !dados && <div className="clientes-empty"><Loader2 size={18} className="animate-spin" /> Carregando clientes…</div>}
    </div>;
}
