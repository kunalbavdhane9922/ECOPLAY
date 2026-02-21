import React from 'react';
import {
    Map as MapIcon,
    Globe,
    ClipboardList,
    FileText,
    Users,
    Trophy,
    BarChart3,
    Wallet,
    Footprints,
    User,
    LogOut
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const menuItems = [
    { id: 'dashboard', label: 'World Map', icon: Globe },
    { id: 'map', label: 'Live Eco Map', icon: MapIcon },
    { id: 'missions', label: 'Missions', icon: ClipboardList },
    { id: 'report', label: 'Report Issue', icon: FileText },
    { id: 'clan', label: 'Eco Clans', icon: Users },
    { id: 'leaderboard', label: 'Ranking', icon: Trophy },
    { id: 'impact', label: 'Impact', icon: BarChart3 },
    { id: 'rewards', label: 'Rewards', icon: Wallet },
    { id: 'mobility', label: 'Mobility Tracker', icon: Footprints },
    { id: 'profile', label: 'Profile', icon: User },
];

export default function Sidebar({ activeView, onViewChange }) {
    const { logout, user } = useAuth();

    return (
        <aside className="sidebar">
            <div className="sidebar-header">
                <div className="logo-container">
                    <span className="logo-emoji">🌍</span>
                    <h1 className="logo-text">ECOPLAY</h1>
                </div>

                <nav className="sidebar-nav">
                    {menuItems.map((item) => (
                        <button
                            key={item.id}
                            onClick={() => onViewChange(item.id)}
                            className={`nav-item ${activeView === item.id ? 'active' : ''}`}
                        >
                            <item.icon size={18} />
                            <span>{item.label}</span>
                        </button>
                    ))}
                </nav>
            </div>

            <div className="sidebar-footer">
                <div className="user-mini-profile">
                    <div className="mini-avatar">
                        <span>👤</span>
                    </div>
                    <div className="mini-user-info">
                        <p className="mini-name">{user?.name || 'Explorer'}</p>
                        <p className="mini-level">Level {user?.level || 1}</p>
                    </div>
                </div>
                <button onClick={logout} className="logout-btn">
                    <LogOut size={18} />
                    <span>Sign Out</span>
                </button>
            </div>
        </aside>
    );
}
