import React, { useEffect, useState, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { reportAPI, taskAPI } from '../services/api';
import { useSocket } from '../context/SocketContext';
import {
    AlertTriangle, CheckCircle, MapPin, Navigation, Filter,
    Layers, RefreshCw, Wifi, WifiOff, Eye, Clock
} from 'lucide-react';

// Fix Leaflet default icon issue
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// =========== CUSTOM MARKER ICONS (styled tags) ===========
const createTagIcon = (emoji, label, color) => {
    return L.divIcon({
        className: 'custom-tag-marker',
        html: `
            <div class="map-tag-pin" style="--tag-color:${color}">
                <span class="tag-emoji">${emoji}</span>
                <span class="tag-label">${label}</span>
                <div class="tag-arrow"></div>
            </div>
        `,
        iconSize: [0, 0],
        iconAnchor: [50, 58],
        popupAnchor: [0, -60],
    });
};

const createNewReportIcon = (emoji, label, color) => {
    return L.divIcon({
        className: 'custom-tag-marker',
        html: `
            <div class="map-tag-pin new-report-pulse" style="--tag-color:${color}">
                <span class="tag-emoji">${emoji}</span>
                <span class="tag-label">${label}</span>
                <span class="tag-live-badge">LIVE</span>
                <div class="tag-arrow"></div>
            </div>
        `,
        iconSize: [0, 0],
        iconAnchor: [50, 58],
        popupAnchor: [0, -60],
    });
};

const REPORT_TAG_ICONS = {
    garbage: (isNew) => (isNew ? createNewReportIcon : createTagIcon)('🗑️', 'Garbage', '#FF6D00'),
    tree: (isNew) => (isNew ? createNewReportIcon : createTagIcon)('🌳', 'Tree', '#00C853'),
    water: (isNew) => (isNew ? createNewReportIcon : createTagIcon)('💧', 'Water', '#00BCD4'),
    air: (isNew) => (isNew ? createNewReportIcon : createTagIcon)('💨', 'Air', '#9C27B0'),
    other: (isNew) => (isNew ? createNewReportIcon : createTagIcon)('⚠️', 'Issue', '#FFD700'),
};

const TASK_ICON = createTagIcon('📌', 'Task', '#7C4DFF');

const USER_ICON = L.divIcon({
    className: 'custom-tag-marker',
    html: `
        <div class="user-location-dot">
            <div class="user-dot-core"></div>
            <div class="user-dot-pulse"></div>
        </div>
    `,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, -16],
});

const STATUS_COLORS = {
    pending: '#FFD700',
    verified: '#00C853',
    rejected: '#FF5252',
    resolved: '#00BCD4',
    under_review: '#FF6D00',
};

// OSM Tile Layer Options
const TILE_LAYERS = {
    dark: {
        url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
        attr: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>',
        label: 'Dark',
    },
    osm: {
        url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
        attr: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        label: 'Standard',
    },
    topo: {
        url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
        attr: '&copy; <a href="https://opentopomap.org">OpenTopoMap</a>',
        label: 'Topo',
    },
    satellite: {
        url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        attr: '&copy; <a href="https://www.esri.com/">Esri</a>',
        label: 'Satellite',
    },
};

// Component to center map on user location
function FlyToUser({ position }) {
    const map = useMap();
    useEffect(() => {
        if (position) map.flyTo(position, 14, { duration: 1.5 });
    }, [position, map]);
    return null;
}

export default function MapView({ onNavigate }) {
    const socket = useSocket();
    const [userPos, setUserPos] = useState(null);
    const [reports, setReports] = useState([]);
    const [tasks, setTasks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeFilter, setActiveFilter] = useState('all');
    const [typeFilter, setTypeFilter] = useState('all');
    const [tileLayer, setTileLayer] = useState('dark');
    const [liveReportIds, setLiveReportIds] = useState(new Set());
    const [liveCount, setLiveCount] = useState(0);
    const [isConnected, setIsConnected] = useState(false);
    const [toast, setToast] = useState(null);
    const mapRef = useRef(null);

    // Get user location
    useEffect(() => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (pos) => setUserPos([pos.coords.latitude, pos.coords.longitude]),
                () => setUserPos([12.9716, 77.5946]),
                { enableHighAccuracy: true, timeout: 10000 }
            );
        } else {
            setUserPos([12.9716, 77.5946]);
        }
    }, []);

    // Fetch data
    useEffect(() => {
        if (!userPos) return;
        fetchMapData();
    }, [userPos]);

    const fetchMapData = async () => {
        setLoading(true);
        try {
            const [reportsRes, tasksRes] = await Promise.allSettled([
                reportAPI.getReports({ lat: userPos[0], lng: userPos[1], radius: 10000, limit: 200 }),
                taskAPI.getNearbyTasks({ lat: userPos[0], lng: userPos[1], radius: 10000 }),
            ]);
            if (reportsRes.status === 'fulfilled') setReports(reportsRes.value.data.reports || []);
            if (tasksRes.status === 'fulfilled') setTasks(tasksRes.value.data.tasks || []);
        } catch (err) {
            console.error('Failed to load map data', err);
        }
        setLoading(false);
    };

    // ========== REAL-TIME SOCKET UPDATES ==========
    useEffect(() => {
        if (!socket) return;

        setIsConnected(socket.connected);

        const onConnect = () => setIsConnected(true);
        const onDisconnect = () => setIsConnected(false);

        // Listen for new reports globally
        const onNewReport = (report) => {
            setReports(prev => {
                // Avoid duplicates
                if (prev.some(r => r._id === report._id)) return prev;
                return [report, ...prev];
            });

            // Mark as live (new / pulsing)
            setLiveReportIds(prev => new Set([...prev, report._id]));
            setLiveCount(prev => prev + 1);

            // Show toast
            const typeEmoji = { garbage: '🗑️', tree: '🌳', water: '💧', air: '💨' };
            showToast(`${typeEmoji[report.type] || '⚠️'} New ${report.type} issue reported${report.address ? ' at ' + report.address : ''}!`);

            // Remove live badge after 30 seconds
            setTimeout(() => {
                setLiveReportIds(prev => {
                    const next = new Set(prev);
                    next.delete(report._id);
                    return next;
                });
            }, 30000);
        };

        // Listen for status updates
        const onStatusUpdate = (data) => {
            setReports(prev => prev.map(r =>
                r._id === data.reportId ? { ...r, status: data.status } : r
            ));
        };

        socket.on('connect', onConnect);
        socket.on('disconnect', onDisconnect);
        socket.on('new_report_global', onNewReport);
        socket.on('report_status_update', onStatusUpdate);
        socket.on('report_verified', (data) => {
            setReports(prev => prev.map(r =>
                r._id === data.reportId ? { ...r, status: 'verified' } : r
            ));
        });

        return () => {
            socket.off('connect', onConnect);
            socket.off('disconnect', onDisconnect);
            socket.off('new_report_global', onNewReport);
            socket.off('report_status_update', onStatusUpdate);
            socket.off('report_verified');
        };
    }, [socket]);

    const showToast = (msg) => {
        setToast(msg);
        setTimeout(() => setToast(null), 4000);
    };

    const handleLocateMe = () => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (pos) => setUserPos([pos.coords.latitude, pos.coords.longitude]),
                () => alert('Location access denied')
            );
        }
    };

    const filteredReports = reports.filter(r => {
        if (typeFilter !== 'all' && r.type !== typeFilter) return false;
        return true;
    });

    const getCoords = (item) => {
        if (item.location?.coordinates?.length === 2) {
            return [item.location.coordinates[1], item.location.coordinates[0]];
        }
        return null;
    };

    const defaultCenter = userPos || [12.9716, 77.5946];
    const currentTile = TILE_LAYERS[tileLayer];

    // Count by type
    const reportCounts = {
        garbage: reports.filter(r => r.type === 'garbage').length,
        tree: reports.filter(r => r.type === 'tree').length,
        water: reports.filter(r => r.type === 'water').length,
        other: reports.filter(r => !['garbage', 'tree', 'water'].includes(r.type)).length,
    };

    return (
        <div className="map-view-container">
            {/* Header Controls */}
            <div className="map-controls">
                <div className="map-controls-left">
                    <h1 className="glow-text" style={{ fontSize: '1.6rem' }}>Live Eco Map</h1>
                    <div className="map-stats">
                        <span className="map-stat-badge" style={{ color: '#FF6D00' }}>
                            <AlertTriangle size={14} /> {reports.length} Issues
                        </span>
                        <span className="map-stat-badge" style={{ color: '#00C853' }}>
                            <CheckCircle size={14} /> {tasks.length} Tasks
                        </span>
                        {liveCount > 0 && (
                            <span className="map-stat-badge live-badge-pulse" style={{ color: '#FF5252' }}>
                                <Wifi size={14} /> {liveCount} Live
                            </span>
                        )}
                        <span className="map-stat-badge" style={{ color: isConnected ? '#00C853' : '#FF5252' }}>
                            {isConnected ? <Wifi size={14} /> : <WifiOff size={14} />}
                            {isConnected ? 'Connected' : 'Offline'}
                        </span>
                    </div>
                </div>

                <div className="map-controls-right">
                    {/* Type Filter */}
                    <div className="map-filter-group">
                        <Filter size={14} />
                        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="map-select">
                            <option value="all">All Types ({reports.length})</option>
                            <option value="garbage">🗑️ Garbage ({reportCounts.garbage})</option>
                            <option value="tree">🌳 Trees ({reportCounts.tree})</option>
                            <option value="water">💧 Water ({reportCounts.water})</option>
                        </select>
                    </div>

                    {/* Layer Filter */}
                    <div className="map-filter-group">
                        <Layers size={14} />
                        <select value={activeFilter} onChange={(e) => setActiveFilter(e.target.value)} className="map-select">
                            <option value="all">Show All</option>
                            <option value="reports">Issues Only</option>
                            <option value="tasks">Tasks Only</option>
                        </select>
                    </div>

                    {/* Map Style */}
                    <div className="map-filter-group">
                        <Eye size={14} />
                        <select value={tileLayer} onChange={(e) => setTileLayer(e.target.value)} className="map-select">
                            {Object.entries(TILE_LAYERS).map(([key, layer]) => (
                                <option key={key} value={key}>{layer.label}</option>
                            ))}
                        </select>
                    </div>

                    <button className="map-locate-btn" onClick={fetchMapData} title="Refresh Data">
                        <RefreshCw size={18} />
                    </button>

                    <button className="map-locate-btn" onClick={handleLocateMe} title="Locate Me">
                        <Navigation size={18} />
                    </button>

                    <button
                        className="primary-btn"
                        style={{ width: 'auto', padding: '10px 20px', marginTop: 0, fontSize: '0.8rem' }}
                        onClick={() => onNavigate('report')}
                    >
                        <MapPin size={16} /> Report Issue
                    </button>
                </div>
            </div>

            {/* Map */}
            <div className="map-wrapper">
                <MapContainer
                    center={defaultCenter}
                    zoom={13}
                    style={{ width: '100%', height: 'calc(100vh - 180px)', minHeight: '500px' }}
                    ref={mapRef}
                    zoomControl={false}
                >
                    <TileLayer
                        key={tileLayer}
                        attribution={currentTile.attr}
                        url={currentTile.url}
                    />

                    {userPos && <FlyToUser position={userPos} />}

                    {/* User marker with pulse */}
                    {userPos && (
                        <Marker position={userPos} icon={USER_ICON}>
                            <Popup>
                                <div className="map-popup">
                                    <strong>📍 Your Location</strong>
                                    <p style={{ fontSize: '0.7rem', color: '#888', margin: '4px 0 0' }}>
                                        {userPos[0].toFixed(5)}, {userPos[1].toFixed(5)}
                                    </p>
                                </div>
                            </Popup>
                        </Marker>
                    )}

                    {/* User radius */}
                    {userPos && (
                        <Circle
                            center={userPos}
                            radius={3000}
                            pathOptions={{
                                color: '#00C853',
                                fillColor: '#00C853',
                                fillOpacity: 0.04,
                                weight: 1,
                                dashArray: '8,6',
                            }}
                        />
                    )}

                    {/* === REPORT PINS WITH TAGS === */}
                    {(activeFilter === 'all' || activeFilter === 'reports') &&
                        filteredReports.map((report) => {
                            const coords = getCoords(report);
                            if (!coords) return null;
                            const isLive = liveReportIds.has(report._id);
                            const iconFn = REPORT_TAG_ICONS[report.type] || REPORT_TAG_ICONS.other;
                            return (
                                <Marker
                                    key={`report-${report._id}`}
                                    position={coords}
                                    icon={iconFn(isLive)}
                                >
                                    <Popup>
                                        <div className="map-popup">
                                            <div className="map-popup-header">
                                                <span className="map-popup-type">{report.type?.toUpperCase()}</span>
                                                <span className="map-popup-status" style={{ color: STATUS_COLORS[report.status] || '#FFD700' }}>
                                                    ● {report.status}
                                                </span>
                                            </div>
                                            {report.imageUrl && (
                                                <img src={report.imageUrl} alt="Report" className="map-popup-img" />
                                            )}
                                            <p className="map-popup-desc">{report.description || 'Environmental issue reported'}</p>
                                            <p className="map-popup-meta">
                                                <MapPin size={12} /> {report.address || report.region || 'Unknown location'}
                                            </p>
                                            <p className="map-popup-time">
                                                <Clock size={12} /> {new Date(report.timestamp || report.createdAt).toLocaleString()}
                                            </p>
                                            {isLive && (
                                                <div className="popup-live-tag">🔴 JUST REPORTED — LIVE</div>
                                            )}
                                        </div>
                                    </Popup>
                                </Marker>
                            );
                        })
                    }

                    {/* Task pins */}
                    {(activeFilter === 'all' || activeFilter === 'tasks') &&
                        tasks.map((task) => {
                            const coords = getCoords(task);
                            if (!coords) return null;
                            return (
                                <Marker key={`task-${task._id}`} position={coords} icon={TASK_ICON}>
                                    <Popup>
                                        <div className="map-popup">
                                            <div className="map-popup-header">
                                                <span className="map-popup-type" style={{ background: '#7C4DFF20', color: '#7C4DFF' }}>
                                                    TASK
                                                </span>
                                                <span style={{
                                                    fontSize: '0.65rem', fontWeight: 700,
                                                    color: task.priority === 'high' || task.priority === 'urgent' ? '#FF5252' : '#FFD700'
                                                }}>
                                                    {task.priority?.toUpperCase()}
                                                </span>
                                            </div>
                                            <h4 style={{ margin: '6px 0', fontSize: '0.85rem', fontWeight: 700 }}>{task.title}</h4>
                                            <p className="map-popup-desc">{task.description}</p>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                                                <span style={{ color: '#FFD700', fontWeight: 700, fontSize: '0.8rem' }}>
                                                    ⭐ {task.pointsReward} XP
                                                </span>
                                                <button className="map-popup-btn" onClick={() => onNavigate('missions')}>
                                                    View Task →
                                                </button>
                                            </div>
                                        </div>
                                    </Popup>
                                </Marker>
                            );
                        })
                    }
                </MapContainer>

                {loading && (
                    <div className="map-loading-overlay">
                        <div className="loader"></div>
                        <p>Loading map data...</p>
                    </div>
                )}
            </div>

            {/* Live Toast Notification */}
            {toast && (
                <div className="map-live-toast">
                    <Wifi size={14} /> {toast}
                </div>
            )}

            {/* Bottom Legend */}
            <div className="map-legend">
                <span><span className="legend-dot" style={{ background: '#00C853' }}></span> You</span>
                <span><span style={{ fontSize: '1.1rem' }}>🗑️</span> Garbage</span>
                <span><span style={{ fontSize: '1.1rem' }}>🌳</span> Tree</span>
                <span><span style={{ fontSize: '1.1rem' }}>💧</span> Water</span>
                <span><span style={{ fontSize: '1.1rem' }}>📌</span> Task</span>
                <span><span className="legend-dot live-dot"></span> Live Update</span>
            </div>
        </div>
    );
}
