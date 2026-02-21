import React, { useEffect, useState, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { mapAPI } from '../services/api';
import { useSocket } from '../context/SocketContext';
import { useAuth } from '../context/AuthContext';
import { MapPin, Clock, User, Info, Loader } from 'lucide-react';

// Fix Leaflet default icon issue
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Custom Icons Mapping
const CATEGORY_ICONS = {
    garbage: L.divIcon({
        className: 'custom-pin-icon pin-garbage',
        html: `<div class="pin-icon-inner" style="background: #ef4444;"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg></div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 32],
        popupAnchor: [0, -32]
    }),
    tree: L.divIcon({
        className: 'custom-pin-icon pin-tree',
        html: `<div class="pin-icon-inner" style="background: #22c55e;"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20v-8"/><path d="M6.3 15C4.5 13.5 3 11 3 8c0-3.3 2.7-6 6-6 1.8 0 3.4.8 4.5 2h1c1.1-1.2 2.7-2 4.5-2 3.3 0 6 2.7 6 6 0 3-1.5 5.5-3.3 7"/><path d="M12 20h4"/><path d="M12 20H8"/></svg></div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 32],
        popupAnchor: [0, -32]
    }),
    water: L.divIcon({
        className: 'custom-pin-icon pin-water',
        html: `<div class="pin-icon-inner" style="background: #3b82f6;"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5L12 2 8 9.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7Z"/></svg></div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 32],
        popupAnchor: [0, -32]
    }),
    other: L.divIcon({
        className: 'custom-pin-icon pin-other',
        html: `<div class="pin-icon-inner" style="background: #ff6d00;"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg></div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 32],
        popupAnchor: [0, -32]
    })
};

// Custom User Location Icon (Blue Dot)
const USER_ICON = L.divIcon({
    className: 'custom-user-dot',
    html: `<div class="user-dot-outer"><div class="user-dot-inner"></div><div class="user-dot-pulse"></div></div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
});

// Component to handle map centering
function ChangeView({ center }) {
    const map = useMap();
    useEffect(() => {
        if (center) {
            map.setView(center, 13);
        }
    }, [center, map]);
    return null;
}

// Component to handle map clicks
function MapClickHandler({ onMapClick }) {
    useMapEvents({
        click: (e) => {
            onMapClick(e.latlng);
        },
    });
    return null;
}

export default function NewMapView() {
    const socket = useSocket();
    const { user } = useAuth();
    const [userLocation, setUserLocation] = useState(null);
    const [pins, setPins] = useState([]);
    const [loading, setLoading] = useState(true);
    const [pinning, setPinning] = useState(false);

    useEffect(() => {
        // 1. Get User Location
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    setUserLocation([position.coords.latitude, position.coords.longitude]);
                },
                (error) => {
                    console.error("Error getting location:", error);
                    // Default to a central location if denied
                    setUserLocation([12.9716, 77.5946]);
                }
            );
        }

        // 2. Fetch Pins from Backend
        fetchPins();
    }, []);

    // 3. Real-time Socket Listener
    useEffect(() => {
        if (!socket) return;

        const handleNewPin = (newPin) => {
            setPins((prev) => {
                // Prevent duplicate pins from identical _id
                if (prev.some(p => p._id === newPin._id)) return prev;
                return [newPin, ...prev];
            });
        };

        const handleRemovePin = (pinId) => {
            setPins((prev) => prev.filter(p => p._id !== pinId));
        };

        socket.on('new_map_pin', handleNewPin);
        socket.on('remove_map_pin', handleRemovePin);

        return () => {
            socket.off('new_map_pin', handleNewPin);
            socket.off('remove_map_pin', handleRemovePin);
        };
    }, [socket]);

    const fetchPins = async () => {
        try {
            const res = await mapAPI.getPins();
            setPins(res.data);
        } catch (error) {
            console.error("Error fetching pins:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleMapClick = async (latlng) => {
        if (!user) {
            alert("Please log in to place a pin.");
            return;
        }

        const title = prompt("Enter a title for this pin:", "Spotted Issue");
        if (!title) return;

        const description = prompt("Enter a brief description:", "Observed something at this location.");
        if (!description) return;

        const categoryInput = prompt("Enter category (garbage, tree, water):", "garbage");
        if (!categoryInput) return;
        const category = ['garbage', 'tree', 'water'].includes(categoryInput.toLowerCase()) ? categoryInput.toLowerCase() : 'other';

        setPinning(true);
        try {
            const newPinData = {
                userId: user._id || user.id,
                username: user.name || user.username || "Anonymous",
                title,
                description,
                category,
                latitude: latlng.lat,
                longitude: latlng.lng
            };

            await mapAPI.addPin(newPinData);
        } catch (error) {
            console.error("Error adding pin:", error);
            alert("Failed to save pin. Please try again.");
        } finally {
            setPinning(false);
        }
    };

    return (
        <div className="map-view-container" style={{ height: 'calc(100vh - 80px)', width: '100%', position: 'relative' }}>
            <style>{`
                .custom-pin-icon { background: none; border: none; }
                .pin-icon-inner {
                    width: 32px; height: 32px;
                    border-radius: 50% 50% 50% 0;
                    transform: rotate(-45deg);
                    display: flex; align-items: center; justify-content: center;
                    border: 2px solid white;
                    box-shadow: 0 4px 10px rgba(0,0,0,0.3);
                }
                .pin-icon-inner svg { transform: rotate(45deg); }
                .user-location-dot { width: 24px; height: 24px; }
                .user-dot-outer { width: 20px; height: 20px; background: rgba(59, 130, 246, 0.3); border-radius: 50%; display: flex; align-items: center; justify-content: center; position: relative; }
                .user-dot-inner { width: 12px; height: 12px; background: #3b82f6; border: 2px solid white; border-radius: 50%; box-shadow: 0 0 10px rgba(59, 130, 246, 0.5); z-index: 2; }
                .user-dot-pulse { position: absolute; width: 24px; height: 24px; background: rgba(59, 130, 246, 0.4); border-radius: 50%; animation: pulse 2s infinite; z-index: 1; }
                @keyframes pulse { 0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.7); } 70% { transform: scale(1); box-shadow: 0 0 0 10px rgba(59, 130, 246, 0); } 100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(59, 130, 246, 0); } }
                .map-pin-popup h3 { margin: 0 0 10px; border-bottom: 1px solid #eee; padding-bottom: 5px; font-size: 1rem; text-transform: capitalize; }
                .map-pin-detail { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; font-size: 0.85rem; color: #444; }
                .map-pin-time { display: flex; align-items: center; gap: 8px; font-size: 0.75rem; color: #999; }
            `}</style>

            <div className="view-header" style={{ padding: '20px', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(10px)', zIndex: '1000', position: 'absolute', top: 0, left: 0, right: 0, borderBottom: '1px solid rgba(255,109,0,0.3)' }}>
                <h1 className="glow-text" style={{ margin: 0, fontSize: '1.5rem' }}>Tactical Environmental Map</h1>
                <p style={{ margin: '5px 0 0', fontSize: '0.85rem', color: '#ccc' }}>
                    Click anywhere to drop a pin • Real-time syncing active • Multi-report support
                </p>
            </div>

            <MapContainer
                center={userLocation || [12.9716, 77.5946]}
                zoom={13}
                style={{ height: '100%', width: '100%' }}
                zoomControl={false}
            >
                <TileLayer
                    url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                />

                <MapClickHandler onMapClick={handleMapClick} />

                {userLocation && <ChangeView center={userLocation} />}

                {/* User Current Location Marker */}
                {userLocation && (
                    <Marker position={userLocation} icon={USER_ICON}>
                        <Popup>
                            <div style={{ textAlign: 'center' }}>
                                <strong>You are here</strong>
                            </div>
                        </Popup>
                    </Marker>
                )}

                {/* Map Pins from Backend */}
                {pins.map((pin) => (
                    <Marker
                        key={pin._id}
                        position={[pin.latitude, pin.longitude]}
                        icon={CATEGORY_ICONS[pin.category] || CATEGORY_ICONS.other}
                    >
                        <Popup>
                            <div className="map-pin-popup" style={{ minWidth: '200px', padding: '5px' }}>
                                <h3 style={{ color: pin.category === 'garbage' ? '#ef4444' : pin.category === 'tree' ? '#22c55e' : '#3b82f6' }}>
                                    {pin.title}
                                </h3>
                                <div className="map-pin-detail">
                                    <Info size={14} />
                                    <span>{pin.description}</span>
                                </div>
                                <div className="map-pin-detail">
                                    <User size={14} />
                                    <span>{pin.username}</span>
                                </div>
                                <div className="map-pin-time">
                                    <Clock size={14} />
                                    <span>{new Date(pin.createdAt).toLocaleString()}</span>
                                </div>
                            </div>
                        </Popup>
                    </Marker>
                ))}
            </MapContainer>

            {loading && (
                <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', background: 'rgba(0,0,0,0.8)', padding: '20px', borderRadius: '10px', color: 'white', zIndex: 1001, display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Loader size={20} className="spin-icon" />
                    <span>Syncing Map Intel...</span>
                </div>
            )}

            {pinning && (
                <div style={{ position: 'absolute', bottom: '40px', left: '50%', transform: 'translateX(-50%)', background: 'var(--primary)', padding: '10px 20px', borderRadius: '30px', color: 'white', zIndex: 1001, boxShadow: '0 4px 15px rgba(255,109,0,0.4)', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Loader size={18} className="spin-icon" />
                    Deploying Pin...
                </div>
            )}
        </div>
    );
}
