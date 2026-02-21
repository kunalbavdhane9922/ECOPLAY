import React, { useState, useEffect } from 'react';
import { userAPI } from '../services/api';
import { Trophy, Medal, Star } from 'lucide-react';

const DEMO_PLAYERS = [
    { _id: '1', name: 'Arjun Sharma', level: 12, totalPoints: 4520 },
    { _id: '2', name: 'Priya Patel', level: 10, totalPoints: 3890 },
    { _id: '3', name: 'Rahul Verma', level: 9, totalPoints: 3210 },
    { _id: '4', name: 'Sneha Gupta', level: 8, totalPoints: 2780 },
    { _id: '5', name: 'Aditya Kumar', level: 7, totalPoints: 2340 },
    { _id: '6', name: 'Kavya Nair', level: 6, totalPoints: 1980 },
    { _id: '7', name: 'Rohan Joshi', level: 5, totalPoints: 1650 },
    { _id: '8', name: 'Meera Reddy', level: 5, totalPoints: 1420 },
];

export default function LeaderboardView() {
    const [players, setPlayers] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchLeaderboard = async () => {
            try {
                const res = await userAPI.getLeaderboard();
                setPlayers(res.data.leaderboard || []);
            } catch (err) {
                console.error('Using demo leaderboard', err);
                setPlayers(DEMO_PLAYERS);
            } finally {
                setLoading(false);
            }
        };
        fetchLeaderboard();
    }, []);

    const getRankIcon = (index) => {
        if (index === 0) return <Trophy style={{ color: 'var(--secondary)' }} size={22} />;
        if (index === 1) return <Medal style={{ color: '#C0C0C0' }} size={22} />;
        if (index === 2) return <Medal style={{ color: '#CD7F32' }} size={22} />;
        return <span className="rank-number">{index + 1}</span>;
    };

    return (
        <div className="leaderboard-view">
            <div className="view-header" style={{ textAlign: 'center', marginBottom: 40 }}>
                <h1 className="glow-text" style={{ fontSize: '2.2rem' }}>World Hall of Fame</h1>
                <p style={{ color: 'var(--text-secondary)', letterSpacing: 3, textTransform: 'uppercase', fontSize: '0.7rem' }}>
                    Top protectors of the planet
                </p>
            </div>

            {loading ? (
                <div className="loading-container"><div className="loader"></div></div>
            ) : (
                <div className="leaderboard-card">
                    <div className="leaderboard-header">
                        <span>Player Rank</span>
                        <span>Total Mastery (XP)</span>
                    </div>
                    <div>
                        {players.map((player, index) => (
                            <div key={player._id} className="leaderboard-row">
                                <div className="leaderboard-player">
                                    <div className="rank-icon">{getRankIcon(index)}</div>
                                    <div className="player-avatar">👤</div>
                                    <div className="player-info">
                                        <h4>{player.name}</h4>
                                        <p>Level {player.level}</p>
                                    </div>
                                </div>
                                <div className="player-score">
                                    <span>{player.totalPoints}</span>
                                    <Star style={{ color: 'var(--primary)' }} size={16} fill="currentColor" />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
