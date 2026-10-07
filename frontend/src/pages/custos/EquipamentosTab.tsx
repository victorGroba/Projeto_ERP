import { FormEvent, useMemo, useState } from 'react';
import { AlertTriangle, Plus, Search, Trash2, X } from 'lucide-react';
import { Equipamento, SETORES, custosApi, formatBRL, labelSetor, normalizar } from './custosApi';

interface Props {
    equipamentos: Equipamento[];
    recarregar: () => Promise<void>;
}

const TIPOS = [
    { value: 'EQUIPAMENTO', label: 'Equipamento' },
    { value: 'CALIBRACAO', label: 'Calibração / qualificação' },
];

export default function EquipamentosTab({ equipamentos, recarregar }: Props) {
    const [busca, setBusca] = useState('');
    const [tipo, setTipo] = useState('');
    const [setor, setSetor] = useState('');
    const [soPendencias, setSoPendencias] = useState(false);
    const [mostrarInativos, setMostrarInativos] = useState(false);
    const [editando, setEditando] = useState<Equipamento | 'novo' | null>(null);

    const filtrados = useMemo(() => {
        const termo = normalizar(busca.trim());
        return equipamentos.filter(e =>
            (mostrarInativos || e.ativo)
            && (!tipo || e.tipo === tipo)
            && (!setor || e.setor === setor)
            && (!soPendencias || e.pendencia)
            && (!termo || normalizar(e.nome).includes(termo)));
    }, [equipamentos, busca, tipo, setor, soPendencias, mostrarInativos]);

    const qtdPendencias = equipamentos.filter(e => e.ativo && e.pendencia).length;

    return (
        <>
            <div className="custos-toolbar">
                <div className="custos-search">
                    <Search size={16} />
                    <input placeholder="Buscar equipamento ou calibração..." value={busca} onChange={e => setBusca(e.target.value)} />
                </div>
                <select value={tipo} onChange={e => setTipo(e.target.value)} aria-label="Tipo">
                    <option value="">Todos os tipos</option>
                    {TIPOS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
                <select value={setor} onChange={e => setSetor(e.target.value)} aria-label="Setor">
                    <option value="">Todos os setores</option>
                    {SETORES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
                <button className={`custos-btn toggle${soPendencias ? ' active' : ''}`} onClick={() => setSoPendencias(v => !v)}>
                    <AlertTriangle size={14} /> Pendências ({qtdPendencias})
                </button>
                <label style={{ display: 'flex', alignItems: 'center', gap: '.35rem', fontSize: '.78rem', color: 'var(--text-muted)' }}>
                    <input type="checkbox" checked={mostrarInativos} onChange={e => setMostrarInativos(e.target.checked)} />
                    Inativos
                </label>
                <button className="custos-btn primary" onClick={() => setEditando('novo')}>
                    <Plus size={14} /> Novo
                </button>
            </div>

            <div className="custos-table-wrap">
                <table className="custos-table">
                    <thead>
                        <tr>
                            <th>Nome</th>
                            <th>Tipo</th>
                            <th>Setor</th>
                            <th className="num">Valor</th>
                            <th className="num">Vida útil / periodicidade</th>
                            <th className="num">Dias de uso/mês</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filtrados.length === 0 ? (
                            <tr><td colSpan={6} className="vazio">
                                {equipamentos.length === 0 ? 'Nenhum equipamento cadastrado.' : 'Nenhum item encontrado com esses filtros.'}
                            </td></tr>
                        ) : filtrados.map(e => (
                            <tr key={e.id} className={e.ativo ? '' : 'inativo'} onClick={() => setEditando(e)}>
                                <td className="nome">
                                    {e.nome}
                                    {e.pendencia && <span className="custos-badge pendencia" title={e.pendencia}><AlertTriangle size={11} /> conferir</span>}
                                    {!e.ativo && <span className="custos-badge inativo">inativo</span>}
                                </td>
                                <td><span className="custos-badge neutro">{e.tipo === 'CALIBRACAO' ? 'Calibração' : 'Equipamento'}</span></td>
                                <td className="setor">{labelSetor(e.setor)}</td>
                                <td className="num">{formatBRL(e.valor)}</td>
                                <td className="num">{e.vidaUtilMeses ? `${e.vidaUtilMeses} meses` : '—'}</td>
                                <td className="num">{e.diasUsoMes ?? '—'}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <p className="custos-rodape">
                {filtrados.length} de {equipamentos.length} itens. A vida útil e os dias de uso serão usados para amortizar o equipamento no custo de cada ensaio.
            </p>

            {editando && (
                <EquipamentoModal
                    equipamento={editando === 'novo' ? null : editando}
                    onClose={() => setEditando(null)}
                    onSaved={async () => { await recarregar(); setEditando(null); }}
                />
            )}
        </>
    );
}

interface ModalProps {
    equipamento: Equipamento | null;
    onClose: () => void;
    onSaved: () => Promise<void>;
}

function EquipamentoModal({ equipamento, onClose, onSaved }: ModalProps) {
    const [form, setForm] = useState({
        nome: equipamento?.nome ?? '',
        tipo: equipamento?.tipo ?? 'EQUIPAMENTO',
        setor: equipamento?.setor ?? 'FQ',
        valor: equipamento?.valor?.toString() ?? '',
        vidaUtilMeses: equipamento?.vidaUtilMeses?.toString() ?? '',
        diasUsoMes: equipamento?.diasUsoMes?.toString() ?? '',
        observacao: equipamento?.observacao ?? '',
        ativo: equipamento?.ativo ?? true,
    });
    const [pendencia, setPendencia] = useState(equipamento?.pendencia ?? null);
    const [erro, setErro] = useState<string | null>(null);
    const [salvando, setSalvando] = useState(false);

    const set = (campo: keyof typeof form) => (e: { target: { value: string } }) => setForm({ ...form, [campo]: e.target.value });

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
        executar(async () => {
            const body = JSON.stringify({ ...form, pendencia });
            if (equipamento) await custosApi(`/equipamentos/${equipamento.id}`, { method: 'PUT', body });
            else await custosApi('/equipamentos', { method: 'POST', body });
            await onSaved();
        });
    };

    const excluir = () => {
        if (!equipamento || !window.confirm(`Excluir "${equipamento.nome}"?`)) return;
        executar(async () => {
            await custosApi(`/equipamentos/${equipamento.id}`, { method: 'DELETE' });
            await onSaved();
        });
    };

    return (
        <div className="custos-modal-backdrop" onClick={onClose}>
            <div className="custos-modal" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
                <header>
                    <h2>{equipamento ? equipamento.nome : 'Novo equipamento ou calibração'}</h2>
                    <button className="custos-icon-btn" onClick={onClose} aria-label="Fechar"><X size={18} /></button>
                </header>
                <div className="custos-modal-body">
                    {erro && <div className="custos-feedback error">{erro}</div>}
                    {pendencia && (
                        <div className="custos-pendencia-box">
                            <strong>Conferir este cadastro</strong>
                            {pendencia}
                            <div>
                                <button type="button" className="custos-btn" onClick={() => setPendencia(null)}>
                                    Marcar como conferido (ao salvar)
                                </button>
                            </div>
                        </div>
                    )}
                    <form className="custos-form" onSubmit={salvar}>
                        <label className="full">Nome
                            <input required value={form.nome} onChange={set('nome')} />
                        </label>
                        <label>Tipo
                            <select value={form.tipo} onChange={set('tipo')}>
                                {TIPOS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                            </select>
                        </label>
                        <label>Setor
                            <select value={form.setor} onChange={set('setor')}>
                                <option value="">—</option>
                                {SETORES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                            </select>
                        </label>
                        <label>{form.tipo === 'CALIBRACAO' ? 'Custo da calibração (R$)' : 'Valor do equipamento (R$)'}
                            <input type="number" step="any" min="0" value={form.valor} onChange={set('valor')} />
                        </label>
                        <label>{form.tipo === 'CALIBRACAO' ? 'Periodicidade (meses)' : 'Vida útil (meses)'}
                            <input type="number" step="1" min="0" value={form.vidaUtilMeses} onChange={set('vidaUtilMeses')} />
                        </label>
                        <label>Dias de uso por mês
                            <input type="number" step="1" min="0" value={form.diasUsoMes} onChange={set('diasUsoMes')} />
                        </label>
                        <label className="full">Observação
                            <textarea value={form.observacao} onChange={set('observacao')} />
                        </label>
                        {equipamento && (
                            <label className="check full">
                                <input type="checkbox" checked={form.ativo} onChange={e => setForm({ ...form, ativo: e.target.checked })} />
                                Ativo
                            </label>
                        )}
                        <div className="custos-form-actions">
                            {equipamento && <button type="button" className="custos-btn danger" onClick={excluir} disabled={salvando}><Trash2 size={14} /> Excluir</button>}
                            <button className="custos-btn primary" disabled={salvando}>{equipamento ? 'Salvar' : 'Cadastrar'}</button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
