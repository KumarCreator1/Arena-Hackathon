import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import api from '../services/api.js';

export default function Dashboard() {
    const { user, logout, isAdmin } = useAuth();

    return (
        <div className="dashboard-layout">
            {/* Nav Bar */}
            <nav className="dashboard-nav">
                <div className="dashboard-nav-brand">
                    <span style={{
                        width: 28, height: 28,
                        background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))',
                        borderRadius: 'var(--radius-sm)', display: 'flex',
                        alignItems: 'center', justifyContent: 'center', fontSize: 14,
                    }}>◈</span>
                    Parallax
                </div>

                <div className="dashboard-nav-actions">
                    <span className={`badge ${isAdmin ? 'badge-warning' : 'badge-info'}`}>
                        {user?.role}
                    </span>
                    <span className="text-sm text-muted">{user?.name}</span>
                    <button className="btn btn-ghost" onClick={logout} style={{ padding: '8px 16px', fontSize: 'var(--text-sm)' }}>
                        Logout
                    </button>
                </div>
            </nav>

            {/* Content */}
            <div className="dashboard-content animate-fade-in">
                {isAdmin ? <AdminView user={user} /> : <StudentView user={user} />}
            </div>
        </div>
    );
}

// ═══════════════════════════════════════════════════════════
// ADMIN VIEW
// ═══════════════════════════════════════════════════════════
function AdminView({ user }) {
    const [exams, setExams] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchExams = async () => {
            try {
                const data = await api.get('/exams');
                setExams(data.exams || []);
            } catch (err) {
                console.error('Failed to fetch exams:', err);
            } finally {
                setLoading(false);
            }
        };
        fetchExams();
    }, []);

    const statusColors = {
        draft: 'badge-info',
        scheduled: 'badge-warning',
        live: 'badge-success',
        completed: 'badge-danger',
    };

    return (
        <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
                <div>
                    <h1 style={{ fontSize: 'var(--text-3xl)', fontWeight: 800, marginBottom: 4 }}>
                        Admin Control Center
                    </h1>
                    <p className="text-muted">
                        Monitor exams, manage students, and review integrity reports.
                    </p>
                </div>
                <Link to="/exams/create" className="btn btn-primary" style={{ whiteSpace: 'nowrap' }}>
                    + Create Exam
                </Link>
            </div>

            {/* Stats Row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 28 }}>
                <StatCard icon="📝" label="Total Exams" value={exams.length} status="info" />
                <StatCard icon="📡" label="Live Now" value={exams.filter(e => e.status === 'live').length} status="success" />
                <StatCard icon="📅" label="Scheduled" value={exams.filter(e => e.status === 'scheduled').length} status="warning" />
                <StatCard icon="✅" label="Completed" value={exams.filter(e => e.status === 'completed').length} status="info" />
            </div>

            {/* Exam List */}
            <div className="glass-card" style={{ padding: 28 }}>
                <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 600, marginBottom: 16 }}>
                    🗂️ Your Exams
                </h2>

                {loading ? (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}>
                        <span className="spinner" style={{ width: 28, height: 28 }} />
                    </div>
                ) : exams.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: 40 }}>
                        <p style={{ fontSize: 48, marginBottom: 12 }}>📭</p>
                        <p className="text-muted">No exams yet. Create your first exam to get started!</p>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {exams.map((exam) => (
                            <div
                                key={exam.id}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    padding: '16px 20px',
                                    background: 'var(--bg-primary)',
                                    borderRadius: 'var(--radius-md)',
                                    border: '1px solid var(--border-subtle)',
                                    transition: 'border-color var(--transition-fast)',
                                }}
                                onMouseOver={(e) => e.currentTarget.style.borderColor = 'var(--border-default)'}
                                onMouseOut={(e) => e.currentTarget.style.borderColor = 'var(--border-subtle)'}
                            >
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontWeight: 600, marginBottom: 4 }}>{exam.title}</div>
                                    <div className="text-sm text-muted" style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                                        <span>🕐 {exam.durationMinutes} min</span>
                                        <span>👥 {exam.participantCount}/{exam.maxStudents}</span>
                                        <span>📅 {new Date(exam.startTime).toLocaleDateString('en-IN', {
                                            day: 'numeric', month: 'short', year: 'numeric',
                                            hour: '2-digit', minute: '2-digit',
                                        })}</span>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                    <code style={{
                                        padding: '4px 10px',
                                        background: 'var(--bg-elevated)',
                                        borderRadius: 'var(--radius-sm)',
                                        fontSize: 'var(--text-sm)',
                                        fontFamily: 'var(--font-mono)',
                                        color: 'var(--text-accent)',
                                        letterSpacing: '0.1em',
                                    }}>
                                        {exam.accessCode}
                                    </code>
                                    <span className={`badge ${statusColors[exam.status] || 'badge-info'}`}>
                                        {exam.status}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </>
    );
}

// ═══════════════════════════════════════════════════════════
// STUDENT VIEW
// ═══════════════════════════════════════════════════════════
function StudentView({ user }) {
    return (
        <>
            <h1 style={{ fontSize: 'var(--text-3xl)', fontWeight: 800, marginBottom: 8 }}>
                Welcome, {user?.name} 👋
            </h1>
            <p className="text-muted mb-2">
                Student Dashboard — Your exam sessions will appear here.
            </p>

            <div className="glass-card" style={{ padding: 32, marginTop: 24 }}>
                <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 600, marginBottom: 12 }}>
                    🖥️ Getting Started
                </h2>
                <p className="text-muted" style={{ lineHeight: 1.8 }}>
                    When an exam is scheduled, you'll see it here. You'll need to:
                </p>
                <ol className="text-muted" style={{ paddingLeft: 20, marginTop: 12, lineHeight: 2 }}>
                    <li>Enter your exam access code</li>
                    <li>Pair your mobile device as a rear-view camera (QR Code scan)</li>
                    <li>Complete the environment check</li>
                    <li>Enter the exam room</li>
                </ol>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginTop: 24 }}>
                <StatCard icon="📡" label="Device Status" value="Not Paired" status="warning" />
                <StatCard icon="🛡️" label="Trust Score" value="—" status="info" />
                <StatCard icon="📝" label="Active Exam" value="None" status="info" />
            </div>
        </>
    );
}

// ═══════════════════════════════════════════════════════════
// SHARED COMPONENTS
// ═══════════════════════════════════════════════════════════
function StatCard({ icon, label, value, status }) {
    const colorMap = {
        info: 'var(--text-accent)',
        success: 'var(--color-success)',
        danger: 'var(--color-danger)',
        warning: 'var(--color-warning)',
    };

    return (
        <div className="glass-card" style={{ padding: 20 }}>
            <div style={{ fontSize: 24, marginBottom: 8 }}>{icon}</div>
            <div className="text-sm text-muted" style={{ marginBottom: 4 }}>{label}</div>
            <div style={{ fontSize: 'var(--text-xl)', fontWeight: 700, color: colorMap[status] }}>
                {value}
            </div>
        </div>
    );
}
