import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import QRCode from 'react-qr-code';
import api from '../services/api.js';
import { connectSocket, disconnectSocket } from '../services/socket.js';
import { useAuth } from '../context/AuthContext.jsx';
import LatexRenderer from '../components/LatexRenderer.jsx';

export default function ExamRoom() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [exam, setExam] = useState(null);
    const [questions, setQuestions] = useState([]);
    const [status, setStatus] = useState('loading'); // loading, pairing, waiting, live, completed
    const [answers, setAnswers] = useState({});
    const [currentIndex, setCurrentIndex] = useState(0);
    const [sessionId, setSessionId] = useState('');
    const [mobileConnected, setMobileConnected] = useState(false);

    useEffect(() => {
        // 1. Generate Session ID for this exam connection
        const sessId = `${id}-${user?.userId || 'anon'}-${Math.random().toString(36).substr(2, 5)}`;
        setSessionId(sessId);

        // 2. Fetch Exam Data
        fetchExamData();

        // 3. Connect Socket
        const token = localStorage.getItem('token');
        const socket = connectSocket(token);

        if (socket) {
            // Join Exam Room
            socket.emit('join-exam', { examId: id });

            // Join Private Session Room (for mobile pairing)
            socket.emit('session:join', sessId);

            // Listeners
            socket.on('exam:state', () => { /*ack*/ });

            socket.on('exam:start', () => {
                setStatus('live');
                fetchQuestions(); // Fetch questions when live
            });

            socket.on('exam:end', () => {
                handleSubmit(true); // Force submit
            });

            socket.on('mobile:connected', () => {
                setMobileConnected(true);
                // If exam is already live, we can start. If waiting, we go to waiting.
                // We do this check in render or effect.
            });
        }

        return () => {
            socket.off('exam:start');
            socket.off('exam:end');
            socket.off('mobile:connected');
            disconnectSocket();
        };
    }, [id, user]); // Added user to dependency array

    const fetchExamData = async () => {
        try {
            setLoading(true);
            // Get exam details first (metadata)
            // GET /exams/:id is admin only? No, we need a student endpoint for exam metadata.
            // Currently GET /exams/:id/questions throws if not live.
            // We might fail here if we rely on that.
            // Let's rely on the error handling we had before.

            try {
                const data = await api.get(`/exams/${id}/questions`);
                setExam(data.exam);
                setQuestions(data.questions);
                setStatus('live'); // Valid questions means live
            } catch (err) {
                if (err.status === 400 && err.message.includes('not live')) {
                    setStatus('waiting');
                    // We need exam title etc. fallback?
                    // For now, we only get it from questions endpoint or we need another endpoint.
                    // Assuming 'waiting' status is handled generally.
                } else {
                    throw err;
                }
            }
        } catch (err) {
            if (err.status !== 400) setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const fetchQuestions = async () => {
        try {
            const data = await api.get(`/exams/${id}/questions`);
            setExam(data.exam);
            setQuestions(data.questions);
            setStatus('live');
        } catch (err) {
            console.error("Failed to fetch questions on start", err);
        }
    };

    const handleOptionSelect = (qIndex, optIndex) => {
        setAnswers(prev => ({ ...prev, [qIndex]: optIndex }));
    };

    const calculateProgress = () => {
        if (!questions.length) return 0;
        const answeredCount = Object.keys(answers).length;
        return Math.round((answeredCount / questions.length) * 100);
    };

    const handleSubmit = async (force = false) => {
        if (!force && !window.confirm('Are you sure you want to submit your exam? This cannot be undone.')) {
            return;
        }

        setLoading(true);
        try {
            const { result } = await api.post(`/exams/${id}/submit`, { answers });
            setExam(prev => ({ ...prev, result }));
            setStatus('completed');
        } catch (err) {
            setError(err.message || 'Failed to submit exam');
        } finally {
            setLoading(false);
        }
    };

    // ----------------------------------------------------------------
    // RENDERING LOGIC
    // ----------------------------------------------------------------

    if (loading) return <div className="flex-center" style={{ height: '100vh' }}><div className="spinner" /></div>;
    if (error) return (
        <div className="flex-center" style={{ height: '100vh', flexDirection: 'column', gap: 16, background: 'var(--bg-primary)' }}>
            <div className="text-danger" style={{ fontSize: 24 }}>⚠️ Error</div>
            <div>{error}</div>
            <button className="btn btn-secondary" onClick={() => navigate('/dashboard')}>
                Back to Dashboard
            </button>
        </div>
    );

    if (status === 'waiting') {
        return (
            <div className="flex-center" style={{ height: '100vh', flexDirection: 'column', gap: 24, textAlign: 'center' }}>
                <div style={{ fontSize: 64 }}>⏳</div>
                <h1 style={{ fontSize: 24 }}>Waiting for Exam to Start</h1>
                <p className="text-muted">
                    Please wait. The exam will begin shortly.
                    <br />
                    Do not close this window.
                </p>
                {mobileConnected && (
                    <div style={{ padding: '8px 16px', background: 'var(--bg-elevated)', borderRadius: 8 }}>
                        📱 One device connected
                    </div>
                )}
                {sessionId && !mobileConnected && (
                    <div style={{ marginTop: 24 }}>
                        <p style={{ marginBottom: 12 }}>Scan to pair your phone:</p>
                        <div style={{ background: 'white', padding: 16, borderRadius: 8, display: 'inline-block' }}>
                            <QRCode value={`${window.location.origin}/mobile-cam/${sessionId}?token=${localStorage.getItem('token')}`} size={160} />
                        </div>
                    </div>
                )}
            </div>
        );
    }

    if (status === 'completed') {
        return (
            <div className="flex-center" style={{ height: '100vh', flexDirection: 'column', gap: 24 }}>
                <div style={{ fontSize: 64 }}>🎉</div>
                <h1 style={{ fontSize: 32 }}>Exam Completed</h1>
                <p>Your answers have been submitted.</p>
                {exam?.result && (
                    <div style={{ padding: 24, background: 'var(--bg-elevated)', borderRadius: 8, textAlign: 'center' }}>
                        <div style={{ fontSize: 48, fontWeight: 700, color: 'var(--color-primary)' }}>
                            {exam.result.score} / {exam.result.totalMarks}
                        </div>
                        <div className="text-muted">Final Score</div>
                    </div>
                )}
                <button className="btn btn-secondary" onClick={() => navigate('/dashboard')}>
                    Return to Dashboard
                </button>
            </div>
        );
    }

    // Live Exam View
    const currentQ = questions[currentIndex];

    return (
        <div className="exam-layout" style={{ display: 'grid', gridTemplateColumns: '1fr 300px', height: '100vh' }}>
            {/* Main Question Area */}
            <div style={{ padding: 40, overflowY: 'auto' }}>
                <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between' }}>
                    <div className="badge badge-info">Question {currentIndex + 1} of {questions.length}</div>
                    <div className="text-muted">Time Remaining: --:--</div> {/* TODO: Timer */}
                </div>

                {currentQ && (
                    <div className="glass-card" style={{ padding: 32 }}>
                        <div style={{ fontSize: 18, marginBottom: 24, lineHeight: 1.6 }}>
                            <LatexRenderer>{currentQ.text}</LatexRenderer>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            {currentQ.options.map((opt, idx) => (
                                <label
                                    key={idx}
                                    className="option-card"
                                    style={{
                                        padding: 16, borderRadius: 8, border: '1px solid var(--border-subtle)',
                                        cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12,
                                        background: answers[currentIndex] === idx ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
                                        borderColor: answers[currentIndex] === idx ? 'var(--color-primary)' : 'var(--border-subtle)'
                                    }}
                                >
                                    <input
                                        type="radio"
                                        name={`q-${currentQ.id}`}
                                        checked={answers[currentIndex] === idx}
                                        onChange={() => handleOptionSelect(currentIndex, idx)}
                                        style={{ width: 16, height: 16 }}
                                    />
                                    <span><LatexRenderer>{opt}</LatexRenderer></span>
                                </label>
                            ))}
                        </div>
                    </div>
                )}

                <div style={{ marginTop: 32, display: 'flex', justifyContent: 'space-between' }}>
                    <button
                        className="btn btn-secondary"
                        disabled={currentIndex === 0}
                        onClick={() => setCurrentIndex(prev => prev - 1)}
                    >
                        Previous
                    </button>
                    {currentIndex < questions.length - 1 ? (
                        <button
                            className="btn btn-primary"
                            onClick={() => setCurrentIndex(prev => prev + 1)}
                        >
                            Next
                        </button>
                    ) : (
                        <button
                            className="btn btn-success"
                            onClick={() => handleSubmit(false)}
                        >
                            Submit Exam
                        </button>
                    )}
                </div>
            </div>

            {/* Sidebar */}
            <div style={{ borderLeft: '1px solid var(--border-subtle)', padding: 24, display: 'flex', flexDirection: 'column', gap: 24 }}>
                <div className="glass-card" style={{ padding: 16, textAlign: 'center' }}>
                    <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>
                        Proctoring Active
                    </div>
                    {/* Camera Feed Placeholder */}
                    <div style={{
                        height: 150, background: '#000', borderRadius: 8,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: '#666', fontSize: 12, position: 'relative', overflow: 'hidden'
                    }}>
                        {/* We would render local webcam here */}
                        <video id="local-webcam" autoPlay muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} ref={el => {
                            if (el && !el.srcObject) {
                                navigator.mediaDevices.getUserMedia({ video: true }).then(stream => el.srcObject = stream).catch(e => console.error(e));
                            }
                        }} />
                        <div style={{ position: 'absolute', bottom: 4, right: 4, fontSize: 10, background: 'rgba(0,0,0,0.5)', padding: '2px 4px', borderRadius: 2, color: 'white' }}>
                            {mobileConnected ? '📱+💻' : '💻 Only'}
                        </div>
                    </div>
                </div>

                <div className="glass-card" style={{ padding: 16 }}>
                    <div style={{ marginBottom: 16, fontWeight: 600 }}>Question Map</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                        {questions.map((_, idx) => (
                            <button
                                key={idx}
                                onClick={() => setCurrentIndex(idx)}
                                style={{
                                    width: 32, height: 32, borderRadius: 4, border: 'none',
                                    background: answers[idx] !== undefined ? 'var(--color-primary)' : 'var(--bg-elevated)',
                                    color: answers[idx] !== undefined ? 'white' : 'var(--text-primary)',
                                    cursor: 'pointer', fontSize: 12
                                }}
                            >
                                {idx + 1}
                            </button>
                        ))}
                    </div>
                </div>

                <div style={{ marginTop: 'auto' }}>
                    <div style={{ fontSize: 12, textAlign: 'center', color: 'var(--text-muted)' }}>
                        Session ID: {sessionId}
                    </div>
                </div>
            </div>
        </div>
    );
}
