import { useCallback, useEffect, useRef, useState } from 'react';
import { BarChart3, Briefcase, ClipboardList, FlaskConical, Microscope, UploadCloud } from 'lucide-react';
import { EnsaioResumo, Equipamento, Insumo, Servico, custosApi } from './custosApi';
import EnsaiosTab from './EnsaiosTab';
import InsumosTab from './InsumosTab';
import EquipamentosTab from './EquipamentosTab';
import ServicosTab from './ServicosTab';
import PainelExemplo from './PainelExemplo';
import './Custos.css';

type Aba = 'ensaios' | 'insumos' | 'equipamentos' | 'servicos' | 'painel';
const ABA_KEY = 'ca-bi:custos-aba';

function abaInicial(): Aba {
    try {
        const salva = localStorage.getItem(ABA_KEY);
        if (salva === 'ensaios' || salva === 'insumos' || salva === 'equipamentos' || salva === 'servicos' || salva === 'painel') return salva;
    } catch { /* sem storage: usa o padrão */ }
    return 'ensaios';
}

export default function CustosLaboratorio() {
    const [aba, setAba] = useState<Aba>(abaInicial);
    const [insumos, setInsumos] = useState<Insumo[]>([]);
    const [equipamentos, setEquipamentos] = useState<Equipamento[]>([]);
    const [ensaios, setEnsaios] = useState<EnsaioResumo[]>([]);
    const [servicos, setServicos] = useState<Servico[]>([]);
    const [carregando, setCarregando] = useState(true);
    const [feedback, setFeedback] = useState<{ tipo: 'success' | 'error'; texto: string } | null>(null);
    const [arquivo, setArquivo] = useState<File | null>(null);
    const [importando, setImportando] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    const recarregarInsumos = useCallback(async () => setInsumos(await custosApi<Insumo[]>('/insumos')), []);
    const recarregarEquipamentos = useCallback(async () => setEquipamentos(await custosApi<Equipamento[]>('/equipamentos')), []);
    const recarregarEnsaios = useCallback(async () => setEnsaios(await custosApi<EnsaioResumo[]>('/ensaios')), []);
    const recarregarServicos = useCallback(async () => setServicos(await custosApi<Servico[]>('/servicos')), []);
    // Preço de insumo ou valor de equipamento muda o custo dos ensaios e, por
    // tabela, a margem de cada grupo analítico — por isso recarrega tudo junto.
    const recarregarCadastrosEEnsaios = useCallback(
        async () => { await Promise.all([recarregarInsumos(), recarregarEquipamentos(), recarregarEnsaios(), recarregarServicos()]); },
        [recarregarInsumos, recarregarEquipamentos, recarregarEnsaios, recarregarServicos],
    );

    useEffect(() => {
        recarregarCadastrosEEnsaios()
            .catch(e => setFeedback({ tipo: 'error', texto: e.message }))
            .finally(() => setCarregando(false));
    }, [recarregarCadastrosEEnsaios]);

    const trocarAba = (nova: Aba) => {
        setAba(nova);
        try { localStorage.setItem(ABA_KEY, nova); } catch { /* ignora */ }
    };

    const importar = async () => {
        if (!arquivo) return;
        setImportando(true);
        setFeedback(null);
        try {
            const form = new FormData();
            form.append('file', arquivo);
            const r = await custosApi<{ message: string }>('/importar-planilha', { method: 'POST', body: form });
            setFeedback({ tipo: 'success', texto: r.message });
            setArquivo(null);
            if (inputRef.current) inputRef.current.value = '';
            await recarregarCadastrosEEnsaios();
        } catch (e: any) {
            setFeedback({ tipo: 'error', texto: e.message });
        } finally {
            setImportando(false);
        }
    };

    return (
        <div className="custos-page">
            <div className="custos-import">
                <div>
                    <h3>Importar planilha de custos</h3>
                    <p>
                        Aceita a planilha de Físico-Química e a de Microbiologia: traz insumos, equipamentos e a ficha técnica
                        de cada ensaio. Pode importar de novo quando a planilha for atualizada: nada é duplicado, fichas já
                        cadastradas não são alteradas e preços diferentes entram no histórico com a data do nome do arquivo.
                    </p>
                </div>
                <div className="custos-import-action">
                    <input ref={inputRef} type="file" accept=".xlsx,.xls" onChange={e => setArquivo(e.target.files?.[0] ?? null)} />
                    <button className="custos-btn primary" onClick={importar} disabled={!arquivo || importando}>
                        <UploadCloud size={14} /> {importando ? 'Importando...' : 'Importar'}
                    </button>
                </div>
            </div>

            {feedback && <div className={`custos-feedback ${feedback.tipo}`}>{feedback.texto}</div>}

            <nav className="custos-tabs">
                <button className={aba === 'ensaios' ? 'active' : ''} onClick={() => trocarAba('ensaios')}>
                    <ClipboardList size={15} /> Ensaios <span className="tab-count">{ensaios.length}</span>
                </button>
                <button className={aba === 'insumos' ? 'active' : ''} onClick={() => trocarAba('insumos')}>
                    <FlaskConical size={15} /> Insumos <span className="tab-count">{insumos.length}</span>
                </button>
                <button className={aba === 'equipamentos' ? 'active' : ''} onClick={() => trocarAba('equipamentos')}>
                    <Microscope size={15} /> Equipamentos e calibrações <span className="tab-count">{equipamentos.length}</span>
                </button>
                <button className={aba === 'servicos' ? 'active' : ''} onClick={() => trocarAba('servicos')}>
                    <Briefcase size={15} /> Serviços e margem <span className="tab-count">{servicos.length}</span>
                </button>
                <button className={`tab-exemplo${aba === 'painel' ? ' active' : ''}`} onClick={() => trocarAba('painel')}>
                    <BarChart3 size={15} /> Painel (exemplo)
                </button>
            </nav>

            {carregando ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Carregando cadastros...</div>
            ) : aba === 'ensaios' ? (
                <EnsaiosTab ensaios={ensaios} insumos={insumos} equipamentos={equipamentos} recarregar={recarregarEnsaios} />
            ) : aba === 'insumos' ? (
                <InsumosTab insumos={insumos} recarregar={recarregarCadastrosEEnsaios} />
            ) : aba === 'equipamentos' ? (
                <EquipamentosTab equipamentos={equipamentos} recarregar={recarregarCadastrosEEnsaios} />
            ) : aba === 'servicos' ? (
                <ServicosTab servicos={servicos} ensaios={ensaios} recarregar={recarregarCadastrosEEnsaios} />
            ) : (
                <>
                    <div className="custos-aviso-exemplo">
                        Este painel ainda usa valores de exemplo. Os custos reais de cada ensaio estão na aba Ensaios; os
                        gráficos passarão a usá-los junto com a margem de contribuição (próxima fase).
                    </div>
                    <PainelExemplo />
                </>
            )}
        </div>
    );
}
