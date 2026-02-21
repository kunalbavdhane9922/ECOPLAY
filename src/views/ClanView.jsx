import React, { useState, useEffect, useCallback } from 'react';
import { clanAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import {
    Users, Shield, Plus, Search, MapPin, X, Loader, Trophy,
    LogOut, CheckCircle, Navigation, Star, TrendingUp,
    Calendar, Leaf, Droplets, Trash2, Award, Crown,
    Lock, Globe, UserPlus, Bell, ChevronDown, ChevronUp, Check, XCircle, Send,
    Zap
} from 'lucide-react';

const RANK_MEDALS = ['🥇', '🥈', '🥉'];
const RANK_COLORS = ['#FFD700', '#C0C0C0', '#CD7F32'];

export default function ClanView() {
    const { user, setUser } = useAuth();

    const [tab, setTab] = useState(user?.clanId ? 'my' : 'nearby');
    const [loading, setLoading] = useState(true);
    const [nearbyClans, setNearbyClans] = useState([]);
    const [userPos, setUserPos] = useState(null);
    const [allClans, setAllClans] = useState([]);
    const [searchRegion, setSearchRegion] = useState('');
    const [myClan, setMyClan] = useState(null);
    const [leaderboard, setLeaderboard] = useState([]);
    const [myInvites, setMyInvites] = useState([]);

    const [joiningId, setJoiningId] = useState(null);
    const [leavingClan, setLeavingClan] = useState(false);
    const [showCreate, setShowCreate] = useState(false);
    const [createForm, setCreateForm] = useState({ name: '', description: '', region: '', maxMembers: 50, isPrivate: false, inviteUsernames: [] });
    const [inviteInput, setInviteInput] = useState('');
    const [creating, setCreating] = useState(false);
    const [toast, setToast] = useState(null);

    // Leader panel state
    const [showRequests, setShowRequests] = useState(true);
    const [approvingId, setApprovingId] = useState(null);
    const [leaderInviteInput, setLeaderInviteInput] = useState('');
    const [sendingInvite, setSendingInvite] = useState(false);

    // Activities state
    const [activities, setActivities] = useState([]);
    const [activityTab, setActivityTab] = useState('active');
    const [showProposeModal, setShowProposeModal] = useState(false);
    const [proposeForm, setProposeForm] = useState({ title: '', description: '', type: 'cleanup', date: '', location: '' });
    const [proposing, setProposing] = useState(false);
    const [joiningActId, setJoiningActId] = useState(null);
    const [completingActId, setCompletingActId] = useState(null);

    // Clan Tasks state
    const [clanTasks, setClanTasks] = useState([]);
    const [showCreateTaskModal, setShowCreateTaskModal] = useState(false);
    const [createTaskForm, setCreateTaskForm] = useState({ title: '', description: '', type: 'cleanup', pointsReward: 50 });
    const [creatingTask, setCreatingTask] = useState(false);
    const [approvingTaskId, setApprovingTaskId] = useState(null);

    // Socket for real-time clan events
    const socket = useSocket();

    // Get user location
    useEffect(() => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (pos) => setUserPos({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
                () => setUserPos({ lat: 12.9716, lng: 77.5946 }),
                { enableHighAccuracy: true, timeout: 10000 }
            );
        } else {
            setUserPos({ lat: 12.9716, lng: 77.5946 });
        }
    }, []);

    useEffect(() => { fetchTabData(); }, [tab, userPos]);

    const fetchTabData = useCallback(async () => {
        setLoading(true);
        try {
            switch (tab) {
                case 'nearby':
                    if (userPos) {
                        const res = await clanAPI.getNearbyClans({ lat: userPos.lat, lng: userPos.lng, radius: 50000 });
                        setNearbyClans(res.data.clans || []);
                    }
                    break;
                case 'browse':
                    const params = {};
                    if (searchRegion.trim()) params.region = searchRegion.trim();
                    const browseRes = await clanAPI.getAllClans(params);
                    setAllClans(browseRes.data.clans || []);
                    break;
                case 'my':
                    if (user?.clanId) {
                        const myRes = await clanAPI.getMyClan();
                        setMyClan(myRes.data.clan);
                        // Also fetch activities and clan tasks
                        try {
                            const actRes = await clanAPI.getActivities(user.clanId);
                            setActivities(actRes.data.activities || []);
                        } catch (e) { console.error('activities fetch error', e); }
                        try {
                            const clanTasksRes = await clanAPI.getMyClanTasks();
                            setClanTasks(clanTasksRes.data.tasks || []);
                        } catch (e) { console.error('clan tasks fetch error', e); }
                    } else { setTab('nearby'); }
                    break;
                case 'rankings':
                    const lbRes = await clanAPI.getLeaderboard();
                    setLeaderboard(lbRes.data.leaderboard || []);
                    break;
                case 'invites':
                    const invRes = await clanAPI.getMyInvites();
                    setMyInvites(invRes.data.invites || []);
                    break;
            }
        } catch (err) {
            console.error('Clan fetch error:', err);
            if (tab === 'my' && err.response?.status === 404) setTab('nearby');
        }
        setLoading(false);
    }, [tab, userPos, searchRegion, user?.clanId]);

    // ─── ACTIONS ────────────────────────────────────────────────────────────────
    const handleJoin = async (clanId, isPrivate) => {
        setJoiningId(clanId);
        try {
            const res = await clanAPI.joinClan(clanId);
            if (res.data.requested) {
                showToast('Join request sent! Waiting for leader approval 🕐', 'success');
            } else {
                showToast(`Welcome to ${res.data.clan?.name}! 🛡️`, 'success');
                setUser(prev => ({ ...prev, clanId, clanName: res.data.clan?.name }));
                setTab('my');
            }
        } catch (err) {
            showToast(err.response?.data?.message || 'Failed to join clan', 'error');
        }
        setJoiningId(null);
    };

    const handleLeave = async () => {
        if (!myClan) return;
        setLeavingClan(true);
        try {
            await clanAPI.leaveClan(myClan._id);
            showToast('You left the clan', 'success');
            setUser(prev => ({ ...prev, clanId: null, clanName: null }));
            setMyClan(null);
            setTab('nearby');
        } catch (err) {
            showToast(err.response?.data?.message || 'Failed to leave', 'error');
        }
        setLeavingClan(false);
    };

    const handleCreate = async (e) => {
        e.preventDefault();
        if (!createForm.name || !createForm.region) { showToast('Name and region are required', 'error'); return; }
        setCreating(true);
        try {
            const payload = {
                ...createForm,
                inviteUsernames: createForm.inviteUsernames,
                location: userPos ? { type: 'Point', coordinates: [userPos.lng, userPos.lat] } : { type: 'Point', coordinates: [0, 0] }
            };
            const res = await clanAPI.createClan(payload);
            showToast(`Clan "${res.data.clan?.name}" created! 🎉`, 'success');
            setUser(prev => ({ ...prev, clanId: res.data.clan?._id, clanName: res.data.clan?.name }));
            setShowCreate(false);
            setCreateForm({ name: '', description: '', region: '', maxMembers: 50, isPrivate: false, inviteUsernames: [] });
            setInviteInput('');
            setTab('my');
        } catch (err) {
            showToast(err.response?.data?.message || 'Failed to create clan', 'error');
        }
        setCreating(false);
    };

    const handleApprove = async (userId) => {
        setApprovingId(userId);
        try {
            await clanAPI.approveMember(myClan._id, userId);
            showToast('Member approved! ✅', 'success');
            const myRes = await clanAPI.getMyClan();
            setMyClan(myRes.data.clan);
        } catch (err) {
            showToast(err.response?.data?.message || 'Failed to approve', 'error');
        }
        setApprovingId(null);
    };

    const handleReject = async (userId) => {
        setApprovingId(userId + '_reject');
        try {
            await clanAPI.rejectMember(myClan._id, userId);
            showToast('Request rejected', 'success');
            setMyClan(prev => ({ ...prev, joinRequests: prev.joinRequests.filter(r => r.userId?._id?.toString() !== userId && r.userId?.toString() !== userId) }));
        } catch (err) {
            showToast(err.response?.data?.message || 'Failed to reject', 'error');
        }
        setApprovingId(null);
    };

    const handleLeaderInvite = async () => {
        if (!leaderInviteInput.trim()) return;
        setSendingInvite(true);
        try {
            await clanAPI.inviteUser(myClan._id, leaderInviteInput.trim());
            showToast(`Invite sent to ${leaderInviteInput.trim()}! 📨`, 'success');
            setLeaderInviteInput('');
        } catch (err) {
            showToast(err.response?.data?.message || 'User not found', 'error');
        }
        setSendingInvite(false);
    };

    const handleRespondInvite = async (clanId, accept) => {
        try {
            const res = await clanAPI.respondInvite(clanId, accept);
            if (accept) {
                showToast(res.data.message || 'Joined clan! 🎉', 'success');
                setUser(prev => ({ ...prev, clanId: res.data.clan?._id, clanName: res.data.clan?.name }));
                setTab('my');
            } else {
                showToast('Invite declined', 'success');
                setMyInvites(prev => prev.filter(i => i.clanId.toString() !== clanId));
            }
        } catch (err) {
            showToast(err.response?.data?.message || 'Failed to respond', 'error');
        }
    };

    const addInviteChip = () => {
        if (inviteInput.trim() && !createForm.inviteUsernames.includes(inviteInput.trim())) {
            setCreateForm(f => ({ ...f, inviteUsernames: [...f.inviteUsernames, inviteInput.trim()] }));
            setInviteInput('');
        }
    };

    const removeInviteChip = (name) => setCreateForm(f => ({ ...f, inviteUsernames: f.inviteUsernames.filter(u => u !== name) }));

    // ─── ACTIVITY HANDLERS ──────────────────────────────────────────────────────
    const handleProposeActivity = async (e) => {
        e.preventDefault();
        if (!proposeForm.title.trim()) { showToast('Activity title is required', 'error'); return; }
        setProposing(true);
        try {
            const res = await clanAPI.proposeActivity(myClan._id, proposeForm);
            showToast('Activity proposed! 🎉', 'success');
            setActivities(prev => [...prev, res.data.activity]);
            setShowProposeModal(false);
            setProposeForm({ title: '', description: '', type: 'cleanup', date: '', location: '' });
            setActivityTab('active');
        } catch (err) {
            showToast(err.response?.data?.message || 'Failed to propose activity', 'error');
        }
        setProposing(false);
    };

    const handleJoinActivity = async (actId) => {
        setJoiningActId(actId);
        try {
            const res = await clanAPI.joinActivity(myClan._id, actId);
            showToast(res.data.message, 'success');
            setActivities(prev => prev.map(a => a._id === actId ? res.data.activity : a));
        } catch (err) {
            showToast(err.response?.data?.message || 'Failed to join activity', 'error');
        }
        setJoiningActId(null);
    };

    const handleUnjoinActivity = async (actId) => {
        setJoiningActId(actId + '_leave');
        try {
            const res = await clanAPI.unjoinActivity(myClan._id, actId);
            showToast('You left the activity', 'success');
            setActivities(prev => prev.map(a => a._id === actId ? res.data.activity : a));
        } catch (err) {
            showToast(err.response?.data?.message || 'Failed', 'error');
        }
        setJoiningActId(null);
    };

    const handleCompleteActivity = async (actId) => {
        setCompletingActId(actId);
        try {
            const res = await clanAPI.completeActivity(myClan._id, actId);
            showToast(res.data.message, 'success');
            setActivities(prev => prev.map(a => a._id === actId ? res.data.activity : a));
            // Refresh clan data for updated points/impact
            const myRes = await clanAPI.getMyClan();
            setMyClan(myRes.data.clan);
        } catch (err) {
            showToast(err.response?.data?.message || 'Failed to complete activity', 'error');
        }
        setCompletingActId(null);
    };

    const showToast = (message, type) => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 4000);
    };

    // ─── CLAN TASK HANDLERS ─────────────────────────────────────────────────────
    const handleCreateClanTask = async (e) => {
        e.preventDefault();
        if (!createTaskForm.title || !createTaskForm.type) { showToast('Title and type are required', 'error'); return; }
        setCreatingTask(true);
        try {
            const res = await clanAPI.createClanTask(myClan._id, createTaskForm);
            showToast('Clan task created! All members notified 🎯', 'success');
            setClanTasks(prev => [res.data.task, ...prev]);
            setShowCreateTaskModal(false);
            setCreateTaskForm({ title: '', description: '', type: 'cleanup', pointsReward: 50 });
        } catch (err) {
            showToast(err.response?.data?.message || 'Failed to create clan task', 'error');
        }
        setCreatingTask(false);
    };

    const handleApproveClanTask = async (taskId) => {
        setApprovingTaskId(taskId);
        try {
            const res = await clanAPI.approveClanTask(taskId);
            showToast('You are now active on this mission! 🚀', 'success');
            setClanTasks(prev => prev.map(t => t._id === taskId ? res.data.task : t));
        } catch (err) {
            showToast(err.response?.data?.message || 'Failed to approve task', 'error');
        }
        setApprovingTaskId(null);
    };

    // Real-time clan task listener
    useEffect(() => {
        if (!socket) return;
        const onClanTaskCreated = ({ taskId, title, message }) => {
            showToast(message || `New clan task: "${title}"`, 'success');
            // Refresh clan tasks
            clanAPI.getMyClanTasks().then(r => setClanTasks(r.data.tasks || [])).catch(() => { });
        };
        socket.on('clan_task_created', onClanTaskCreated);
        socket.on('task_approved', ({ message }) => { showToast(message, 'success'); });
        return () => {
            socket.off('clan_task_created', onClanTaskCreated);
            socket.off('task_approved');
        };
    }, [socket]);

    const getDistance = (clan) => {
        if (!userPos || !clan.location?.coordinates) return null;
        const [lng, lat] = clan.location.coordinates;
        if (lng === 0 && lat === 0) return null;
        const R = 6371;
        const dLat = (lat - userPos.lat) * Math.PI / 180;
        const dLon = (lng - userPos.lng) * Math.PI / 180;
        const a = Math.sin(dLat / 2) ** 2 + Math.cos(userPos.lat * Math.PI / 180) * Math.cos(lat * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
        return (R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))).toFixed(1);
    };

    const isLeader = myClan?.members?.find(m => m.userId?._id?.toString() === user?._id?.toString() && ['leader', 'co-leader'].includes(m.role));

    // ─── CLAN CARD ──────────────────────────────────────────────────────────────
    const renderClanCard = (clan, showDistance = false) => {
        const dist = showDistance ? getDistance(clan) : null;
        const memberCount = clan.members?.length || clan.memberCount || 0;
        const isFull = clan.maxMembers && memberCount >= clan.maxMembers;
        const isMyCurrentClan = user?.clanId?.toString() === clan._id?.toString();
        return (
            <div key={clan._id} className="card clan-card-full">
                <div className="clan-card-header">
                    <div className="clan-badge-circle">{clan.badge || '🛡️'}</div>
                    <div className="clan-card-info">
                        <h3 style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            {clan.name}
                            {clan.isPrivate ? <Lock size={13} style={{ color: '#FF9800' }} /> : <Globe size={13} style={{ color: '#00C853' }} />}
                        </h3>
                        <div className="clan-card-meta">
                            <span className="clan-region-tag"><MapPin size={12} /> {clan.region}</span>
                            {dist && <span className="clan-distance-tag"><Navigation size={12} /> {dist} km</span>}
                            {clan.maxMembers && (
                                <span className="clan-distance-tag" style={{ color: isFull ? '#f44336' : 'inherit' }}>
                                    <Users size={12} /> {memberCount}/{clan.maxMembers}
                                </span>
                            )}
                        </div>
                    </div>
                    {clan.ranking && (
                        <div className="clan-rank-badge">
                            <span className="rank-number">{clan.ranking <= 3 ? RANK_MEDALS[clan.ranking - 1] : `#${clan.ranking}`}</span>
                            <span className="rank-label">RANK</span>
                        </div>
                    )}
                </div>
                {clan.description && <p className="clan-card-desc">{clan.description}</p>}
                <div className="clan-card-stats">
                    <div className="clan-mini-stat"><Users size={14} /><span>{memberCount}{clan.maxMembers ? `/${clan.maxMembers}` : ''}</span><span className="stat-label">Members</span></div>
                    <div className="clan-mini-stat highlight"><Trophy size={14} /><span>{clan.points || 0}</span><span className="stat-label">XP</span></div>
                    <div className="clan-mini-stat"><Leaf size={14} /><span>{clan.impact?.treesPlanted || 0}</span><span className="stat-label">Trees</span></div>
                    <div className="clan-mini-stat"><Trash2 size={14} /><span>{clan.impact?.garbageCleared || 0}</span><span className="stat-label">Cleaned</span></div>
                </div>
                <button
                    className="clan-action-btn"
                    onClick={() => handleJoin(clan._id, clan.isPrivate)}
                    disabled={joiningId === clan._id || isMyCurrentClan || isFull}
                    style={clan.isPrivate && !isMyCurrentClan ? { background: 'linear-gradient(135deg, #FF9800, #F57C00)' } : {}}
                >
                    {joiningId === clan._id ? (
                        <><Loader size={14} className="spin-icon" /> Processing...</>
                    ) : isMyCurrentClan ? (
                        <><CheckCircle size={14} /> Already Joined</>
                    ) : isFull ? (
                        <><XCircle size={14} /> Clan Full</>
                    ) : clan.isPrivate ? (
                        <><Lock size={14} /> Request to Join</>
                    ) : (
                        <><Shield size={14} /> Join Clan</>
                    )}
                </button>
            </div>
        );
    };

    // ─── MY CLAN ─────────────────────────────────────────────────────────────────
    const renderMyClan = () => {
        if (!myClan) return null;
        const pendingRequests = myClan.joinRequests || [];
        return (
            <div className="my-clan-detail">
                {/* Hero */}
                <div className="clan-hero">
                    <div className="clan-hero-badge">{myClan.badge || '🛡️'}</div>
                    <div className="clan-hero-info">
                        <h2 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            {myClan.name}
                            {myClan.isPrivate
                                ? <span style={{ fontSize: '0.65rem', background: 'rgba(255,152,0,0.15)', color: '#FF9800', border: '1px solid rgba(255,152,0,0.3)', borderRadius: 6, padding: '2px 8px', display: 'flex', alignItems: 'center', gap: 4 }}><Lock size={10} /> PRIVATE</span>
                                : <span style={{ fontSize: '0.65rem', background: 'rgba(0,200,83,0.15)', color: '#00C853', border: '1px solid rgba(0,200,83,0.3)', borderRadius: 6, padding: '2px 8px', display: 'flex', alignItems: 'center', gap: 4 }}><Globe size={10} /> PUBLIC</span>
                            }
                        </h2>
                        <p className="clan-hero-desc">{myClan.description || 'United for the environment'}</p>
                        <div className="clan-hero-tags">
                            <span className="hero-tag"><MapPin size={13} /> {myClan.region}</span>
                            <span className="hero-tag"><Users size={13} /> {myClan.members?.length || 0}{myClan.maxMembers ? `/${myClan.maxMembers}` : ''} members</span>
                            <span className="hero-tag gold"><Star size={13} fill="currentColor" /> {myClan.points || 0} XP</span>
                        </div>
                    </div>
                    <div className="clan-hero-rank">
                        <span className="hero-rank-number">{myClan.ranking <= 3 ? RANK_MEDALS[myClan.ranking - 1] : `#${myClan.ranking}`}</span>
                        <span className="hero-rank-label">CITY RANK</span>
                    </div>
                </div>

                {/* Impact Grid */}
                <div className="clan-impact-grid">
                    {[
                        { label: 'Trees Planted', value: myClan.impact?.treesPlanted || 0, icon: <Leaf size={20} />, color: '#00C853' },
                        { label: 'Garbage Cleared', value: myClan.impact?.garbageCleared || 0, icon: <Trash2 size={20} />, color: '#FF6D00' },
                        { label: 'Water Issues', value: myClan.impact?.waterIssuesResolved || 0, icon: <Droplets size={20} />, color: '#00BCD4' },
                        { label: 'Tasks Done', value: myClan.completedTasks || 0, icon: <CheckCircle size={20} />, color: '#FFD700' },
                    ].map((s, i) => (
                        <div key={i} className="clan-impact-card" style={{ borderColor: `${s.color}30` }}>
                            <div className="impact-icon-circle" style={{ background: `${s.color}15`, color: s.color }}>{s.icon}</div>
                            <p className="impact-value">{s.value}</p>
                            <p className="impact-label">{s.label}</p>
                        </div>
                    ))}
                </div>

                {/* Join Requests Panel (leader only) */}
                {isLeader && (
                    <div className="card clan-section" style={{ borderColor: pendingRequests.length > 0 ? 'rgba(255,152,0,0.3)' : undefined }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }} onClick={() => setShowRequests(!showRequests)}>
                            <h3 className="clan-section-title" style={{ margin: 0 }}>
                                <Bell size={18} /> Join Requests
                                {pendingRequests.length > 0 && (
                                    <span style={{ marginLeft: 8, background: '#FF9800', color: '#000', borderRadius: 12, padding: '1px 8px', fontSize: '0.7rem', fontWeight: 700 }}>
                                        {pendingRequests.length}
                                    </span>
                                )}
                            </h3>
                            {showRequests ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </div>
                        {showRequests && (
                            pendingRequests.length === 0 ? (
                                <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', marginTop: 12 }}>No pending join requests.</p>
                            ) : (
                                <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
                                    {pendingRequests.map((req, i) => {
                                        const reqUserId = req.userId?._id || req.userId;
                                        return (
                                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: 'rgba(255,152,0,0.06)', borderRadius: 10, border: '1px solid rgba(255,152,0,0.15)' }}>
                                                <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(255,152,0,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem' }}>
                                                    {req.userId?.profileImage ? <img src={req.userId.profileImage} alt="" style={{ width: '100%', borderRadius: '50%' }} /> : '👤'}
                                                </div>
                                                <div style={{ flex: 1 }}>
                                                    <p style={{ fontWeight: 600, fontSize: '0.9rem', margin: 0 }}>{req.userId?.name || req.name || 'Unknown'}</p>
                                                    <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: 0 }}>Lv.{req.userId?.level || 1} · {req.userId?.totalPoints || 0} XP</p>
                                                </div>
                                                <button
                                                    onClick={() => handleApprove(reqUserId?.toString())}
                                                    disabled={approvingId === reqUserId?.toString()}
                                                    style={{ padding: '6px 14px', borderRadius: 8, background: 'rgba(0,200,83,0.15)', color: '#00C853', border: '1px solid rgba(0,200,83,0.3)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.8rem', fontWeight: 600 }}
                                                >
                                                    {approvingId === reqUserId?.toString() ? <Loader size={12} className="spin-icon" /> : <Check size={14} />} Approve
                                                </button>
                                                <button
                                                    onClick={() => handleReject(reqUserId?.toString())}
                                                    disabled={approvingId === reqUserId?.toString() + '_reject'}
                                                    style={{ padding: '6px 14px', borderRadius: 8, background: 'rgba(244,67,54,0.1)', color: '#f44336', border: '1px solid rgba(244,67,54,0.25)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.8rem', fontWeight: 600 }}
                                                >
                                                    {approvingId === reqUserId?.toString() + '_reject' ? <Loader size={12} className="spin-icon" /> : <XCircle size={14} />} Reject
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            )
                        )}
                    </div>
                )}

                {/* Invite Member (leader only) */}
                {isLeader && (
                    <div className="card clan-section">
                        <h3 className="clan-section-title"><UserPlus size={18} /> Invite Member</h3>
                        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                            <div className="input-wrapper" style={{ flex: 1 }}>
                                <UserPlus className="input-icon" size={16} />
                                <input
                                    type="text"
                                    placeholder="Enter exact username to invite..."
                                    value={leaderInviteInput}
                                    onChange={(e) => setLeaderInviteInput(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleLeaderInvite()}
                                    style={{ paddingLeft: 38 }}
                                />
                            </div>
                            <button
                                onClick={handleLeaderInvite}
                                disabled={sendingInvite || !leaderInviteInput.trim()}
                                style={{ padding: '0 18px', borderRadius: 10, background: 'var(--gradient)', color: '#000', border: 'none', cursor: 'pointer', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.85rem' }}
                            >
                                {sendingInvite ? <Loader size={14} className="spin-icon" /> : <Send size={14} />} Send
                            </button>
                        </div>
                        {/* Pending invites sent */}
                        {myClan.invites?.filter(i => i.status === 'pending').length > 0 && (
                            <div style={{ marginTop: 12 }}>
                                <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: 6 }}>Pending invites:</p>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                    {myClan.invites.filter(i => i.status === 'pending').map((inv, i) => (
                                        <span key={i} style={{ background: 'rgba(100,200,255,0.1)', border: '1px solid rgba(100,200,255,0.2)', borderRadius: 20, padding: '3px 12px', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                                            📨 {inv.username}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Members List */}
                <div className="card clan-section">
                    <h3 className="clan-section-title"><Users size={18} /> Members ({myClan.members?.length || 0}{myClan.maxMembers ? `/${myClan.maxMembers}` : ''})</h3>
                    <div className="clan-members-list">
                        {myClan.members?.map((m, i) => (
                            <div key={i} className="clan-member-row">
                                <div className="member-rank">{i + 1}</div>
                                <div className="member-avatar">
                                    {m.userId?.profileImage ? <img src={m.userId.profileImage} alt="" /> : <span>👤</span>}
                                </div>
                                <div className="member-info">
                                    <span className="member-name">{m.userId?.name || 'Member'}</span>
                                    <span className="member-role">{m.role?.toUpperCase()}</span>
                                </div>
                                <div className="member-stats">
                                    <span className="member-xp"><Star size={12} fill="currentColor" /> {m.contributedPoints || m.userId?.totalPoints || 0} XP</span>
                                    <span className="member-level">Lv.{m.userId?.level || 1}</span>
                                </div>
                                {m.role === 'leader' && <Crown size={16} className="leader-icon" />}
                            </div>
                        ))}
                    </div>
                </div>

                {/* ─── GROUP ACTIVITIES ─── */}
                <div className="card clan-section">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                        <h3 className="clan-section-title" style={{ margin: 0 }}>
                            <Zap size={18} /> Group Activities
                            {activities.filter(a => a.status === 'active').length > 0 && (
                                <span style={{ marginLeft: 8, background: '#00C853', color: '#000', borderRadius: 12, padding: '1px 8px', fontSize: '0.7rem', fontWeight: 700 }}>
                                    {activities.filter(a => a.status === 'active').length} active
                                </span>
                            )}
                        </h3>
                        <button
                            onClick={() => setShowProposeModal(true)}
                            style={{ padding: '7px 14px', borderRadius: 10, background: 'var(--gradient)', color: '#000', border: 'none', cursor: 'pointer', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem' }}
                        >
                            <Plus size={14} /> Propose
                        </button>
                    </div>

                    {/* Sub-tabs */}
                    <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                        {['active', 'completed'].map(t => (
                            <button key={t} onClick={() => setActivityTab(t)}
                                style={{ padding: '5px 16px', borderRadius: 20, border: `1.5px solid ${activityTab === t ? '#00C853' : 'rgba(255,255,255,0.1)'}`, background: activityTab === t ? 'rgba(0,200,83,0.12)' : 'transparent', color: activityTab === t ? '#00C853' : 'var(--text-secondary)', cursor: 'pointer', fontWeight: 600, fontSize: '0.78rem', textTransform: 'capitalize', transition: 'all 0.2s' }}
                            >{t === 'active' ? '⚡ Ongoing' : '✅ Completed'}</button>
                        ))}
                    </div>

                    {/* Active Activities */}
                    {activityTab === 'active' && (() => {
                        const activeActs = activities.filter(a => a.status === 'active');
                        if (activeActs.length === 0) return (
                            <div style={{ textAlign: 'center', padding: '30px 0' }}>
                                <div style={{ fontSize: '2.5rem', marginBottom: 10 }}>🌱</div>
                                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>No active activities yet.</p>
                                <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>Propose the first one and rally your team!</p>
                            </div>
                        );
                        return (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                                {activeActs.map((act, i) => {
                                    const amJoined = act.participants?.find(p => p.userId?.toString() === user?._id?.toString() || p.userId === user?._id);
                                    const isProposerOrLeader = act.proposedBy?.userId?.toString() === user?._id?.toString() || isLeader;
                                    const ACTIVITY_COLORS = { cleanup: '#FF6D00', plantation: '#00C853', awareness: '#2196F3', water: '#00BCD4', recycling: '#9C27B0', energy: '#FFD700', other: '#607D8B' };
                                    const actColor = ACTIVITY_COLORS[act.type] || '#607D8B';
                                    return (
                                        <div key={i} style={{ border: `1px solid ${actColor}30`, borderRadius: 14, padding: '16px 18px', background: `${actColor}06`, position: 'relative' }}>
                                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                                                <div style={{ minWidth: 42, height: 42, borderRadius: 10, background: `${actColor}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.3rem' }}>
                                                    {act.type === 'cleanup' ? '🧹' : act.type === 'plantation' ? '🌳' : act.type === 'awareness' ? '📢' : act.type === 'water' ? '💧' : act.type === 'recycling' ? '♻️' : act.type === 'energy' ? '⚡' : '🌍'}
                                                </div>
                                                <div style={{ flex: 1 }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                                        <h4 style={{ margin: 0, fontSize: '0.95rem' }}>{act.title}</h4>
                                                        <span style={{ fontSize: '0.7rem', background: `${actColor}20`, color: actColor, border: `1px solid ${actColor}40`, borderRadius: 10, padding: '1px 8px', fontWeight: 700, textTransform: 'uppercase' }}>{act.type}</span>
                                                    </div>
                                                    {act.description && <p style={{ margin: '5px 0 0', fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{act.description}</p>}
                                                    <div style={{ display: 'flex', gap: 14, marginTop: 8, flexWrap: 'wrap' }}>
                                                        {act.date && <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 4 }}><Calendar size={11} /> {new Date(act.date).toLocaleDateString()}</span>}
                                                        {act.location && <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 4 }}><MapPin size={11} /> {act.location}</span>}
                                                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 4 }}><Users size={11} /> {act.participants?.length || 0} joined</span>
                                                        <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Proposed by <strong>{act.proposedBy?.name}</strong></span>
                                                    </div>
                                                    {/* Participant avatars */}
                                                    {act.participants?.length > 0 && (
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: -4, marginTop: 10 }}>
                                                            {act.participants.slice(0, 6).map((p, pi) => (
                                                                <div key={pi} title={p.name} style={{ width: 26, height: 26, borderRadius: '50%', background: `hsl(${(pi * 60) % 360},60%,40%)`, border: '2px solid var(--card)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', fontWeight: 700, color: '#fff', marginLeft: pi === 0 ? 0 : -8, zIndex: 6 - pi }}>
                                                                    {p.name?.charAt(0)?.toUpperCase()}
                                                                </div>
                                                            ))}
                                                            {act.participants.length > 6 && <span style={{ marginLeft: 6, fontSize: '0.75rem', color: 'var(--text-secondary)' }}>+{act.participants.length - 6}</span>}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                            {/* Action buttons */}
                                            <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
                                                {amJoined ? (
                                                    <button onClick={() => handleUnjoinActivity(act._id)} disabled={joiningActId === act._id + '_leave'}
                                                        style={{ padding: '7px 16px', borderRadius: 8, background: 'rgba(244,67,54,0.1)', color: '#f44336', border: '1px solid rgba(244,67,54,0.25)', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5 }}>
                                                        {joiningActId === act._id + '_leave' ? <Loader size={12} className="spin-icon" /> : <XCircle size={13} />} Leave Activity
                                                    </button>
                                                ) : (
                                                    <button onClick={() => handleJoinActivity(act._id)} disabled={joiningActId === act._id}
                                                        style={{ padding: '7px 16px', borderRadius: 8, background: 'rgba(0,200,83,0.12)', color: '#00C853', border: '1px solid rgba(0,200,83,0.3)', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5 }}>
                                                        {joiningActId === act._id ? <Loader size={12} className="spin-icon" /> : <Check size={13} />} Join Activity
                                                    </button>
                                                )}
                                                {isProposerOrLeader && (
                                                    <button onClick={() => handleCompleteActivity(act._id)} disabled={completingActId === act._id}
                                                        style={{ padding: '7px 16px', borderRadius: 8, background: 'rgba(255,215,0,0.12)', color: '#FFD700', border: '1px solid rgba(255,215,0,0.3)', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5 }}>
                                                        {completingActId === act._id ? <Loader size={12} className="spin-icon" /> : <Trophy size={13} />} Mark Complete
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        );
                    })()}

                    {/* Completed Activities */}
                    {activityTab === 'completed' && (() => {
                        const completedActs = activities.filter(a => a.status === 'completed');
                        if (completedActs.length === 0) return (
                            <div style={{ textAlign: 'center', padding: '30px 0' }}>
                                <div style={{ fontSize: '2.5rem', marginBottom: 10 }}>🏆</div>
                                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>No completed activities yet.</p>
                                <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>Complete your first activity to earn clan XP!</p>
                            </div>
                        );
                        return (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                                {completedActs.map((act, i) => (
                                    <div key={i} style={{ border: '1px solid rgba(0,200,83,0.2)', borderRadius: 14, padding: '16px 18px', background: 'rgba(0,200,83,0.04)', opacity: 0.9 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                                            <div style={{ fontSize: '1.5rem' }}>
                                                {act.type === 'cleanup' ? '🧹' : act.type === 'plantation' ? '🌳' : act.type === 'awareness' ? '📢' : act.type === 'water' ? '💧' : act.type === 'recycling' ? '♻️' : '🌍'}
                                            </div>
                                            <div style={{ flex: 1 }}>
                                                <h4 style={{ margin: 0, fontSize: '0.92rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                                                    {act.title}
                                                    <span style={{ fontSize: '0.7rem', background: 'rgba(0,200,83,0.15)', color: '#00C853', borderRadius: 10, padding: '1px 8px' }}>✅ Done</span>
                                                </h4>
                                                <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                                    Completed {act.completedAt ? new Date(act.completedAt).toLocaleDateString() : ''} · {act.participants?.length || 0} participants
                                                </p>
                                            </div>
                                            <div style={{ textAlign: 'right' }}>
                                                <div style={{ fontSize: '1rem', fontWeight: 800, color: '#FFD700' }}>+{act.pointsAwarded || 0}</div>
                                                <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>Clan XP</div>
                                            </div>
                                        </div>
                                        {act.description && <p style={{ margin: '0 0 8px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{act.description}</p>}
                                        {/* Participants */}
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                            <span style={{ fontSize: '0.73rem', color: 'var(--text-secondary)' }}>Participants:</span>
                                            {act.participants?.map((p, pi) => (
                                                <span key={pi} style={{ fontSize: '0.73rem', background: 'rgba(255,255,255,0.06)', borderRadius: 10, padding: '2px 8px', color: 'var(--text-secondary)' }}>
                                                    {p.name}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        );
                    })()}
                </div>

                <button className="clan-leave-btn" onClick={handleLeave} disabled={leavingClan}>
                    <LogOut size={16} /> {leavingClan ? 'Leaving...' : 'Leave Clan'}
                </button>

                {/* ─── CLAN TASKS (Leader-Created) ─── */}
                <div className="card clan-section" style={{ borderColor: 'rgba(255,215,0,0.2)' }}>
                    <div className="clan-tasks-header">
                        <h3 className="clan-section-title" style={{ margin: 0 }}>
                            <Trophy size={18} /> Clan Tasks
                            {clanTasks.filter(t => {
                                const me = t.assignedUsers?.find(a => a.userId?.toString() === user?._id?.toString());
                                return me?.status === 'pending_approval';
                            }).length > 0 && (
                                    <span style={{ marginLeft: 8, background: '#FF9800', color: '#000', borderRadius: 12, padding: '1px 8px', fontSize: '0.7rem', fontWeight: 700 }}>
                                        {clanTasks.filter(t => {
                                            const me = t.assignedUsers?.find(a => a.userId?.toString() === user?._id?.toString());
                                            return me?.status === 'pending_approval';
                                        }).length} pending
                                    </span>
                                )}
                        </h3>
                        {isLeader && (
                            <button
                                onClick={() => setShowCreateTaskModal(true)}
                                className="primary-btn"
                                style={{ padding: '7px 14px', fontSize: '0.8rem', background: 'linear-gradient(135deg,#FFD700,#FF9800)', color: '#000' }}
                            >
                                <Plus size={14} /> Create Task
                            </button>
                        )}
                    </div>

                    {clanTasks.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '24px 0' }}>
                            <div style={{ fontSize: '2rem', marginBottom: 8 }}>🎯</div>
                            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                                {isLeader ? 'Create a task to assign to all clan members.' : 'No clan tasks yet. Your leader will create one soon!'}
                            </p>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            {clanTasks.map((task, i) => {
                                const myEntry = task.assignedUsers?.find(a => a.userId?.toString() === user?._id?.toString());
                                const isPending = myEntry?.status === 'pending_approval';
                                const isActive = myEntry?.status === 'assigned';
                                const isDone = myEntry?.status === 'completed';
                                const TASK_COLORS = { cleanup: '#FF6D00', plantation: '#00C853', awareness: '#2196F3', water: '#00BCD4', tree: '#4CAF50', garbage: '#FF5722', other: '#607D8B' };
                                const taskColor = TASK_COLORS[task.type] || '#607D8B';
                                return (
                                    <div key={i} className="clan-task-card" style={{ borderColor: `${taskColor}30`, background: `${taskColor}06` }}>
                                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
                                                    <span style={{ fontSize: '0.68rem', background: `${taskColor}20`, color: taskColor, border: `1px solid ${taskColor}40`, borderRadius: 10, padding: '1px 8px', fontWeight: 700, textTransform: 'uppercase', flexShrink: 0 }}>{task.type}</span>
                                                    {isPending && <span style={{ fontSize: '0.68rem', background: 'rgba(255,152,0,0.15)', color: '#FF9800', border: '1px solid rgba(255,152,0,0.3)', borderRadius: 10, padding: '1px 8px', fontWeight: 700, flexShrink: 0 }}>⏳ Pending</span>}
                                                    {isActive && <span style={{ fontSize: '0.68rem', background: 'rgba(0,200,83,0.15)', color: '#00C853', border: '1px solid rgba(0,200,83,0.3)', borderRadius: 10, padding: '1px 8px', fontWeight: 700, flexShrink: 0 }}>✅ Active</span>}
                                                    {isDone && <span style={{ fontSize: '0.68rem', background: 'rgba(255,215,0,0.15)', color: '#FFD700', border: '1px solid rgba(255,215,0,0.3)', borderRadius: 10, padding: '1px 8px', fontWeight: 700, flexShrink: 0 }}>🏆 Completed</span>}
                                                </div>
                                                <h4 className="clan-task-title">{task.title}</h4>
                                                {task.description && <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{task.description}</p>}
                                                <div className="clan-task-meta">
                                                    <span><Star size={11} fill="currentColor" color="#FFD700" /> {task.pointsReward || 50} pts</span>
                                                    <span><Users size={11} /> {task.assignedUsers?.filter(a => a.status === 'assigned').length || 0} active</span>
                                                </div>
                                            </div>
                                        </div>
                                        {isPending && (
                                            <button
                                                onClick={() => handleApproveClanTask(task._id)}
                                                disabled={approvingTaskId === task._id}
                                                style={{ marginTop: 12, padding: '8px 18px', borderRadius: 8, background: 'rgba(0,200,83,0.15)', color: '#00C853', border: '1px solid rgba(0,200,83,0.3)', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}
                                            >
                                                {approvingTaskId === task._id ? <Loader size={13} className="spin-icon" /> : <Check size={14} />}
                                                Approve & Join Activity
                                            </button>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

            </div>
        );
    };

    // ─── INVITES TAB ─────────────────────────────────────────────────────────────
    const renderInvites = () => (
        <div>
            {myInvites.length === 0 ? (
                <div className="empty-state">
                    <div style={{ fontSize: '3rem', marginBottom: 16 }}>📭</div>
                    <h3 style={{ marginBottom: 8 }}>No pending invites</h3>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>When a clan leader invites you, it'll show up here.</p>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {myInvites.map((inv, i) => (
                        <div key={i} className="card" style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '18px 20px' }}>
                            <div style={{ fontSize: '2rem' }}>{inv.badge || '🛡️'}</div>
                            <div style={{ flex: 1 }}>
                                <h3 style={{ margin: 0, fontSize: '1rem' }}>{inv.clanName}</h3>
                                <p style={{ margin: '2px 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}><MapPin size={11} /> {inv.region}</p>
                                {inv.description && <p style={{ margin: '4px 0 0', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{inv.description}</p>}
                            </div>
                            <div style={{ display: 'flex', gap: 8 }}>
                                <button
                                    onClick={() => handleRespondInvite(inv.clanId, true)}
                                    style={{ padding: '8px 16px', borderRadius: 8, background: 'rgba(0,200,83,0.15)', color: '#00C853', border: '1px solid rgba(0,200,83,0.3)', cursor: 'pointer', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.82rem' }}
                                >
                                    <Check size={14} /> Accept
                                </button>
                                <button
                                    onClick={() => handleRespondInvite(inv.clanId, false)}
                                    style={{ padding: '8px 16px', borderRadius: 8, background: 'rgba(244,67,54,0.1)', color: '#f44336', border: '1px solid rgba(244,67,54,0.25)', cursor: 'pointer', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.82rem' }}
                                >
                                    <XCircle size={14} /> Decline
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );

    // ─── LEADERBOARD ─────────────────────────────────────────────────────────────
    const renderLeaderboard = () => (
        <div className="clan-leaderboard">
            {leaderboard.length >= 3 && (
                <div className="podium-container">
                    {[1, 0, 2].map((idx) => {
                        const clan = leaderboard[idx];
                        if (!clan) return null;
                        const isFirst = idx === 0;
                        return (
                            <div key={idx} className={`podium-card ${isFirst ? 'first' : ''}`}>
                                <div className="podium-medal">{RANK_MEDALS[idx]}</div>
                                <div className="podium-badge">{clan.badge || '🛡️'}</div>
                                <h4 className="podium-name">{clan.name}</h4>
                                <p className="podium-region"><MapPin size={11} /> {clan.region}</p>
                                <p className="podium-points" style={{ color: RANK_COLORS[idx] }}>{clan.points} XP</p>
                                <div className="podium-stats"><span><Users size={11} /> {clan.memberCount}</span></div>
                            </div>
                        );
                    })}
                </div>
            )}
            <div className="card clan-section">
                <h3 className="clan-section-title"><TrendingUp size={18} /> All City Rankings</h3>
                <div className="clan-ranking-table">
                    <div className="ranking-header-row">
                        <span className="col-rank">Rank</span>
                        <span className="col-name">Clan</span>
                        <span className="col-region">City / Region</span>
                        <span className="col-members">Members</span>
                        <span className="col-points">Points</span>
                    </div>
                    {leaderboard.map((clan, idx) => (
                        <div key={idx} className={`ranking-row ${idx < 3 ? 'top-three' : ''} ${user?.clanName === clan.name ? 'my-clan-row' : ''}`}>
                            <span className="col-rank">{idx < 3 ? RANK_MEDALS[idx] : <span className="rank-num">{clan.rank || idx + 1}</span>}</span>
                            <span className="col-name"><span className="ranking-clan-name">{clan.name}</span></span>
                            <span className="col-region">{clan.region}</span>
                            <span className="col-members">{clan.memberCount}</span>
                            <span className="col-points"><span className="points-value">{clan.points}</span> XP</span>
                        </div>
                    ))}
                    {leaderboard.length === 0 && (
                        <div className="empty-state" style={{ padding: '40px 20px' }}>
                            <p style={{ color: 'var(--text-secondary)' }}>No clans ranked yet. Create one and start earning!</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );

    // ─── MAIN RENDER ─────────────────────────────────────────────────────────────
    return (
        <div className="clan-view">
            {/* Header */}
            <div className="view-header-row">
                <div>
                    <h1 className="glow-text" style={{ fontSize: '2rem', marginBottom: 8 }}>Eco Clans</h1>
                    <p style={{ color: 'var(--text-secondary)' }}>Team up, compete across the city, amplify your impact</p>
                </div>
                <div className="header-actions">
                    <button className="primary-btn" style={{ width: 'auto', padding: '10px 20px', marginTop: 0, fontSize: '0.85rem' }} onClick={() => setShowCreate(true)}>
                        <Plus size={16} /> Create Clan
                    </button>
                </div>
            </div>

            {/* Tabs */}
            <div className="missions-tabs" style={{ marginBottom: 24 }}>
                {user?.clanId && <button className={`missions-tab ${tab === 'my' ? 'active' : ''}`} onClick={() => setTab('my')}><Shield size={14} /> My Clan</button>}
                <button className={`missions-tab ${tab === 'nearby' ? 'active' : ''}`} onClick={() => setTab('nearby')}><Navigation size={14} /> Nearby</button>
                <button className={`missions-tab ${tab === 'browse' ? 'active' : ''}`} onClick={() => setTab('browse')}><Search size={14} /> Browse</button>
                <button className={`missions-tab ${tab === 'rankings' ? 'active' : ''}`} onClick={() => setTab('rankings')}><Trophy size={14} /> City Rankings</button>
                <button className={`missions-tab ${tab === 'invites' ? 'active' : ''}`} onClick={() => setTab('invites')}>
                    <Bell size={14} /> Invites {myInvites.length > 0 && <span style={{ background: '#FF9800', color: '#000', borderRadius: 10, padding: '0 6px', fontSize: '0.7rem', fontWeight: 700, marginLeft: 4 }}>{myInvites.length}</span>}
                </button>
            </div>

            {/* Browse search */}
            {tab === 'browse' && (
                <div className="search-bar" style={{ marginBottom: 24 }}>
                    <Search size={18} style={{ color: 'var(--text-secondary)' }} />
                    <input type="text" placeholder="Filter by city or region..." value={searchRegion} onChange={(e) => setSearchRegion(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && fetchTabData()} className="search-input" />
                    <button className="secondary-btn" style={{ padding: '8px 16px', fontSize: '0.8rem' }} onClick={fetchTabData}>Search</button>
                </div>
            )}

            {/* Content */}
            {loading ? (
                <div className="loading-container"><div className="loader"></div></div>
            ) : (
                <>
                    {tab === 'my' && renderMyClan()}
                    {tab === 'nearby' && (
                        nearbyClans.length === 0 ? (
                            <div className="empty-state">
                                <div style={{ fontSize: '3rem', marginBottom: 16 }}>📍</div>
                                <h3 style={{ marginBottom: 8 }}>No nearby clans found</h3>
                                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: 20 }}>No clans registered near your location. Be the first!</p>
                                <button className="primary-btn" style={{ width: 'auto', padding: '10px 24px' }} onClick={() => setShowCreate(true)}><Plus size={16} /> Create Clan Here</button>
                            </div>
                        ) : <div className="clans-grid-new">{nearbyClans.map((clan) => renderClanCard(clan, true))}</div>
                    )}
                    {tab === 'browse' && (
                        allClans.length === 0 ? (
                            <div className="empty-state">
                                <div style={{ fontSize: '3rem', marginBottom: 16 }}>🔍</div>
                                <h3 style={{ marginBottom: 8 }}>No clans found</h3>
                                <p style={{ color: 'var(--text-secondary)' }}>{searchRegion ? `No clans in "${searchRegion}". Try another city!` : 'No clans yet. Be the pioneer!'}</p>
                            </div>
                        ) : <div className="clans-grid-new">{allClans.map((clan) => renderClanCard(clan, false))}</div>
                    )}
                    {tab === 'rankings' && renderLeaderboard()}
                    {tab === 'invites' && renderInvites()}
                </>
            )}

            {/* ─── Create Clan Modal ─── */}
            {showCreate && (
                <div className="modal-overlay" onClick={() => setShowCreate(false)}>
                    <div className="modal-card" onClick={e => e.stopPropagation()} style={{ maxHeight: '90vh', overflowY: 'auto' }}>
                        <div className="modal-header">
                            <h3>🛡️ Create New Clan</h3>
                            <button onClick={() => setShowCreate(false)} className="modal-close"><X size={20} /></button>
                        </div>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', marginBottom: 20 }}>Your clan will be anchored to your GPS location for nearby discovery.</p>
                        <form onSubmit={handleCreate}>
                            {/* Name */}
                            <div className="input-group">
                                <label>Clan Name *</label>
                                <div className="input-wrapper">
                                    <Shield className="input-icon" size={18} />
                                    <input type="text" placeholder="e.g. Green Guardians" value={createForm.name} onChange={(e) => setCreateForm(f => ({ ...f, name: e.target.value }))} required />
                                </div>
                            </div>
                            {/* Region */}
                            <div className="input-group">
                                <label>City / Region *</label>
                                <div className="input-wrapper">
                                    <MapPin className="input-icon" size={18} />
                                    <input type="text" placeholder="e.g. Bangalore, Mumbai, Pune" value={createForm.region} onChange={(e) => setCreateForm(f => ({ ...f, region: e.target.value }))} required />
                                </div>
                            </div>
                            {/* Description */}
                            <div className="input-group">
                                <label>Description</label>
                                <div className="input-wrapper">
                                    <input type="text" placeholder="What's your clan's mission?" value={createForm.description} onChange={(e) => setCreateForm(f => ({ ...f, description: e.target.value }))} style={{ paddingLeft: 14 }} />
                                </div>
                            </div>
                            {/* Max Members */}
                            <div className="input-group">
                                <label>Member Limit (2–500)</label>
                                <div className="input-wrapper">
                                    <Users className="input-icon" size={18} />
                                    <input type="number" min={2} max={500} value={createForm.maxMembers} onChange={(e) => setCreateForm(f => ({ ...f, maxMembers: parseInt(e.target.value) || 50 }))} />
                                </div>
                            </div>
                            {/* Public / Private toggle */}
                            <div className="input-group">
                                <label>Visibility</label>
                                <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                                    <button type="button"
                                        onClick={() => setCreateForm(f => ({ ...f, isPrivate: false }))}
                                        style={{ flex: 1, padding: '10px', borderRadius: 10, border: `2px solid ${!createForm.isPrivate ? '#00C853' : 'rgba(255,255,255,0.1)'}`, background: !createForm.isPrivate ? 'rgba(0,200,83,0.12)' : 'transparent', color: !createForm.isPrivate ? '#00C853' : 'var(--text-secondary)', cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, transition: 'all 0.2s' }}
                                    >
                                        <Globe size={15} /> Public
                                    </button>
                                    <button type="button"
                                        onClick={() => setCreateForm(f => ({ ...f, isPrivate: true }))}
                                        style={{ flex: 1, padding: '10px', borderRadius: 10, border: `2px solid ${createForm.isPrivate ? '#FF9800' : 'rgba(255,255,255,0.1)'}`, background: createForm.isPrivate ? 'rgba(255,152,0,0.12)' : 'transparent', color: createForm.isPrivate ? '#FF9800' : 'var(--text-secondary)', cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, transition: 'all 0.2s' }}
                                    >
                                        <Lock size={15} /> Private
                                    </button>
                                </div>
                                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: 6 }}>
                                    {createForm.isPrivate ? '🔒 Members must be approved by you before joining.' : '🌐 Anyone can join instantly.'}
                                </p>
                            </div>
                            {/* Invite Usernames */}
                            <div className="input-group">
                                <label>Invite Members (by username)</label>
                                <div style={{ display: 'flex', gap: 8 }}>
                                    <div className="input-wrapper" style={{ flex: 1 }}>
                                        <UserPlus className="input-icon" size={16} />
                                        <input
                                            type="text"
                                            placeholder="Type username & press Enter or Add"
                                            value={inviteInput}
                                            onChange={(e) => setInviteInput(e.target.value)}
                                            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addInviteChip(); } }}
                                            style={{ paddingLeft: 38 }}
                                        />
                                    </div>
                                    <button type="button" onClick={addInviteChip} style={{ padding: '0 14px', borderRadius: 10, background: 'rgba(0,200,83,0.15)', color: '#00C853', border: '1px solid rgba(0,200,83,0.3)', cursor: 'pointer', fontWeight: 700 }}>Add</button>
                                </div>
                                {createForm.inviteUsernames.length > 0 && (
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                                        {createForm.inviteUsernames.map((name, i) => (
                                            <span key={i} style={{ background: 'rgba(0,200,83,0.1)', border: '1px solid rgba(0,200,83,0.25)', borderRadius: 20, padding: '3px 10px 3px 12px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: 6, color: '#00C853' }}>
                                                {name}
                                                <button type="button" onClick={() => removeInviteChip(name)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: '#00C853', display: 'flex' }}><X size={12} /></button>
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>
                            {/* GPS */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'rgba(0,200,83,0.08)', borderRadius: 10, marginBottom: 20, fontSize: '0.78rem', color: 'var(--primary)', fontWeight: 600 }}>
                                <MapPin size={14} />
                                {userPos ? `📍 Location: ${userPos.lat.toFixed(4)}, ${userPos.lng.toFixed(4)}` : 'Detecting GPS...'}
                            </div>
                            <button type="submit" className="primary-btn" disabled={creating}>
                                {creating ? <><Loader size={16} className="spin-icon" /> Creating...</> : <><Plus size={16} /> Create Clan</>}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* ─── Propose Activity Modal ─── */}
            {showProposeModal && (
                <div className="modal-overlay" onClick={() => setShowProposeModal(false)}>
                    <div className="modal-card" onClick={e => e.stopPropagation()} style={{ maxHeight: '90vh', overflowY: 'auto' }}>
                        <div className="modal-header">
                            <h3>⚡ Propose Group Activity</h3>
                            <button onClick={() => setShowProposeModal(false)} className="modal-close"><X size={20} /></button>
                        </div>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', marginBottom: 20 }}>
                            Propose an environmental activity for your clan. Members can join, and completing it earns everyone XP + boosts your leaderboard rank!
                        </p>
                        <form onSubmit={handleProposeActivity}>
                            {/* Activity Type */}
                            <div className="input-group">
                                <label>Activity Type *</label>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginTop: 4 }}>
                                    {[
                                        { key: 'cleanup', emoji: '🧹', label: 'Cleanup', color: '#FF6D00' },
                                        { key: 'plantation', emoji: '🌳', label: 'Plantation', color: '#00C853' },
                                        { key: 'awareness', emoji: '📢', label: 'Awareness', color: '#2196F3' },
                                        { key: 'water', emoji: '💧', label: 'Water', color: '#00BCD4' },
                                        { key: 'recycling', emoji: '♻️', label: 'Recycling', color: '#9C27B0' },
                                        { key: 'energy', emoji: '⚡', label: 'Energy', color: '#FFD700' },
                                    ].map(({ key, emoji, label, color }) => (
                                        <button key={key} type="button"
                                            onClick={() => setProposeForm(f => ({ ...f, type: key }))}
                                            style={{ padding: '10px 8px', borderRadius: 10, border: `2px solid ${proposeForm.type === key ? color : 'rgba(255,255,255,0.08)'}`, background: proposeForm.type === key ? `${color}15` : 'transparent', color: proposeForm.type === key ? color : 'var(--text-secondary)', cursor: 'pointer', fontWeight: 600, fontSize: '0.78rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, transition: 'all 0.2s' }}>
                                            <span style={{ fontSize: '1.3rem' }}>{emoji}</span>
                                            {label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            {/* Title */}
                            <div className="input-group">
                                <label>Activity Title *</label>
                                <div className="input-wrapper">
                                    <Zap className="input-icon" size={18} />
                                    <input type="text" placeholder="e.g. Weekend Park Cleanup Drive" value={proposeForm.title} onChange={e => setProposeForm(f => ({ ...f, title: e.target.value }))} required />
                                </div>
                            </div>
                            {/* Description */}
                            <div className="input-group">
                                <label>Description</label>
                                <textarea
                                    placeholder="Describe what the activity involves, what to bring, instructions for participants..."
                                    value={proposeForm.description}
                                    onChange={e => setProposeForm(f => ({ ...f, description: e.target.value }))}
                                    rows={3}
                                    style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: 'var(--text-primary)', fontSize: '0.85rem', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box', marginTop: 4 }}
                                />
                            </div>
                            {/* Date + Location */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                <div className="input-group">
                                    <label>Date</label>
                                    <div className="input-wrapper">
                                        <Calendar className="input-icon" size={16} />
                                        <input type="date" value={proposeForm.date} onChange={e => setProposeForm(f => ({ ...f, date: e.target.value }))} />
                                    </div>
                                </div>
                                <div className="input-group">
                                    <label>Location / Area</label>
                                    <div className="input-wrapper">
                                        <MapPin className="input-icon" size={16} />
                                        <input type="text" placeholder="e.g. Cubbon Park" value={proposeForm.location} onChange={e => setProposeForm(f => ({ ...f, location: e.target.value }))} />
                                    </div>
                                </div>
                            </div>
                            {/* XP Preview */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px', background: 'rgba(255,215,0,0.06)', border: '1px solid rgba(255,215,0,0.15)', borderRadius: 10, marginBottom: 20, fontSize: '0.8rem' }}>
                                <Star size={18} style={{ color: '#FFD700' }} fill="#FFD700" />
                                <div>
                                    <strong style={{ color: '#FFD700' }}>Clan earns 150+ XP</strong> on completion
                                    <p style={{ margin: '2px 0 0', color: 'var(--text-secondary)', fontSize: '0.75rem' }}>+10 XP per participant · Each member earns 75 personal XP</p>
                                </div>
                            </div>
                            <button type="submit" className="primary-btn" disabled={proposing}>
                                {proposing ? <><Loader size={16} className="spin-icon" /> Proposing...</> : <><Zap size={16} /> Propose Activity</>}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* ─── Create Clan Task Modal (Leader Only) ─── */}
            {showCreateTaskModal && (
                <div className="modal-overlay" onClick={() => setShowCreateTaskModal(false)}>
                    <div className="modal-card" onClick={e => e.stopPropagation()} style={{ maxHeight: '90vh', overflowY: 'auto' }}>
                        <div className="modal-header">
                            <h3>🎯 Create Clan Task</h3>
                            <button onClick={() => setShowCreateTaskModal(false)} className="modal-close"><X size={20} /></button>
                        </div>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', marginBottom: 20 }}>
                            As leader, this task will be assigned to <strong>all clan members</strong>. Each member can approve and join individually.
                        </p>
                        <form onSubmit={handleCreateClanTask}>
                            {/* Task Type */}
                            <div className="input-group">
                                <label>Task Type *</label>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginTop: 4 }}>
                                    {[
                                        { key: 'cleanup', emoji: '🧹', label: 'Cleanup', color: '#FF6D00' },
                                        { key: 'plantation', emoji: '🌳', label: 'Plantation', color: '#00C853' },
                                        { key: 'awareness', emoji: '📢', label: 'Awareness', color: '#2196F3' },
                                        { key: 'water', emoji: '💧', label: 'Water', color: '#00BCD4' },
                                        { key: 'garbage', emoji: '🗑️', label: 'Garbage', color: '#FF5722' },
                                        { key: 'other', emoji: '🌍', label: 'Other', color: '#607D8B' },
                                    ].map(({ key, emoji, label, color }) => (
                                        <button key={key} type="button"
                                            onClick={() => setCreateTaskForm(f => ({ ...f, type: key }))}
                                            style={{ padding: '10px 8px', borderRadius: 10, border: `2px solid ${createTaskForm.type === key ? color : 'rgba(255,255,255,0.08)'}`, background: createTaskForm.type === key ? `${color}15` : 'transparent', color: createTaskForm.type === key ? color : 'var(--text-secondary)', cursor: 'pointer', fontWeight: 600, fontSize: '0.78rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, transition: 'all 0.2s' }}>
                                            <span style={{ fontSize: '1.3rem' }}>{emoji}</span>
                                            {label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            {/* Title */}
                            <div className="input-group">
                                <label>Task Title *</label>
                                <div className="input-wrapper">
                                    <Trophy className="input-icon" size={18} />
                                    <input type="text" placeholder="e.g. Clean the riverside park" value={createTaskForm.title}
                                        onChange={e => setCreateTaskForm(f => ({ ...f, title: e.target.value }))} required style={{ paddingLeft: 38 }} />
                                </div>
                            </div>
                            {/* Description */}
                            <div className="input-group">
                                <label>Description</label>
                                <textarea
                                    placeholder="Instructions for clan members..."
                                    value={createTaskForm.description}
                                    onChange={e => setCreateTaskForm(f => ({ ...f, description: e.target.value }))}
                                    rows={3}
                                    style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: 'var(--text-primary)', fontSize: '0.85rem', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box', marginTop: 4 }}
                                />
                            </div>
                            {/* Points Reward */}
                            <div className="input-group">
                                <label>Points Reward</label>
                                <div className="input-wrapper">
                                    <Star className="input-icon" size={16} />
                                    <input type="number" min={10} max={500} value={createTaskForm.pointsReward}
                                        onChange={e => setCreateTaskForm(f => ({ ...f, pointsReward: parseInt(e.target.value) || 50 }))}
                                        style={{ paddingLeft: 38 }} />
                                </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px', background: 'rgba(255,215,0,0.06)', border: '1px solid rgba(255,215,0,0.15)', borderRadius: 10, marginBottom: 20, fontSize: '0.8rem' }}>
                                <Crown size={18} style={{ color: '#FFD700' }} />
                                <div>
                                    <strong style={{ color: '#FFD700' }}>Leader Task</strong>
                                    <p style={{ margin: '2px 0 0', color: 'var(--text-secondary)', fontSize: '0.75rem' }}>Auto-assigned to all {myClan?.members?.length || 0} members with Pending Approval status</p>
                                </div>
                            </div>
                            <button type="submit" className="primary-btn" disabled={creatingTask} style={{ background: 'linear-gradient(135deg, #FFD700, #FF9800)', color: '#000' }}>
                                {creatingTask ? <><Loader size={16} className="spin-icon" /> Creating...</> : <><Trophy size={16} /> Create & Assign to All Members</>}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* Toast */}
            {toast && <div className={`toast ${toast.type}`}>{toast.message}</div>}

        </div>
    );
}
