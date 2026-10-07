import { useCallback, useEffect, useRef, useState } from 'react';
import { BarChart3, FlaskConical, Microscope, UploadCloud } from 'lucide-react';
import { Equipamento, Insumo, custosApi } from './custosApi';
import InsumosTab from './InsumosTab';
import EquipamentosTab from './EquipamentosTab';
import PainelExemplo from './PainelExemplo';
import './Custos.css';

type Aba = 'insumos' | 'equipamentos' | 'painel';
const ABA_KEY = 'ca-bi:custos-aba';

function abaInicial(): Aba {
    try {
        const salva = localStorage.getItem(ABA_KEY);
        if (salva === 'insumos' || salva === 'equipamentos' || salva === 'painel') return salva;
    } catch { /* sem storage: usa o padrão */ }
    return 'insumos';
}

export default function CustosLaboratorio() {
    const [aba, setAba] = useState<Aba>(abaInicial);
    const [insumos, setInsumos] = useState<Insumo[]>([]);
    const [equipamentos, setEquipamentos] = useState<Equipamento[]>([]);
    const [carregando, setCarregando] = useState(true);
    const [feedback, setFeedback] = useState<{ tipo: 'success' | 'error'; texto: string } | null>(null);
    const [arquivo, setArquivo] = useState<File | null>(null);
    const [importando, setImportando] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    const recarregarInsumos = useCallback(async () => setInsumos(await custosApi<Insumo[]>('/insumos')), []);
    const recarregarEquipamentos = useCallback(async () => setEquipamentos(await custosApi<Equipamento[]>('/equipamentos')), []);

    useEffect(() => {
        Promise.all([recarregarInsumos(), recarregarEquipamentos()])
            .catch(e => setFeedback({ tipo: 'error', texto: e.message }))
            .finally(() => setCarregando(false));
    }, [recarregarInsumos, recarregarEquipamentos]);

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
            await Promise.all([recarregarInsumos(), recarregarEquipamentos()]);
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
                        Aceita a planilha de Físico-Química (abas "Insumos MM" e "Equipamentos MM") e a de Microbiologia
                        (fichas e abas de calibração). Pode importar de novo quando a planilha for atualizada: nada é duplicado
                        e preços diferentes entram no histórico com a data do nome do arquivo.
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
                <button className={aba === 'insumos' ? 'active' : ''} onClick={() => trocarAba('insumos')}>
                    <FlaskConical size={15} /> Insumos <span className="tab-count">{insumos.length}</span>
                </button>
                <button className={aba === 'equipamentos' ? 'active' : ''} onClick={() => trocarAba('equipamentos')}>
                    <Microscope size={15} /> Equipamentos e calibrações <span className="tab-count">{equipamentos.length}</span>
                </button>
                <button className={`tab-exemplo${aba === 'painel' ? ' active' : ''}`} onClick={() => trocarAba('painel')}>
                    <BarChart3 size={15} /> Painel (exemplo)
                </button>
            </nav>

            {carregando ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Carregando cadastros...</div>
            ) : aba === 'insumos' ? (
                <InsumosTab insumos={insumos} recarregar={recarregarInsumos} />
            ) : aba === 'equipamentos' ? (
                <EquipamentosTab equipamentos={equipamentos} recarregar={recarregarEquipamentos} />
            ) : (
                <>
                    <div className="custos-aviso-exemplo">
                        Este painel ainda usa valores de exemplo. Ele passará a usar os custos reais quando as fichas técnicas
                        dos ensaios forem cadastradas (próxima fase).
                    </div>
                    <PainelExemplo />
                </>
            )}
        </div>
    );
}
