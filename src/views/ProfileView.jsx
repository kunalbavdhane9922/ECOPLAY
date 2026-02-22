import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import {
    Shield, MapPin, Calendar, Award, Wallet, Gift,
    TrendingUp, Star, ChevronRight, Sparkles, IndianRupee,
    CheckCircle, Leaf, Trash2, Zap, ShieldCheck, TreePine, Droplets
} from 'lucide-react';
import { userAPI, reportAPI, taskAPI } from '../services/api';

// Conversion rate: 1 XP = ₹0.50
const XP_TO_INR = 0.50;

const REWARD_TIERS = [
    { name: 'Seedling', minXP: 0, maxXP: 500, color: '#8B949E', emoji: '🌱', bonus: '0%' },
    { name: 'Sapling', minXP: 500, maxXP: 2000, color: '#00C853', emoji: '🌿', bonus: '2%' },
    { name: 'Tree', minXP: 2000, maxXP: 5000, color: '#FFD700', emoji: '🌳', bonus: '5%' },
    { name: 'Forest', minXP: 5000, maxXP: 15000, color: '#FF6D00', emoji: '🌲', bonus: '10%' },
    { name: 'Ecosystem', minXP: 15000, maxXP: Infinity, color: '#E040FB', emoji: '🌍', bonus: '15%' },
];

const REDEMPTION_OPTIONS = [
    { id: 'upi', label: 'UPI Transfer', desc: 'Paytm, GPay, PhonePe', icon: '💳', minXP: 500, color: '#5C6BC0' },
    { id: 'amazon', label: 'Amazon Gift Card', desc: 'Amazon.in vouchers', icon: '🛒', minXP: 1000, color: '#FF9800' },
    { id: 'plant', label: 'Plant a Tree', desc: 'We plant one in your name', icon: '🌳', minXP: 200, color: '#00C853' },
    { id: 'ngo', label: 'Donate to NGO', desc: 'Support eco NGOs', icon: '💚', minXP: 100, color: '#4CAF50' },
    { id: 'merch', label: 'Eco Merchandise', desc: 'T-shirts, bottles, bags', icon: '👕', minXP: 2000, color: '#00BCD4' },
    { id: 'certificate', label: 'Impact Certificate', desc: 'Verifiable digital cert', icon: '📜', minXP: 300, color: '#9C27B0' },
];

export default function ProfileView() {
    const { user, logout } = useAuth();
    const [stats, setStats] = useState(null);
    const [selectedRedemption, setSelectedRedemption] = useState(null);

    const totalXP = user?.totalPoints || 0;
    const moneyValue = (totalXP * XP_TO_INR).toFixed(2);
    const currentTier = REWARD_TIERS.find(t => totalXP >= t.minXP && totalXP < t.maxXP) || REWARD_TIERS[0];
    const nextTier = REWARD_TIERS[REWARD_TIERS.indexOf(currentTier) + 1];
    const tierProgress = nextTier
        ? ((totalXP - currentTier.minXP) / (nextTier.minXP - currentTier.minXP)) * 100
        : 100;

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const [reportsRes, tasksRes] = await Promise.allSettled([
                    reportAPI.getMyReports(),
                    taskAPI.getMyTasks(),
                ]);
                const reports = reportsRes.status === 'fulfilled' ? reportsRes.value.data?.reports || [] : [];
                const tasks = tasksRes.status === 'fulfilled' ? tasksRes.value.data?.tasks || [] : [];
                setStats({
                    totalReports: reports.length,
                    totalTasks: tasks.filter(t => t.status === 'completed').length,
                    streak: user?.streak?.current || 0,
                });
            } catch {
                setStats({ totalReports: 0, totalTasks: 0, streak: user?.streak?.current || 0 });
            }
        };
        fetchStats();
    }, [user]);

    return (
        <div className="profile-view">

            {/* ── BANNER ─────────────────────────────────────── */}
            <div className="profile-banner">
                <div className="profile-banner-bg" />
                <div className="profile-banner-content">
                    <div className="profile-avatar">
                        👤
                        <div className="profile-level-badge">LV {user?.level || 1}</div>
                    </div>
                    <div className="profile-info">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div>
                                <h1 className="glow-text">{user?.name || 'Explorer'}</h1>
                                <div className="profile-tags">
                                    <span className="profile-tag"><MapPin size={13} /> Global Explorer</span>
                                    <span className="profile-tag"><Calendar size={13} /> Joined Feb 2024</span>
                                </div>
                            </div>
                            <button onClick={logout} className="logout-btn-profile">
                                Sign Out
                            </button>
                        </div>
                    </div>
                    <div className="profile-stats">
                        <div className="profile-stat-box">
                            <p className="value" style={{ color: 'var(--primary)' }}>{totalXP.toLocaleString()}</p>
                            <p className="label">Total XP</p>
                        </div>
                        <div className="profile-stat-box">
                            <p className="value" style={{ color: 'var(--secondary)' }}>{user?.badges?.length || 0}</p>
                            <p className="label">Badges</p>
                        </div>
                        <div className="profile-stat-box">
                            <p className="value" style={{ color: currentTier.color }}>{currentTier.emoji}</p>
                            <p className="label">{currentTier.name}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── WALLET HERO ──────────────────────────────── */}
            <div className="rewards-hero profile-wallet-hero">
                <div className="rewards-hero-left">
                    <div className="wallet-icon-big"><Wallet size={28} /></div>
                    <div>
                        <p className="wallet-label">Eco Wallet</p>
                        <h2 className="wallet-points">{totalXP.toLocaleString()} <span className="xp-suffix">XP</span></h2>
                    </div>
                </div>
                <div className="rewards-hero-divider" />
                <div className="rewards-hero-right">
                    <div className="money-row">
                        <IndianRupee size={20} />
                        <span className="money-amount">₹{moneyValue}</span>
                    </div>
                    <p className="conversion-rate">1 XP = ₹{XP_TO_INR.toFixed(2)}</p>
                </div>
            </div>

            {/* ── REWARD TIER ──────────────────────────────── */}
            <div className="card profile-tier-card">
                <div className="tier-header">
                    <div className="tier-info">
                        <span className="tier-emoji">{currentTier.emoji}</span>
                        <div>
                            <h3 className="tier-name" style={{ color: currentTier.color }}>{currentTier.name} Tier</h3>
                            <p className="tier-perks">{currentTier.bonus} bonus on redemptions</p>
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
                    <div
                        className="tier-progress-fill"
                        style={{ width: `${Math.min(tierProgress, 100)}%`, background: currentTier.color }}
                    />
                </div>
            </div>

            {/* ── QUICK STATS ──────────────────────────────── */}
            <div className="profile-quick-stats">
                {[
                    { label: 'Reports', value: stats?.totalReports ?? '—', icon: '📋', color: '#FF6D00' },
                    { label: 'Tasks Done', value: stats?.totalTasks ?? '—', icon: '✅', color: '#00C853' },
                    { label: 'Day Streak', value: `${stats?.streak ?? 0}🔥`, icon: '⚡', color: '#FFD700' },
                    { label: 'Level', value: user?.level || 1, icon: '🏅', color: '#7C4DFF' },
                ].map((s, i) => (
                    <div key={i} className="profile-quick-stat-card">
                        <span className="pqs-icon">{s.icon}</span>
                        <span className="pqs-val" style={{ color: s.color }}>{s.value}</span>
                        <span className="pqs-lbl">{s.label}</span>
                    </div>
                ))}
            </div>

            {/* ── GRID: Achievements + Clan Status ─────────── */}
            <div className="profile-grid">
                <div className="card" style={{ padding: 24 }}>
                    <h3 className="section-title">
                        <Award style={{ color: 'var(--primary)' }} size={18} /> Recent Achievements
                    </h3>
                    <div className="achievements-grid">
                        {['Forest Guardian', 'River Protector', 'Air Sentinel', 'Eco Pioneer'].map((name, i) => (
                            <div key={i} className="achievement-item">
                                <div className="achievement-icon">🏆</div>
                                <div className="achievement-text">
                                    <p>{name}</p>
                                    <p>Unlocked {i + 1} days ago</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="card" style={{ padding: 24 }}>
                    <h3 className="section-title">
                        <Shield style={{ color: 'var(--secondary)' }} size={18} /> Clan Status
                    </h3>
                    {user?.clanName ? (
                        <div style={{ textAlign: 'center', padding: '16px 0' }}>
                            <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>🛡️</div>
                            <h4 style={{ fontSize: '1.05rem', marginBottom: 4 }}>{user.clanName}</h4>
                            <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', marginBottom: 16 }}>
                                Master of the Grove
                            </p>
                            <button className="secondary-btn" style={{ width: '100%', justifyContent: 'center' }}>
                                Visit Clan Base
                            </button>
                        </div>
                    ) : (
                        <div className="clan-status-empty">
                            <p>No clan membership yet.</p>
                            <button className="primary-btn">Find a Clan</button>
                        </div>
                    )}
                </div>
            </div>

            {/* ── REDEEM YOUR POINTS ───────────────────────── */}
            <div className="card" style={{ padding: 24 }}>
                <h3 className="section-title">
                    <Gift style={{ color: '#FFD700' }} size={18} /> Redeem Your Points
                </h3>
                <div className="redemption-grid">
                    {REDEMPTION_OPTIONS.map((option) => {
                        const canRedeem = totalXP >= option.minXP;
                        return (
                            <div
                                key={option.id}
                                className={`redemption-card ${canRedeem ? '' : 'locked'}`}
                                onClick={() => canRedeem && setSelectedRedemption(option)}
                            >
                                <div className="redemption-icon" style={{ background: `${option.color}18` }}>
                                    <span style={{ fontSize: '1.5rem' }}>{option.icon}</span>
                                </div>
                                <div className="redemption-info">
                                    <h4>{option.label}</h4>
                                    <p>{option.desc}</p>
                                </div>
                                <div className="redemption-req">
                                    {canRedeem
                                        ? <ChevronRight size={16} style={{ color: option.color }} />
                                        : <span className="locked-badge">🔒 {option.minXP}</span>}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* ── REDEMPTION MODAL ─────────────────────────── */}
            {selectedRedemption && (
                <div className="modal-overlay" onClick={() => setSelectedRedemption(null)}>
                    <div className="modal-card" onClick={e => e.stopPropagation()} style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '3rem', marginBottom: 14 }}>{selectedRedemption.icon}</div>
                        <h3 style={{ marginBottom: 8 }}>{selectedRedemption.label}</h3>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.84rem', marginBottom: 22 }}>
                            {selectedRedemption.desc}
                        </p>
                        <div style={{
                            padding: '18px', background: 'var(--bg-dark)',
                            borderRadius: 14, marginBottom: 18, border: '1px solid var(--border)'
                        }}>
                            <p style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 2 }}>Your Balance</p>
                            <p style={{ fontSize: '1.8rem', fontWeight: 900, fontFamily: 'Outfit' }}>{totalXP.toLocaleString()} XP</p>
                            <p style={{ color: 'var(--primary)', fontWeight: 700 }}>= ₹{moneyValue}</p>
                        </div>
                        <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginBottom: 18 }}>
                            ⚡ Processed within 24–48 hrs · Min: {selectedRedemption.minXP} XP
                        </p>
                        <button className="primary-btn" style={{ marginBottom: 10 }}>
                            <Gift size={15} /> Redeem Now
                        </button>
                        <button className="secondary-btn" style={{ width: '100%', justifyContent: 'center' }} onClick={() => setSelectedRedemption(null)}>
                            Cancel
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
