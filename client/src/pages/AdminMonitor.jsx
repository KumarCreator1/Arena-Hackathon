import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { connectSocket, disconnectSocket } from '../services/socket.js';
import { useAuth } from '../context/AuthContext.jsx';
import api from '../services/api.js';

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

    if (status === 'loading') return <div className="flex-center" style={{ height: '100vh' }}><span className="spinner" /></div>;
    if (!exam) return <div>Exam not found</div>;

    return (
        <div className="dashboard-layout">
            <header style={{
                height: 64, borderBottom: '1px solid var(--border-subtle)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px'
            }}>
                <button className="btn btn-ghost" onClick={() => navigate('/dashboard')}>← Back</button>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <div style={{ fontWeight: 700 }}>{exam.title}</div>
                    <div style={{
                        padding: '4px 12px', background: 'var(--bg-elevated)',
                        border: '1px solid var(--border-subtle)', borderRadius: 4,
                        fontFamily: 'monospace', letterSpacing: '0.1em', fontSize: 16,
                        color: 'var(--text-accent)'
                    }}>
                        {exam.accessCode}
                    </div>
                </div>
                <div style={{ display: 'flex', gap: 12 }}>
                    {exam.status === 'scheduled' || exam.status === 'draft' ? (
                        <button className="btn btn-primary" onClick={handleStartExam}>Start Exam Now</button>
                    ) : exam.status === 'live' ? (
                        <button className="btn btn-danger" onClick={handleEndExam}>End Exam</button>
                    ) : (
                        <span className="badge badge-info">Completed</span>
                    )}
                </div>
            </header>

            <div style={{ padding: 24, display: 'grid', gridTemplateColumns: '300px 1fr', gap: 24 }}>

                {/* Sidebar: Student List */}
                <div className="glass-card" style={{ height: 'calc(100vh - 120px)', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ padding: 16, borderBottom: '1px solid var(--border-subtle)', fontWeight: 600 }}>
                        Connected Students ({students.length})
                    </div>
                    <div style={{ overflowY: 'auto', flex: 1 }}>
                        {students.map(s => (
                            <div key={s.userId} style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)', fontSize: 14 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span>{s.userId}</span> {/* Ideally fetch Name */}
                                    <span className="badge badge-success">Online</span>
                                </div>
                                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                                    {s.device} • Joined {new Date(s.connectedAt).toLocaleTimeString()}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Main: Violations Feed */}
                <div className="glass-card" style={{ padding: 24, overflowY: 'auto', height: 'calc(100vh - 120px)' }}>
                    <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 600, marginBottom: 16 }}>Live Integrity Feed</h2>
                    {violations.length === 0 ? (
                        <div className="text-muted" style={{ textAlign: 'center', marginTop: 40 }}>
                            No violations detected yet.
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            {violations.map((v, i) => (
                                <div key={i} style={{
                                    padding: 16, borderLeft: '4px solid var(--color-danger)',
                                    background: 'rgba(239, 68, 68, 0.1)', borderRadius: '0 4px 4px 0'
                                }}>
                                    <div style={{ fontWeight: 700, color: 'var(--color-danger)' }}>
                                        {v.violation}
                                    </div>
                                    <div style={{ fontSize: 12, marginTop: 4 }}>
                                        Confidence: {(v.confidence * 100).toFixed(0)}% • {new Date(v.timestamp).toLocaleTimeString()}
                                    </div>
                                    <div style={{ fontSize: 12, marginTop: 4, fontFamily: 'monospace' }}>
                                        Session: {v.sessionId}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
}
