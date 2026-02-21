import React, { useState } from 'react';
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
    const [activeView, setActiveView] = useState('dashboard');
    const [selectedTaskId, setSelectedTaskId] = useState(null);

    const handleNavigateVerify = (taskId) => {
        setSelectedTaskId(taskId);
        setActiveView('verify');
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

    const renderView = () => {
        switch (activeView) {
            case 'dashboard': return <DashboardView onIslandClick={() => setActiveView('missions')} />;
            case 'map': return <NewMapView onNavigate={setActiveView} />;
            case 'missions': return <MissionsView onVerify={handleNavigateVerify} />;
            case 'report': return <ReportsView />;
            case 'clan': return <ClanView />;
            case 'leaderboard': return <LeaderboardView />;
            case 'impact': return <ImpactView />;
            case 'rewards': return <RewardsView />;
            case 'mobility': return <MobilityView />;
            case 'profile': return <ProfileView />;
            case 'verify': return <VerificationView taskId={selectedTaskId} onBack={() => setActiveView('missions')} />;
            default: return <DashboardView onIslandClick={() => setActiveView('missions')} />;
        }
    };

    return (
        <div className="app-container">
            <Sidebar activeView={activeView} onViewChange={setActiveView} />
            <main className="main-content">
                {renderView()}
            </main>
            {/* Mobile bottom navigation */}
            <nav className="mobile-bottom-nav">
                <div className="mobile-nav-items">
                    {MOBILE_NAV.map(item => (
                        <button
                            key={item.id}
                            onClick={() => setActiveView(item.id)}
                            className={`mobile-nav-item ${activeView === item.id ? 'active' : ''}`}
                        >
                            <item.icon size={20} />
                            <span>{item.label}</span>
                        </button>
                    ))}
                </div>
            </nav>
        </div>
    );
}

function App() {
    return (
        <AuthProvider>
            <SocketProvider>
                <MainApp />
            </SocketProvider>
        </AuthProvider>
    );
}

export default App;

