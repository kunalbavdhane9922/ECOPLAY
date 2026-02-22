import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { taskAPI } from '../services/api';
import { CheckCircle, MapPin, Loader, X, Camera, Send, Info, Clock, User } from 'lucide-react';

export default function VerificationView({ onBack }) {
    const { taskId } = useParams();
    const [task, setTask] = useState(null);
    const [loading, setLoading] = useState(true);
    const [verifying, setVerifying] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);

    useEffect(() => {
        fetchTaskDetails();
    }, [taskId]);

    const fetchTaskDetails = async () => {
        try {
            // Reusing getReportById logic or just fetching task
            const res = await taskAPI.getAllTasks({ _id: taskId });
            const foundTask = res.data.tasks.find(t => t._id === taskId);
            if (foundTask) {
                setTask(foundTask);
            } else {
                setError('Task not found');
            }
        } catch (err) {
            console.error('Error fetching task:', err);
            setError('Failed to load task details');
        } finally {
            setLoading(false);
        }
    };

    const handleVerify = async () => {
        setVerifying(true);
        setError('');
        try {
            await taskAPI.verifyMission(taskId);
            setSuccess(true);
            // Real-time sync is handled by backend emitting socket event
        } catch (err) {
            console.error('Verification error:', err);
            setError(err.response?.data?.message || 'Failed to verify mission');
        } finally {
            setVerifying(false);
        }
    };

    if (loading) return <div className="loading-container"><div className="loader"></div></div>;

    if (success) {
        return (
            <div className="report-success">
                <div className="success-icon-circle" style={{ background: 'var(--primary)' }}>
                    <CheckCircle size={42} />
                </div>
                <h2 className="glow-text">Mission Verified!</h2>
                <p>
                    Congratulations! You have successfully verified the completion of this mission.
                    The issue has been resolved and removed from the tactical map.
                </p>
                <button
                    onClick={onBack}
                    className="primary-btn"
                    style={{ width: 'auto', padding: '12px 30px' }}
                >
                    Back to Missions
                </button>
            </div>
        );
    }

    if (error || !task) {
        return (
            <div className="empty-state">
                <X size={48} color="var(--danger)" />
                <h3>Error</h3>
                <p>{error || 'Task data unavailable'}</p>
                <button onClick={onBack} className="secondary-btn">Go Back</button>
            </div>
        );
    }

    return (
        <div className="reports-view">
            <div className="view-header" style={{ textAlign: 'center' }}>
                <h1 className="glow-text">Verify Mission</h1>
                <p>Confirm the completion of the environmental task at the location.</p>
            </div>

            <div className="card report-form-card" style={{ maxWidth: '700px', margin: '0 auto' }}>
                <div className="mission-details-header" style={{ marginBottom: '20px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '15px' }}>
                    <h2 style={{ color: 'var(--primary)', marginBottom: '10px' }}>{task.title}</h2>
                    <p style={{ color: 'var(--text-secondary)' }}>{task.description}</p>
                </div>

                <div className="report-section">
                    <span className="report-section-label">Location Details</span>
                    <div className="location-display">
                        <div className="location-info">
                            <MapPin size={18} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                            <div>
                                <p style={{ fontWeight: 700, fontSize: '0.85rem', marginBottom: 2 }}>
                                    {task.location.coordinates[1].toFixed(6)}, {task.location.coordinates[0].toFixed(6)}
                                </p>
                                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                    {task.address || task.region || 'Area coordinates provided'}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="report-section">
                    <span className="report-section-label">Task Info</span>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                        <div className="mission-meta">
                            <Clock size={16} />
                            <span>Started: {new Date(task.createdAt).toLocaleDateString()}</span>
                        </div>
                        <div className="mission-meta">
                            <User size={16} />
                            <span>Assignees: {task.assignedUsers?.length || 0}</span>
                        </div>
                    </div>
                </div>

                <div className="report-section" style={{ background: 'rgba(255,109,0,0.05)', padding: '20px', borderRadius: '12px', border: '1px solid rgba(255,109,0,0.2)' }}>
                    <div style={{ display: 'flex', gap: '15px', alignItems: 'flex-start' }}>
                        <Info size={24} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                        <div>
                            <p style={{ fontWeight: 700, marginBottom: '5px' }}>Verification Clause</p>
                            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                                By clicking verify, you confirm that you have personally witnessed or have proof that this environmental issue has been completely resolved. This action is permanent and will remove the issue from the global map for all users.
                            </p>
                        </div>
                    </div>
                </div>

                {error && <div className="report-error"><span>⚠️ {error}</span></div>}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginTop: '30px' }}>
                    <button onClick={onBack} className="secondary-btn">
                        Cancel
                    </button>
                    <button
                        onClick={handleVerify}
                        disabled={verifying}
                        className="primary-btn"
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}
                    >
                        {verifying ? (
                            <><Loader size={18} className="spin-icon" /> Verifying...</>
                        ) : (
                            <>Submit Verification <Send size={18} /></>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
