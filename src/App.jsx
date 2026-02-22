import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import Sidebar from './components/Sidebar';
import DashboardView from './views/DashboardView';
import NewMapView from './views/map';
import MissionsView from './views/MissionsView';
import ClanView from './views/ClanView';
import LeaderboardView from './views/LeaderboardView';
import ImpactView from './views/ImpactView';
import ProfileView from './views/ProfileView';
import ReportsView from './views/ReportsView';
import RewardsView from './views/RewardsView';
import MobilityView from './views/MobilityView';
import LoginView from './views/LoginView';
import VerificationView from './views/VerificationView';
import { Globe, Map as MapIcon, ClipboardList, FileText, Users, User } from 'lucide-react';
import './App.css';
import MidView from './views/MidView';

const MOBILE_NAV = [
    { id: 'dashboard', label: 'Map', icon: Globe },
    { id: 'map', label: 'Live Map', icon: MapIcon },
    { id: 'missions', label: 'Missions', icon: ClipboardList },
    { id: 'report', label: 'Report', icon: FileText },
    { id: 'clan', label: 'Clans', icon: Users },
    { id: 'profile', label: 'Profile', icon: User },
];


function MainApp() {
    const { user, loading } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    // Get active view from path
    const activeView = location.pathname.substring(1) || 'dashboard';

    const handleNavigateVerify = (taskId) => {
        navigate(`/verify/${taskId}`);
    };

    if (loading) {
        return (
            <div className="fullscreen-loader">
                <div className="loader"></div>
            </div>
        );
    }

    if (!user) {
        return <LoginView />;
    }

    return (
        <div className="app-container">
            <Sidebar activeView={activeView} onViewChange={(view) => navigate(`/${view}`)} />
            <main className="main-content">
                <Routes>
                    <Route path="/dashboard" element={<DashboardView onBack={() => navigate('/map')} onNavigate={(v) => navigate(`/${v}`)} />} />
                    <Route path="/map" element={<NewMapView onNavigate={(v) => navigate(`/${v}`)} />} />
                    <Route path="/missions" element={<MissionsView onVerify={handleNavigateVerify} />} />
                    <Route path="/report" element={<ReportsView />} />
                    <Route path="/clan" element={<ClanView />} />
                    <Route path="/leaderboard" element={<LeaderboardView />} />
                    <Route path="/impact" element={<ImpactView />} />
                    <Route path="/rewards" element={<RewardsView />} />
                    <Route path="/mobility" element={<MobilityView />} />
                    <Route path="/profile" element={<ProfileView />} />
                    <Route path="/msh" element={<MidView />} />
                    <Route path="/verify/:taskId" element={<VerificationView onBack={() => navigate('/missions')} />} />
                    <Route path="/" element={<Navigate to="/dashboard" replace />} />
                    <Route path="*" element={<Navigate to="/dashboard" replace />} />
                </Routes>
            </main>
        </div>
    );
}

function App() {
    return (
        <AuthProvider>
            <SocketProvider>
                <Router>
                    <MainApp />
                </Router>
            </SocketProvider>
        </AuthProvider>
    );
}

export default App;

