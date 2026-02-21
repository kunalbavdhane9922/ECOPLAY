import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { userAPI, reportAPI, taskAPI } from '../services/api';
import {
    Wallet, TrendingUp, Gift, ArrowRight, Star, Zap,
    IndianRupee, Award, ShieldCheck, TreePine, Trash2,
    Droplets, CheckCircle, Clock, ChevronRight, Sparkles,
    CreditCard, HandCoins, Leaf
} from 'lucide-react';

// Conversion rate: 1 XP = ₹0.50
const XP_TO_INR = 0.50;
const XP_TO_USD = 0.006;

const REWARD_TIERS = [
    { name: 'Seedling', minXP: 0, maxXP: 500, color: '#8B949E', emoji: '🌱', perks: 'Basic rewards access' },
    { name: 'Sapling', minXP: 500, maxXP: 2000, color: '#00C853', emoji: '🌿', perks: '2% bonus on redemptions' },
    { name: 'Tree', minXP: 2000, maxXP: 5000, color: '#FFD700', emoji: '🌳', perks: '5% bonus + exclusive tasks' },
    { name: 'Forest', minXP: 5000, maxXP: 15000, color: '#FF6D00', emoji: '🌲', perks: '10% bonus + NGO partnerships' },
    { name: 'Ecosystem', minXP: 15000, maxXP: Infinity, color: '#E040FB', emoji: '🌍', perks: '15% bonus + direct cashout' },
];

const REDEMPTION_OPTIONS = [
    { id: 'upi', label: 'UPI Transfer', desc: 'Redeem to Paytm, GPay, PhonePe', icon: '💳', minXP: 500, color: '#5C6BC0' },
    { id: 'amazon', label: 'Amazon Gift Card', desc: 'Get Amazon.in vouchers', icon: '🛒', minXP: 1000, color: '#FF9800' },
    { id: 'plant', label: 'Plant a Tree', desc: 'We plant a real tree in your name', icon: '🌳', minXP: 200, color: '#00C853' },
    { id: 'ngo', label: 'Donate to NGO', desc: 'Support environmental NGOs', icon: '💚', minXP: 100, color: '#4CAF50' },
    { id: 'merch', label: 'Eco Merchandise', desc: 'T-shirts, bottles, bags', icon: '👕', minXP: 2000, color: '#00BCD4' },
    { id: 'certificate', label: 'Impact Certificate', desc: 'Verifiable digital certificate', icon: '📜', minXP: 300, color: '#9C27B0' },
];

const POINT_ACTIVITIES = [
    { activity: 'Report Environmental Issue', xp: '50-100', icon: <Trash2 size={16} />, color: '#FF6D00' },
    { activity: 'Complete a Task', xp: '100-500', icon: <CheckCircle size={16} />, color: '#00C853' },
    { activity: 'Tree Verification', xp: '75', icon: <TreePine size={16} />, color: '#4CAF50' },
    { activity: 'Water Issue Report', xp: '80', icon: <Droplets size={16} />, color: '#00BCD4' },
    { activity: 'Daily Login Streak', xp: '10-50', icon: <Zap size={16} />, color: '#FFD700' },
    { activity: 'Community Verification', xp: '25', icon: <ShieldCheck size={16} />, color: '#7C4DFF' },
    { activity: 'Clan Drive Participation', xp: '200', icon: <Leaf size={16} />, color: '#00E676' },
];

export default function RewardsView() {
    const { user } = useAuth();
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [selectedRedemption, setSelectedRedemption] = useState(null);
    const [redeemAmount, setRedeemAmount] = useState('');
    const [showHistory, setShowHistory] = useState(false);

    const totalXP = user?.totalPoints || 0;
    const moneyValue = (totalXP * XP_TO_INR).toFixed(2);
    const usdValue = (totalXP * XP_TO_USD).toFixed(2);

    // Find current tier
    const currentTier = REWARD_TIERS.find(t => totalXP >= t.minXP && totalXP < t.maxXP) || REWARD_TIERS[0];
    const nextTier = REWARD_TIERS[REWARD_TIERS.indexOf(currentTier) + 1];
    const tierProgress = nextTier
        ? ((totalXP - currentTier.minXP) / (nextTier.minXP - currentTier.minXP)) * 100
        : 100;

    useEffect(() => {
        fetchStats();
    }, []);

    const fetchStats = async () => {
        setLoading(false);
        try {
            const [impactRes, reportsRes, tasksRes] = await Promise.allSettled([
                userAPI.getImpactOverview(),
                reportAPI.getMyReports(),
                taskAPI.getMyTasks(),
            ]);

            const impact = impactRes.status === 'fulfilled' ? impactRes.value.data : {};
            const reports = reportsRes.status === 'fulfilled' ? reportsRes.value.data.reports : [];
            const tasks = tasksRes.status === 'fulfilled' ? tasksRes.value.data.tasks : [];

            setStats({
                totalReports: reports.length || impact.totalReports || 0,
                totalTasks: tasks.filter(t => t.status === 'completed').length || impact.completedTasks || 0,
                verifiedReports: reports.filter(r => r.status === 'verified').length || 0,
                streak: user?.streak?.current || 0,
            });
        } catch (err) {
            console.error('Failed to fetch stats', err);
            setStats({
                totalReports: user?.reportCount || 0,
                totalTasks: user?.taskCount || 0,
                verifiedReports: 0,
                streak: user?.streak?.current || 0,
            });
        }
    };

    const estimatedBreakdown = {
        reports: (stats?.totalReports || 0) * 75,
        tasks: (stats?.totalTasks || 0) * 200,
        streaks: (stats?.streak || 0) * 25,
        other: Math.max(0, totalXP - ((stats?.totalReports || 0) * 75 + (stats?.totalTasks || 0) * 200 + (stats?.streak || 0) * 25)),
    };

    return (
        <div className="rewards-view">
            {/* Header */}
            <div className="view-header-row">
                <div>
                    <h1 className="glow-text" style={{ fontSize: '2rem', marginBottom: 8 }}>Rewards & Wallet</h1>
                    <p style={{ color: 'var(--text-secondary)' }}>Your eco-efforts have real value. Track, convert, and redeem.</p>
                </div>
            </div>

            {/* ====== HERO: Total Points + Money Value ====== */}
            <div className="rewards-hero">
                <div className="rewards-hero-left">
                    <div className="wallet-icon-big">
                        <Wallet size={32} />
                    </div>
                    <div>
                        <p className="wallet-label">Total Eco Points</p>
                        <h2 className="wallet-points">{totalXP.toLocaleString()} <span className="xp-suffix">XP</span></h2>
                    </div>
                </div>
                <div className="rewards-hero-divider"></div>
                <div className="rewards-hero-right">
                    <div className="money-conversion">
                        <div className="money-row">
                            <IndianRupee size={22} />
                            <span className="money-amount">₹{moneyValue}</span>
                        </div>
                        <p className="conversion-rate">1 XP = ₹{XP_TO_INR.toFixed(2)} • ~${usdValue} USD</p>
                    </div>
                </div>
            </div>

            {/* ====== REWARD TIER ====== */}
            <div className="card rewards-tier-card">
                <div className="tier-header">
                    <div className="tier-info">
                        <span className="tier-emoji">{currentTier.emoji}</span>
                        <div>
                            <h3 className="tier-name" style={{ color: currentTier.color }}>{currentTier.name} Tier</h3>
                            <p className="tier-perks">{currentTier.perks}</p>
                        </div>
                    </div>
                    {nextTier && (
                        <div className="tier-next">
                            <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>NEXT</span>
                            <span className="tier-next-name">{nextTier.emoji} {nextTier.name}</span>
                            <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>
                                {(nextTier.minXP - totalXP).toLocaleString()} XP to go
                            </span>
                        </div>
                    )}
                </div>
                <div className="tier-progress-bar">
                    <div className="tier-progress-fill" style={{ width: `${Math.min(tierProgress, 100)}%`, background: currentTier.color }}></div>
                </div>
                <div className="tier-milestones">
                    {REWARD_TIERS.slice(0, -1).map((t, i) => (
                        <div key={i} className={`tier-milestone ${totalXP >= t.minXP ? 'reached' : ''}`}>
                            <span>{t.emoji}</span>
                            <span>{t.minXP}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* ====== POINTS BREAKDOWN ====== */}
            <div className="rewards-grid-2">
                {/* Left: Breakdown */}
                <div className="card" style={{ padding: 28 }}>
                    <h3 className="section-title-icon"><TrendingUp size={18} /> Points Breakdown</h3>
                    <div className="breakdown-chart">
                        {[
                            { label: 'Reports', value: estimatedBreakdown.reports, color: '#FF6D00', icon: '📋' },
                            { label: 'Tasks', value: estimatedBreakdown.tasks, color: '#00C853', icon: '✅' },
                            { label: 'Streaks', value: estimatedBreakdown.streaks, color: '#FFD700', icon: '🔥' },
                            { label: 'Bonuses', value: estimatedBreakdown.other, color: '#00BCD4', icon: '✨' },
                        ].map((item, i) => {
                            const pct = totalXP > 0 ? (item.value / totalXP) * 100 : 0;
                            return (
                                <div key={i} className="breakdown-row">
                                    <div className="breakdown-left">
                                        <span style={{ fontSize: '1.1rem' }}>{item.icon}</span>
                                        <span className="breakdown-label">{item.label}</span>
                                    </div>
                                    <div className="breakdown-bar-container">
                                        <div className="breakdown-bar" style={{ width: `${pct}%`, background: item.color }}></div>
                                    </div>
                                    <div className="breakdown-right">
                                        <span className="breakdown-xp">{item.value.toLocaleString()}</span>
                                        <span className="breakdown-money">₹{(item.value * XP_TO_INR).toFixed(0)}</span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Summary stats */}
                    <div className="breakdown-summary">
                        <div className="summary-item">
                            <span className="summary-val">{stats?.totalReports || 0}</span>
                            <span className="summary-lbl">Reports</span>
                        </div>
                        <div className="summary-item">
                            <span className="summary-val">{stats?.totalTasks || 0}</span>
                            <span className="summary-lbl">Tasks Done</span>
                        </div>
                        <div className="summary-item">
                            <span className="summary-val">{stats?.streak || 0}🔥</span>
                            <span className="summary-lbl">Day Streak</span>
                        </div>
                        <div className="summary-item">
                            <span className="summary-val">{user?.level || 1}</span>
                            <span className="summary-lbl">Level</span>
                        </div>
                    </div>
                </div>

                {/* Right: Conversion Calculator */}
                <div className="card" style={{ padding: 28 }}>
                    <h3 className="section-title-icon"><HandCoins size={18} /> Conversion Calculator</h3>
                    <div className="conversion-calc">
                        <div className="calc-input-group">
                            <label>Enter XP to Convert</label>
                            <div className="calc-input-row">
                                <input
                                    type="number"
                                    placeholder="e.g. 500"
                                    value={redeemAmount}
                                    onChange={(e) => setRedeemAmount(e.target.value)}
                                    min="0"
                                    max={totalXP}
                                    className="calc-input"
                                />
                                <span className="calc-input-suffix">XP</span>
                            </div>
                        </div>

                        <div className="calc-results">
                            <div className="calc-result-card">
                                <span className="calc-flag">🇮🇳</span>
                                <span className="calc-currency">INR</span>
                                <span className="calc-value">₹{((Number(redeemAmount) || 0) * XP_TO_INR).toFixed(2)}</span>
                            </div>
                            <div className="calc-result-card">
                                <span className="calc-flag">🇺🇸</span>
                                <span className="calc-currency">USD</span>
                                <span className="calc-value">${((Number(redeemAmount) || 0) * XP_TO_USD).toFixed(2)}</span>
                            </div>
                        </div>

                        {/* Quick amounts */}
                        <div className="calc-quick-amounts">
                            {[100, 500, 1000, 2500].map(v => (
                                <button key={v} className="quick-amount-btn" onClick={() => setRedeemAmount(String(Math.min(v, totalXP)))}>
                                    {v} XP
                                </button>
                            ))}
                            <button className="quick-amount-btn all" onClick={() => setRedeemAmount(String(totalXP))}>
                                MAX
                            </button>
                        </div>

                        <div className="calc-rate-info">
                            <Sparkles size={14} />
                            <span>
                                Tier bonus: <strong style={{ color: currentTier.color }}>
                                    {currentTier.name === 'Seedling' ? '0%' :
                                        currentTier.name === 'Sapling' ? '2%' :
                                            currentTier.name === 'Tree' ? '5%' :
                                                currentTier.name === 'Forest' ? '10%' : '15%'}
                                </strong> extra on redemptions
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* ====== EARNING GUIDE ====== */}
            <div className="card" style={{ padding: 28, marginBottom: 24 }}>
                <h3 className="section-title-icon"><Star size={18} fill="currentColor" /> How to Earn Points</h3>
                <div className="earning-grid">
                    {POINT_ACTIVITIES.map((item, i) => (
                        <div key={i} className="earning-item">
                            <div className="earning-icon" style={{ background: `${item.color}15`, color: item.color }}>
                                {item.icon}
                            </div>
                            <div className="earning-info">
                                <span className="earning-activity">{item.activity}</span>
                                <span className="earning-xp" style={{ color: item.color }}>+{item.xp} XP</span>
                            </div>
                            <span className="earning-money">≈ ₹{(parseInt(item.xp) * XP_TO_INR).toFixed(0)}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* ====== REDEMPTION OPTIONS ====== */}
            <div className="card" style={{ padding: 28 }}>
                <h3 className="section-title-icon"><Gift size={18} /> Redeem Your Points</h3>
                <div className="redemption-grid">
                    {REDEMPTION_OPTIONS.map((option) => {
                        const canRedeem = totalXP >= option.minXP;
                        return (
                            <div
                                key={option.id}
                                className={`redemption-card ${canRedeem ? '' : 'locked'}`}
                                onClick={() => canRedeem && setSelectedRedemption(option)}
                            >
                                <div className="redemption-icon" style={{ background: `${option.color}15` }}>
                                    <span style={{ fontSize: '1.6rem' }}>{option.icon}</span>
                                </div>
                                <div className="redemption-info">
                                    <h4>{option.label}</h4>
                                    <p>{option.desc}</p>
                                </div>
                                <div className="redemption-req">
                                    {canRedeem ? (
                                        <ChevronRight size={18} style={{ color: option.color }} />
                                    ) : (
                                        <span className="locked-badge">🔒 {option.minXP} XP</span>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* ====== REDEMPTION MODAL ====== */}
            {selectedRedemption && (
                <div className="modal-overlay" onClick={() => setSelectedRedemption(null)}>
                    <div className="modal-card" onClick={e => e.stopPropagation()} style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '3rem', marginBottom: 16 }}>{selectedRedemption.icon}</div>
                        <h3 style={{ marginBottom: 8 }}>{selectedRedemption.label}</h3>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: 24 }}>
                            {selectedRedemption.desc}
                        </p>
                        <div style={{
                            padding: '20px', background: 'var(--bg-dark)', borderRadius: 16, marginBottom: 20,
                            border: '1px solid var(--border)'
                        }}>
                            <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 2 }}>Your Balance</p>
                            <p style={{ fontSize: '2rem', fontWeight: 900, fontFamily: 'Outfit' }}>{totalXP.toLocaleString()} XP</p>
                            <p style={{ color: 'var(--primary)', fontWeight: 700, fontSize: '1.1rem' }}>= ₹{moneyValue}</p>
                        </div>
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: 20 }}>
                            ⚡ Redemption requests are processed within 24-48 hours. Minimum: {selectedRedemption.minXP} XP
                        </p>
                        <button className="primary-btn" style={{ marginBottom: 12 }}>
                            <Gift size={16} /> Redeem Now
                        </button>
                        <button
                            className="secondary-btn"
                            style={{ width: '100%', justifyContent: 'center' }}
                            onClick={() => setSelectedRedemption(null)}
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
