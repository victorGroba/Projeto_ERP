import { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AlertTriangle, ArrowDownRight, ArrowUpRight, CheckCircle2, ChevronDown, ChevronRight, Download, FileSpreadsheet, Loader2, RefreshCw, Search, SlidersHorizontal, TrendingUp, UploadCloud, UsersRound, WalletCards } from 'lucide-react';
import PeriodFilterBar from '../components/PeriodFilterBar';
import { COMPARISON_PRESETS, PRESETS, computeRange, fmtDateLabel, shiftYear, toISO } from '../utils/periodPresets';
import type { PresetKey, PresetKeyB } from '../utils/periodPresets';
import './Clientes.css';

const hoje = new Date();
const PERIODO_INICIAL = { de: `${hoje.getFullYear()}-01-01`, ate: toISO(hoje) };
const fmt = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
const fmtCompact = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact', maximumFractionDigits: 1 }).format(value || 0);
const fmtNumber = (value: number) => new Intl.NumberFormat('pt-BR').format(value || 0);
const fmtPct = (value: number) => `${value > 0 ? '+' : ''}${(value * 100).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
const fmtDataCurta = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
const fmtMes = (value: string) => new Date(`${value}-01T12:00:00Z`).toLocaleDateString('pt-BR', { month: 'short', year: 'numeric', timeZone: 'UTC' });
const fmtMesCurto = (value: string) => new Date(`${value}-01T12:00:00Z`).toLocaleDateString('pt-BR', { month: 'short', timeZone: 'UTC' }).replace('.', '');

interface Cliente {
    id: string; codigo: string | null; nome: string; nomeEmpresa: string | null; documento: string | null;
    email: string | null; cidade: string | null; uf: string | null; ativo: boolean;
    faturamento: number; recebido: number; aberto: number; titulos: number;
    faturamentoAnterior: number; titulosAnterior: number;
}
interface Grupo {
    codigo: string | null; clientes: Cliente[]; faturamento: number; recebido: number; aberto: number; titulos: number;
    faturamentoAnterior: number; titulosAnterior: number;
}
interface VisaoClientes {
    atualizadoEm: string | null;
    fiscal: { mesesImportados: string[]; mesesEsperados: string[]; mesesAusentes: string[]; notasNoPeriodo: number; naoConciliadasNoPeriodo: number; ultimaImportacao: string | null };
    comparacao: { de: string; ate: string; mesesEsperados: string[]; mesesImportados: string[]; mesesAusentes: string[]; notasNoPeriodo: number; faturamento: number };
    serieMensal: { mes: string | null; mesAnterior: string | null; atual: number | null; anterior: number | null }[];
    resumo: { cadastros: number; grupos: number; semCodigo: number; faturamentoSemCodigo: number; faturamento: number; recebido: number; aberto: number; titulos: number };
    grupos: Grupo[];
}

type Tendencia = 'todos' | 'novos' | 'alta' | 'queda' | 'perdidos';
const tendenciaDe = (atual: number, anterior: number): Exclude<Tendencia, 'todos'> | 'estavel' | 'vazio' => {
    if (atual > 0 && anterior <= 0) return 'novos';
    if (atual <= 0 && anterior > 0) return 'perdidos';
    if (atual <= 0 && anterior <= 0) return 'vazio';
    return atual > anterior ? 'alta' : atual < anterior ? 'queda' : 'estavel';
};

function Variacao({ atual, anterior, comparavel }: { atual: number; anterior: number; comparavel: boolean }) {
    if (!comparavel) return <span className="var-badge neutral">—</span>;
    const tendencia = tendenciaDe(atual, anterior);
    if (tendencia === 'novos') return <span className="var-badge novo">novo</span>;
    if (tendencia === 'perdidos') return <span className="var-badge perdido"><ArrowDownRight size={12} /> sem faturamento</span>;
    if (tendencia === 'vazio' || tendencia === 'estavel') return <span className="var-badge neutral">0,0%</span>;
    const Icone = tendencia === 'alta' ? ArrowUpRight : ArrowDownRight;
    return <span className={`var-badge ${tendencia}`}><Icone size={12} /> {fmtPct((atual - anterior) / anterior)}</span>;
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
    const [preset, setPreset] = useState<PresetKey>('ytd');
    const [customDe, setCustomDe] = useState(PERIODO_INICIAL.de);
    const [customAte, setCustomAte] = useState(PERIODO_INICIAL.ate);
    const [periodo, setPeriodo] = useState(PERIODO_INICIAL);
    // Período de comparação: por padrão ('auto') o mesmo intervalo um ano antes.
    const periodoBInicial = { de: shiftYear(PERIODO_INICIAL.de, -1), ate: shiftYear(PERIODO_INICIAL.ate, -1) };
    const [presetB, setPresetB] = useState<PresetKeyB>('auto');
    const [customBDe, setCustomBDe] = useState(periodoBInicial.de);
    const [customBAte, setCustomBAte] = useState(periodoBInicial.ate);
    const [periodoB, setPeriodoB] = useState(periodoBInicial);
    const [tendencia, setTendencia] = useState<Tendencia>('todos');
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
    const [somenteSemCodigo, setSomenteSemCodigo] = useState(false);
    const fiscalInput = useRef<HTMLInputElement>(null);
    const ledgerRef = useRef<HTMLElement>(null);

    const carregar = async (range = periodo, termo = busca, rangeB = periodoB) => {
        setLoading(true);
        setErro(null);
        try {
            const response = await axios.get('/api/clientes', { params: { ...range, de2: rangeB.de, ate2: rangeB.ate, busca: termo } });
            setDados(response.data);
        } catch (error: any) {
            setErro(error.response?.data?.message || 'Não foi possível carregar os clientes.');
        } finally { setLoading(false); }
    };

    useEffect(() => {
        const timer = window.setTimeout(() => { void carregar(periodo, busca, periodoB); }, 350);
        return () => window.clearTimeout(timer);
    }, [periodo, periodoB, busca]);

    // ── Filtro de períodos (mesmo comportamento da tela de Despesas) ──
    const syncAutoComparison = (novoA: { de: string; ate: string }) => {
        if (presetB !== 'auto') return;
        const rangeB = { de: shiftYear(novoA.de, -1), ate: shiftYear(novoA.ate, -1) };
        setCustomBDe(rangeB.de); setCustomBAte(rangeB.ate); setPeriodoB(rangeB);
    };
    const handlePresetChange = (novo: PresetKey) => {
        setPreset(novo);
        if (novo === 'custom') return;
        const range = computeRange(novo, periodo);
        setCustomDe(range.de); setCustomAte(range.ate); setPeriodo(range);
        syncAutoComparison(range);
    };
    const aplicarCustom = () => {
        if (!customDe || !customAte || customDe > customAte) return;
        setPeriodo({ de: customDe, ate: customAte });
        syncAutoComparison({ de: customDe, ate: customAte });
    };
    const handlePresetBChange = (novo: PresetKeyB) => {
        setPresetB(novo);
        if (novo === 'custom') return;
        const range = novo === 'auto'
            ? { de: shiftYear(periodo.de, -1), ate: shiftYear(periodo.ate, -1) }
            : computeRange(novo, periodoB);
        setCustomBDe(range.de); setCustomBAte(range.ate); setPeriodoB(range);
    };
    const aplicarCustomB = () => {
        if (!customBDe || !customBAte || customBDe > customBAte) return;
        setPeriodoB({ de: customBDe, ate: customBAte });
    };

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

    const rolarParaLista = () => window.setTimeout(() => ledgerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0);
    const alternarSemCodigo = () => setSomenteSemCodigo(current => {
        const next = !current;
        if (next) rolarParaLista();
        return next;
    });
    const filtrarTendencia = (valor: Tendencia) => {
        setTendencia(atual => atual === valor ? 'todos' : valor);
        rolarParaLista();
    };

    // Sem nenhum CSV no período de comparação a variação seria falsa (tudo "novo").
    const comparavel = Boolean(dados?.comparacao.mesesImportados.length);
    const comparacaoParcial = comparavel && Boolean(dados?.comparacao.mesesAusentes.length);

    // Decomposição da variação: novos + crescimento − redução − perdidos = variação total.
    const ponte = useMemo(() => {
        const base = { novos: { valor: 0, qtd: 0 }, alta: { valor: 0, qtd: 0 }, queda: { valor: 0, qtd: 0 }, perdidos: { valor: 0, qtd: 0 } };
        dados?.grupos.forEach(grupo => {
            const t = tendenciaDe(grupo.faturamento, grupo.faturamentoAnterior);
            if (t === 'vazio' || t === 'estavel') return;
            base[t].valor += grupo.faturamento - grupo.faturamentoAnterior;
            base[t].qtd++;
        });
        return base;
    }, [dados]);

    const destaques = useMemo(() => {
        const comAmbos = (dados?.grupos || []).filter(g => g.faturamento > 0 || g.faturamentoAnterior > 0)
            .map(g => ({ grupo: g, delta: g.faturamento - g.faturamentoAnterior }));
        return {
            altas: comAmbos.filter(x => x.delta > 0).sort((a, b) => b.delta - a.delta).slice(0, 5),
            quedas: comAmbos.filter(x => x.delta < 0).sort((a, b) => a.delta - b.delta).slice(0, 5),
        };
    }, [dados]);

    const serieGrafico = useMemo(() => (dados?.serieMensal || []).map(ponto => ({
        ...ponto,
        rotulo: ponto.mes ? fmtMesCurto(ponto.mes) : ponto.mesAnterior ? fmtMesCurto(ponto.mesAnterior) : '',
    })), [dados]);

    const gruposVisiveis = useMemo(() => dados?.grupos.filter(grupo => {
        // Grupos sem movimento nos dois períodos só aparecem quando procurados pelo nome.
        if (!busca && grupo.faturamento <= 0 && grupo.faturamentoAnterior <= 0) return false;
        if (somenteSemCodigo && (grupo.codigo || grupo.faturamento <= 0)) return false;
        if (tendencia !== 'todos' && tendenciaDe(grupo.faturamento, grupo.faturamentoAnterior) !== tendencia) return false;
        return true;
    }) || [], [dados, somenteSemCodigo, tendencia, busca]);
    const clientesVisiveis = useMemo(() => gruposVisiveis.flatMap(g => g.clientes), [gruposVisiveis]);
    const coberturaFiscal = useMemo(() => {
        if (!importacoesFiscais.length) return null;
        const meses = importacoesFiscais.map(item => item.competencia.slice(0, 7)).sort();
        const importados = new Set(meses);
        const ausentes: string[] = [];
        let [ano, mes] = meses[0].split('-').map(Number);
        const fim = meses[meses.length - 1];
        for (let chave = meses[0]; chave <= fim; chave = `${ano}-${String(mes).padStart(2, '0')}`) {
            if (!importados.has(chave)) ausentes.push(chave);
            mes++;
            if (mes > 12) { mes = 1; ano++; }
        }
        return {
            inicio: meses[0], fim, meses: meses.length, ausentes,
            notas: importacoesFiscais.reduce((s, item) => s + item.qtdNotas, 0),
            valor: importacoesFiscais.reduce((s, item) => s + item.valorTotal, 0),
        };
    }, [importacoesFiscais]);
    const exportar = () => {
        if (!dados) return;
        const header = ['Código do grupo', 'Cliente', 'Empresa', 'CPF/CNPJ', 'E-mail', 'Cidade', 'UF', 'Ativo',
            `Faturamento bruto ${periodo.de} a ${periodo.ate}`, `Faturamento bruto ${dados.comparacao.de} a ${dados.comparacao.ate}`, 'Variação %', 'Títulos'];
        const rows = gruposVisiveis.flatMap(grupo => grupo.clientes.map(cliente => [
            grupo.codigo || '', cliente.nome, cliente.nomeEmpresa, cliente.documento, cliente.email,
            cliente.cidade, cliente.uf, cliente.ativo ? 'Sim' : 'Não', cliente.faturamento.toFixed(2),
            cliente.faturamentoAnterior.toFixed(2),
            cliente.faturamentoAnterior > 0 ? (((cliente.faturamento - cliente.faturamentoAnterior) / cliente.faturamentoAnterior) * 100).toFixed(1) : '',
            cliente.titulos,
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
                    <p>Anexe um mês ou um período completo. Cada competência encontrada será separada e substituirá somente o mesmo mês.</p>
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
                {coberturaFiscal && <div className="fiscal-coverage">
                    <span>Período coberto</span>
                    <strong>{fmtMes(coberturaFiscal.inicio)} a {fmtMes(coberturaFiscal.fim)}</strong>
                    <span>{coberturaFiscal.meses} {coberturaFiscal.meses === 1 ? 'mês' : 'meses'} · {fmtNumber(coberturaFiscal.notas)} notas · {fmt(coberturaFiscal.valor)}</span>
                    {coberturaFiscal.ausentes.length > 0 && <em><AlertTriangle size={13} /> Faltam: {coberturaFiscal.ausentes.map(fmtMes).join(', ')}</em>}
                </div>}
                {importacoesFiscais.length === 0
                    ? <span className="fiscal-history-empty">Ainda não há fechamento fiscal importado.</span>
                    : importacoesFiscais.map(item => <span className="fiscal-month" key={item.id}>
                        <CheckCircle2 size={14} />
                        <strong>{new Date(item.competencia).toLocaleDateString('pt-BR', { month: 'short', year: 'numeric', timeZone: 'UTC' })}</strong>
                        {item.qtdNotas} notas · {fmt(item.valorTotal)}
                    </span>)}
            </div>
        </section>

        <section className="clientes-periodos" aria-label="Períodos comparados">
            <PeriodFilterBar
                icon={<SlidersHorizontal size={15} color="var(--text-muted)" style={{ flexShrink: 0 }} />}
                label="Período"
                presets={PRESETS}
                preset={preset}
                onPresetChange={key => handlePresetChange(key as PresetKey)}
                de={customDe}
                ate={customAte}
                onDeChange={valor => { setPreset('custom'); setCustomDe(valor); }}
                onAteChange={valor => { setPreset('custom'); setCustomAte(valor); }}
                onApply={aplicarCustom}
                pending={customDe !== periodo.de || customAte !== periodo.ate}
                isLoading={loading}
                trailing={<span style={{ color: 'var(--text-main)', fontWeight: 600 }}>{fmtDateLabel(periodo.de)} – {fmtDateLabel(periodo.ate)}</span>}
            />
            <div className="clientes-periodos-divider" />
            <PeriodFilterBar
                icon={<TrendingUp size={15} color="var(--text-subtle)" style={{ flexShrink: 0 }} />}
                label="Comparar com"
                presets={COMPARISON_PRESETS}
                preset={presetB}
                onPresetChange={key => handlePresetBChange(key as PresetKeyB)}
                de={customBDe}
                ate={customBAte}
                onDeChange={valor => { setPresetB('custom'); setCustomBDe(valor); }}
                onAteChange={valor => { setPresetB('custom'); setCustomBAte(valor); }}
                onApply={aplicarCustomB}
                pending={customBDe !== periodoB.de || customBAte !== periodoB.ate}
                isLoading={loading}
                trailing={`${fmtDateLabel(periodoB.de)} – ${fmtDateLabel(periodoB.ate)}`}
            />
        </section>

        <section className="clientes-toolbar" aria-label="Filtros da visão de clientes">
            <label className="clientes-search"><Search size={16} /><input value={busca} onChange={event => setBusca(event.target.value)} placeholder="Buscar código, cliente, CNPJ ou e-mail" /></label>
            <button className={`clientes-filter-toggle${somenteSemCodigo ? ' active' : ''}`} onClick={alternarSemCodigo} aria-pressed={somenteSemCodigo}>
                <AlertTriangle size={15} /> Sem código {dados ? `(${dados.resumo.semCodigo})` : ''}
            </button>
        </section>

        {mensagem && <div className="clientes-feedback success">{mensagem}</div>}
        {erro && <div className="clientes-feedback error">{erro}</div>}

        {dados && <>
            <section className="clientes-summary">
                <article className="money">
                    <WalletCards size={18} /><span>Faturamento bruto fiscal</span><strong>{fmt(dados.resumo.faturamento)}</strong>
                    <small className="summary-compare">
                        <Variacao atual={dados.resumo.faturamento} anterior={dados.comparacao.faturamento} comparavel={comparavel} />
                        {comparavel ? `vs ${fmt(dados.comparacao.faturamento)}` : 'sem dados fiscais na comparação'}
                    </small>
                </article>
                <article>
                    <TrendingUp size={18} /><span>Variação no período</span>
                    <strong className={!comparavel ? '' : dados.resumo.faturamento >= dados.comparacao.faturamento ? 'positive' : 'negative'}>
                        {comparavel ? `${dados.resumo.faturamento >= dados.comparacao.faturamento ? '+' : ''}${fmt(dados.resumo.faturamento - dados.comparacao.faturamento)}` : '—'}
                    </strong>
                    <small>vs {fmtDateLabel(dados.comparacao.de)} – {fmtDateLabel(dados.comparacao.ate)}</small>
                </article>
                <button type="button" className={`summary-action${dados.resumo.semCodigo ? ' attention' : ''}${somenteSemCodigo ? ' active' : ''}`} onClick={alternarSemCodigo} aria-pressed={somenteSemCodigo}>
                    <AlertTriangle size={18} /><span>Clientes sem código</span><strong>{fmtNumber(dados.resumo.semCodigo)}</strong><small>{fmt(dados.resumo.faturamentoSemCodigo)} no período · clique para visualizar</small>
                </button>
                <article><UsersRound size={18} /><span>Cobertura fiscal</span><strong>{dados.fiscal.mesesImportados.length}/{dados.fiscal.mesesEsperados.length}</strong><small>{fmtNumber(dados.resumo.titulos)} NFS-e · comparação {dados.comparacao.mesesImportados.length}/{dados.comparacao.mesesEsperados.length} meses</small></article>
            </section>
            {dados.fiscal.mesesAusentes.length > 0 && <div className="clientes-feedback warning"><AlertTriangle size={16} />
                <span>Faturamento parcial: faltam os CSVs de {dados.fiscal.mesesAusentes.map(fmtMes).join(', ')}. Valores líquidos da API não são somados ao bruto.</span>
            </div>}
            {!comparavel && <div className="clientes-feedback warning"><AlertTriangle size={16} />
                <span>Não há CSV da prefeitura importado para o período de comparação ({fmtDateLabel(dados.comparacao.de)} – {fmtDateLabel(dados.comparacao.ate)}), por isso a variação não é calculada.</span>
            </div>}
            {comparacaoParcial && <div className="clientes-feedback warning"><AlertTriangle size={16} />
                <span>Comparação parcial: faltam os CSVs de {dados.comparacao.mesesAusentes.map(fmtMes).join(', ')} no período de comparação; a variação fica superestimada.</span>
            </div>}
            {dados.fiscal.naoConciliadasNoPeriodo > 0 && <div className="clientes-feedback warning"><AlertTriangle size={16} /> {dados.fiscal.naoConciliadasNoPeriodo} nota(s) não foram vinculadas a um cadastro do Conta Azul pelo CNPJ. Elas continuam incluídas no faturamento.</div>}

            {comparavel && <section className="clientes-compare">
                <article className="compare-card">
                    <header><h3>O que explica a variação</h3><p>Clique em uma linha para listar os grupos</p></header>
                    {(() => {
                        const itens: { key: Exclude<Tendencia, 'todos'>; titulo: string; valor: number; qtd: number }[] = [
                            { key: 'novos', titulo: 'Grupos novos', valor: ponte.novos.valor, qtd: ponte.novos.qtd },
                            { key: 'alta', titulo: 'Grupos que cresceram', valor: ponte.alta.valor, qtd: ponte.alta.qtd },
                            { key: 'queda', titulo: 'Grupos que reduziram', valor: ponte.queda.valor, qtd: ponte.queda.qtd },
                            { key: 'perdidos', titulo: 'Sem faturamento agora', valor: ponte.perdidos.valor, qtd: ponte.perdidos.qtd },
                        ];
                        const maximo = Math.max(...itens.map(item => Math.abs(item.valor)), 1);
                        const total = dados.resumo.faturamento - dados.comparacao.faturamento;
                        return <div className="bridge">
                            {itens.map(item => <button type="button" key={item.key} className={`bridge-row${tendencia === item.key ? ' active' : ''}`} onClick={() => filtrarTendencia(item.key)} aria-pressed={tendencia === item.key}>
                                <span className="bridge-label"><strong>{item.titulo}</strong><small>{fmtNumber(item.qtd)} {item.qtd === 1 ? 'grupo' : 'grupos'}</small></span>
                                <span className="bridge-track"><span className={`bridge-bar ${item.valor >= 0 ? 'positive' : 'negative'}`} style={{ width: `${Math.max(2, (Math.abs(item.valor) / maximo) * 100)}%` }} /></span>
                                <span className={`bridge-value ${item.valor >= 0 ? 'positive' : 'negative'}`}>{item.valor >= 0 ? '+' : '−'}{fmtCompact(Math.abs(item.valor))}</span>
                            </button>)}
                            <div className="bridge-total"><span>Variação total</span><strong className={total >= 0 ? 'positive' : 'negative'}>{total >= 0 ? '+' : '−'}{fmt(Math.abs(total))}</strong></div>
                        </div>;
                    })()}
                </article>

                <article className="compare-card">
                    <header><h3>Faturamento mês a mês</h3><p>Cada mês ao lado do mesmo mês do período de comparação</p></header>
                    <div className="compare-chart">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={serieGrafico} margin={{ top: 4, right: 8, left: 0, bottom: 0 }} barGap={2} barCategoryGap="24%">
                                <CartesianGrid stroke="var(--border)" vertical={false} />
                                <XAxis dataKey="rotulo" tick={{ fill: 'var(--text-muted)', fontSize: 12 }} axisLine={{ stroke: 'var(--border)' }} tickLine={false} />
                                <YAxis tickFormatter={valor => fmtCompact(Number(valor)).replace('R$', '').trim()} width={48} tick={{ fill: 'var(--text-subtle)', fontSize: 11 }} axisLine={false} tickLine={false} />
                                <Tooltip
                                    cursor={{ fill: 'var(--background)' }}
                                    content={({ active, payload }) => {
                                        if (!active || !payload?.length) return null;
                                        const ponto = payload[0].payload as typeof serieGrafico[number];
                                        const atual = ponto.atual ?? 0, anterior = ponto.anterior ?? 0;
                                        return <div className="compare-tooltip">
                                            {ponto.mesAnterior && <div><i className="swatch previous" />{fmtMes(ponto.mesAnterior)}<strong>{fmt(anterior)}</strong></div>}
                                            {ponto.mes && <div><i className="swatch current" />{fmtMes(ponto.mes)}<strong>{fmt(atual)}</strong></div>}
                                            {ponto.mes && ponto.mesAnterior && anterior > 0 && <div className="tooltip-var"><Variacao atual={atual} anterior={anterior} comparavel /></div>}
                                        </div>;
                                    }}
                                />
                                <Legend verticalAlign="top" align="right" height={28} iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '0.78rem', color: 'var(--text-muted)' }} />
                                <Bar dataKey="anterior" name="Período de comparação" fill="var(--text-subtle)" radius={[4, 4, 0, 0]} maxBarSize={22} />
                                <Bar dataKey="atual" name="Período selecionado" fill="var(--primary)" radius={[4, 4, 0, 0]} maxBarSize={22} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </article>

                {[{ titulo: 'Maiores altas', itens: destaques.altas }, { titulo: 'Maiores quedas', itens: destaques.quedas }].map(bloco =>
                    <article className="compare-card" key={bloco.titulo}>
                        <header><h3>{bloco.titulo}</h3><p>Grupos com maior variação em reais</p></header>
                        {bloco.itens.length === 0 ? <div className="clientes-empty small">Nenhum grupo nesta situação.</div>
                            : <ol className="movers">{bloco.itens.map(({ grupo, delta }, index) => <li key={`${grupo.codigo || grupo.clientes[0]?.id}-${index}`}>
                                <span className={`clientes-code${grupo.codigo ? '' : ' missing'}`}>{grupo.codigo || 'Sem código'}</span>
                                <span className="movers-name"><strong>{grupo.clientes[0]?.nomeEmpresa || grupo.clientes[0]?.nome}{grupo.clientes.length > 1 ? ` +${grupo.clientes.length - 1}` : ''}</strong><small>{fmt(grupo.faturamentoAnterior)} → {fmt(grupo.faturamento)}</small></span>
                                <span className={`movers-delta ${delta >= 0 ? 'positive' : 'negative'}`}>{delta >= 0 ? '+' : '−'}{fmtCompact(Math.abs(delta))}</span>
                            </li>)}</ol>}
                    </article>)}
            </section>}

            <section className="clientes-ledger" ref={ledgerRef}>
                <header>
                    <div><h3>{somenteSemCodigo ? 'Clientes pendentes de código' : 'Faturamento consolidado'}</h3><p>{gruposVisiveis.length} agrupamentos · competência de {new Date(`${periodo.de}T12:00:00`).toLocaleDateString('pt-BR')} a {new Date(`${periodo.ate}T12:00:00`).toLocaleDateString('pt-BR')}</p></div>
                    {comparavel && <div className="trend-filter" role="group" aria-label="Filtrar por variação">
                        {([['todos', 'Todos'], ['alta', 'Em alta'], ['queda', 'Em queda'], ['novos', 'Novos'], ['perdidos', 'Sem faturamento']] as [Tendencia, string][]).map(([valor, rotulo]) =>
                            <button key={valor} type="button" className={tendencia === valor ? 'active' : ''} onClick={() => setTendencia(valor)} aria-pressed={tendencia === valor}>{rotulo}</button>)}
                    </div>}
                </header>
                <div className="clientes-group-row compare head" aria-hidden="true">
                    <span /><span>Código</span><span>Grupo</span><span>{fmtDataCurta(dados.comparacao.de)} – {fmtDataCurta(dados.comparacao.ate)}</span><span>{fmtDataCurta(periodo.de)} – {fmtDataCurta(periodo.ate)}</span><span>Variação</span>
                </div>
                {loading ? <div className="clientes-empty"><Loader2 size={18} className="animate-spin" /> Atualizando visão…</div>
                    : gruposVisiveis.length === 0 ? <div className="clientes-empty">{somenteSemCodigo ? 'Nenhum cliente com faturamento está sem código neste período.' : 'Nenhum cliente encontrado. Sincronize os cadastros ou ajuste os filtros.'}</div>
                    : gruposVisiveis.map((grupo, index) => {
                        const key = grupo.codigo || grupo.clientes[0]?.id || String(index);
                        const aberto = abertos.has(key);
                        return <div className="clientes-group" key={key}>
                            <button className="clientes-group-row compare" onClick={() => toggle(key)} aria-expanded={aberto}>
                                <span className="clientes-chevron">{aberto ? <ChevronDown size={17} /> : <ChevronRight size={17} />}</span>
                                <span className={`clientes-code${grupo.codigo ? '' : ' missing'}`}>{grupo.codigo || 'Sem código'}</span>
                                <span className="clientes-group-name"><strong>{grupo.clientes.length === 1 ? grupo.clientes[0].nomeEmpresa || grupo.clientes[0].nome : `${grupo.clientes.length} clientes vinculados`}</strong><small>{grupo.titulos} nota(s) · {grupo.titulosAnterior} na comparação</small></span>
                                <span className="previous-value">{comparavel ? fmt(grupo.faturamentoAnterior) : '—'}</span>
                                <span><strong>{fmt(grupo.faturamento)}</strong></span>
                                <span><Variacao atual={grupo.faturamento} anterior={grupo.faturamentoAnterior} comparavel={comparavel} /></span>
                            </button>
                            {aberto && <div className="clientes-detail-wrap"><table>
                                <thead><tr><th>Cliente</th><th>CPF/CNPJ</th><th>Contato</th><th>Local</th><th>Comparação</th><th>Período</th><th>Variação</th></tr></thead>
                                <tbody>{grupo.clientes.map(cliente => <tr key={cliente.id}>
                                    <td><strong>{cliente.nomeEmpresa || cliente.nome}</strong>{cliente.nomeEmpresa && <small>{cliente.nome}</small>}</td>
                                    <td>{cliente.documento || '—'}</td><td>{cliente.email || '—'}</td><td>{[cliente.cidade, cliente.uf].filter(Boolean).join(' / ') || '—'}</td>
                                    <td>{comparavel ? fmt(cliente.faturamentoAnterior) : '—'}</td>
                                    <td>{fmt(cliente.faturamento)}</td>
                                    <td><Variacao atual={cliente.faturamento} anterior={cliente.faturamentoAnterior} comparavel={comparavel} /></td>
                                </tr>)}</tbody>
                            </table></div>}
                        </div>;
                    })}
            </section>
        </>}
        {loading && !dados && <div className="clientes-empty"><Loader2 size={18} className="animate-spin" /> Carregando clientes…</div>}
    </div>;
}
