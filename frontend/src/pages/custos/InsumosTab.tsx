import { FormEvent, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Plus, Search, Trash2, X } from 'lucide-react';
import {
    CATEGORIAS_INSUMO, Insumo, SETORES, UNIDADES,
    custosApi, formatBRL, formatData, formatPrecoUnitario, hojeISO, labelSetor, normalizar,
} from './custosApi';

interface Props {
    insumos: Insumo[];
    recarregar: () => Promise<void>;
}

type ModalState = { modo: 'novo' } | { modo: 'editar'; id: string } | null;

export default function InsumosTab({ insumos, recarregar }: Props) {
    const [busca, setBusca] = useState('');
    const [setor, setSetor] = useState('');
    const [categoria, setCategoria] = useState('');
    const [soPendencias, setSoPendencias] = useState(false);
    const [mostrarInativos, setMostrarInativos] = useState(false);
    const [modal, setModal] = useState<ModalState>(null);

    const filtrados = useMemo(() => {
        const termo = normalizar(busca.trim());
        return insumos.filter(i =>
            (mostrarInativos || i.ativo)
            && (!setor || i.setor === setor)
            && (!categoria || i.categoria === categoria)
            && (!soPendencias || i.pendencia)
            && (!termo || normalizar(i.nome).includes(termo)));
    }, [insumos, busca, setor, categoria, soPendencias, mostrarInativos]);

    const qtdPendencias = insumos.filter(i => i.ativo && i.pendencia).length;

    return (
        <>
            <div className="custos-toolbar">
                <div className="custos-search">
                    <Search size={16} />
                    <input placeholder="Buscar insumo..." value={busca} onChange={e => setBusca(e.target.value)} />
                </div>
                <select value={setor} onChange={e => setSetor(e.target.value)} aria-label="Setor">
                    <option value="">Todos os setores</option>
                    {SETORES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
                <select value={categoria} onChange={e => setCategoria(e.target.value)} aria-label="Categoria">
                    <option value="">Todas as categorias</option>
                    {CATEGORIAS_INSUMO.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <button
                    className={`custos-btn toggle${soPendencias ? ' active' : ''}`}
                    onClick={() => setSoPendencias(v => !v)}
                    title="Itens que precisam ser conferidos"
                >
                    <AlertTriangle size={14} /> Pendências ({qtdPendencias})
                </button>
                <label style={{ display: 'flex', alignItems: 'center', gap: '.35rem', fontSize: '.78rem', color: 'var(--text-muted)' }}>
                    <input type="checkbox" checked={mostrarInativos} onChange={e => setMostrarInativos(e.target.checked)} />
                    Inativos
                </label>
                <button className="custos-btn primary" onClick={() => setModal({ modo: 'novo' })}>
                    <Plus size={14} /> Novo insumo
                </button>
            </div>

            <div className="custos-table-wrap">
                <table className="custos-table">
                    <thead>
                        <tr>
                            <th>Insumo</th>
                            <th>Categoria</th>
                            <th>Setor</th>
                            <th className="num">Embalagem</th>
                            <th className="num">Preço embalagem</th>
                            <th className="num">Preço unitário</th>
                            <th>Vigência</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filtrados.length === 0 ? (
                            <tr><td colSpan={7} className="vazio">
                                {insumos.length === 0
                                    ? 'Nenhum insumo cadastrado. Importe a planilha de custos ou cadastre manualmente.'
                                    : 'Nenhum insumo encontrado com esses filtros.'}
                            </td></tr>
                        ) : filtrados.map(i => (
                            <tr key={i.id} className={i.ativo ? '' : 'inativo'} onClick={() => setModal({ modo: 'editar', id: i.id })}>
                                <td className="nome">
                                    {i.nome}
                                    {i.pendencia && <span className="custos-badge pendencia" title={i.pendencia}><AlertTriangle size={11} /> conferir</span>}
                                    {!i.ativo && <span className="custos-badge inativo">inativo</span>}
                                </td>
                                <td>{i.categoria ?? '—'}</td>
                                <td className="setor">{labelSetor(i.setor)}</td>
                                <td className="num">{i.precoAtual ? `${i.precoAtual.qtdEmbalagem.toLocaleString('pt-BR')} ${i.unidade ?? '?'}` : '—'}</td>
                                <td className="num">{formatBRL(i.precoAtual?.precoEmbalagem)}</td>
                                <td className="num">
                                    {i.precoAtual ? `${formatPrecoUnitario(i.precoAtual.precoUnitario)}/${i.unidade ?? '?'}` : '—'}
                                </td>
                                <td>{formatData(i.precoAtual?.vigencia)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <p className="custos-rodape">{filtrados.length} de {insumos.length} insumos. Clique em um insumo para ver o histórico ou atualizar o preço.</p>

            {modal && (
                <InsumoModal
                    id={modal.modo === 'editar' ? modal.id : undefined}
                    onClose={() => setModal(null)}
                    onChanged={recarregar}
                    onCreated={id => setModal({ modo: 'editar', id })}
                />
            )}
        </>
    );
}

// ── Detalhe / cadastro ─────────────────────────────────────

interface CadastroForm {
    nome: string;
    unidade: string;
    categoria: string;
    setor: string;
    observacao: string;
    ativo: boolean;
}

interface PrecoForm {
    precoEmbalagem: string;
    qtdEmbalagem: string;
    vigencia: string;
    fornecedor: string;
}

const cadastroVazio: CadastroForm = { nome: '', unidade: '', categoria: 'Reagente', setor: 'FQ', observacao: '', ativo: true };
const precoVazio = (): PrecoForm => ({ precoEmbalagem: '', qtdEmbalagem: '', vigencia: hojeISO(), fornecedor: '' });

function precoUnitarioDe(form: PrecoForm): number | null {
    const preco = Number(form.precoEmbalagem);
    const qtd = Number(form.qtdEmbalagem);
    return form.precoEmbalagem !== '' && qtd > 0 && Number.isFinite(preco) ? preco / qtd : null;
}

interface ModalProps {
    id?: string;
    onClose: () => void;
    onChanged: () => Promise<void>;
    onCreated: (id: string) => void;
}

function InsumoModal({ id, onClose, onChanged, onCreated }: ModalProps) {
    const [insumo, setInsumo] = useState<Insumo | null>(null);
    const [cadastro, setCadastro] = useState<CadastroForm>(cadastroVazio);
    const [preco, setPreco] = useState<PrecoForm>(precoVazio);
    const [erro, setErro] = useState<string | null>(null);
    const [salvando, setSalvando] = useState(false);

    const carregar = async () => {
        if (!id) return;
        const data = await custosApi<Insumo>(`/insumos/${id}`);
        setInsumo(data);
        setCadastro({
            nome: data.nome,
            unidade: data.unidade ?? '',
            categoria: data.categoria ?? '',
            setor: data.setor ?? '',
            observacao: data.observacao ?? '',
            ativo: data.ativo,
        });
        setPreco({ ...precoVazio(), qtdEmbalagem: data.precoAtual ? String(data.precoAtual.qtdEmbalagem) : '' });
    };

    useEffect(() => {
        carregar().catch(e => setErro(e.message));
    }, [id]);

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

    const salvarCadastro = (e: FormEvent) => {
        e.preventDefault();
        executar(async () => {
            if (id) {
                await custosApi(`/insumos/${id}`, {
                    method: 'PUT',
                    body: JSON.stringify({ ...cadastro, pendencia: insumo?.pendencia ?? null }),
                });
                await Promise.all([carregar(), onChanged()]);
            } else {
                const criado = await custosApi<{ id: string }>('/insumos', {
                    method: 'POST',
                    body: JSON.stringify(preco.precoEmbalagem ? { ...cadastro, ...preco } : cadastro),
                });
                await onChanged();
                onCreated(criado.id);
            }
        });
    };

    const resolverPendencia = () => executar(async () => {
        await custosApi(`/insumos/${id}`, { method: 'PUT', body: JSON.stringify({ ...cadastro, pendencia: null }) });
        await Promise.all([carregar(), onChanged()]);
    });

    const registrarPreco = (e: FormEvent) => {
        e.preventDefault();
        executar(async () => {
            await custosApi(`/insumos/${id}/precos`, { method: 'POST', body: JSON.stringify(preco) });
            await Promise.all([carregar(), onChanged()]);
        });
    };

    const excluirPreco = (precoId: string) => {
        if (!window.confirm('Excluir este registro de preço do histórico?')) return;
        executar(async () => {
            await custosApi(`/insumos/${id}/precos/${precoId}`, { method: 'DELETE' });
            await Promise.all([carregar(), onChanged()]);
        });
    };

    const excluirInsumo = () => {
        if (!window.confirm(`Excluir "${insumo?.nome}" e todo o histórico de preços? Se ele só não é mais usado, prefira marcar como inativo.`)) return;
        executar(async () => {
            await custosApi(`/insumos/${id}`, { method: 'DELETE' });
            await onChanged();
            onClose();
        });
    };

    const novoUnitario = precoUnitarioDe(preco);
    const atual = insumo?.precoAtual ?? null;
    const variacao = novoUnitario !== null && atual ? (novoUnitario / atual.precoUnitario - 1) * 100 : null;
    const unidade = cadastro.unidade || '?';
    const agora = Date.now();

    return (
        <div className="custos-modal-backdrop" onClick={onClose}>
            <div className="custos-modal" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
                <header>
                    <h2>{id ? insumo?.nome ?? 'Carregando...' : 'Novo insumo'}</h2>
                    <button className="custos-icon-btn" onClick={onClose} aria-label="Fechar"><X size={18} /></button>
                </header>

                <div className="custos-modal-body">
                    {erro && <div className="custos-feedback error">{erro}</div>}

                    {insumo?.pendencia && (
                        <div className="custos-pendencia-box">
                            <strong>Conferir este cadastro</strong>
                            {insumo.pendencia}
                            <div>
                                <button className="custos-btn" onClick={resolverPendencia} disabled={salvando}>Marcar como conferido</button>
                            </div>
                        </div>
                    )}

                    {id && insumo && (
                        <section>
                            <h3>Preço vigente</h3>
                            <div className="custos-preco-atual">
                                <div><span>Embalagem</span><strong>{atual ? `${atual.qtdEmbalagem.toLocaleString('pt-BR')} ${unidade}` : '—'}</strong></div>
                                <div><span>Preço da embalagem</span><strong>{formatBRL(atual?.precoEmbalagem)}</strong></div>
                                <div><span>Preço por {unidade}</span><strong>{formatPrecoUnitario(atual?.precoUnitario)}</strong></div>
                            </div>
                        </section>
                    )}

                    {id && (
                        <section>
                            <h3>Atualizar preço</h3>
                            <form className="custos-form" onSubmit={registrarPreco}>
                                <PrecoCampos preco={preco} setPreco={setPreco} unidade={unidade} />
                                {novoUnitario !== null && (
                                    <div className="calculado">
                                        Novo preço: {formatPrecoUnitario(novoUnitario)}/{unidade}
                                        {variacao !== null && ` (${variacao >= 0 ? '+' : ''}${variacao.toFixed(1)}% em relação ao vigente)`}
                                    </div>
                                )}
                                <div className="custos-form-actions">
                                    <button className="custos-btn primary" disabled={salvando || novoUnitario === null}>Registrar novo preço</button>
                                </div>
                            </form>
                        </section>
                    )}

                    {id && insumo?.precos && insumo.precos.length > 0 && (
                        <section>
                            <h3>Histórico de preços</h3>
                            <table className="custos-historico">
                                <thead>
                                    <tr>
                                        <th>Vigência</th>
                                        <th className="num">Embalagem</th>
                                        <th className="num">Preço</th>
                                        <th className="num">Por {unidade}</th>
                                        <th className="num">Var.</th>
                                        <th>Origem</th>
                                        <th />
                                    </tr>
                                </thead>
                                <tbody>
                                    {insumo.precos.map((p, idx, lista) => {
                                        const anterior = lista[idx + 1];
                                        const v = anterior ? (p.precoUnitario / anterior.precoUnitario - 1) * 100 : null;
                                        const futuro = new Date(p.vigencia).getTime() > agora;
                                        return (
                                            <tr key={p.id} className={p.id === atual?.id ? 'vigente' : futuro ? 'futuro' : ''}>
                                                <td>{formatData(p.vigencia)}{futuro && ' (futuro)'}</td>
                                                <td className="num">{p.qtdEmbalagem.toLocaleString('pt-BR')}</td>
                                                <td className="num">{formatBRL(p.precoEmbalagem)}</td>
                                                <td className="num">{formatPrecoUnitario(p.precoUnitario)}</td>
                                                <td className={`num variacao ${v === null ? '' : v > 0 ? 'up' : 'down'}`}>
                                                    {v === null || Math.abs(v) < 0.05 ? '—' : `${v > 0 ? '+' : ''}${v.toFixed(1)}%`}
                                                </td>
                                                <td title={p.origem ?? ''}>{p.fornecedor || (p.origem === 'Manual' ? 'Manual' : 'Planilha')}</td>
                                                <td>
                                                    <button className="custos-icon-btn danger" onClick={() => excluirPreco(p.id)} title="Excluir do histórico">
                                                        <Trash2 size={14} />
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </section>
                    )}

                    <section>
                        <h3>Cadastro</h3>
                        <form className="custos-form" onSubmit={salvarCadastro}>
                            <label className="full">Nome
                                <input required value={cadastro.nome} onChange={e => setCadastro({ ...cadastro, nome: e.target.value })} />
                            </label>
                            <label>Unidade de medida
                                <input list="custos-unidades" placeholder="g, mL, un..." value={cadastro.unidade}
                                    onChange={e => setCadastro({ ...cadastro, unidade: e.target.value })} />
                                <datalist id="custos-unidades">{UNIDADES.map(u => <option key={u} value={u} />)}</datalist>
                            </label>
                            <label>Setor
                                <select value={cadastro.setor} onChange={e => setCadastro({ ...cadastro, setor: e.target.value })}>
                                    <option value="">—</option>
                                    {SETORES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                                </select>
                            </label>
                            <label className="full">Categoria
                                <select value={cadastro.categoria} onChange={e => setCadastro({ ...cadastro, categoria: e.target.value })}>
                                    <option value="">—</option>
                                    {CATEGORIAS_INSUMO.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </label>
                            {!id && (
                                <>
                                    <p className="full" style={{ gridColumn: '1 / -1', color: 'var(--text-muted)', fontSize: '.75rem' }}>
                                        Preço inicial (opcional)
                                    </p>
                                    <PrecoCampos preco={preco} setPreco={setPreco} unidade={unidade} />
                                    {novoUnitario !== null && (
                                        <div className="calculado">Preço unitário: {formatPrecoUnitario(novoUnitario)}/{unidade}</div>
                                    )}
                                </>
                            )}
                            <label className="full">Observação
                                <textarea value={cadastro.observacao} onChange={e => setCadastro({ ...cadastro, observacao: e.target.value })} />
                            </label>
                            {id && (
                                <label className="check full">
                                    <input type="checkbox" checked={cadastro.ativo} onChange={e => setCadastro({ ...cadastro, ativo: e.target.checked })} />
                                    Ativo (desmarque se o insumo não é mais usado)
                                </label>
                            )}
                            <div className="custos-form-actions">
                                {id && <button type="button" className="custos-btn danger" onClick={excluirInsumo} disabled={salvando}><Trash2 size={14} /> Excluir</button>}
                                <button className="custos-btn primary" disabled={salvando}>{id ? 'Salvar cadastro' : 'Cadastrar insumo'}</button>
                            </div>
                        </form>
                    </section>
                </div>
            </div>
        </div>
    );
}

function PrecoCampos({ preco, setPreco, unidade }: { preco: PrecoForm; setPreco: (p: PrecoForm) => void; unidade: string }) {
    return (
        <>
            <label>Preço da embalagem (R$)
                <input type="number" step="any" min="0" value={preco.precoEmbalagem}
                    onChange={e => setPreco({ ...preco, precoEmbalagem: e.target.value })} />
            </label>
            <label>Quantidade na embalagem ({unidade})
                <input type="number" step="any" min="0" value={preco.qtdEmbalagem}
                    onChange={e => setPreco({ ...preco, qtdEmbalagem: e.target.value })} />
            </label>
            <label>Vale a partir de
                <input type="date" value={preco.vigencia} onChange={e => setPreco({ ...preco, vigencia: e.target.value })} />
            </label>
            <label>Fornecedor
                <input value={preco.fornecedor} onChange={e => setPreco({ ...preco, fornecedor: e.target.value })} />
            </label>
        </>
    );
}
