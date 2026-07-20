import { useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';

interface Historico {
    id: string;
    tipo: string;
    arquivoNome: string;
    dataInicio: string;
    dataFim: string;
    qtdRegistros: number;
    createdAt: string;
}

export default function HistoricoImportacoes() {
    const [historico, setHistorico] = useState<Historico[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchHistorico();
    }, []);

    const fetchHistorico = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await fetch('/api/importacoes/historico', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            if (res.ok) {
                const data = await res.json();
                setHistorico(data);
            }
        } catch (error) {
            console.error('Erro ao buscar histórico:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm('Tem certeza que deseja excluir esta importação? TODOS os registros vinculados a ela serão apagados do sistema.')) {
            return;
        }
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`/api/importacoes/historico/${id}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            if (res.ok) {
                alert('Importação excluída com sucesso.');
                fetchHistorico();
            } else {
                const data = await res.json();
                alert(data.error || 'Erro ao excluir.');
            }
        } catch (error) {
            alert('Erro ao excluir importação.');
        }
    };

    const formatDate = (dateStr: string) => {
        if (!dateStr) return '-';
        // Handle timezone parsing safely
        return new Date(dateStr).toLocaleDateString('pt-BR', { timeZone: 'UTC' });
    };

    if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}>Carregando histórico...</div>;

    return (
        <div className="card">
            <h2 style={{ marginBottom: '1rem' }}>Histórico de Importações CSV</h2>
            <p style={{ color: '#666', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
                Aqui você visualiza os arquivos que foram processados. Clicar em excluir apagará todos os dados financeiros gerados por aquele upload em específico (fazendo um "rollback").
            </p>

            <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '700px' }}>
                    <thead>
                        <tr style={{ borderBottom: '2px solid #eee', color: '#444' }}>
                            <th style={{ padding: '0.75rem' }}>Data do Upload</th>
                            <th style={{ padding: '0.75rem' }}>Arquivo</th>
                            <th style={{ padding: '0.75rem' }}>Tipo</th>
                            <th style={{ padding: '0.75rem' }}>Período Ref.</th>
                            <th style={{ padding: '0.75rem', textAlign: 'right' }}>Registros</th>
                            <th style={{ padding: '0.75rem', textAlign: 'center' }}>Ações</th>
                        </tr>
                    </thead>
                    <tbody>
                        {historico.length === 0 ? (
                            <tr>
                                <td colSpan={6} style={{ padding: '2rem', textAlign: 'center', color: '#888' }}>
                                    Nenhuma importação encontrada.
                                </td>
                            </tr>
                        ) : historico.map(item => (
                            <tr key={item.id} style={{ borderBottom: '1px solid #f5f5f5' }}>
                                <td style={{ padding: '0.75rem' }}>{new Date(item.createdAt).toLocaleString('pt-BR')}</td>
                                <td style={{ padding: '0.75rem', fontSize: '0.9rem', color: '#555' }}>{item.arquivoNome || 'N/A'}</td>
                                <td style={{ padding: '0.75rem', fontWeight: '600', color: item.tipo === 'DESPESAS' ? '#e74c3c' : '#27ae60' }}>
                                    {item.tipo}
                                </td>
                                <td style={{ padding: '0.75rem', fontSize: '0.9rem' }}>
                                    {formatDate(item.dataInicio)} a {formatDate(item.dataFim)}
                                </td>
                                <td style={{ padding: '0.75rem', textAlign: 'right' }}>{item.qtdRegistros}</td>
                                <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                                    <button 
                                        onClick={() => handleDelete(item.id)}
                                        style={{ background: 'none', border: 'none', color: '#e74c3c', cursor: 'pointer', padding: '0.25rem' }}
                                        title="Excluir"
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
