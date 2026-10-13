import { FormEvent, useMemo, useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronRight, Plus, Search, Trash2, X } from 'lucide-react';
import {
    EnsaioResumo, GrupoAnalitico, GrupoInput, SETORES, Servico,
    custosApi, formatBRL, grupoParaInput, labelSetor, normalizar,
} from './custosApi';

interface Props {
    servicos: Servico[];
    ensaios: EnsaioResumo[];
    recarregar: () => Promise<void>;
}

export default function ServicosTab({ servicos, ensaios, recarregar }: Props) {
    const [busca, setBusca] = useState('');
    const [expandidos, setExpandidos] = useState<Set<string>>(new Set());
    const [modalServico, setModalServico] = useState<Servico | 'novo' | null>(null);
    const [modalGrupo, setModalGrupo] = useState<{ servico: Servico; grupo?: GrupoAnalitico } | null>(null);

    const filtrados = useMemo(() => {
        const termo = normalizar(busca.trim());
        if (!termo) return servicos;
        return servicos.filter(s => normalizar(`${s.nome} ${s.codigo ?? ''}`).includes(termo));
    }, [servicos, busca]);

    const alternar = (id: string) => setExpandidos(prev => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id); else next.add(id);
        return next;
    });

    const fecharModais = async () => { await recarregar(); setModalServico(null); setModalGrupo(null); };

    return (
        <>
            <div className="custos-toolbar">
                <div className="custos-search">
                    <Search size={16} />
                    <input placeholder="Buscar serviço ou código..." value={busca} onChange={e => setBusca(e.target.value)} />
                </div>
                <button className="custos-btn primary" onClick={() => setModalServico('novo')}>
                    <Plus size={14} /> Novo serviço
                </button>
            </div>

            <div className="servicos-lista">
                {filtrados.length === 0 ? (
                    <div className="custos-table-wrap">
                        <p className="vazio">
                            {servicos.length === 0
                                ? 'Nenhum serviço cadastrado. Cadastre o primeiro serviço vendido e seus grupos de preço.'
                                : 'Nenhum serviço encontrado com esse termo.'}
                        </p>
                    </div>
                ) : filtrados.map(s => {
                    const aberto = expandidos.has(s.id);
                    const margemTotal = s.grupos.reduce((acc, g) => acc + g.margem.margemContribuicao, 0);
                    const avisos = s.grupos.reduce((acc, g) => acc + g.margem.qtdAvisos + (g.pendencia ? 1 : 0), 0);
                    return (
                        <div className={`servico-card${s.ativo ? '' : ' inativo'}`} key={s.id}>
                            <button className="servico-head" onClick={() => alternar(s.id)}>
                                {aberto ? <ChevronDown size={17} /> : <ChevronRight size={17} />}
                                <div className="servico-head-info">
                                    <span className="servico-nome">
                                        {s.nome}
                                        {s.codigo && <span className="custos-badge neutro">{s.codigo}</span>}
                                        {!s.ativo && <span className="custos-badge inativo">inativo</span>}
                                    </span>
                                    <span className="servico-sub">
                                        {s.grupos.length} grupo{s.grupos.length === 1 ? '' : 's'} de preço
                                        {avisos > 0 && (
                                            <span className="custos-badge pendencia"><AlertTriangle size={11} /> {avisos} a conferir</span>
                                        )}
                                    </span>
                                </div>
                                <span className={`servico-margem ${margemTotal >= 0 ? 'ok' : 'alerta'}`}>
                                    {formatBRL(margemTotal)}
                                    <small>margem total</small>
                                </span>
                            </button>

                            {aberto && (
                                <div className="servico-body">
                                    {s.grupos.length === 0 ? (
                                        <p className="custos-ajuda">Nenhum grupo de preço ainda.</p>
                                    ) : s.grupos.map(g => (
                                        <GrupoCard key={g.id} grupo={g} onEditar={() => setModalGrupo({ servico: s, grupo: g })} />
                                    ))}
                                    <div className="servico-acoes">
                                        <button className="custos-btn" onClick={() => setModalGrupo({ servico: s })}>
                                            <Plus size={13} /> Grupo de preço
                                        </button>
                                        <button className="custos-btn" onClick={() => setModalServico(s)}>Editar serviço</button>
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
            <p className="custos-rodape">
                {filtrados.length} de {servicos.length} serviços. A margem de contribuição é calculada ao vivo (preço − imposto −
                custo direto dos ensaios do grupo) e nunca é gravada — reflete sempre os preços vigentes hoje.
            </p>

            {modalServico && (
                <ServicoModal
                    servico={modalServico === 'novo' ? null : modalServico}
                    ensaios={ensaios}
                    onClose={() => setModalServico(null)}
                    onSaved={fecharModais}
                />
            )}
            {modalGrupo && (
                <GrupoModal
                    servico={modalGrupo.servico}
                    grupo={modalGrupo.grupo}
                    ensaios={ensaios}
                    onClose={() => setModalGrupo(null)}
                    onSaved={fecharModais}
                />
            )}
        </>
    );
}

// ── Cartão de grupo analítico (lista, somente leitura) ─────────────────────

function GrupoCard({ grupo, onEditar }: { grupo: GrupoAnalitico; onEditar: () => void }) {
    const { margem } = grupo;
    const positiva = margem.margemContribuicao >= 0;
    const custoPct = grupo.precoVenda > 0 ? Math.min(100, (margem.custoDireto / grupo.precoVenda) * 100) : 0;
    const impostoPct = grupo.precoVenda > 0 ? Math.min(100 - custoPct, (margem.imposto / grupo.precoVenda) * 100) : 0;
    const margemPct = Math.max(0, 100 - custoPct - impostoPct);
    const temAviso = Boolean(grupo.pendencia) || margem.qtdAvisos > 0;

    return (
        <button className="grupo-card" onClick={onEditar}>
            <div className="grupo-card-head">
                <span className="grupo-nome">{grupo.nome}</span>
                {grupo.setor && <span className="custos-badge neutro">{labelSetor(grupo.setor)}</span>}
                <span className="custos-badge neutro">{grupo.ensaios.length} ensaio{grupo.ensaios.length === 1 ? '' : 's'}</span>
                {temAviso && (
                    <span className="custos-badge pendencia" title={grupo.pendencia ?? margem.avisos.join(' ')}>
                        <AlertTriangle size={11} /> conferir
                    </span>
                )}
            </div>

            <div className="grupo-stats">
                <div><span>Preço de venda</span><strong>{formatBRL(grupo.precoVenda)}</strong></div>
                <div><span>Custo direto</span><strong>{formatBRL(margem.custoDireto)}</strong></div>
                <div><span>Imposto</span><strong>{formatBRL(margem.imposto)}</strong></div>
                <div className={`destaque ${positiva ? 'ok' : 'alerta'}`}>
                    <span>Margem de contribuição</span>
                    <strong>
                        {formatBRL(margem.margemContribuicao)}
                        <small>{margem.percentualMargem === null ? '—' : `${margem.percentualMargem.toFixed(1)}%`}</small>
                    </strong>
                </div>
            </div>

            <div className={`grupo-bar${positiva ? '' : ' negativa'}`}>
                <i className="custo" style={{ width: `${custoPct}%` }} title={`Custo direto · ${formatBRL(margem.custoDireto)}`} />
                <i className="imposto" style={{ width: `${impostoPct}%` }} title={`Imposto · ${formatBRL(margem.imposto)}`} />
                {positiva && <i className="margem" style={{ width: `${margemPct}%` }} title={`Margem · ${formatBRL(margem.margemContribuicao)}`} />}
            </div>
        </button>
    );
}

// ── Formulário de grupo (compartilhado: novo serviço e grupo novo/editar) ──

interface GrupoFormValue {
    nome: string;
    setor: string;
    precoVenda: string;
    chips: { id: string; nome: string }[];
    nomeAllims: string;
    pendencia: string;
}

const grupoFormVazio = (): GrupoFormValue => ({ nome: '', setor: '', precoVenda: '', chips: [], nomeAllims: '', pendencia: '' });

const grupoFormDoGrupo = (g: GrupoAnalitico): GrupoFormValue => ({
    nome: g.nome,
    setor: g.setor ?? '',
    precoVenda: String(g.precoVenda),
    chips: g.ensaios.map(e => ({ id: e.ensaioId, nome: e.ensaio.nome })),
    nomeAllims: g.nomeAllims ?? '',
    pendencia: g.pendencia ?? '',
});

const grupoInputDoForm = (v: GrupoFormValue): GrupoInput => ({
    nome: v.nome.trim(),
    setor: v.setor || null,
    precoVenda: Number(v.precoVenda.replace(',', '.')) || 0,
    nomeAllims: v.nomeAllims.trim() || null,
    pendencia: v.pendencia.trim() || null,
    ensaioIds: v.chips.map(c => c.id),
});

function CamposGrupoForm({ value, onChange, ensaios, idDatalist }: {
    value: GrupoFormValue;
    onChange: (v: GrupoFormValue) => void;
    ensaios: EnsaioResumo[];
    idDatalist: string;
}) {
    const [buscaEnsaio, setBuscaEnsaio] = useState('');
    const [avancadoAberto, setAvancadoAberto] = useState(Boolean(value.nomeAllims || value.pendencia));
    const ensaiosAtivos = useMemo(() => ensaios.filter(e => e.ativo), [ensaios]);
    const opcoes = useMemo(() => ensaiosAtivos.filter(e => !value.chips.some(c => c.id === e.id)), [ensaiosAtivos, value.chips]);

    const adicionarEnsaio = (nomeDigitado: string) => {
        const encontrado = ensaiosAtivos.find(e => e.nome === nomeDigitado);
        if (!encontrado) { setBuscaEnsaio(nomeDigitado); return; }
        if (value.chips.some(c => c.id === encontrado.id)) { setBuscaEnsaio(''); return; }
        onChange({ ...value, chips: [...value.chips, { id: encontrado.id, nome: encontrado.nome }] });
        setBuscaEnsaio('');
    };
    const removerEnsaio = (id: string) => onChange({ ...value, chips: value.chips.filter(c => c.id !== id) });

    return (
        <div className="custos-form">
            <label className="full">Nome do grupo
                <input required value={value.nome} placeholder="Ex.: Água de Rede — Físico-Química"
                    onChange={e => onChange({ ...value, nome: e.target.value })} />
            </label>
            <label>Setor
                <select value={value.setor} onChange={e => onChange({ ...value, setor: e.target.value })}>
                    <option value="">—</option>
                    {SETORES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
            </label>
            <label>Preço de venda (R$)
                <input required type="number" step="any" min="0" value={value.precoVenda}
                    onChange={e => onChange({ ...value, precoVenda: e.target.value })} />
            </label>
            <label className="full">Ensaios incluídos neste preço
                <input list={idDatalist} value={buscaEnsaio} placeholder="Buscar e adicionar ensaio..."
                    onChange={e => adicionarEnsaio(e.target.value)} />
            </label>
            <datalist id={idDatalist}>{opcoes.map(e => <option key={e.id} value={e.nome} />)}</datalist>
            <div className="full grupo-chips">
                {value.chips.length === 0
                    ? <span className="custos-muted">Nenhum ensaio adicionado ainda.</span>
                    : value.chips.map(c => (
                        <span className="grupo-chip" key={c.id}>
                            {c.nome}
                            <button type="button" onClick={() => removerEnsaio(c.id)} aria-label={`Remover ${c.nome}`}><X size={12} /></button>
                        </span>
                    ))}
            </div>

            <button type="button" className="custos-link full" onClick={() => setAvancadoAberto(v => !v)}>
                {avancadoAberto ? 'Ocultar' : 'Mostrar'} campos avançados (Allims, pendência)
            </button>
            {avancadoAberto && (
                <>
                    <label className="full">Nome no Allims <small className="custos-ajuda">(de-para manual, preenchido quando feito)</small>
                        <input value={value.nomeAllims} onChange={e => onChange({ ...value, nomeAllims: e.target.value })} />
                    </label>
                    <label className="full">Pendência
                        <textarea value={value.pendencia} onChange={e => onChange({ ...value, pendencia: e.target.value })} />
                    </label>
                </>
            )}
        </div>
    );
}

// ── Modal: cadastrar/editar o serviço (nome/código/observação) ────────────

function ServicoModal({ servico, ensaios, onClose, onSaved }: {
    servico: Servico | null;
    ensaios: EnsaioResumo[];
    onClose: () => void;
    onSaved: () => Promise<void>;
}) {
    const [nome, setNome] = useState(servico?.nome ?? '');
    const [codigo, setCodigo] = useState(servico?.codigo ?? '');
    const [observacao, setObservacao] = useState(servico?.observacao ?? '');
    const [ativo, setAtivo] = useState(servico?.ativo ?? true);
    const [grupoValor, setGrupoValor] = useState<GrupoFormValue>(grupoFormVazio());
    const [erro, setErro] = useState<string | null>(null);
    const [salvando, setSalvando] = useState(false);

    const executar = async (acao: () => Promise<void>) => {
        setErro(null);
        setSalvando(true);
        try {
            await acao();
        } catch (e: any) {
            setErro(e.message);
            setSalvando(false);
        }
    };

    const salvar = (e: FormEvent) => {
        e.preventDefault();
        if (!servico && grupoValor.chips.length === 0) {
            setErro('Adicione pelo menos um ensaio ao primeiro grupo de preço.');
            return;
        }
        executar(async () => {
            const base: Record<string, unknown> = { nome, codigo: codigo || null, observacao: observacao || null };
            if (servico) {
                base.ativo = ativo;
                await custosApi(`/servicos/${servico.id}`, { method: 'PUT', body: JSON.stringify(base) });
            } else {
                base.grupos = [grupoInputDoForm(grupoValor)];
                await custosApi('/servicos', { method: 'POST', body: JSON.stringify(base) });
            }
            await onSaved();
        });
    };

    const excluir = () => {
        if (!servico || !window.confirm(`Excluir o serviço "${servico.nome}" e todos os seus grupos de preço?`)) return;
        executar(async () => {
            await custosApi(`/servicos/${servico.id}`, { method: 'DELETE' });
            await onSaved();
        });
    };

    return (
        <div className="custos-modal-backdrop" onClick={onClose}>
            <div className="custos-modal" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
                <header>
                    <h2>{servico ? servico.nome : 'Novo serviço'}</h2>
                    <button className="custos-icon-btn" onClick={onClose} aria-label="Fechar"><X size={18} /></button>
                </header>
                <form className="custos-modal-body" onSubmit={salvar}>
                    {erro && <div className="custos-feedback error">{erro}</div>}

                    <section>
                        <h3>Cadastro</h3>
                        <div className="custos-form">
                            <label className="full">Nome do serviço
                                <input required value={nome} placeholder="Ex.: Água de Rede" onChange={e => setNome(e.target.value)} />
                            </label>
                            <label>Código de referência
                                <input value={codigo} onChange={e => setCodigo(e.target.value)} />
                            </label>
                            {servico && (
                                <label className="check">
                                    <input type="checkbox" checked={ativo} onChange={e => setAtivo(e.target.checked)} /> Ativo
                                </label>
                            )}
                            <label className="full">Observação
                                <textarea value={observacao} onChange={e => setObservacao(e.target.value)} />
                            </label>
                        </div>
                    </section>

                    {!servico && (
                        <section>
                            <h3>Primeiro grupo de preço</h3>
                            <p className="custos-ajuda">
                                Todo serviço precisa de ao menos um grupo com preço próprio. Depois de criado, use "Grupo de
                                preço" na lista para adicionar outros (ex.: um grupo Físico-Química e outro Microbiologia,
                                cada um com seu preço).
                            </p>
                            <CamposGrupoForm value={grupoValor} onChange={setGrupoValor} ensaios={ensaios} idDatalist="novo-servico-ensaios" />
                        </section>
                    )}

                    <div className="custos-form-actions">
                        {servico && <button type="button" className="custos-btn danger" onClick={excluir} disabled={salvando}><Trash2 size={14} /> Excluir</button>}
                        <button className="custos-btn primary" disabled={salvando}>{servico ? 'Salvar' : 'Cadastrar serviço'}</button>
                    </div>
                </form>
            </div>
        </div>
    );
}

// ── Modal: adicionar/editar um grupo de preço de um serviço existente ─────

function GrupoModal({ servico, grupo, ensaios, onClose, onSaved }: {
    servico: Servico;
    grupo?: GrupoAnalitico;
    ensaios: EnsaioResumo[];
    onClose: () => void;
    onSaved: () => Promise<void>;
}) {
    const [valor, setValor] = useState<GrupoFormValue>(grupo ? grupoFormDoGrupo(grupo) : grupoFormVazio());
    const [erro, setErro] = useState<string | null>(null);
    const [salvando, setSalvando] = useState(false);

    const executar = async (acao: () => Promise<void>) => {
        setErro(null);
        setSalvando(true);
        try {
            await acao();
        } catch (e: any) {
            setErro(e.message);
            setSalvando(false);
        }
    };

    // A API substitui todos os grupos do serviço a cada PUT — então toda
    // gravação (criar, editar ou excluir um grupo) reenvia a lista inteira.
    const montarGrupos = (substituto: GrupoInput | null): GrupoInput[] => {
        const demais = servico.grupos.filter(g => g.id !== grupo?.id).map(grupoParaInput);
        return substituto ? [...demais, substituto] : demais;
    };

    const gravar = (grupos: GrupoInput[]) => custosApi(`/servicos/${servico.id}`, {
        method: 'PUT',
        body: JSON.stringify({ nome: servico.nome, codigo: servico.codigo, observacao: servico.observacao, grupos }),
    });

    const salvar = (e: FormEvent) => {
        e.preventDefault();
        if (valor.chips.length === 0) {
            setErro('Escolha pelo menos um ensaio para este grupo.');
            return;
        }
        executar(async () => {
            await gravar(montarGrupos(grupoInputDoForm(valor)));
            await onSaved();
        });
    };

    const excluir = () => {
        if (!grupo) return;
        if (servico.grupos.length <= 1) {
            setErro('Este é o único grupo do serviço. Para removê-lo, exclua o serviço inteiro em vez do grupo.');
            return;
        }
        if (!window.confirm(`Excluir o grupo "${grupo.nome}"?`)) return;
        executar(async () => {
            await gravar(montarGrupos(null));
            await onSaved();
        });
    };

    return (
        <div className="custos-modal-backdrop" onClick={onClose}>
            <div className="custos-modal" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
                <header>
                    <h2>{grupo ? grupo.nome : `Novo grupo — ${servico.nome}`}</h2>
                    <button className="custos-icon-btn" onClick={onClose} aria-label="Fechar"><X size={18} /></button>
                </header>
                <form className="custos-modal-body" onSubmit={salvar}>
                    {erro && <div className="custos-feedback error">{erro}</div>}

                    {grupo && (
                        <div className="custos-resumo-ficha">
                            <div><span>Custo direto</span><strong>{formatBRL(grupo.margem.custoDireto)}</strong></div>
                            <div><span>Imposto</span><strong>{formatBRL(grupo.margem.imposto)}</strong></div>
                            <div className={`destaque ${grupo.margem.margemContribuicao >= 0 ? 'ok' : 'alerta'}`}>
                                <span>Margem de contribuição</span>
                                <strong>
                                    {formatBRL(grupo.margem.margemContribuicao)}
                                    {' · '}{grupo.margem.percentualMargem === null ? '—' : `${grupo.margem.percentualMargem.toFixed(1)}%`}
                                </strong>
                            </div>
                        </div>
                    )}

                    <CamposGrupoForm value={valor} onChange={setValor} ensaios={ensaios} idDatalist="grupo-ensaios-picker" />

                    <div className="custos-form-actions">
                        {grupo && <button type="button" className="custos-btn danger" onClick={excluir} disabled={salvando}><Trash2 size={14} /> Excluir grupo</button>}
                        <button className="custos-btn primary" disabled={salvando}>{grupo ? 'Salvar grupo' : 'Adicionar grupo'}</button>
                    </div>
                </form>
            </div>
        </div>
    );
}
