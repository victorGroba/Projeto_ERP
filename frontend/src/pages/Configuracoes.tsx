import React, { useState } from 'react';
import axios from 'axios';
import { Database, RefreshCw, CheckCircle, AlertTriangle } from 'lucide-react';
import './Configuracoes.css';

export const Configuracoes = () => {
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState<null | 'success' | 'error'>(null);
    const [message, setMessage] = useState('');

    const handleRunETL = async () => {
        setLoading(true);
        setStatus(null);
        try {
            const token = localStorage.getItem('@ContaAzul:token');
            const response = await axios.post('http://localhost:3001/api/etl/sync', {}, {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            });
            setStatus('success');
            setMessage(response.data.message || 'Sincronização concluída!');
        } catch (error: any) {
            setStatus('error');
            setMessage(error.response?.data?.error || 'Erro na sincronização');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="config-page">
            <header className="page-header">
                <h2>Configurações do Sistema</h2>
                <p>Gerencie as integrações e sincronização de dados</p>
            </header>

            <div className="config-grid">
                <div className="config-card">
                    <div className="card-icon">
                        <Database size={28} color="#38bdf8" />
                    </div>
                    <h3>Sincronização Conta Azul</h3>
                    <p>Execute o processo de ETL (Extração, Transformação e Carga) manualmente para atualizar os dashboards com os dados mais recentes do ERP.</p>

                    <button
                        className={`sync-btn ${loading ? 'loading' : ''}`}
                        onClick={handleRunETL}
                        disabled={loading}
                    >
                        <RefreshCw size={18} className={loading ? 'spin' : ''} />
                        {loading ? 'Sincronizando Dados...' : 'Rodar Sincronização (ETL)'}
                    </button>

                    {status && (
                        <div className={`status-badge ${status}`}>
                            {status === 'success' ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
                            {message}
                        </div>
                    )}
                </div>

                <div className="config-card">
                    <h3>Grupos Econômicos (De-Para)</h3>
                    <p>O gerenciamento completo de CNPJs e classificações Público/Privado estará disponível nesta aba futuramente.</p>
                    <button className="secondary-btn" disabled>Acessar Gestão de Clientes</button>
                </div>
            </div>
        </div>
    );
};
