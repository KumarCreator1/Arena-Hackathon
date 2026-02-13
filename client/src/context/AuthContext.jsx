/**
 * Auth Context
 * 
 * Provides user state, login, register, logout across the app.
 * Persists JWT in localStorage, auto-fetches /me on mount.
 */

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(localStorage.getItem('parallax_token'));
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    // Persist token to localStorage
    const saveToken = useCallback((newToken) => {
        if (newToken) {
            localStorage.setItem('parallax_token', newToken);
        } else {
            localStorage.removeItem('parallax_token');
        }
        setToken(newToken);
    }, []);

    // Fetch current user on mount (if token exists)
    useEffect(() => {
        const fetchUser = async () => {
            if (!token) {
                setLoading(false);
                return;
            }
            try {
                const data = await api.get('/auth/me');
                setUser(data.user);
            } catch {
                // Token invalid/expired — clear it
                saveToken(null);
                setUser(null);
            } finally {
                setLoading(false);
            }
        };
        fetchUser();
    }, [token, saveToken]);

    const login = async (email, password) => {
        const data = await api.post('/auth/login', { email, password });
        saveToken(data.token);
        setUser(data.user);
        return data.user;
    };

    const register = async (name, email, password) => {
        const data = await api.post('/auth/register', { name, email, password });
        saveToken(data.token);
        setUser(data.user);
        return data.user;
    };

    const logout = useCallback(() => {
        saveToken(null);
        setUser(null);
        navigate('/login');
    }, [saveToken, navigate]);

    const value = {
        user,
        token,
        loading,
        isAuthenticated: !!user,
        isAdmin: user?.role === 'admin',
        login,
        register,
        logout,
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}

export default AuthContext;
