import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import {
    Footprints, Bike, Bus, Car, Play, Square, Pause,
    MapPin, Zap, Leaf, TrendingUp, AlertTriangle,
    Clock, Route, Flame, Trophy, Shield, Navigation,
    ChevronDown, Activity, Wind, BarChart3
} from 'lucide-react';

// =========== CONSTANTS ===========
const MODES = [
    { id: 'walking', label: 'Walking', icon: Footprints, emoji: '🚶', maxSpeed: 8, color: '#00C853', co2PerKm: 0 },
    { id: 'cycling', label: 'Cycling', icon: Bike, emoji: '🚲', maxSpeed: 35, color: '#00BCD4', co2PerKm: 0 },
    { id: 'public', label: 'Public Transport', icon: Bus, emoji: '🚌', maxSpeed: 80, color: '#FF6D00', co2PerKm: 50 },
];

const CAR_CO2_PER_KM = 120; // grams CO₂ per km for average car
const TRACKING_INTERVAL = 3000; // GPS poll every 3 seconds

// Distance between two GPS points (Haversine)
function haversine(lat1, lon1, lat2, lon2) {
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatDuration(ms) {
    const secs = Math.floor(ms / 1000);
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    return `${h > 0 ? h + ':' : ''}${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function formatDistance(meters) {
    return meters >= 1000 ? (meters / 1000).toFixed(2) + ' km' : Math.round(meters) + ' m';
}

export default function MobilityView() {
    const { user } = useAuth();

    // Tracking state
    const [selectedMode, setSelectedMode] = useState(null);
    const [isTracking, setIsTracking] = useState(false);
    const [isPaused, setIsPaused] = useState(false);

    // GPS Data
    const [currentPos, setCurrentPos] = useState(null);
    const [currentSpeed, setCurrentSpeed] = useState(0);
    const [trackPoints, setTrackPoints] = useState([]);

    // Session stats
    const [distance, setDistance] = useState(0);
    const [duration, setDuration] = useState(0);
    const [startTime, setStartTime] = useState(null);
    const [co2Saved, setCo2Saved] = useState(0);
    const [avgSpeed, setAvgSpeed] = useState(0);
    const [maxSpeedReached, setMaxSpeedReached] = useState(0);

    // Fraud detection
    const [speedAlerts, setSpeedAlerts] = useState(0);
    const [routeFlags, setRouteFlags] = useState([]);
    const [trustScore, setTrustScore] = useState(100);

    // History
    const [sessions, setSessions] = useState(() => {
        try {
            return JSON.parse(localStorage.getItem('mobility_sessions') || '[]');
        } catch { return []; }
    });
    const [showHistory, setShowHistory] = useState(false);

    // Refs
    const watchIdRef = useRef(null);
    const timerRef = useRef(null);
    const lastPosRef = useRef(null);
    const speedsRef = useRef([]);
    const pausedDurationRef = useRef(0);
    const pauseStartRef = useRef(null);

    // =========== LIFECYCLE STATS ===========
    const totalSessions = sessions.length;
    const totalDistanceKm = sessions.reduce((acc, s) => acc + s.distance, 0) / 1000;
    const totalCO2Saved = sessions.reduce((acc, s) => acc + s.co2Saved, 0);
    const totalDuration = sessions.reduce((acc, s) => acc + s.duration, 0);
    const currentStreak = calculateStreak(sessions);
    const weeklyDistance = calculateWeeklyDistance(sessions);

    // =========== START TRACKING ===========
    const startTracking = useCallback(() => {
        if (!selectedMode) return;
        if (!navigator.geolocation) {
            alert('Geolocation not supported in this browser');
            return;
        }

        setIsTracking(true);
        setIsPaused(false);
        setDistance(0);
        setDuration(0);
        setCo2Saved(0);
        setAvgSpeed(0);
        setMaxSpeedReached(0);
        setSpeedAlerts(0);
        setRouteFlags([]);
        setTrustScore(100);
        setTrackPoints([]);
        speedsRef.current = [];
        lastPosRef.current = null;
        pausedDurationRef.current = 0;
        pauseStartRef.current = null;

        const now = Date.now();
        setStartTime(now);

        // Start GPS watcher
        watchIdRef.current = navigator.geolocation.watchPosition(
            (pos) => {
                if (isPaused) return;
                const { latitude, longitude, speed: gpsSpeed, accuracy } = pos.coords;
                const point = { lat: latitude, lng: longitude, time: Date.now(), accuracy };

                setCurrentPos({ lat: latitude, lng: longitude });

                // Calculate speed (km/h)
                let speedKmh = 0;
                if (gpsSpeed != null && gpsSpeed >= 0) {
                    speedKmh = gpsSpeed * 3.6;
                } else if (lastPosRef.current) {
                    const d = haversine(lastPosRef.current.lat, lastPosRef.current.lng, latitude, longitude);
                    const dt = (point.time - lastPosRef.current.time) / 1000;
                    if (dt > 0) speedKmh = (d / dt) * 3.6;
                }

                setCurrentSpeed(Math.round(speedKmh * 10) / 10);
                speedsRef.current.push(speedKmh);

                // Update max speed
                setMaxSpeedReached(prev => Math.max(prev, speedKmh));

                // Calculate distance
                if (lastPosRef.current && accuracy < 50) {
                    const seg = haversine(lastPosRef.current.lat, lastPosRef.current.lng, latitude, longitude);
                    if (seg < 500) { // Filter GPS jumps > 500m
                        setDistance(prev => prev + seg);
                    }
                }

                // Track points for route
                setTrackPoints(prev => [...prev, point]);

                // FRAUD DETECTION: Speed anomaly
                const mode = MODES.find(m => m.id === selectedMode);
                if (mode && speedKmh > mode.maxSpeed) {
                    setSpeedAlerts(prev => prev + 1);
                    setTrustScore(prev => Math.max(0, prev - 5));
                    setRouteFlags(prev => [...prev, {
                        type: 'speed',
                        message: `Speed ${speedKmh.toFixed(1)} km/h exceeds ${mode.label} limit (${mode.maxSpeed} km/h)`,
                        time: new Date().toLocaleTimeString(),
                    }]);
                }

                // FRAUD DETECTION: Sudden location jump
                if (lastPosRef.current) {
                    const jumpDist = haversine(lastPosRef.current.lat, lastPosRef.current.lng, latitude, longitude);
                    const jumpTime = (point.time - lastPosRef.current.time) / 1000;
                    if (jumpDist > 500 && jumpTime < 10) {
                        setTrustScore(prev => Math.max(0, prev - 15));
                        setRouteFlags(prev => [...prev, {
                            type: 'teleport',
                            message: `Location jump of ${(jumpDist / 1000).toFixed(1)} km detected`,
                            time: new Date().toLocaleTimeString(),
                        }]);
                    }
                }

                lastPosRef.current = point;
            },
            (err) => console.error('GPS error:', err),
            { enableHighAccuracy: true, maximumAge: 2000, timeout: 10000 }
        );

        // Duration timer
        timerRef.current = setInterval(() => {
            setDuration(Date.now() - now - pausedDurationRef.current);
        }, 1000);
    }, [selectedMode]);

    // =========== PAUSE / RESUME ===========
    const togglePause = () => {
        if (isPaused) {
            // Resume
            if (pauseStartRef.current) {
                pausedDurationRef.current += Date.now() - pauseStartRef.current;
                pauseStartRef.current = null;
            }
            setIsPaused(false);
        } else {
            // Pause
            pauseStartRef.current = Date.now();
            setIsPaused(true);
        }
    };

    // =========== STOP TRACKING ===========
    const stopTracking = () => {
        if (watchIdRef.current != null) {
            navigator.geolocation.clearWatch(watchIdRef.current);
            watchIdRef.current = null;
        }
        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }

        // Calculate final stats
        const mode = MODES.find(m => m.id === selectedMode);
        const distKm = distance / 1000;
        const co2 = distKm * (CAR_CO2_PER_KM - (mode?.co2PerKm || 0));
        setCo2Saved(co2);

        const avgSpd = speedsRef.current.length > 0
            ? speedsRef.current.reduce((a, b) => a + b) / speedsRef.current.length
            : 0;
        setAvgSpeed(avgSpd);

        // Save session
        const session = {
            id: Date.now(),
            mode: selectedMode,
            distance: distance,
            duration: duration,
            co2Saved: co2,
            avgSpeed: avgSpd,
            maxSpeed: maxSpeedReached,
            speedAlerts,
            trustScore,
            trackPoints: trackPoints.length,
            date: new Date().toISOString(),
        };

        const updatedSessions = [session, ...sessions].slice(0, 50);
        setSessions(updatedSessions);
        localStorage.setItem('mobility_sessions', JSON.stringify(updatedSessions));

        setIsTracking(false);
        setIsPaused(false);
    };

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (watchIdRef.current != null) navigator.geolocation.clearWatch(watchIdRef.current);
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, []);

    // Update CO₂ in real-time
    useEffect(() => {
        if (isTracking && !isPaused) {
            const mode = MODES.find(m => m.id === selectedMode);
            const distKm = distance / 1000;
            setCo2Saved(distKm * (CAR_CO2_PER_KM - (mode?.co2PerKm || 0)));
        }
    }, [distance, selectedMode, isTracking, isPaused]);

    // =========== RENDER ===========
    return (
        <div className="mobility-view">
            {/* Header */}
            <div className="view-header-row">
                <div>
                    <h1 className="glow-text" style={{ fontSize: '2rem', marginBottom: 8 }}>Smart Mobility Tracker</h1>
                    <p style={{ color: 'var(--text-secondary)' }}>Track eco-friendly travel, save CO₂, earn rewards</p>
                </div>
            </div>

            {/* ====== LIFETIME STATS BANNER ====== */}
            <div className="mobility-stats-banner">
                {[
                    { label: 'Total Distance', value: totalDistanceKm.toFixed(1) + ' km', icon: <Route size={16} />, color: '#00BCD4' },
                    { label: 'CO₂ Saved', value: (totalCO2Saved / 1000).toFixed(2) + ' kg', icon: <Leaf size={16} />, color: '#00C853' },
                    { label: 'Zero Fuel Streak', value: currentStreak + ' days', icon: <Flame size={16} />, color: '#FF6D00' },
                    { label: 'Sessions', value: totalSessions, icon: <Activity size={16} />, color: '#7C4DFF' },
                    { label: 'Weekly Distance', value: (weeklyDistance / 1000).toFixed(1) + ' km', icon: <TrendingUp size={16} />, color: '#FFD700' },
                ].map((s, i) => (
                    <div key={i} className="mobility-stat-card">
                        <div className="mobility-stat-icon" style={{ background: `${s.color}15`, color: s.color }}>{s.icon}</div>
                        <div>
                            <p className="mobility-stat-value">{s.value}</p>
                            <p className="mobility-stat-label">{s.label}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* ====== MODE SELECTION ====== */}
            {!isTracking && (
                <div className="card" style={{ padding: 28, marginBottom: 24 }}>
                    <h3 className="section-title-icon"><Navigation size={18} /> Select Transport Mode</h3>
                    <div className="mode-selection-grid">
                        {MODES.map((mode) => (
                            <button
                                key={mode.id}
                                className={`mode-card ${selectedMode === mode.id ? 'selected' : ''}`}
                                onClick={() => setSelectedMode(mode.id)}
                                style={{ '--mode-color': mode.color }}
                            >
                                <div className="mode-icon-big">{mode.emoji}</div>
                                <h4>{mode.label}</h4>
                                <div className="mode-details">
                                    <span className="mode-detail">Max: {mode.maxSpeed} km/h</span>
                                    <span className="mode-detail" style={{ color: '#00C853' }}>
                                        CO₂: {mode.co2PerKm === 0 ? 'Zero!' : mode.co2PerKm + 'g/km'}
                                    </span>
                                </div>
                                <div className="mode-savings">
                                    <Wind size={12} />
                                    Save {CAR_CO2_PER_KM - mode.co2PerKm}g CO₂/km vs car
                                </div>
                                {selectedMode === mode.id && (
                                    <div className="mode-check">✓</div>
                                )}
                            </button>
                        ))}
                    </div>

                    {/* Compare with car */}
                    <div className="car-comparison">
                        <Car size={16} style={{ color: 'var(--danger)' }} />
                        <span>Average car emits <strong>{CAR_CO2_PER_KM}g CO₂/km</strong>. Your choice makes a difference!</span>
                    </div>

                    {/* Start Button */}
                    <button
                        className="start-tracking-btn"
                        onClick={startTracking}
                        disabled={!selectedMode}
                    >
                        <Play size={20} />
                        Start {selectedMode ? MODES.find(m => m.id === selectedMode)?.label : 'Tracking'}
                    </button>
                </div>
            )}

            {/* ====== ACTIVE TRACKING DASHBOARD ====== */}
            {isTracking && (
                <div className="tracking-dashboard">
                    {/* Mode indicator */}
                    <div className="tracking-mode-bar" style={{ borderColor: MODES.find(m => m.id === selectedMode)?.color }}>
                        <span className="tracking-mode-emoji">{MODES.find(m => m.id === selectedMode)?.emoji}</span>
                        <span className="tracking-mode-label">{MODES.find(m => m.id === selectedMode)?.label}</span>
                        <span className={`tracking-status ${isPaused ? 'paused' : 'active'}`}>
                            {isPaused ? '⏸ PAUSED' : '● TRACKING'}
                        </span>
                    </div>

                    {/* Big speed display */}
                    <div className="speed-hero">
                        <div className="speed-ring" style={{
                            '--speed-pct': `${Math.min((currentSpeed / (MODES.find(m => m.id === selectedMode)?.maxSpeed || 50)) * 100, 100)}%`,
                            '--speed-color': currentSpeed > (MODES.find(m => m.id === selectedMode)?.maxSpeed || 50) ? 'var(--danger)' : 'var(--primary)'
                        }}>
                            <div className="speed-value">{currentSpeed.toFixed(1)}</div>
                            <div className="speed-unit">km/h</div>
                        </div>
                        <div className="speed-limit-indicator">
                            <span>Limit: {MODES.find(m => m.id === selectedMode)?.maxSpeed} km/h</span>
                            {currentSpeed > (MODES.find(m => m.id === selectedMode)?.maxSpeed || 50) && (
                                <span className="speed-warning"><AlertTriangle size={14} /> OVER LIMIT</span>
                            )}
                        </div>
                    </div>

                    {/* Live stats grid */}
                    <div className="tracking-stats-grid">
                        <div className="tracking-stat">
                            <Route size={18} />
                            <span className="tracking-stat-val">{formatDistance(distance)}</span>
                            <span className="tracking-stat-lbl">Distance</span>
                        </div>
                        <div className="tracking-stat">
                            <Clock size={18} />
                            <span className="tracking-stat-val">{formatDuration(duration)}</span>
                            <span className="tracking-stat-lbl">Duration</span>
                        </div>
                        <div className="tracking-stat highlight-green">
                            <Leaf size={18} />
                            <span className="tracking-stat-val">{(co2Saved / 1000).toFixed(2)} kg</span>
                            <span className="tracking-stat-lbl">CO₂ Saved</span>
                        </div>
                        <div className="tracking-stat">
                            <TrendingUp size={18} />
                            <span className="tracking-stat-val">{speedsRef.current.length > 0 ? (speedsRef.current.reduce((a, b) => a + b) / speedsRef.current.length).toFixed(1) : '0'}</span>
                            <span className="tracking-stat-lbl">Avg km/h</span>
                        </div>
                    </div>

                    {/* Trust Score */}
                    <div className="trust-score-bar">
                        <div className="trust-header">
                            <span><Shield size={14} /> AI Trust Score</span>
                            <span className="trust-value" style={{
                                color: trustScore >= 80 ? '#00C853' : trustScore >= 50 ? '#FFD700' : '#FF5252'
                            }}>{trustScore}%</span>
                        </div>
                        <div className="trust-progress">
                            <div className="trust-fill" style={{
                                width: `${trustScore}%`,
                                background: trustScore >= 80 ? '#00C853' : trustScore >= 50 ? '#FFD700' : '#FF5252'
                            }}></div>
                        </div>
                        {speedAlerts > 0 && (
                            <p className="trust-warning">
                                <AlertTriangle size={12} /> {speedAlerts} speed anomal{speedAlerts === 1 ? 'y' : 'ies'} detected
                            </p>
                        )}
                    </div>

                    {/* Route flags */}
                    {routeFlags.length > 0 && (
                        <div className="route-flags">
                            <h4><AlertTriangle size={14} /> AI Fraud Flags</h4>
                            {routeFlags.slice(-3).map((flag, i) => (
                                <div key={i} className={`route-flag ${flag.type}`}>
                                    <span className="flag-time">{flag.time}</span>
                                    <span>{flag.message}</span>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* GPS indicator */}
                    {currentPos && (
                        <div className="gps-indicator">
                            <MapPin size={12} />
                            <span>{currentPos.lat.toFixed(5)}, {currentPos.lng.toFixed(5)}</span>
                            <span className="gps-dot"></span>
                        </div>
                    )}

                    {/* Control buttons */}
                    <div className="tracking-controls">
                        <button className="control-btn pause-btn" onClick={togglePause}>
                            {isPaused ? <><Play size={18} /> Resume</> : <><Pause size={18} /> Pause</>}
                        </button>
                        <button className="control-btn stop-btn" onClick={stopTracking}>
                            <Square size={18} /> Stop & Save
                        </button>
                    </div>
                </div>
            )}

            {/* ====== SESSION COMPLETE SUMMARY ====== */}
            {!isTracking && sessions.length > 0 && sessions[0].distance > 0 && !showHistory && (
                <div className="card session-summary" style={{ padding: 28, marginBottom: 24 }}>
                    <h3 className="section-title-icon"><Trophy size={18} /> Last Session Summary</h3>
                    <div className="summary-grid-3">
                        <div className="session-stat-card">
                            <span className="session-stat-emoji">{MODES.find(m => m.id === sessions[0].mode)?.emoji}</span>
                            <span className="session-stat-big">{(sessions[0].distance / 1000).toFixed(2)} km</span>
                            <span className="session-stat-label">Distance</span>
                        </div>
                        <div className="session-stat-card green">
                            <Leaf size={24} />
                            <span className="session-stat-big">{(sessions[0].co2Saved / 1000).toFixed(2)} kg</span>
                            <span className="session-stat-label">CO₂ Saved</span>
                        </div>
                        <div className="session-stat-card">
                            <Clock size={24} />
                            <span className="session-stat-big">{formatDuration(sessions[0].duration)}</span>
                            <span className="session-stat-label">Duration</span>
                        </div>
                    </div>
                    <div className="session-trust-row">
                        <Shield size={14} />
                        <span>Trust Score: <strong style={{
                            color: sessions[0].trustScore >= 80 ? '#00C853' : sessions[0].trustScore >= 50 ? '#FFD700' : '#FF5252'
                        }}>{sessions[0].trustScore}%</strong></span>
                        {sessions[0].speedAlerts > 0 && (
                            <span className="session-alert-badge">⚠ {sessions[0].speedAlerts} alerts</span>
                        )}
                    </div>
                </div>
            )}

            {/* ====== CO₂ IMPACT BREAKDOWN ====== */}
            {!isTracking && (
                <div className="card" style={{ padding: 28, marginBottom: 24 }}>
                    <h3 className="section-title-icon"><BarChart3 size={18} /> Monthly Mobility Report</h3>
                    <div className="co2-impact-grid">
                        <div className="co2-card">
                            <div className="co2-icon" style={{ background: 'rgba(0,200,83,0.1)', color: '#00C853' }}>
                                <Leaf size={24} />
                            </div>
                            <p className="co2-big">{(totalCO2Saved / 1000).toFixed(2)} kg</p>
                            <p className="co2-label">Total CO₂ Saved</p>
                            <p className="co2-equiv">≈ {Math.floor(totalCO2Saved / 21000)} trees/year equivalent</p>
                        </div>
                        <div className="co2-card">
                            <div className="co2-icon" style={{ background: 'rgba(0,188,212,0.1)', color: '#00BCD4' }}>
                                <Route size={24} />
                            </div>
                            <p className="co2-big">{totalDistanceKm.toFixed(1)} km</p>
                            <p className="co2-label">Eco Distance</p>
                            <p className="co2-equiv">{(totalDuration / 3600000).toFixed(1)} hours of eco-travel</p>
                        </div>
                        <div className="co2-card">
                            <div className="co2-icon" style={{ background: 'rgba(255,109,0,0.1)', color: '#FF6D00' }}>
                                <Flame size={24} />
                            </div>
                            <p className="co2-big">{currentStreak} days</p>
                            <p className="co2-label">Zero Fuel Streak</p>
                            <p className="co2-equiv">Keep going for bonus rewards!</p>
                        </div>
                    </div>

                    {/* Mode breakdown */}
                    <h4 style={{ margin: '20px 0 14px', fontSize: '0.85rem', fontWeight: 700 }}>By Transport Mode</h4>
                    <div className="mode-breakdown">
                        {MODES.map(mode => {
                            const modeSessions = sessions.filter(s => s.mode === mode.id);
                            const modeDist = modeSessions.reduce((a, s) => a + s.distance, 0) / 1000;
                            const modeCO2 = modeSessions.reduce((a, s) => a + s.co2Saved, 0);
                            return (
                                <div key={mode.id} className="mode-breakdown-row">
                                    <span className="mode-bk-emoji">{mode.emoji}</span>
                                    <span className="mode-bk-name">{mode.label}</span>
                                    <div className="mode-bk-bar-wrap">
                                        <div className="mode-bk-bar" style={{
                                            width: `${totalDistanceKm > 0 ? (modeDist / totalDistanceKm) * 100 : 0}%`,
                                            background: mode.color
                                        }}></div>
                                    </div>
                                    <span className="mode-bk-dist">{modeDist.toFixed(1)} km</span>
                                    <span className="mode-bk-co2">{(modeCO2 / 1000).toFixed(1)} kg</span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* ====== SESSION HISTORY ====== */}
            {!isTracking && sessions.length > 0 && (
                <div className="card" style={{ padding: 28 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                        <h3 className="section-title-icon" style={{ marginBottom: 0 }}><Clock size={18} /> Session History</h3>
                        <button
                            className="secondary-btn"
                            style={{ padding: '6px 14px', fontSize: '0.75rem' }}
                            onClick={() => setShowHistory(!showHistory)}
                        >
                            {showHistory ? 'Collapse' : 'Show All'} <ChevronDown size={14} style={{ transform: showHistory ? 'rotate(180deg)' : 'none', transition: '0.2s' }} />
                        </button>
                    </div>
                    <div className="sessions-list">
                        {(showHistory ? sessions : sessions.slice(0, 5)).map((s, i) => {
                            const mode = MODES.find(m => m.id === s.mode);
                            return (
                                <div key={s.id || i} className="session-row">
                                    <span className="session-mode-emoji">{mode?.emoji || '🚶'}</span>
                                    <div className="session-info">
                                        <span className="session-mode-name">{mode?.label || s.mode}</span>
                                        <span className="session-date">{new Date(s.date).toLocaleDateString()} • {new Date(s.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                    </div>
                                    <div className="session-metrics">
                                        <span>{(s.distance / 1000).toFixed(2)} km</span>
                                        <span className="session-co2">-{(s.co2Saved / 1000).toFixed(1)} kg CO₂</span>
                                    </div>
                                    <div className="session-trust-mini" style={{
                                        color: s.trustScore >= 80 ? '#00C853' : s.trustScore >= 50 ? '#FFD700' : '#FF5252'
                                    }}>
                                        <Shield size={12} /> {s.trustScore}%
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}

// =========== HELPER FUNCTIONS ===========
function calculateStreak(sessions) {
    if (sessions.length === 0) return 0;
    let streak = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = 0; i <= 365; i++) {
        const checkDate = new Date(today);
        checkDate.setDate(checkDate.getDate() - i);
        const dayStr = checkDate.toDateString();
        const hasSession = sessions.some(s => new Date(s.date).toDateString() === dayStr);
        if (hasSession) {
            streak++;
        } else if (i > 0) {
            break;
        }
    }
    return streak;
}

function calculateWeeklyDistance(sessions) {
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return sessions
        .filter(s => new Date(s.date).getTime() > weekAgo)
        .reduce((acc, s) => acc + s.distance, 0);
}
