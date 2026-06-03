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
import {
    LayoutDashboard, AlertTriangle, TrendingDown,
    LogOut, UploadCloud, LineChart, Settings
} from 'lucide-react';
import './index.css';

const NAV_ITEMS = [
    { to: '/',              label: 'Visão Geral',      Icon: LayoutDashboard },
    { to: '/inadimplencia', label: 'Inadimplência',    Icon: AlertTriangle },
    { to: '/despesas',      label: 'Custos & Despesas',Icon: TrendingDown },
    { to: '/evolucao',      label: 'Análise Avançada', Icon: LineChart },
    { to: '/importacao',    label: 'Importação CSV',   Icon: UploadCloud },
    { to: '/configuracoes', label: 'Configurações',    Icon: Settings },
];

const PAGE_TITLES: Record<string, string> = {
    '/':               'Visão Geral',
    '/inadimplencia':  'Inadimplência',
    '/despesas':       'Custos & Despesas',
    '/evolucao':       'Análise Avançada',
    '/importacao':     'Sincronização',
    '/configuracoes':  'Configurações',
};

function MainLayout() {
    const { logout, user } = useAuth();
    const location = useLocation();
    const title = PAGE_TITLES[location.pathname] ?? 'Painel';

    return (
        <div className="dashboard-container">
            <aside className="sidebar">
                <div className="logo">C.A. BI</div>
                <nav>
                    <ul>
                        {NAV_ITEMS.map(({ to, label, Icon }) => (
                            <li key={to}>
                                <NavLink
                                    to={to}
                                    end={to === '/'}
                                    className={({ isActive }) => isActive ? 'active' : ''}
                                >
                                    <Icon size={16} />
                                    {label}
                                </NavLink>
                            </li>
                        ))}
                        <li>
                            <a href="#" onClick={e => { e.preventDefault(); logout(); }}>
                                <LogOut size={16} />
                                Sair
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
                            <Route path="/despesas"     element={<Despesas />} />
                            <Route path="/evolucao"       element={<EvolucaoMensal />} />
                            <Route path="/configuracoes" element={<Configuracoes />} />
                            <Route path="*"              element={<Navigate to="/" replace />} />
                        </Route>
                    </Route>
                </Routes>
            </BrowserRouter>
        </AuthProvider>
    );
}

export default App;
