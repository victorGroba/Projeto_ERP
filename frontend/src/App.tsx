import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, NavLink, Outlet } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Login } from './pages/Login';
import { Configuracoes } from './pages/Configuracoes';
import { Faturamento } from './pages/Faturamento';
import { Inadimplencia } from './pages/Inadimplencia';
import { LayoutDashboard, Receipt, AlertTriangle, TrendingDown, Settings, LogOut } from 'lucide-react';
import './index.css';

function MainLayout() {
    const { logout } = useAuth();

    return (
        <div className="dashboard-container">
            <aside className="sidebar">
                <div className="logo">C.A. Dashboard</div>
                <nav>
                    <ul>
                        <li><NavLink to="/" className={({ isActive }) => isActive ? "active" : ""}><LayoutDashboard size={18} /> Visão Geral</NavLink></li>
                        <li><NavLink to="/faturamento" className={({ isActive }) => isActive ? "active" : ""}><Receipt size={18} /> Faturamento</NavLink></li>
                        <li><NavLink to="/inadimplencia" className={({ isActive }) => isActive ? "active" : ""}><AlertTriangle size={18} /> Inadimplência</NavLink></li>
                        <li><NavLink to="/despesas" className={({ isActive }) => isActive ? "active" : ""}><TrendingDown size={18} /> Custos</NavLink></li>
                        <li><NavLink to="/configuracoes" className={({ isActive }) => isActive ? "active" : ""}><Settings size={18} /> Integrações</NavLink></li>
                        <li style={{ marginTop: 'auto' }}>
                            <a href="#" onClick={(e) => { e.preventDefault(); logout(); }} style={{ color: '#ef4444' }}>
                                <LogOut size={18} /> Sair
                            </a>
                        </li>
                    </ul>
                </nav>
            </aside>
            <main className="main-content">
                <header className="topbar">
                    <h1>Painel Gerencial</h1>
                    <div className="user-profile">
                        <span>Gestor</span>
                    </div>
                </header>
                <section className="content">
                    <Outlet />
                </section>
            </main>
        </div>
    )
}

function WelcomeScreen() {
    return (
        <div className="card" style={{ animation: 'fadeIn 0.4s ease' }}>
            <h2>Bem-vindo ao Dashboard Financeiro</h2>
            <p>O ambiente foi configurado com sucesso. Selecione <strong>Integrações</strong> no menu lateral para rodar a Primeira Sincronização.</p>
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
                            <Route path="/" element={<WelcomeScreen />} />
                            <Route path="/configuracoes" element={<Configuracoes />} />
                            <Route path="/faturamento" element={<Faturamento />} />
                            <Route path="/inadimplencia" element={<Inadimplencia />} />
                            <Route path="/despesas" element={<div className="card">Módulo de Despesas em construção.</div>} />
                            <Route path="*" element={<Navigate to="/" replace />} />
                        </Route>
                    </Route>
                </Routes>
            </BrowserRouter>
        </AuthProvider>
    );
}

export default App;
