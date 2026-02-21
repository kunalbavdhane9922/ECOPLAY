import React, { useState, useEffect, useCallback } from 'react';
import { taskAPI, uploadAPI } from '../services/api';
import { MapPin, Star, CheckCircle, Clock, Upload, X, Loader, Navigation, Filter, Camera, AlertCircle, RefreshCw } from 'lucide-react';
import { useSocket } from '../context/SocketContext';
import { useAuth } from '../context/AuthContext';

const NEARBY_RADIUS_M = 15000; // 15 km

const TYPE_CONFIG = {
    garbage: { emoji: '🗑️', color: '#FF5722', label: 'Garbage' },
    tree: { emoji: '🌳', color: '#4CAF50', label: 'Tree' },
    water: { emoji: '💧', color: '#2196F3', label: 'Water' },
    cleanup: { emoji: '🧹', color: '#FF6D00', label: 'Cleanup' },
    plantation: { emoji: '🌱', color: '#00C853', label: 'Plantation' },
    awareness: { emoji: '📢', color: '#9C27B0', label: 'Awareness' },
    other: { emoji: '📍', color: '#607D8B', label: 'Other' },
};

function haversineKm(lat1, lng1, lat2, lng2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
    return (R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))).toFixed(1);
}

export default function MissionsView({ onVerify }) {
    const socket = useSocket();
    const { user } = useAuth();

    // ── State ────────────────────────────────────────────────────────────────
    const [tab, setTab] = useState('nearby');
    const [nearbyTasks, setNearbyTasks] = useState([]);
    const [allTasks, setAllTasks] = useState([]);
    const [myTasks, setMyTasks] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [userPos, setUserPos] = useState(null);
    const [locLoading, setLocLoading] = useState(true);

    // Proof upload
    const [proofModal, setProofModal] = useState(null);
    const [proofFile, setProofFile] = useState(null);
    const [proofPreview, setProofPreview] = useState(null);
    const [submitting, setSubmitting] = useState(false);

    // Action states
    const [joiningId, setJoiningId] = useState(null);
    const [toast, setToast] = useState(null);
    const [verifiedIds, setVerifiedIds] = useState(new Set());

    // ── Toast ─────────────────────────────────────────────────────────────────
    const showToast = useCallback((message, type = 'success') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 4000);
    }, []);

    // ── Socket: task_completed ─────────────────────────────────────────────────
    useEffect(() => {
        if (!socket) return;
        const handler = ({ taskId, pointsAwarded, message }) => {
            const tid = taskId?.toString();
            setVerifiedIds(prev => new Set([...prev, tid]));
            showToast(message || `🏆 Verified! +${pointsAwarded} pts earned!`);
            setTimeout(() => {
                setMyTasks(prev => prev.filter(t => t._id?.toString() !== tid));
                setVerifiedIds(prev => { const s = new Set(prev); s.delete(tid); return s; });
            }, 2500);
        };
        socket.on('task_completed', handler);
        return () => socket.off('task_completed', handler);
    }, [socket, showToast]);

    // ── Get user location ─────────────────────────────────────────────────────
    useEffect(() => {
        setLocLoading(true);
        if (!navigator.geolocation) {
            setUserPos({ lat: 18.5204, lng: 73.8567 }); // fallback: Pune
            setLocLoading(false);
            return;
        }
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                setUserPos({ lat: pos.coords.latitude, lng: pos.coords.longitude });
                setLocLoading(false);
            },
            () => {
                setUserPos({ lat: 18.5204, lng: 73.8567 });
                setLocLoading(false);
            },
            { timeout: 8000 }
        );
    }, []);

    // ── Fetch tasks when tab / location changes ───────────────────────────────
    const fetchTasks = useCallback(async () => {
        if (tab === 'nearby' && !userPos) return;
        setLoading(true);
        setError(null);
        try {
            if (tab === 'nearby') {
                const res = await taskAPI.getNearbyTasks({
                    lat: userPos.lat,
                    lng: userPos.lng,
                    radius: NEARBY_RADIUS_M
                });
                setNearbyTasks(res.data?.tasks || []);
            } else if (tab === 'all') {
                const res = await taskAPI.getAllTasks({ status: 'open' });
                setAllTasks(res.data?.tasks || []);
            } else if (tab === 'my') {
                const res = await taskAPI.getMyTasks();
                setMyTasks(res.data?.tasks || []);
            }
        } catch (err) {
            console.error('Task fetch error:', err);
            setError(err.response?.data?.message || 'Failed to load tasks');
        }
        setLoading(false);
    }, [tab, userPos]);

    useEffect(() => {
        fetchTasks();
    }, [fetchTasks]);

    // ── Helpers ───────────────────────────────────────────────────────────────
    const hasUserCompleted = (task) => {
        if (!user) return false;
        const entry = task.assignedUsers?.find(a => a.userId?.toString() === user._id?.toString());
        return entry?.status === 'completed';
    };

    const isUserJoined = (task) => {
        if (!user) return false;
        return task.assignedUsers?.some(a => a.userId?.toString() === user._id?.toString());
    };

    const getTypeInfo = (type) => TYPE_CONFIG[type] || TYPE_CONFIG.other;

    const getDistance = (task) => {
        if (!userPos || !task.location?.coordinates) return null;
        const [lng, lat] = task.location.coordinates;
        if (!lng && !lat) return null;
        return haversineKm(userPos.lat, userPos.lng, lat, lng);
    };

    // ── Actions ───────────────────────────────────────────────────────────────
    const handleJoinNearby = async (task) => {
        const id = (task.mapPinId || task._id)?.toString();
        setJoiningId(id);
        try {
            if (task.mapPinId) {
                await taskAPI.joinMission(task.mapPinId);
            } else {
                await taskAPI.acceptTask(task._id);
            }
            showToast('Joined mission! Switch to "My Tasks" 🎯');
            fetchTasks();
        } catch (err) {
            showToast(err.response?.data?.message || 'Failed to join mission', 'error');
        }
        setJoiningId(null);
    };

    const handleJoinAll = async (task) => {
        const id = task._id?.toString();
        setJoiningId(id);
        try {
            await taskAPI.acceptTask(task._id);
            showToast('Mission accepted! Switch to "My Tasks" 🎯');
            fetchTasks();
        } catch (err) {
            showToast(err.response?.data?.message || 'Failed to accept task', 'error');
        }
        setJoiningId(null);
    };

    const handleProofSelect = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setProofFile(file);
        setProofPreview(URL.createObjectURL(file));
    };

    const handleSubmitProof = async () => {
        if (!proofFile || !proofModal) return;
        setSubmitting(true);
        try {
            let imageUrl = 'proof_submitted';
            try {
                const uploadRes = await uploadAPI.uploadImage(proofFile);
                imageUrl = uploadRes.data?.url || 'proof_submitted';
            } catch (uploadErr) {
                console.warn('Upload failed, using placeholder:', uploadErr.message);
            }
            await taskAPI.completeTask(proofModal, { imageUrl });
            showToast('Proof submitted! ML verifying in 6 seconds... 🔍');
            closeProofModal();
            fetchTasks();
        } catch (err) {
            showToast(err.response?.data?.message || 'Failed to submit proof', 'error');
        }
        setSubmitting(false);
    };

    const closeProofModal = () => {
        setProofModal(null);
        setProofFile(null);
        setProofPreview(null);
    };

    // ── Render helpers ────────────────────────────────────────────────────────
    const displayTasks = tab === 'nearby' ? nearbyTasks : tab === 'my' ? myTasks : allTasks;

    const tabs = [
        { id: 'nearby', label: 'Nearby', icon: <Navigation size={14} />, count: nearbyTasks.length },
        { id: 'all', label: 'All Open', icon: <Filter size={14} />, count: allTasks.length },
        { id: 'my', label: 'My Tasks', icon: <CheckCircle size={14} />, count: myTasks.length },
    ];

    return (
        <div className="missions-view-wrapper">
            {/* ── Header ── */}
            <div className="missions-header">
                <div>
                    <h1 className="glow-text missions-title">Missions</h1>
                    <p className="missions-subtitle">
                        {tab === 'nearby'
                            ? userPos ? `📍 Showing issues within ${NEARBY_RADIUS_M / 1000} km of your location` : '📍 Detecting your location...'
                            : tab === 'all' ? '🌍 All open issues globally'
                                : '✅ Your active missions'}
                    </p>
                </div>
                <button
                    onClick={fetchTasks}
                    disabled={loading}
                    style={{ padding: '8px 14px', borderRadius: 10, background: 'rgba(0,200,83,0.1)', border: '1px solid rgba(0,200,83,0.2)', color: 'var(--primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', fontWeight: 700, flexShrink: 0 }}
                >
                    {loading ? <Loader size={14} className="spin-icon" /> : <RefreshCw size={14} />}
                    <span className="refresh-label">Refresh</span>
                </button>
            </div>

            {/* ── Tabs ── */}
            <div className="missions-tabs">
                {tabs.map(t => (
                    <button
                        key={t.id}
                        onClick={() => setTab(t.id)}
                        className={`missions-tab ${tab === t.id ? 'active' : ''}`}
                    >
                        {t.icon}
                        <span>{t.label}</span>
                        {t.count > 0 && (
                            <span className="tab-count">{t.count}</span>
                        )}
                    </button>
                ))}
            </div>

            {/* ── Location banner for nearby ── */}
            {tab === 'nearby' && locLoading && (
                <div className="location-banner">
                    <Loader size={14} className="spin-icon" />
                    Detecting your GPS location...
                </div>
            )}
            {tab === 'nearby' && !locLoading && userPos && (
                <div className="location-banner success">
                    <Navigation size={14} />
                    Showing tasks within {NEARBY_RADIUS_M / 1000} km · {userPos.lat.toFixed(4)}, {userPos.lng.toFixed(4)}
                </div>
            )}

            {/* ── Content ── */}
            {loading ? (
                <div className="missions-loader">
                    <Loader size={32} className="spin-icon" />
                    <p>Loading missions...</p>
                </div>
            ) : error ? (
                <div className="missions-error">
                    <AlertCircle size={32} />
                    <p>{error}</p>
                    <button onClick={fetchTasks} className="primary-btn" style={{ width: 'auto', marginTop: 12, padding: '10px 24px' }}>
                        <RefreshCw size={14} /> Try Again
                    </button>
                </div>
            ) : displayTasks.length === 0 ? (
                <div className="missions-empty">
                    <div className="missions-empty-icon">
                        {tab === 'nearby' ? '📡' : tab === 'my' ? '🎯' : '🌍'}
                    </div>
                    <h3>{tab === 'nearby' ? 'No Nearby Issues' : tab === 'my' ? 'No Active Missions' : 'No Open Issues'}</h3>
                    <p>
                        {tab === 'nearby'
                            ? 'No environmental issues reported near you. The area looks clean!'
                            : tab === 'my'
                                ? 'Join a mission from the Nearby or All Open tabs to get started.'
                                : 'No issues found globally. Stay tuned!'}
                    </p>
                </div>
            ) : (
                <div className="missions-grid">
                    {displayTasks.map((task) => {
                        const typeInfo = getTypeInfo(task.type);
                        const dist = getDistance(task);
                        const joined = isUserJoined(task);
                        const completed = hasUserCompleted(task);
                        const isVerified = verifiedIds.has(task._id?.toString());
                        const isJoining = joiningId === (task.mapPinId || task._id)?.toString();

                        return (
                            <div key={task._id} className="mission-card card" style={{ borderColor: `${typeInfo.color}25` }}>
                                {/* Card Header */}
                                <div className="mission-card-header">
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                        <span style={{
                                            padding: '3px 10px',
                                            borderRadius: 20,
                                            fontSize: '0.68rem',
                                            fontWeight: 800,
                                            textTransform: 'uppercase',
                                            background: `${typeInfo.color}18`,
                                            color: typeInfo.color,
                                            border: `1px solid ${typeInfo.color}35`,
                                            letterSpacing: 1
                                        }}>
                                            {typeInfo.emoji} {typeInfo.label}
                                        </span>
                                        {task.status && (
                                            <span style={{
                                                padding: '3px 10px',
                                                borderRadius: 20,
                                                fontSize: '0.62rem',
                                                fontWeight: 700,
                                                background: task.status === 'in_progress' ? 'rgba(0,188,212,0.12)' : 'rgba(255,215,0,0.12)',
                                                color: task.status === 'in_progress' ? '#00BCD4' : '#FFD700',
                                                border: `1px solid ${task.status === 'in_progress' ? 'rgba(0,188,212,0.25)' : 'rgba(255,215,0,0.25)'}`,
                                            }}>
                                                {task.status === 'in_progress' ? 'IN PROGRESS' : 'OPEN'}
                                            </span>
                                        )}
                                    </div>
                                    <div className="xp-badge">
                                        <Star size={13} fill="currentColor" />
                                        {task.pointsReward || 50} XP
                                    </div>
                                </div>

                                {/* Title & Description */}
                                <h3 style={{ fontSize: '1rem', marginBottom: 6, lineHeight: 1.3, textTransform: 'none', letterSpacing: 0, fontFamily: "'Outfit', sans-serif", fontWeight: 700 }}>
                                    {task.title || 'Environmental Issue'}
                                </h3>
                                {task.description && (
                                    <p className="desc" style={{ marginBottom: 14 }}>{task.description}</p>
                                )}

                                {/* Meta row */}
                                <div className="mission-meta" style={{ flexWrap: 'wrap', gap: '6px 14px' }}>
                                    {task.type && (
                                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                            <span style={{ width: 8, height: 8, borderRadius: '50%', background: typeInfo.color, display: 'inline-block' }} />
                                            {task.type.toUpperCase()}
                                        </span>
                                    )}
                                    {dist && (
                                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                            <MapPin size={11} /> {dist} km
                                        </span>
                                    )}
                                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                        <Clock size={11} />
                                        {task.assignedUsers?.filter(a => a.status === 'assigned' || a.status === 'completed').length || 0}/{task.maxParticipants || 10} participants
                                    </span>
                                </div>

                                {/* Action area */}
                                <div style={{ marginTop: 'auto' }}>
                                    {/* Nearby tab: join via map pin or task accept */}
                                    {tab === 'nearby' && (
                                        <button
                                            className="primary-btn"
                                            style={{ marginTop: 0 }}
                                            onClick={() => handleJoinNearby(task)}
                                            disabled={isJoining === (task.mapPinId || task._id)?.toString()}
                                        >
                                            {isJoining === (task.mapPinId || task._id)?.toString()
                                                ? <><Loader size={14} className="spin-icon" /> Joining...</>
                                                : '🎯 Join Mission'}
                                        </button>
                                    )}

                                    {/* All Open tab: accept the task directly */}
                                    {tab === 'all' && (
                                        <button
                                            className="primary-btn"
                                            style={{ marginTop: 0 }}
                                            onClick={() => handleJoinAll(task)}
                                            disabled={isJoining === task._id?.toString() || joined}
                                        >
                                            {isJoining === task._id?.toString()
                                                ? <><Loader size={14} className="spin-icon" /> Joining...</>
                                                : joined ? '✅ Already Joined' : '🎯 Join Mission'}
                                        </button>
                                    )}

                                    {/* My Tasks tab */}
                                    {tab === 'my' && (
                                        <>
                                            {isVerified ? (
                                                <div style={{ textAlign: 'center', padding: '12px', background: 'rgba(255,215,0,0.12)', borderRadius: 12, color: '#FFD700', fontWeight: 700, fontSize: '0.85rem', transition: 'all 0.5s' }}>
                                                    🏆 Verified! Points awarded — removing...
                                                </div>
                                            ) : completed ? (
                                                <div style={{ textAlign: 'center', padding: '12px', background: 'rgba(0,200,83,0.1)', borderRadius: 12, color: 'var(--primary)', fontWeight: 700, fontSize: '0.85rem' }}>
                                                    ⏳ Proof Submitted — ML verifying (6s)...
                                                </div>
                                            ) : (
                                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                                                    <button
                                                        className="primary-btn"
                                                        style={{ background: 'linear-gradient(135deg, #00BCD4, #0097A7)', marginTop: 0 }}
                                                        onClick={() => setProofModal(task._id)}
                                                    >
                                                        <Camera size={14} /> Upload Proof
                                                    </button>
                                                    {onVerify && (
                                                        <button
                                                            className="primary-btn"
                                                            style={{ background: 'linear-gradient(135deg, #FF6D00, #EF4444)', marginTop: 0 }}
                                                            onClick={() => onVerify(task._id)}
                                                        >
                                                            ✅ Verify
                                                        </button>
                                                    )}
                                                </div>
                                            )}
                                        </>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* ── Proof Upload Modal ── */}
            {proofModal && (
                <div className="modal-overlay" onClick={closeProofModal}>
                    <div className="modal-card" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>Upload Completion Proof</h3>
                            <button onClick={closeProofModal} className="modal-close"><X size={20} /></button>
                        </div>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: 20 }}>
                            Take a photo of the completed task. ML will verify within 6 seconds.
                        </p>

                        {proofPreview ? (
                            <div className="image-preview-container" style={{ marginBottom: 20 }}>
                                <img src={proofPreview} alt="Proof" className="image-preview" />
                                <button type="button" className="image-remove-btn" onClick={() => { setProofFile(null); setProofPreview(null); }}>
                                    <X size={16} />
                                </button>
                            </div>
                        ) : (
                            <div className="upload-zone" style={{ marginBottom: 20 }}>
                                <input type="file" accept="image/*" style={{ display: 'none' }} id="proof-upload" onChange={handleProofSelect} />
                                <label htmlFor="proof-upload" style={{ cursor: 'pointer' }}>
                                    <div className="upload-icon-circle"><Camera size={24} /></div>
                                    <p style={{ fontWeight: 700 }}>Capture proof photo</p>
                                    <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Tap to take/select a photo</p>
                                </label>
                            </div>
                        )}

                        <button className="primary-btn" onClick={handleSubmitProof} disabled={!proofFile || submitting}>
                            {submitting
                                ? <><Loader size={16} className="spin-icon" /> Uploading & Verifying...</>
                                : <><Upload size={16} /> Submit for ML Verification</>}
                        </button>
                    </div>
                </div>
            )}

            {/* ── Toast ── */}
            {toast && (
                <div className={`toast ${toast.type || 'success'}`}>
                    {toast.message}
                </div>
            )}
        </div>
    );
}
