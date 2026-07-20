import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, NavLink, Outlet, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Login } from './pages/Login';
import VistaoGeral from './pages/VistaoGeral';
import Inadimplencia from './pages/Inadimplencia';
import Importacao from './pages/Importacao';
import Despesas from './pages/Despesas';
import EvolucaoMensal from './pages/EvolucaoMensal';
import Configuracoes from './pages/Configuracoes';
import DocumentacaoKPIs from './pages/DocumentacaoKPIs';
import ApiContaAzul from './pages/ApiContaAzul';
import HistoricoImportacoes from './pages/HistoricoImportacoes';
import {
    LayoutDashboard, AlertTriangle, TrendingDown,
    LogOut, UploadCloud, LineChart, Settings, BookOpen,
    PanelLeftClose, PanelLeftOpen, Plug, History
} from 'lucide-react';
import './index.css';

const SIDEBAR_COLLAPSED_KEY = 'ca-bi:sidebar-collapsed';

const NAV_ITEMS = [
    { to: '/',              label: 'Visão Geral',      Icon: LayoutDashboard },
    { to: '/inadimplencia', label: 'Inadimplência',    Icon: AlertTriangle },
    { to: '/despesas',      label: 'Custos & Despesas',Icon: TrendingDown },
    { to: '/evolucao',      label: 'Análise Avançada', Icon: LineChart },
    { to: '/api-conta-azul', label: 'API',              Icon: Plug },
    { to: '/importacao',    label: 'Importação CSV',   Icon: UploadCloud },
    { to: '/historico',     label: 'Histórico',        Icon: History },
    { to: '/configuracoes', label: 'Configurações',    Icon: Settings },
    { to: '/kpis',          label: 'Doc. KPIs',        Icon: BookOpen },
];

const PAGE_TITLES: Record<string, string> = {
    '/':               'Visão Geral',
    '/inadimplencia':  'Inadimplência',
    '/despesas':       'Custos & Despesas',
    '/evolucao':       'Análise Avançada',
    '/api-conta-azul': 'Indicadores via API',
    '/importacao':     'Sincronização',
    '/historico':      'Histórico de Importações',
    '/configuracoes':  'Configurações',
    '/kpis':           'Documentação de KPIs',
};

function MainLayout() {
    const { logout, user } = useAuth();
    const location = useLocation();
    const title = PAGE_TITLES[location.pathname] ?? 'Painel';

    const [collapsed, setCollapsed] = useState(
        () => localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1'
    );

    useEffect(() => {
        localStorage.setItem(SIDEBAR_COLLAPSED_KEY, collapsed ? '1' : '0');
    }, [collapsed]);

    return (
        <div className={`dashboard-container${collapsed ? ' sidebar-collapsed' : ''}`}>
            <aside className="sidebar">
                <div className="logo">
                    <span className="logo-text">C.A. BI</span>
                    <button
                        className="sidebar-toggle"
                        onClick={() => setCollapsed(c => !c)}
                        title={collapsed ? 'Expandir menu' : 'Recolher menu'}
                    >
                        {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
                    </button>
                </div>
                <nav>
                    <ul>
                        {NAV_ITEMS.map(({ to, label, Icon }) => (
                            <li key={to}>
                                <NavLink
                                    to={to}
                                    end={to === '/'}
                                    className={({ isActive }) => isActive ? 'active' : ''}
                                    title={label}
                                >
                                    <Icon size={16} />
                                    <span>{label}</span>
                                </NavLink>
                            </li>
                        ))}
                        <li>
                            <a href="#" onClick={e => { e.preventDefault(); logout(); }} title="Sair">
                                <LogOut size={16} />
                                <span>Sair</span>
                            </a>
                        </li>
                    </ul>
                </nav>
            </aside>

            <main className="main-content">
                <header className="topbar">
                    <h1>{title}</h1>
                    <div className="user-profile">
                        <span>{user?.name || user?.email?.split('@')[0] || 'Gestor'}</span>
                    </div>
                </header>
                <section className="content">
                    <Outlet />
                </section>
            </main>
        </div>
    );
}

function App() {
    return (
        <AuthProvider>
            <BrowserRouter>
                <Routes>
                    <Route path="/login" element={<Login />} />
                    <Route element={<ProtectedRoute />}>
                        <Route element={<MainLayout />}>
                            <Route path="/"             element={<VistaoGeral />} />
                            <Route path="/inadimplencia" element={<Inadimplencia />} />
                            <Route path="/importacao"   element={<Importacao />} />
                            <Route path="/historico"    element={<HistoricoImportacoes />} />
                            <Route path="/despesas"     element={<Despesas />} />
                            <Route path="/evolucao"       element={<EvolucaoMensal />} />
                            <Route path="/api-conta-azul" element={<ApiContaAzul />} />
                            <Route path="/configuracoes" element={<Configuracoes />} />
                            <Route path="/kpis"          element={<DocumentacaoKPIs />} />
                            <Route path="*"              element={<Navigate to="/" replace />} />
                        </Route>
                    </Route>
                </Routes>
            </BrowserRouter>
        </AuthProvider>
    );
}

export default App;
