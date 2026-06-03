import { createContext, useState, useEffect, ReactNode, useContext } from 'react';
import axios from 'axios';

// ...


interface User {
    id: string;
    name: string;
    email: string;
    role: string;
}

interface AuthContextData {
    user: User | null;
    isAuthenticated: boolean;
    login: (token: string, user: User) => void;
    logout: () => void;
}

export const AuthContext = createContext<AuthContextData>({} as AuthContextData);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const storagedToken = localStorage.getItem('@ContaAzul:token');
        const storagedUser = localStorage.getItem('@ContaAzul:user');

        if (storagedToken && storagedUser) {
            setUser(JSON.parse(storagedUser));
            axios.defaults.headers.common['Authorization'] = `Bearer ${storagedToken}`;
        }
        setLoading(false);
    }, []);

    const login = (token: string, loggedUser: User) => {
        setUser(loggedUser);
        localStorage.setItem('@ContaAzul:token', token);
        localStorage.setItem('@ContaAzul:user', JSON.stringify(loggedUser));
        axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    };

    const logout = () => {
        setUser(null);
        localStorage.removeItem('@ContaAzul:token');
        localStorage.removeItem('@ContaAzul:user');
        delete axios.defaults.headers.common['Authorization'];
    };

    if (loading) {
        return <div style={{ color: 'white' }}>Carregando...</div>;
    }

    return (
        <AuthContext.Provider value={{ user, isAuthenticated: !!user, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    return useContext(AuthContext);
};
