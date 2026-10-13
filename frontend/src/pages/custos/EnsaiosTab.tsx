import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Copy, Plus, Search, Settings2, Trash2, X } from 'lucide-react';
import {
    CalculoFicha, EnsaioDetalhe, EnsaioResumo, Equipamento, Insumo, ItemFicha, Parametro, SETORES, TipoItem,
    custosApi, formatBRL, labelSetor, normalizar,
} from './custosApi';

interface Props {
    ensaios: EnsaioResumo[];
    insumos: Insumo[];
    equipamentos: Equipamento[];
    recarregar: () => Promise<void>;
}

type Ordem = 'nome' | 'custo' | 'diferenca';
type ModalState = { modo: 'novo' } | { modo: 'editar'; id: string } | null;

const diferencaPlanilha = (e: { custoPlanilha: number | null }, total: number) =>
    e.custoPlanilha ? (total / e.custoPlanilha - 1) * 100 : null;

function Diferenca({ valor }: { valor: number | null }) {
    if (valor === null) return <span className="custos-muted">—</span>;
    if (Math.abs(valor) < 1) return <span className="custos-dif igual">igual</span>;
    return <span className={`custos-dif ${valor > 0 ? 'maior' : 'menor'}`}>{valor > 0 ? '+' : ''}{valor.toFixed(0)}%</span>;
}

export default function EnsaiosTab({ ensaios, insumos, equipamentos, recarregar }: Props) {
    const [busca, setBusca] = useState('');
    const [setor, setSetor] = useState('');
    const [ordem, setOrdem] = useState<Ordem>('nome');
    const [soPendencias, setSoPendencias] = useState(false);
    const [mostrarInativos, setMostrarInativos] = useState(false);
    const [modal, setModal] = useState<ModalState>(null);
    const [parametrosAbertos, setParametrosAbertos] = useState(false);

    const filtrados = useMemo(() => {
        const termo = normalizar(busca.trim());
        const lista = ensaios.filter(e =>
            (mostrarInativos || e.ativo)
            && (!setor || e.setor === setor)
            && (!soPendencias || e.pendencia || e.custo.qtdAvisos > 0)
            && (!termo || normalizar(`${e.nome} ${e.codigoLims ?? ''} ${e.metodologia ?? ''}`).includes(termo)));
        if (ordem === 'custo') return [...lista].sort((a, b) => b.custo.total - a.custo.total);
        if (ordem === 'diferenca') {
            const dif = (e: EnsaioResumo) => Math.abs(diferencaPlanilha(e, e.custo.total) ?? 0);
            return [...lista].sort((a, b) => dif(b) - dif(a));
        }
        return lista;
    }, [ensaios, busca, setor, ordem, soPendencias, mostrarInativos]);

    const qtdPendencias = ensaios.filter(e => e.ativo && (e.pendencia || e.custo.qtdAvisos > 0)).length;

    return (
        <>
            <div className="custos-toolbar">
                <div className="custos-search">
                    <Search size={16} />
                    <input placeholder="Buscar ensaio, código LIMS ou metodologia..." value={busca} onChange={e => setBusca(e.target.value)} />
                </div>
                <select value={setor} onChange={e => setSetor(e.target.value)} aria-label="Setor">
                    <option value="">Todos os setores</option>
                    {SETORES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
                <select value={ordem} onChange={e => setOrdem(e.target.value as Ordem)} aria-label="Ordenar">
                    <option value="nome">Ordenar por nome</option>
                    <option value="custo">Maior custo primeiro</option>
                    <option value="diferenca">Maior diferença da planilha</option>
                </select>
                <button className={`custos-btn toggle${soPendencias ? ' active' : ''}`} onClick={() => setSoPendencias(v => !v)}>
                    <AlertTriangle size={14} /> Pendências ({qtdPendencias})
                </button>
                <label className="custos-check">
                    <input type="checkbox" checked={mostrarInativos} onChange={e => setMostrarInativos(e.target.checked)} />
                    Inativos
                </label>
                <button className="custos-btn" onClick={() => setParametrosAbertos(true)} title="Custo do minuto do técnico e dias úteis">
                    <Settings2 size={14} /> Parâmetros
                </button>
                <button className="custos-btn primary" onClick={() => setModal({ modo: 'novo' })}>
                    <Plus size={14} /> Novo ensaio
                </button>
            </div>

            <div className="custos-table-wrap">
                <table className="custos-table">
                    <thead>
                        <tr>
                            <th>Ensaio</th>
                            <th>Setor</th>
                            <th className="num">Mão de obra</th>
                            <th className="num">Materiais</th>
                            <th className="num">Equipamentos</th>
                            <th className="num">CQ</th>
                            <th className="num">Custo direto</th>
                            <th className="num">Planilha</th>
                            <th className="num">Diferença</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filtrados.length === 0 ? (
                            <tr><td colSpan={9} className="vazio">
                                {ensaios.length === 0
                                    ? 'Nenhum ensaio cadastrado. Importe a planilha de custos ou cadastre um ensaio.'
                                    : 'Nenhum ensaio encontrado com esses filtros.'}
                            </td></tr>
                        ) : filtrados.map(e => (
                            <tr key={e.id} className={e.ativo ? '' : 'inativo'} onClick={() => setModal({ modo: 'editar', id: e.id })}>
                                <td className="nome">
                                    {e.nome}
                                    {(e.pendencia || e.custo.qtdAvisos > 0) && (
                                        <span className="custos-badge pendencia" title={e.pendencia ?? 'Há itens sem preço ou dados incompletos'}>
                                            <AlertTriangle size={11} /> conferir
                                        </span>
                                    )}
                                    {!e.ativo && <span className="custos-badge inativo">inativo</span>}
                                    {e.codigoLims && <div className="custos-sub">LIMS {e.codigoLims}{e.metodologia ? ` · ${e.metodologia}` : ''}</div>}
                                    {!e.codigoLims && e.metodologia && <div className="custos-sub">{e.metodologia}</div>}
                                </td>
                                <td className="setor">{labelSetor(e.setor)}</td>
                                <td className="num">{formatBRL(e.custo.maoDeObra)}</td>
                                <td className="num">{formatBRL(e.custo.materiais)}</td>
                                <td className="num">{formatBRL(e.custo.equipamentos)}</td>
                                <td className="num">{formatBRL(e.custo.controleQualidade)}</td>
                                <td className="num total">{formatBRL(e.custo.total)}</td>
                                <td className="num custos-muted">{formatBRL(e.custoPlanilha)}</td>
                                <td className="num"><Diferenca valor={diferencaPlanilha(e, e.custo.total)} /></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <p className="custos-rodape">
                {filtrados.length} de {ensaios.length} ensaios. Custo direto calculado com os preços vigentes hoje; a coluna Planilha
                mostra o valor da planilha de referência para comparação.
            </p>

            {modal && (
                <EnsaioModal
                    id={modal.modo === 'editar' ? modal.id : undefined}
                    insumos={insumos}
                    equipamentos={equipamentos}
                    onClose={() => setModal(null)}
                    onChanged={recarregar}
                    onAbrir={id => setModal({ modo: 'editar', id })}
                />
            )}
            {parametrosAbertos && <ParametrosModal onClose={() => setParametrosAbertos(false)} onSaved={recarregar} />}
        </>
    );
}

// ── Ficha técnica ──────────────────────────────────────────

interface Linha {
    key: number;
    tipo: TipoItem;
    descricao: string;
    grupo: string;
    minutos: string;
    insumoId: string;
    insumoTexto: string;
    quantidade: string;
    equipamentoId: string;
    equipamentoTexto: string;
    vidaUtilMeses: string;
    rendimento: string;
}

interface Cadastro {
    nome: string;
    codigoLims: string;
    metodologia: string;
    setor: string;
    percentualCQ: string;
    observacao: string;
    ativo: boolean;
}

let proximaChave = 1;
const txt = (v: number | string | null | undefined) => (v === null || v === undefined ? '' : String(v));
const num = (v: string) => (v.trim() === '' ? null : Number(v.replace(',', '.')));

function linhaVazia(tipo: TipoItem): Linha {
    return {
        key: proximaChave++, tipo, descricao: '', grupo: '', minutos: '', insumoId: '', insumoTexto: '',
        quantidade: '', equipamentoId: '', equipamentoTexto: '', vidaUtilMeses: '', rendimento: '1',
    };
}

function linhaDoItem(item: ItemFicha & { nome?: string }): Linha {
    return {
        ...linhaVazia(item.tipo),
        descricao: txt(item.descricao),
        grupo: txt(item.grupo),
        minutos: txt(item.minutos),
        insumoId: txt(item.insumoId),
        insumoTexto: item.tipo === 'INSUMO' ? txt(item.nome) : '',
        quantidade: txt(item.quantidade),
        equipamentoId: txt(item.equipamentoId),
        equipamentoTexto: item.tipo === 'EQUIPAMENTO' ? txt(item.nome) : '',
        vidaUtilMeses: txt(item.vidaUtilMeses),
        rendimento: txt(item.rendimento),
    };
}

function linhaCompleta(l: Linha): boolean {
    const rendimento = num(l.rendimento);
    if (!rendimento || rendimento <= 0) return false;
    if (l.tipo === 'ATIVIDADE') return num(l.minutos) !== null;
    if (l.tipo === 'INSUMO') return Boolean(l.insumoId) && num(l.quantidade) !== null;
    return Boolean(l.equipamentoId);
}

function itemDaLinha(l: Linha): ItemFicha {
    return {
        tipo: l.tipo,
        descricao: l.descricao || null,
        grupo: l.grupo || null,
        minutos: num(l.minutos),
        insumoId: l.insumoId || null,
        quantidade: num(l.quantidade),
        equipamentoId: l.equipamentoId || null,
        vidaUtilMeses: num(l.vidaUtilMeses),
        rendimento: num(l.rendimento) ?? 1,
    };
}

interface ModalProps {
    id?: string;
    insumos: Insumo[];
    equipamentos: Equipamento[];
    onClose: () => void;
    onChanged: () => Promise<void>;
    onAbrir: (id: string) => void;
}

function EnsaioModal({ id, insumos, equipamentos, onClose, onChanged, onAbrir }: ModalProps) {
    const [ensaio, setEnsaio] = useState<EnsaioDetalhe | null>(null);
    const [cadastro, setCadastro] = useState<Cadastro>({
        nome: '', codigoLims: '', metodologia: '', setor: 'FQ', percentualCQ: '15', observacao: '', ativo: true,
    });
    const [linhas, setLinhas] = useState<Linha[]>([]);
    const [calculo, setCalculo] = useState<CalculoFicha | null>(null);
    const [pendencia, setPendencia] = useState<string | null>(null);
    const [erro, setErro] = useState<string | null>(null);
    const [salvando, setSalvando] = useState(false);
    const [alterado, setAlterado] = useState(false);

    const insumosAtivos = useMemo(() => insumos.filter(i => i.ativo), [insumos]);
    const equipamentosAtivos = useMemo(() => equipamentos.filter(e => e.ativo), [equipamentos]);
    const insumoPorId = useMemo(() => new Map(insumos.map(i => [i.id, i])), [insumos]);
    const equipamentoPorId = useMemo(() => new Map(equipamentos.map(e => [e.id, e])), [equipamentos]);

    useEffect(() => {
        if (!id) {
            setLinhas([linhaVazia('ATIVIDADE'), linhaVazia('INSUMO'), linhaVazia('EQUIPAMENTO')]);
            return;
        }
        custosApi<EnsaioDetalhe>(`/ensaios/${id}`).then(data => {
            setEnsaio(data);
            setCadastro({
                nome: data.nome,
                codigoLims: txt(data.codigoLims),
                metodologia: txt(data.metodologia),
                setor: txt(data.setor),
                percentualCQ: txt(data.percentualCQ),
                observacao: txt(data.observacao),
                ativo: data.ativo,
            });
            setPendencia(data.pendencia);
            setLinhas(data.calculo.itens.map(linhaDoItem));
            setCalculo(data.calculo);
            setAlterado(false);
        }).catch(e => setErro(e.message));
    }, [id]);

    // Recalcula no servidor a cada alteração (com pequena espera), usando a
    // mesma regra que grava o custo, só com as linhas já completas.
    const simulacao = useRef(0);
    useEffect(() => {
        if (!alterado) return;
        const rodada = ++simulacao.current;
        const timer = setTimeout(async () => {
            const completas = linhas.filter(linhaCompleta);
            try {
                const r = await custosApi<CalculoFicha>('/ensaios/simular', {
                    method: 'POST',
                    body: JSON.stringify({ itens: completas.map(itemDaLinha), percentualCQ: num(cadastro.percentualCQ) ?? 0 }),
                });
                if (rodada !== simulacao.current) return;
                const porKey = new Map(completas.map((l, i) => [l.key, r.itens[i]]));
                setCalculo({ ...r, itens: linhas.map(l => porKey.get(l.key) ?? null) as CalculoFicha['itens'] });
            } catch (e: any) {
                if (rodada === simulacao.current) setErro(e.message);
            }
        }, 350);
        return () => clearTimeout(timer);
    }, [linhas, cadastro.percentualCQ, alterado]);

    const custoDaLinha = (l: Linha) => {
        const i = linhas.indexOf(l);
        return calculo?.itens[i] ?? null;
    };

    const alterar = (key: number, campos: Partial<Linha>) => {
        setAlterado(true);
        setLinhas(ls => ls.map(l => (l.key === key ? { ...l, ...campos } : l)));
    };
    const adicionar = (tipo: TipoItem) => { setAlterado(true); setLinhas(ls => [...ls, linhaVazia(tipo)]); };
    const remover = (key: number) => { setAlterado(true); setLinhas(ls => ls.filter(l => l.key !== key)); };
    const alterarCadastro = (campos: Partial<Cadastro>) => { setAlterado(true); setCadastro(c => ({ ...c, ...campos })); };

    const escolherInsumo = (l: Linha, texto: string) => {
        const insumo = insumosAtivos.find(i => i.nome === texto);
        alterar(l.key, { insumoTexto: texto, insumoId: insumo?.id ?? '' });
    };
    const escolherEquipamento = (l: Linha, texto: string) => {
        const equipamento = equipamentosAtivos.find(e => e.nome === texto);
        alterar(l.key, { equipamentoTexto: texto, equipamentoId: equipamento?.id ?? '' });
    };

    const executar = async (acao: () => Promise<void>) => {
        setErro(null);
        setSalvando(true);
        try {
            await acao();
        } catch (e: any) {
            setErro(e.message);
        } finally {
            setSalvando(false);
        }
    };

    const salvar = (e: FormEvent) => {
        e.preventDefault();
        const incompletas = linhas.filter(l => !linhaCompleta(l) && (l.descricao || l.minutos || l.insumoTexto || l.quantidade || l.equipamentoTexto));
        if (incompletas.length) {
            setErro(`Há ${incompletas.length} linha(s) incompleta(s) na ficha. Complete ou remova antes de salvar.`);
            return;
        }
        executar(async () => {
            const body = JSON.stringify({ ...cadastro, pendencia, itens: linhas.filter(linhaCompleta).map(itemDaLinha) });
            if (id) {
                await custosApi(`/ensaios/${id}`, { method: 'PUT', body });
                await onChanged();
                onClose();
            } else {
                const criado = await custosApi<{ id: string }>('/ensaios', { method: 'POST', body });
                await onChanged();
                onAbrir(criado.id);
            }
        });
    };

    const duplicar = () => executar(async () => {
        const copia = await custosApi<{ id: string }>(`/ensaios/${id}/duplicar`, { method: 'POST' });
        await onChanged();
        onAbrir(copia.id);
    });

    const excluir = () => {
        if (!window.confirm(`Excluir o ensaio "${cadastro.nome}" e sua ficha técnica?`)) return;
        executar(async () => {
            await custosApi(`/ensaios/${id}`, { method: 'DELETE' });
            await onChanged();
            onClose();
        });
    };

    const fechar = () => {
        if (alterado && !window.confirm('Há alterações não salvas. Fechar mesmo assim?')) return;
        onClose();
    };

    const custoPlanilha = ensaio?.custoPlanilha ?? null;
    const secoes: { tipo: TipoItem; titulo: string; ajuda: string }[] = [
        { tipo: 'ATIVIDADE', titulo: 'Mão de obra', ajuda: 'Minutos do técnico. "Análises por vez" divide atividades feitas em lote.' },
        { tipo: 'INSUMO', titulo: 'Insumos', ajuda: 'Quantidade usada no preparo e quantas análises ela rende (ex.: 10 g numa solução que serve 100 análises).' },
        { tipo: 'EQUIPAMENTO', titulo: 'Equipamentos e calibrações', ajuda: 'Valor ÷ vida útil ÷ análises por dia. Contrato de manutenção: valor ÷ análises.' },
    ];

    return (
        <div className="custos-modal-backdrop" onClick={fechar}>
            <div className="custos-modal largo" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
                <header>
                    <h2>{id ? (ensaio?.nome ?? 'Carregando...') : 'Novo ensaio'}</h2>
                    <button className="custos-icon-btn" onClick={fechar} aria-label="Fechar"><X size={18} /></button>
                </header>
                <form className="custos-modal-body" onSubmit={salvar}>
                    {erro && <div className="custos-feedback error">{erro}</div>}

                    {calculo && (
                        <div className="custos-resumo-ficha">
                            <div><span>Mão de obra</span><strong>{formatBRL(calculo.maoDeObra)}</strong></div>
                            <div><span>Materiais</span><strong>{formatBRL(calculo.materiais)}</strong></div>
                            <div><span>Equipamentos</span><strong>{formatBRL(calculo.equipamentos)}</strong></div>
                            <div><span>CQ ({txt(cadastro.percentualCQ) || 0}%)</span><strong>{formatBRL(calculo.controleQualidade)}</strong></div>
                            <div className="destaque"><span>Custo direto</span><strong>{formatBRL(calculo.total)}</strong></div>
                            {custoPlanilha !== null && (
                                <div><span>Planilha</span><strong>{formatBRL(custoPlanilha)} <Diferenca valor={diferencaPlanilha({ custoPlanilha }, calculo.total)} /></strong></div>
                            )}
                        </div>
                    )}

                    {pendencia && (
                        <div className="custos-pendencia-box">
                            <strong>Conferir esta ficha</strong>
                            <ul>{pendencia.split(/(?<=\.)\s+(?=[A-Z"N])/).map((p, i) => <li key={i}>{p}</li>)}</ul>
                            <div>
                                <button type="button" className="custos-btn" onClick={() => { setPendencia(null); setAlterado(true); }}>
                                    Marcar como conferida (ao salvar)
                                </button>
                            </div>
                        </div>
                    )}

                    <section>
                        <h3>Cadastro</h3>
                        <div className="custos-form">
                            <label className="full">Nome do ensaio
                                <input required value={cadastro.nome} onChange={e => alterarCadastro({ nome: e.target.value })} />
                            </label>
                            <label>Código no LIMS
                                <input value={cadastro.codigoLims} onChange={e => alterarCadastro({ codigoLims: e.target.value })} />
                            </label>
                            <label>Metodologia
                                <input value={cadastro.metodologia} onChange={e => alterarCadastro({ metodologia: e.target.value })} />
                            </label>
                            <label>Setor
                                <select value={cadastro.setor} onChange={e => alterarCadastro({ setor: e.target.value })}>
                                    <option value="">—</option>
                                    {SETORES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                                </select>
                            </label>
                            <label>Controle de qualidade (% sobre o custo)
                                <input type="number" step="any" min="0" max="100" value={cadastro.percentualCQ}
                                    onChange={e => alterarCadastro({ percentualCQ: e.target.value })} />
                            </label>
                        </div>
                    </section>

                    <datalist id="ficha-insumos">{insumosAtivos.map(i => <option key={i.id} value={i.nome} />)}</datalist>
                    <datalist id="ficha-equipamentos">{equipamentosAtivos.map(e => <option key={e.id} value={e.nome} />)}</datalist>

                    {secoes.map(secao => {
                        const daSecao = linhas.filter(l => l.tipo === secao.tipo);
                        return (
                            <section key={secao.tipo}>
                                <div className="custos-secao-ficha">
                                    <h3>{secao.titulo}</h3>
                                    <button type="button" className="custos-btn" onClick={() => adicionar(secao.tipo)}><Plus size={13} /> Linha</button>
                                </div>
                                <p className="custos-ajuda">{secao.ajuda}</p>
                                <div className="custos-ficha-wrap">
                                    <table className="custos-ficha">
                                        <thead>
                                            {secao.tipo === 'ATIVIDADE' && (
                                                <tr><th>Atividade</th><th className="n">Minutos</th><th className="n">Análises por vez</th><th className="n">Custo</th><th /></tr>
                                            )}
                                            {secao.tipo === 'INSUMO' && (
                                                <tr><th>Insumo</th><th className="n">Quantidade</th><th className="n">Rende (análises)</th><th>Solução / etapa</th><th className="n">Custo</th><th /></tr>
                                            )}
                                            {secao.tipo === 'EQUIPAMENTO' && (
                                                <tr><th>Equipamento / calibração</th><th className="n">Vida útil (meses)</th><th className="n">Análises por dia</th><th className="n">Custo</th><th /></tr>
                                            )}
                                        </thead>
                                        <tbody>
                                            {daSecao.length === 0 && (
                                                <tr><td colSpan={6} className="vazio">Nenhuma linha.</td></tr>
                                            )}
                                            {daSecao.map(l => {
                                                const calc = custoDaLinha(l);
                                                const custoCell = (
                                                    <td className="n custo" title={calc?.aviso ?? ''}>
                                                        {calc?.aviso && <AlertTriangle size={12} className="aviso" />}
                                                        {linhaCompleta(l) ? formatBRL(calc?.custo ?? null, 4) : <span className="custos-muted">incompleta</span>}
                                                    </td>
                                                );
                                                const removerCell = (
                                                    <td><button type="button" className="custos-icon-btn danger" onClick={() => remover(l.key)} title="Remover linha"><Trash2 size={14} /></button></td>
                                                );
                                                if (l.tipo === 'ATIVIDADE') return (
                                                    <tr key={l.key}>
                                                        <td><input value={l.descricao} placeholder="Ex.: Análise e divulgação" onChange={e => alterar(l.key, { descricao: e.target.value })} /></td>
                                                        <td className="n"><input type="number" step="any" min="0" value={l.minutos} onChange={e => alterar(l.key, { minutos: e.target.value })} /></td>
                                                        <td className="n"><input type="number" step="any" min="0" value={l.rendimento} onChange={e => alterar(l.key, { rendimento: e.target.value })} /></td>
                                                        {custoCell}{removerCell}
                                                    </tr>
                                                );
                                                if (l.tipo === 'INSUMO') {
                                                    const insumo = insumoPorId.get(l.insumoId);
                                                    return (
                                                        <tr key={l.key}>
                                                            <td>
                                                                <input list="ficha-insumos" value={l.insumoTexto} placeholder="Buscar insumo..."
                                                                    className={l.insumoTexto && !l.insumoId ? 'invalido' : ''}
                                                                    onChange={e => escolherInsumo(l, e.target.value)} />
                                                            </td>
                                                            <td className="n">
                                                                <div className="com-unidade">
                                                                    <input type="number" step="any" min="0" value={l.quantidade} onChange={e => alterar(l.key, { quantidade: e.target.value })} />
                                                                    <span>{insumo?.unidade ?? ''}</span>
                                                                </div>
                                                            </td>
                                                            <td className="n"><input type="number" step="any" min="0" value={l.rendimento} onChange={e => alterar(l.key, { rendimento: e.target.value })} /></td>
                                                            <td><input value={l.grupo} placeholder="Opcional" onChange={e => alterar(l.key, { grupo: e.target.value })} /></td>
                                                            {custoCell}{removerCell}
                                                        </tr>
                                                    );
                                                }
                                                const equipamento = equipamentoPorId.get(l.equipamentoId);
                                                const manutencao = equipamento?.tipo === 'MANUTENCAO';
                                                return (
                                                    <tr key={l.key}>
                                                        <td>
                                                            <input list="ficha-equipamentos" value={l.equipamentoTexto} placeholder="Buscar equipamento..."
                                                                className={l.equipamentoTexto && !l.equipamentoId ? 'invalido' : ''}
                                                                onChange={e => escolherEquipamento(l, e.target.value)} />
                                                        </td>
                                                        <td className="n">
                                                            {manutencao ? <span className="custos-muted">—</span> : (
                                                                <input type="number" step="any" min="0" value={l.vidaUtilMeses}
                                                                    placeholder={equipamento?.vidaUtilMeses ? String(equipamento.vidaUtilMeses) : 'informar'}
                                                                    onChange={e => alterar(l.key, { vidaUtilMeses: e.target.value })} />
                                                            )}
                                                        </td>
                                                        <td className="n">
                                                            <input type="number" step="any" min="0" value={l.rendimento} title={manutencao ? 'Análises que dividem o valor do contrato' : 'Análises por dia que usam o equipamento'}
                                                                onChange={e => alterar(l.key, { rendimento: e.target.value })} />
                                                        </td>
                                                        {custoCell}{removerCell}
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </section>
                        );
                    })}

                    <section>
                        <div className="custos-form">
                            <label className="full">Observação
                                <textarea value={cadastro.observacao} onChange={e => alterarCadastro({ observacao: e.target.value })} />
                            </label>
                            {id && (
                                <label className="check full">
                                    <input type="checkbox" checked={cadastro.ativo} onChange={e => alterarCadastro({ ativo: e.target.checked })} />
                                    Ativo
                                </label>
                            )}
                        </div>
                        {ensaio?.origem && <p className="custos-ajuda">Importado da aba "{ensaio.origem}" da planilha de custos.</p>}
                    </section>

                    <div className="custos-form-actions sticky">
                        {id && <button type="button" className="custos-btn danger" onClick={excluir} disabled={salvando}><Trash2 size={14} /> Excluir</button>}
                        {id && <button type="button" className="custos-btn" onClick={duplicar} disabled={salvando}><Copy size={14} /> Duplicar</button>}
                        <button className="custos-btn primary" disabled={salvando}>{id ? 'Salvar ficha' : 'Cadastrar ensaio'}</button>
                    </div>
                </form>
            </div>
        </div>
    );
}

// ── Parâmetros gerais ──────────────────────────────────────

function ParametrosModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => Promise<void> }) {
    const [parametros, setParametros] = useState<Parametro[]>([]);
    const [valores, setValores] = useState<Record<string, string>>({});
    const [erro, setErro] = useState<string | null>(null);
    const [salvando, setSalvando] = useState(false);

    useEffect(() => {
        custosApi<Parametro[]>('/parametros').then(lista => {
            setParametros(lista);
            setValores(Object.fromEntries(lista.map(p => [p.chave, String(p.valor)])));
        }).catch(e => setErro(e.message));
    }, []);

    const salvar = async (e: FormEvent) => {
        e.preventDefault();
        setSalvando(true);
        setErro(null);
        try {
            await custosApi('/parametros', { method: 'PUT', body: JSON.stringify(valores) });
            await onSaved();
            onClose();
        } catch (err: any) {
            setErro(err.message);
            setSalvando(false);
        }
    };

    const rotulos: Record<string, string> = {
        custoMinutoTecnico: 'Custo do minuto do técnico (R$)',
        diasUteisMes: 'Dias úteis por mês',
    };

    return (
        <div className="custos-modal-backdrop" onClick={onClose}>
            <div className="custos-modal" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
                <header>
                    <h2>Parâmetros do custeio</h2>
                    <button className="custos-icon-btn" onClick={onClose} aria-label="Fechar"><X size={18} /></button>
                </header>
                <form className="custos-modal-body" onSubmit={salvar}>
                    {erro && <div className="custos-feedback error">{erro}</div>}
                    <p className="custos-ajuda">Valem para todos os ensaios. Ao salvar, os custos são recalculados.</p>
                    <div className="custos-form">
                        {parametros.map(p => (
                            <label key={p.chave} className="full">{rotulos[p.chave] ?? p.chave}
                                <input type="number" step="any" min="0" value={valores[p.chave] ?? ''}
                                    onChange={e => setValores({ ...valores, [p.chave]: e.target.value })} />
                                <small className="custos-ajuda">{p.descricao}</small>
                            </label>
                        ))}
                        <div className="custos-form-actions">
                            <button className="custos-btn primary" disabled={salvando}>Salvar parâmetros</button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
}
