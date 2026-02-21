import React, { useState } from 'react';
import { authAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { User, Lock, Mail, ArrowRight } from 'lucide-react';

export default function LoginView() {
    const { login } = useAuth();
    const [isRegister, setIsRegister] = useState(false);
    const [identifier, setIdentifier] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [loading, setLoading] = useState(false);

    const handleAuth = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            if (isRegister) {
                await authAPI.register({ name, email: identifier, password });
                alert('Registration successful! Please log in.');
                setIsRegister(false);
            } else {
                const res = await authAPI.login({
                    [identifier.includes('@') ? 'email' : 'phone']: identifier,
                    password
                });
                login(res.data.user, res.data.token);
            }
        } catch (err) {
            alert(err.response?.data?.message || 'Authentication failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-view">
            <div className="auth-card">
                <div className="auth-logo">
                    <span className="emoji">🌏</span>
                    <h1 className="glow-text" style={{ fontSize: '2rem' }}>ECOPLAY</h1>
                    <p className="auth-subtitle">Gamifying the Planet</p>
                </div>

                <form onSubmit={handleAuth} className="auth-form">
                    {isRegister && (
                        <div className="input-group">
                            <label>Full Name</label>
                            <div className="input-wrapper">
                                <User className="input-icon" size={18} />
                                <input
                                    type="text"
                                    placeholder="Enter your name"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    required
                                />
                            </div>
                        </div>
                    )}

                    <div className="input-group">
                        <label>Email or Phone</label>
                        <div className="input-wrapper">
                            <Mail className="input-icon" size={18} />
                            <input
                                type="text"
                                placeholder="name@ecoplay.io"
                                value={identifier}
                                onChange={(e) => setIdentifier(e.target.value)}
                                required
                            />
                        </div>
                    </div>

                    <div className="input-group">
                        <label>Password</label>
                        <div className="input-wrapper">
                            <Lock className="input-icon" size={18} />
                            <input
                                type="password"
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                            />
                        </div>
                    </div>

                    <button type="submit" className="primary-btn" disabled={loading}>
                        {loading ? 'Processing...' : isRegister ? 'Create Account' : 'Sign In'}
                        {!loading && <ArrowRight size={18} />}
                    </button>
                </form>

                <div style={{ textAlign: 'center' }}>
                    <button onClick={() => setIsRegister(!isRegister)} className="toggle-auth-btn">
                        {isRegister ? 'Already have an account? Sign In' : 'New here? Create Account'}
                    </button>
                </div>
            </div>
        </div>
    );
}
