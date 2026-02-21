import React, { useState, useEffect } from 'react';
import { userAPI } from '../services/api';
import { Leaf, Droplets, Trash2, Wind, Activity } from 'lucide-react';

function ImpactStat({ icon: Icon, label, value, unit, color }) {
    return (
        <div className="card impact-stat-card">
            <div className="impact-stat-icon" style={{ backgroundColor: color + '18', color: color }}>
                <Icon size={28} />
            </div>
            <p className="impact-stat-value">
                {value}
                <span className="impact-stat-unit">{unit}</span>
            </p>
            <p className="impact-stat-label">{label}</p>
            <div className="impact-progress-bar">
                <div className="impact-progress-fill" style={{ width: '65%', backgroundColor: color }}></div>
            </div>
        </div>
    );
}

const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const barData = [40, 70, 45, 90, 65, 80, 50, 60, 85, 40, 55, 75];

export default function ImpactView() {
    const [impact, setImpact] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchImpact = async () => {
            try {
                const res = await userAPI.getImpactOverview();
                setImpact(res.data.impact);
            } catch (err) {
                console.error('Using demo impact data', err);
                setImpact({ treesPlanted: 47, garbageCleared: 128, waterIssuesResolved: 340, co2Reduced: 56 });
            } finally {
                setLoading(false);
            }
        };
        fetchImpact();
    }, []);

    const circumference = 2 * Math.PI * 72;
    const offset = circumference - (0.85 * circumference);

    return (
        <div className="impact-view">
            <div className="view-header-row">
                <div>
                    <h1 className="glow-text" style={{ fontSize: '2.2rem', marginBottom: 8 }}>Planetary Impact</h1>
                    <p style={{ color: 'var(--text-secondary)', letterSpacing: 3, textTransform: 'uppercase', fontSize: '0.7rem' }}>
                        Real-time data from your environmental actions
                    </p>
                </div>
                <div className="header-actions">
                    <button className="secondary-btn">
                        <Activity size={16} /> Global Pulse
                    </button>
                </div>
            </div>

            <div className="impact-stats-grid">
                <ImpactStat icon={Leaf} label="Trees Planted" value={impact?.treesPlanted || 0} unit="units" color="#00C853" />
                <ImpactStat icon={Trash2} label="Garbage Cleared" value={impact?.garbageCleared || 0} unit="kg" color="#FF6D00" />
                <ImpactStat icon={Droplets} label="Water Conserved" value={impact?.waterIssuesResolved || 0} unit="liters" color="#00BCD4" />
                <ImpactStat icon={Wind} label="CO2 Reduced" value={impact?.co2Reduced || 0} unit="kg" color="#9C27B0" />
            </div>

            <div className="impact-bottom-grid">
                <div className="card chart-card">
                    <h3>
                        <Activity style={{ color: 'var(--primary)' }} size={22} />
                        Impact Timeline
                    </h3>
                    <div className="bar-chart">
                        {barData.map((h, i) => (
                            <div key={i} className="bar-wrapper">
                                <div className="bar-fill" style={{ height: `${h}%` }}></div>
                                <div className="bar-tooltip">{h}%</div>
                            </div>
                        ))}
                    </div>
                    <div className="chart-labels">
                        {months.map((m) => <span key={m}>{m}</span>)}
                    </div>
                </div>

                <div className="card goal-card">
                    <div>
                        <h3>Contribution Goal</h3>
                        <p className="goal-desc">
                            Next milestone: Environmental Shield Award (85% progress)
                        </p>
                    </div>
                    <div className="progress-ring-container">
                        <svg viewBox="0 0 160 160">
                            <circle className="progress-ring-bg" cx="80" cy="80" r="72" />
                            <circle
                                className="progress-ring-fill"
                                cx="80" cy="80" r="72"
                                strokeDasharray={circumference}
                                strokeDashoffset={offset}
                            />
                        </svg>
                        <div className="progress-ring-text">
                            <span className="percent">85%</span>
                            <span className="label">Complete</span>
                        </div>
                    </div>
                    <button className="primary-btn" style={{ marginTop: 0 }}>Set New Goal</button>
                </div>
            </div>
        </div>
    );
}
