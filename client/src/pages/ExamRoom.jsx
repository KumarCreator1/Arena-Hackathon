import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api.js';
import LatexRenderer from '../components/LatexRenderer.jsx';

export default function ExamRoom() {
    const { id } = useParams();
    const navigate = useNavigate();

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [exam, setExam] = useState(null);
    const [questions, setQuestions] = useState([]);
    const [status, setStatus] = useState('loading'); // loading, waiting, live, completed
    const [answers, setAnswers] = useState({}); // { questionIndex: optionIndex }
    const [currentIndex, setCurrentIndex] = useState(0);

    useEffect(() => {
        fetchExamData();
    }, [id]);

    const fetchExamData = async () => {
        try {
            setLoading(true);
            // Try to get questions. If exam is not live, this will throw 400.
            const data = await api.get(`/exams/${id}/questions`);
            setExam(data.exam);
            setQuestions(data.questions);
            setStatus('live');
        } catch (err) {
            if (err.status === 400 && err.message.includes('not live')) {
                setStatus('waiting');
            } else {
                setError(err.message || 'Failed to load exam');
            }
        } finally {
            setLoading(false);
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

    const handleSubmit = async () => {
        if (!window.confirm('Are you sure you want to submit your exam? This cannot be undone.')) {
            return;
        }

        setLoading(true);
        try {
            const { result } = await api.post(`/exams/${id}/submit`, { answers });
            // Merge result into exam object for display
            setExam(prev => ({ ...prev, result }));
            setStatus('completed');
        } catch (err) {
            setError(err.message || 'Failed to submit exam');
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex-center" style={{ height: '100vh', background: 'var(--bg-primary)' }}>
                <div className="spinner" style={{ width: 48, height: 48 }}></div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex-center" style={{ height: '100vh', flexDirection: 'column', gap: 16, background: 'var(--bg-primary)' }}>
                <div className="text-danger" style={{ fontSize: 24 }}>⚠️ Error</div>
                <div>{error}</div>
                <button className="btn btn-secondary" onClick={() => navigate('/dashboard')}>
                    Back to Dashboard
                </button>
            </div>
        );
    }

    if (status === 'waiting') {
        return (
            <div className="flex-center" style={{ height: '100vh', flexDirection: 'column', textAlign: 'center', padding: 20, background: 'var(--bg-primary)' }}>
                <div className="glass-card" style={{ padding: 40, maxWidth: 500 }}>
                    <div style={{ fontSize: 64, marginBottom: 24 }}>⏳</div>
                    <h1 style={{ marginBottom: 16 }}>Waiting for Host</h1>
                    <p className="text-muted" style={{ marginBottom: 32 }}>
                        The exam has not started yet. Please wait for the instructor to start the exam.
                    </p>
                    <button className="btn btn-primary" onClick={fetchExamData}>
                        Check Status (Refresh)
                    </button>
                </div>
            </div>
        );
    }

    if (status === 'completed') {
        return (
            <div className="flex-center" style={{ height: '100vh', flexDirection: 'column', gap: 24, textAlign: 'center', background: 'var(--bg-primary)' }}>
                <div style={{ fontSize: 80 }}>🎉</div>
                <h1 style={{ fontSize: 'var(--text-3xl)', fontWeight: 800 }}>Exam Submitted!</h1>
                <p className="text-muted">
                    Your answers have been recorded successfully.
                </p>

                {exam?.result && (
                    <div className="glass-card" style={{ padding: 40, minWidth: 300 }}>
                        <div style={{ fontSize: 14, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)' }}>
                            Your Score
                        </div>
                        <div style={{ fontSize: 64, fontWeight: 800, color: 'var(--accent-primary)', lineHeight: 1.2 }}>
                            {exam.result.score} <span style={{ fontSize: 24, color: 'var(--text-muted)' }}>/ {exam.result.totalMarks}</span>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 24, paddingTop: 24, borderTop: '1px solid var(--border-subtle)' }}>
                            <div>
                                <div style={{ fontSize: 24, color: 'var(--color-success)' }}>{exam.result.correctCount}</div>
                                <div className="text-sm text-muted">Correct</div>
                            </div>
                            <div>
                                <div style={{ fontSize: 24, color: 'var(--color-danger)' }}>{exam.result.incorrectCount}</div>
                                <div className="text-sm text-muted">Incorrect</div>
                            </div>
                        </div>
                    </div>
                )}

                <button className="btn btn-secondary" onClick={() => navigate('/dashboard')}>
                    Return to Dashboard
                </button>
            </div>
        );
    }

    const currentQ = questions[currentIndex];

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--bg-secondary)' }}>

            {/* Header */}
            <header style={{
                height: 64, background: 'var(--bg-primary)', borderBottom: '1px solid var(--border-subtle)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px'
            }}>
                <div style={{ fontWeight: 700, fontSize: 18 }}>
                    {exam?.title}
                </div>
                <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
                    <div className="text-muted" style={{ fontSize: 14 }}>
                        Time Remaining: <span style={{ color: 'var(--color-warning)', fontWeight: 700 }}>--:--</span>
                    </div>
                    <button
                        className="btn btn-primary"
                        style={{ padding: '6px 16px', fontSize: 14 }}
                        onClick={handleSubmit}
                    >
                        Submit Exam
                    </button>
                </div>
            </header>

            {/* Main Layout */}
            <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

                {/* Sidebar (Question Palette) */}
                <aside style={{
                    width: 280, background: 'var(--bg-primary)', borderRight: '1px solid var(--border-subtle)',
                    display: 'flex', flexDirection: 'column'
                }}>
                    <div style={{ padding: 20, borderBottom: '1px solid var(--border-subtle)' }}>
                        <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: 8 }}>
                            Progress
                        </div>
                        <div style={{ height: 6, background: 'var(--bg-secondary)', borderRadius: 3, overflow: 'hidden' }}>
                            <div style={{ width: `${calculateProgress()}%`, height: '100%', background: 'var(--accent-primary)' }} />
                        </div>
                        <div style={{ textAlign: 'right', fontSize: 12, marginTop: 4, color: 'var(--text-muted)' }}>
                            {Object.keys(answers).length} / {questions.length} answered
                        </div>
                    </div>

                    <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                            {questions.map((_, idx) => {
                                const isAnswered = answers[idx] !== undefined;
                                const isCurrent = idx === currentIndex;
                                return (
                                    <button
                                        key={idx}
                                        onClick={() => setCurrentIndex(idx)}
                                        style={{
                                            aspectRatio: '1',
                                            borderRadius: 'var(--radius-sm)',
                                            border: isCurrent ? '1px solid var(--accent-primary)' : '1px solid var(--border-subtle)',
                                            background: isCurrent ? 'rgba(99, 102, 241, 0.1)' : (isAnswered ? 'var(--bg-elevated)' : 'transparent'),
                                            color: isCurrent ? 'var(--accent-primary)' : (isAnswered ? 'var(--text-primary)' : 'var(--text-muted)'),
                                            fontWeight: isCurrent || isAnswered ? 700 : 400,
                                            cursor: 'pointer',
                                            transition: 'all 0.2s'
                                        }}
                                    >
                                        {idx + 1}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </aside>

                {/* Question Area */}
                <main style={{ flex: 1, overflowY: 'auto', padding: 40, display: 'flex', justifyContent: 'center' }}>
                    <div style={{ maxWidth: 800, width: '100%' }}>

                        <div style={{ marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span className="badge badge-info">Question {currentIndex + 1}</span>
                            <span className="text-muted" style={{ fontSize: 14 }}>
                                Marks: +{exam?.markingScheme?.correct} / {exam?.markingScheme?.incorrect}
                            </span>
                        </div>

                        <div style={{ fontSize: 20, lineHeight: 1.6, marginBottom: 32, fontWeight: 500 }}>
                            <LatexRenderer>{currentQ.text}</LatexRenderer>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                            {currentQ.options.map((opt, optIdx) => {
                                const isSelected = answers[currentIndex] === optIdx;
                                return (
                                    <div
                                        key={optIdx}
                                        onClick={() => handleOptionSelect(currentIndex, optIdx)}
                                        style={{
                                            padding: 20,
                                            borderRadius: 'var(--radius-md)',
                                            border: `1px solid ${isSelected ? 'var(--accent-primary)' : 'var(--border-subtle)'}`,
                                            background: isSelected ? 'rgba(99, 102, 241, 0.05)' : 'var(--bg-elevated)',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            transition: 'all 0.2s'
                                        }}
                                    >
                                        <div style={{
                                            width: 24, height: 24, borderRadius: '50%', border: '2px solid',
                                            borderColor: isSelected ? 'var(--accent-primary)' : 'var(--text-muted)',
                                            marginRight: 16,
                                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                                        }}>
                                            {isSelected && <div style={{ width: 12, height: 12, borderRadius: '50%', background: 'var(--accent-primary)' }} />}
                                        </div>
                                        <div style={{ fontSize: 16 }}>
                                            <LatexRenderer>{opt}</LatexRenderer>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Navigation Buttons */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 40 }}>
                            <button
                                className="btn btn-ghost"
                                disabled={currentIndex === 0}
                                onClick={() => setCurrentIndex(prev => prev - 1)}
                            >
                                ← Previous
                            </button>
                            <button
                                className="btn btn-primary"
                                disabled={currentIndex === questions.length - 1}
                                onClick={() => setCurrentIndex(prev => prev + 1)}
                            >
                                Next →
                            </button>
                        </div>

                    </div>
                </main>

            </div>
        </div>
    );
}
