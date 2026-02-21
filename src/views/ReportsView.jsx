import React, { useState, useEffect } from 'react';
import { Camera, Send, CheckCircle, MapPin, Loader, X, Navigation, Image as ImageIcon, Map as MapIcon } from 'lucide-react';
import { reportAPI, uploadAPI, mapAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';

const CATEGORIES = [
    { id: 'garbage', label: 'Garbage', icon: '🗑️', type: 'garbage' },
    { id: 'tree', label: 'Tree/Plants', icon: '🌳', type: 'tree' },
    { id: 'water', label: 'Water Issue', icon: '💧', type: 'water' },
    { id: 'other', label: 'Other', icon: '⚠️', type: 'other' },
];

export default function ReportsView() {
    const [category, setCategory] = useState('');
    const [description, setDescription] = useState('');
    const [imageFile, setImageFile] = useState(null);
    const [imagePreview, setImagePreview] = useState(null);
    const [location, setLocation] = useState(null);
    const [address, setAddress] = useState('');
    const [loading, setLoading] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [error, setError] = useState('');
    const [geoLoading, setGeoLoading] = useState(false);
    const [helpRequired, setHelpRequired] = useState(false);
    const [pinning, setPinning] = useState(false);
    const { user } = useAuth();

    // Auto-detect location on mount
    useEffect(() => {
        getLocation();
    }, []);

    const getLocation = () => {
        setGeoLoading(true);
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    setLocation({
                        latitude: pos.coords.latitude,
                        longitude: pos.coords.longitude,
                    });
                    // Reverse geocode for address (using free Nominatim API)
                    fetch(`https://nominatim.openstreetmap.org/reverse?lat=${pos.coords.latitude}&lon=${pos.coords.longitude}&format=json`)
                        .then(r => r.json())
                        .then(data => {
                            setAddress(data.display_name || `${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}`);
                        })
                        .catch(() => {
                            setAddress(`${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}`);
                        });
                    setGeoLoading(false);
                },
                (err) => {
                    setError('Location required. Please enable GPS.');
                    setGeoLoading(false);
                },
                { enableHighAccuracy: true, timeout: 10000 }
            );
        } else {
            setError('Geolocation not supported in this browser');
            setGeoLoading(false);
        }
    };

    const handleImageChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (file.size > 5 * 1024 * 1024) {
            setError('Image must be under 5MB');
            return;
        }
        setImageFile(file);
        setImagePreview(URL.createObjectURL(file));
        setError('');
    };

    const removeImage = () => {
        setImageFile(null);
        setImagePreview(null);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (!category) { setError('Please select a category'); return; }
        if (!imageFile) { setError('Please upload an image'); return; }
        if (!location) { setError('GPS location is required. Please enable location.'); return; }

        setLoading(true);
        try {
            // Step 1: Upload image to backend
            const uploadRes = await uploadAPI.uploadImage(imageFile);
            const imageUrl = uploadRes.data.url;

            // Step 2: Submit report with location + imageUrl
            const catInfo = CATEGORIES.find(c => c.id === category);
            await reportAPI.submitReport({
                type: catInfo.type,
                imageUrl,
                description,
                helpRequired,
                location: {
                    latitude: location.latitude,
                    longitude: location.longitude,
                },
                address,
                city: address.split(',').slice(-3, -2)[0]?.trim() || '',
                region: address.split(',').slice(-2, -1)[0]?.trim() || '',
            });

            setSubmitted(true);
        } catch (err) {
            console.error('Report submission error:', err);
            setError(err.response?.data?.message || 'Failed to submit report. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handlePinOnMap = async () => {
        setError('');
        if (!category) { setError('Please select a category'); return; }
        if (!location) { setError('GPS location is required. Please enable location.'); return; }
        if (!user) { setError('You must be logged in to pin on map'); return; }

        setPinning(true);
        try {
            const catInfo = CATEGORIES.find(c => c.id === category);
            await mapAPI.addPin({
                userId: user._id || user.id,
                username: user.username || user.name || 'Anonymous',
                title: catInfo.label,
                description: description || `Environmental issue: ${catInfo.label}`,
                category: category.toLowerCase(),
                latitude: location.latitude,
                longitude: location.longitude,
            });
            alert('📍 Pin added to map successfully!');
        } catch (err) {
            console.error('Pinning error:', err);
            setError(err.response?.data?.message || 'Failed to add pin to map.');
        } finally {
            setPinning(false);
        }
    };

    if (submitted) {
        return (
            <div className="report-success">
                <div className="success-icon-circle">
                    <CheckCircle size={42} />
                </div>
                <h2 className="glow-text">Report Submitted!</h2>
                <p>
                    Your report has been pinned on the map at your current location.
                    ML verification is running — points will be awarded once confirmed.
                </p>
                <button
                    onClick={() => {
                        setSubmitted(false);
                        setCategory('');
                        setDescription('');
                        setImageFile(null);
                        setImagePreview(null);
                        setHelpRequired(false);
                    }}
                    className="primary-btn"
                    style={{ width: 'auto', padding: '12px 30px' }}
                >
                    Submit Another Report
                </button>
            </div>
        );
    }

    return (
        <div className="reports-view">
            <div className="view-header" style={{ textAlign: 'center' }}>
                <h1 className="glow-text">Report Issue</h1>
                <p>Spot an environmental issue? Report it with a photo and GPS coordinates.</p>
            </div>

            <div className="card report-form-card">
                <form onSubmit={handleSubmit}>
                    {/* Category Selection */}
                    <div className="report-section">
                        <span className="report-section-label">1. Issue Category</span>
                        <div className="category-grid">
                            {CATEGORIES.map((cat) => (
                                <button
                                    key={cat.id}
                                    type="button"
                                    onClick={() => setCategory(cat.id)}
                                    className={`category-btn ${category === cat.id ? 'selected' : ''}`}
                                >
                                    <span className="cat-icon">{cat.icon}</span>
                                    <span className="cat-label">{cat.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Image Upload */}
                    <div className="report-section">
                        <span className="report-section-label">2. Upload Photo Proof</span>
                        {imagePreview ? (
                            <div className="image-preview-container">
                                <img src={imagePreview} alt="Preview" className="image-preview" />
                                <button type="button" className="image-remove-btn" onClick={removeImage}>
                                    <X size={16} />
                                </button>
                            </div>
                        ) : (
                            <div className="upload-zone">
                                <input
                                    type="file"
                                    accept="image/jpeg,image/png,image/webp"
                                    style={{ display: 'none' }}
                                    id="image-upload"
                                    onChange={handleImageChange}
                                />
                                <div className="upload-zone-inner">
                                    <label htmlFor="image-upload">
                                        <div className="upload-icon-circle">
                                            <Camera size={24} />
                                        </div>
                                        <p>Click to Capture or Upload</p>
                                        <p>JPG, PNG, WebP — max 5MB</p>
                                    </label>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* GPS Location */}
                    <div className="report-section">
                        <span className="report-section-label">3. GPS Location</span>
                        <div className="location-display">
                            <div className="location-info">
                                <MapPin size={18} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                                {geoLoading ? (
                                    <span style={{ color: 'var(--text-secondary)' }}>Detecting GPS...</span>
                                ) : location ? (
                                    <div>
                                        <p style={{ fontWeight: 700, fontSize: '0.85rem', marginBottom: 2 }}>
                                            {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
                                        </p>
                                        <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                            {address || 'Address lookup...'}
                                        </p>
                                    </div>
                                ) : (
                                    <span style={{ color: 'var(--danger)' }}>Location not available</span>
                                )}
                            </div>
                            <button type="button" className="secondary-btn" onClick={getLocation} style={{ padding: '8px 14px', fontSize: '0.75rem' }}>
                                <Navigation size={14} /> Refresh
                            </button>
                        </div>
                    </div>

                    {/* Description */}
                    <div className="report-section">
                        <span className="report-section-label">4. Description (Optional)</span>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Describe what you see (e.g., 'Plastic waste near river bank')"
                            className="report-textarea"
                            rows={3}
                        />
                    </div>

                    {/* Help Required Toggle */}
                    <div className="report-section">
                        <label className="help-toggle">
                            <input
                                type="checkbox"
                                checked={helpRequired}
                                onChange={(e) => setHelpRequired(e.target.checked)}
                            />
                            <span className="help-toggle-label">
                                🤝 This issue requires community help (creates a task for others)
                            </span>
                        </label>
                    </div>

                    {/* Error */}
                    {error && (
                        <div className="report-error">
                            <span>⚠️ {error}</span>
                        </div>
                    )}

                    {/* Submit & Pin */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                        <button
                            type="submit"
                            disabled={!category || !imageFile || !location || loading}
                            className="primary-btn"
                            style={{ padding: '16px 24px', marginTop: 0 }}
                        >
                            {loading ? (
                                <>
                                    <Loader size={18} className="spin-icon" /> Submitting...
                                </>
                            ) : (
                                <>
                                    Submit Report <Send size={18} />
                                </>
                            )}
                        </button>

                        <button
                            type="button"
                            onClick={handlePinOnMap}
                            disabled={!category || !location || pinning}
                            className="secondary-btn"
                            style={{
                                padding: '16px 24px',
                                background: 'linear-gradient(135deg, #007aff 0%, #0056b3 100%)',
                                color: 'white',
                                borderColor: 'transparent',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '8px'
                            }}
                        >
                            {pinning ? (
                                <Loader size={18} className="spin-icon" />
                            ) : (
                                <>
                                    Pin on Map <MapIcon size={18} />
                                </>
                            )}
                        </button>
                    </div>

                    <p className="report-footer">
                        📡 Coordinates are captured automatically • ML verification runs on submission
                    </p>
                </form>
            </div>
        </div>
    );
}
