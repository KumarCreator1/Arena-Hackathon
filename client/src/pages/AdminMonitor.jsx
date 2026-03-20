import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { connectSocket, disconnectSocket } from '../services/socket.js';
import { useAuth } from '../context/AuthContext.jsx';
import api from '../services/api.js';
import QRCode from 'react-qr-code';

export default function AdminMonitor() {
    const { id } = useParams();
    const { user } = useAuth(); // token is in localStorage managed by context/api logic usually
    const navigate = useNavigate();

    const [exam, setExam] = useState(null);
    const [students, setStudents] = useState([]);
    const [violations, setViolations] = useState([]);
    const [status, setStatus] = useState('loading');

    useEffect(() => {
        fetchExamDetails();

        // Connect to Socket
        const token = localStorage.getItem('token');
        const socket = connectSocket(token);

        if (socket) {
            socket.emit('join-exam', { examId: id, device: 'admin-monitor' });

            socket.on('exam:state', (data) => {
                // Initial state
                if (data.users) {
                    // Filter only students (if needed, or just show all connections)
                    setStudents(data.users.filter(u => u.device !== 'admin-monitor'));
                }
            });

            socket.on('exam:user_joined', (data) => {
                if (data.device === 'admin-monitor') return;
                setStudents(prev => {
                    if (prev.find(s => s.userId === data.userId)) return prev;
                    return [...prev, { ...data, connectedAt: Date.now() }];
                });
            });

            socket.on('exam:user_left', (data) => {
                setStudents(prev => prev.filter(s => s.userId !== data.userId));
            });

            socket.on('violation:detected', (data) => {
                setViolations(prev => [...prev, { ...data, timestamp: Date.now() }]);
                // TODO: Flash UI or Sound Alert
            });

            socket.on('exam:start', () => {
                setExam(prev => ({ ...prev, status: 'live' }));
            });

            socket.on('exam:end', () => {
                setExam(prev => ({ ...prev, status: 'completed' }));
            });
        }

        return () => {
            socket.off('exam:state');
            socket.off('exam:user_joined');
            socket.off('exam:user_left');
            socket.off('violation:detected');
            socket.off('exam:start');
            socket.off('exam:end');
            disconnectSocket();
        };
    }, [id]);

    const fetchExamDetails = async () => {
        try {
            const res = await api.get(`/exams/${id}`);
            setExam(res.exam);
            setStatus('ready');
        } catch (err) {
            console.error(err);
            setStatus('error');
        }
    };

    const handleStartExam = () => {
        const socket = connectSocket();
        socket.emit('exam:start', id);
        // Also update backend status via API for persistence
        api.patch(`/exams/${id}/status`, { status: 'live' });
    };

    const handleEndExam = () => {
        if (!window.confirm('End exam for everyone?')) return;
        const socket = connectSocket();
        socket.emit('exam:end', id);
        // API update
        api.patch(`/exams/${id}/status`, { status: 'completed' });
    };

    // Mock Data Helpers
    const getTrustScore = (studentId) => {
        const studentViolations = violations.filter(v => v.studentId === studentId || v.userId === studentId); // Handle inconsistency
        return Math.max(0, 100 - (studentViolations.length * 10));
    };

    const getStatusColor = (score) => {
        if (score >= 90) return 'var(--color-success)';
        if (score >= 70) return 'var(--color-warning)';
        return 'var(--color-danger)';
    };

    const getBatteryLevel = (id) => {
        // Deterministic pseudo-random based on ID char codes
        const sum = id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
        return 60 + (sum % 41); // 60-100%
    };

    // Stats
    const activeStudents = students.length;
    const flaggedStudents = students.filter(s => getTrustScore(s.userId) < 90).length;
    const avgTrust = students.length > 0
        ? Math.round(students.reduce((acc, s) => acc + getTrustScore(s.userId), 0) / students.length)
        : 100;


    if (status === 'loading') return <div className="flex-center" style={{ height: '100vh' }}><span className="spinner" /></div>;
    if (!exam) return <div>Exam not found</div>;

    return (
        <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#050508', color: 'white' }}>
            {/* Navbar */}
            <nav style={{
                height: 64, borderBottom: '1px solid rgba(255,255,255,0.08)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px',
                background: 'rgba(10, 10, 15, 0.6)', backdropFilter: 'blur(10px)'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <button onClick={() => navigate('/dashboard')} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 20 }}>
                        ←
                    </button>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '6px 16px', background: 'rgba(99, 102, 241, 0.1)', borderRadius: 20, border: '1px solid rgba(99, 102, 241, 0.2)' }}>
                        <span style={{ fontSize: 16 }}>🖥️</span>
                        <span style={{ fontWeight: 600, fontSize: 13, letterSpacing: '0.05em', color: 'var(--accent-primary)' }}>PROCTOR DASHBOARD</span>
                    </div>
                    {exam.status === 'live' && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <div style={{ width: 8, height: 8, background: 'var(--color-success)', borderRadius: '50%', boxShadow: '0 0 8px var(--color-success)' }} />
                            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-success)', letterSpacing: '0.05em' }}>LIVE</span>
                        </div>
                    )}
                </div>

                <div style={{ display: 'flex', gap: 12 }}>
                    {exam.status === 'scheduled' || exam.status === 'draft' ? (
                        <button className="btn btn-primary" onClick={handleStartExam}>Start Exam Now</button>
                    ) : exam.status === 'live' ? (
                        <button className="btn btn-danger" onClick={handleEndExam}>End Exam</button>
                    ) : (
                        <span className="badge badge-info">Completed ({avgTrust}% Trust)</span>
                    )}
                </div>
            </nav>

            {/* Main Content Grid */}
            <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 360px', overflow: 'hidden' }}>

                {/* Left: Student Grid */}
                <div style={{ padding: 24, overflowY: 'auto' }}>

                    {students.length === 0 ? (
                        <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', color: 'var(--text-muted)' }}>
                            <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.5 }}>👥</div>
                            <p>Waiting for students to join...</p>
                            <div style={{ marginTop: 16, padding: '8px 16px', background: 'rgba(255,255,255,0.05)', borderRadius: 8, fontFamily: 'monospace' }}>
                                Code: {exam.accessCode}
                            </div>
                        </div>
                    ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 24 }}>
                            {students.map(student => {
                                const trustScore = getTrustScore(student.userId);
                                const trustColor = getStatusColor(trustScore);
                                const battery = getBatteryLevel(student.userId);

                                return (
                                    <div key={student.userId} className="glass-card" style={{
                                        height: 380, position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column',
                                        border: `1px solid ${trustScore < 80 ? trustColor : 'var(--border-subtle)'}`,
                                        boxShadow: trustScore < 80 ? `0 0 20px ${trustColor}20` : 'none'
                                    }}>
                                        {/* Status Bar */}
                                        <div style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                            <div>
                                                <div style={{ display: 'flex', gap: 12, marginBottom: 4 }}>
                                                    <div style={{ width: 40, height: 40, background: 'linear-gradient(135deg, #FFD700, #FFA500)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>
                                                        🧑‍🎓
                                                    </div>
                                                    <div>
                                                        <div style={{ fontWeight: 700, fontSize: 16 }}>{student.userId}</div>
                                                        <div style={{ fontSize: 11, fontWeight: 700, color: trustColor, letterSpacing: '0.05em' }}>
                                                            {trustScore < 90 ? 'ALERTS DETECTED' : 'STATUS_CLEAR'}
                                                        </div>
                                                    </div>
                                                </div>
                                                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>TRUST SCORE</div>
                                                <div style={{ fontSize: 32, fontWeight: 800, color: trustColor, lineHeight: 1 }}>{trustScore}</div>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: battery < 20 ? 'var(--color-danger)' : 'var(--color-success)' }}>
                                                <span>🔋</span> {battery}%
                                            </div>
                                        </div>

                                        {/* Camera Placeholder */}
                                        <div style={{ flex: 1, background: '#000', margin: '0 20px 20px 20px', borderRadius: 12, position: 'relative', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)' }}>
                                            {/* Glow effect */}
                                            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: 100, height: 100, background: 'radial-gradient(circle, rgba(99,102,241,0.2) 0%, transparent 70%)' }}></div>

                                            {/* Overlay Info */}
                                            <div style={{ position: 'absolute', bottom: 12, left: 12, fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>
                                                CAM 01 • {student.device}
                                            </div>

                                            {/* Signal Lost Simulation for Randomness */}
                                            {battery % 5 === 0 && (
                                                <div style={{ width: '100%', height: '100%', background: 'rgba(0,0,0,0.8)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#f59e0b' }}>
                                                    <div style={{ fontSize: 24, marginBottom: 8 }}>📶</div>
                                                    <div style={{ fontSize: 10, letterSpacing: '0.1em' }}>SIGNAL WEAK</div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Right: Sidebar */}
                <div style={{ borderLeft: '1px solid rgba(255,255,255,0.08)', background: '#0e0e14', display: 'flex', flexDirection: 'column' }}>

                    {/* Live Alerts */}
                    <div style={{ flex: 1, padding: 24, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, color: 'var(--text-secondary)', fontSize: 12, fontWeight: 700, letterSpacing: '0.1em' }}>
                            <span>📋</span> LIVE ALERTS
                        </div>
                        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12, paddingRight: 4 }}>
                            {violations.length === 0 ? (
                                <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, marginTop: 40 }}>
                                    No alerts yet.
                                </div>
                            ) : (
                                violations.slice().reverse().map((v, i) => (
                                    <div key={i} style={{
                                        padding: 12, borderRadius: 8,
                                        background: 'rgba(255, 255, 255, 0.03)',
                                        border: '1px solid rgba(255, 255, 255, 0.05)',
                                        borderLeft: `3px solid var(--color-danger)`
                                    }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                            <span style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: 13 }}>{new Date(v.timestamp).toLocaleTimeString([], { hour12: false })}</span>
                                            <span style={{ color: 'var(--color-danger)', fontSize: 11, fontWeight: 700 }}>HIGH</span>
                                        </div>
                                        <div style={{ color: 'var(--text-secondary)', fontSize: 12, marginBottom: 4 }}>
                                            <span style={{ color: 'var(--text-accent)' }}>{v.userId || 'Student'}</span>: {v.violation}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Session Stats */}
                    <div style={{ padding: 24, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, color: 'var(--text-secondary)', fontSize: 12, fontWeight: 700, letterSpacing: '0.1em' }}>
                            <span>📊</span> SESSION STATS
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 24 }}>
                            <div className="glass-card" style={{ padding: 16, textAlign: 'center', background: 'rgba(34, 197, 94, 0.05)' }}>
                                <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--color-success)' }}>{activeStudents - flaggedStudents}</div>
                                <div style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.05em', marginTop: 4 }}>ALL CLEAR</div>
                            </div>
                            <div className="glass-card" style={{ padding: 16, textAlign: 'center', background: 'rgba(239, 68, 68, 0.05)' }}>
                                <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--color-danger)' }}>{flaggedStudents}</div>
                                <div style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.05em', marginTop: 4 }}>FLAGGED</div>
                            </div>
                        </div>

                        <div className="glass-card" style={{ padding: 16, textAlign: 'center' }}>
                            <div style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.05em', marginBottom: 4 }}>AVERAGE TRUST SCORE</div>
                            <div style={{ fontSize: 32, fontWeight: 800, color: getStatusColor(avgTrust) }}>{avgTrust}</div>
                        </div>
                    </div>

                    {/* QR Code */}
                    <div style={{ padding: 24, borderTop: '1px solid rgba(255,255,255,0.08)', background: '#0a0a0f' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, color: 'var(--text-secondary)', fontSize: 12, fontWeight: 700, letterSpacing: '0.1em' }}>
                            <span>🔗</span> QR PAIRING CODE
                        </div>
                        <div style={{ background: 'white', padding: 12, borderRadius: 12, width: 'fit-content', margin: '0 auto' }}>
                            {/* Use mock for visuals or logic? Default to generic if waiting */}
                            <QRCode value={`${window.location.origin}/mobile-cam/pair?code=${exam.accessCode}`} size={120} />
                        </div>
                        <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--text-muted)', marginTop: 12 }}>
                            Scan to pair phone sentinel
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
}
