import React, { createContext, useState, useContext, useEffect } from 'react';
import { authAPI } from '../services/api';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const checkAuth = async () => {
            const token = localStorage.getItem('authToken');
            if (token) {
                try {
                    const res = await authAPI.getMe();
                    setUser(res.data.user);
                } catch (err) {
                    console.error('Session expired');
                    localStorage.removeItem('authToken');
                }
            }
            setLoading(false);
        };
        checkAuth();
    }, []);

    const login = async (userData, token) => {
        localStorage.setItem('authToken', token);
        setUser(userData);
    };

    const logout = () => {
        localStorage.removeItem('authToken');
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{ user, login, logout, loading, setUser }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
