import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import api from '../services/api.js';
import LatexRenderer from '../components/LatexRenderer.jsx';

// Helper to format date for datetime-local input (YYYY-MM-DDTHH:mm)
const formatDateForInput = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return ''; // Invalid date

    // Adjust to local ISO string (handling timezone offset)
    const offset = date.getTimezoneOffset() * 60000;
    const localISOTime = new Date(date.getTime() - offset).toISOString().slice(0, 16);
    return localISOTime;
};

export default function CreateExam() {
    const { user } = useAuth();
    const navigate = useNavigate();

    const [title, setTitle] = useState('');
    const [maxStudents, setMaxStudents] = useState('');
    const [durationMinutes, setDurationMinutes] = useState('');
    const [startTime, setStartTime] = useState('');
    const [markCorrect, setMarkCorrect] = useState(4);
    const [markIncorrect, setMarkIncorrect] = useState(-1);
    const [questions, setQuestions] = useState(null);
    const [fileName, setFileName] = useState('');
    const [error, setError] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setFileName(file.name);
        setError('');

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const data = JSON.parse(event.target.result);

                // Support both formats: { config, questions } or raw array
                let parsedQuestions;
                if (data.questions && Array.isArray(data.questions)) {
                    parsedQuestions = data.questions;
                    // Auto-fill config if present
                    if (data.config) {
                        if (data.config.title && !title) setTitle(data.config.title);
                        if (data.config.durationMinutes && !durationMinutes) setDurationMinutes(String(data.config.durationMinutes));
                        if (data.config.marking) {
                            setMarkCorrect(data.config.marking.correct ?? 4);
                            setMarkIncorrect(data.config.marking.incorrect ?? -1);
                        }
                    }
                } else if (Array.isArray(data)) {
                    parsedQuestions = data;
                } else {
                    setError('JSON must contain a "questions" array or be a raw array');
                    return;
                }

                // Validate
                for (let i = 0; i < parsedQuestions.length; i++) {
                    const q = parsedQuestions[i];
                    if (!q.id || !q.text || !q.options || q.answerIndex === undefined) {
                        setError(`Question ${i + 1} missing required fields (id, text, options, answerIndex)`);
                        setQuestions(null);
                        return;
                    }
                }

                setQuestions(parsedQuestions);
            } catch {
                setError('Invalid JSON file — could not parse');
                setQuestions(null);
            }
        };
        reader.readAsText(file);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (!questions || questions.length === 0) {
            setError('Please upload a valid JSON quiz file');
            return;
        }

        setSubmitting(true);

        try {
            const payload = {
                config: {
                    title,
                    durationMinutes: Number(durationMinutes),
                    marking: { correct: Number(markCorrect), incorrect: Number(markIncorrect) },
                },
                questions,
                maxStudents: Number(maxStudents),
                startTime: new Date(startTime).toISOString(), // Send as ISO string
            };

            await api.post('/exams', payload);
            navigate('/dashboard');
        } catch (err) {
            setError(err.message);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="dashboard-layout">
            {/* Nav */}
            <nav className="dashboard-nav">
                <Link to="/dashboard" className="dashboard-nav-brand" style={{ textDecoration: 'none' }}>
                    <span style={{
                        width: 28, height: 28,
                        background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))',
                        borderRadius: 'var(--radius-sm)', display: 'flex',
                        alignItems: 'center', justifyContent: 'center', fontSize: 14,
                    }}>◈</span>
                    Parallax
                </Link>
                <div className="dashboard-nav-actions">
                    <span className="badge badge-warning">{user?.role}</span>
                    <span className="text-sm text-muted">{user?.name}</span>
                </div>
            </nav>

            {/* Content */}
            <div className="dashboard-content animate-fade-in" style={{ maxWidth: 720 }}>
                <Link to="/dashboard" className="text-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginBottom: 16 }}>
                    ← Back to Dashboard
                </Link>

                <h1 style={{ fontSize: 'var(--text-3xl)', fontWeight: 800, marginBottom: 8 }}>
                    Create Exam
                </h1>
                <p className="text-muted mb-2">
                    Set up exam parameters and upload your quiz questions.
                </p>

                {error && <div className="alert alert-error mb-2">{error}</div>}

                <form onSubmit={handleSubmit}>
                    {/* Exam Details Card */}
                    <div className="glass-card" style={{ padding: 28, marginBottom: 20 }}>
                        <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 600, marginBottom: 20 }}>
                            📋 Exam Details
                        </h2>

                        <div className="input-group">
                            <label className="input-label" htmlFor="title">Exam Title</label>
                            <input
                                id="title"
                                className="input-field"
                                type="text"
                                placeholder="e.g. Midterm — Data Structures"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                required
                            />
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                            <div className="input-group">
                                <label className="input-label" htmlFor="maxStudents">Max Students</label>
                                <input
                                    id="maxStudents"
                                    className="input-field"
                                    type="number"
                                    placeholder="e.g. 60"
                                    min="1"
                                    value={maxStudents}
                                    onChange={(e) => setMaxStudents(e.target.value)}
                                    required
                                />
                            </div>

                            <div className="input-group">
                                <label className="input-label" htmlFor="duration">Duration (minutes)</label>
                                <input
                                    id="duration"
                                    className="input-field"
                                    type="number"
                                    placeholder="e.g. 45"
                                    min="1"
                                    value={durationMinutes}
                                    onChange={(e) => setDurationMinutes(e.target.value)}
                                    required
                                />
                            </div>
                        </div>

                        <div className="input-group">
                            <label className="input-label" htmlFor="startTime">Start Date & Time</label>
                            <input
                                id="startTime"
                                className="input-field"
                                type="datetime-local"
                                value={startTime}
                                onChange={(e) => setStartTime(e.target.value)}
                                required
                                style={{ colorScheme: 'dark' }}
                            />
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                            <div className="input-group">
                                <label className="input-label" htmlFor="markCorrect">Marks per Correct (+ )</label>
                                <input
                                    id="markCorrect"
                                    className="input-field"
                                    type="number"
                                    value={markCorrect}
                                    onChange={(e) => setMarkCorrect(e.target.value)}
                                />
                            </div>
                            <div className="input-group">
                                <label className="input-label" htmlFor="markIncorrect">Marks per Incorrect (−)</label>
                                <input
                                    id="markIncorrect"
                                    className="input-field"
                                    type="number"
                                    value={markIncorrect}
                                    onChange={(e) => setMarkIncorrect(e.target.value)}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Upload Card */}
                    <div className="glass-card" style={{ padding: 28, marginBottom: 20 }}>
                        <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 600, marginBottom: 20 }}>
                            📎 Quiz Questions (JSON)
                        </h2>

                        <label
                            htmlFor="quiz-file"
                            style={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                gap: 12,
                                padding: 32,
                                border: '2px dashed var(--border-default)',
                                borderRadius: 'var(--radius-md)',
                                cursor: 'pointer',
                                transition: 'all var(--transition-fast)',
                                textAlign: 'center',
                            }}
                            onMouseOver={(e) => e.currentTarget.style.borderColor = 'var(--accent-primary)'}
                            onMouseOut={(e) => e.currentTarget.style.borderColor = 'var(--border-default)'}
                        >
                            <span style={{ fontSize: 32 }}>
                                {questions ? '✅' : '📤'}
                            </span>
                            <span className="text-muted text-sm">
                                {fileName
                                    ? `${fileName} — ${questions ? `${questions.length} questions loaded` : 'Error in file'}`
                                    : 'Click to upload or drag & drop a JSON file'}
                            </span>
                            <input
                                id="quiz-file"
                                type="file"
                                accept=".json"
                                onChange={handleFileUpload}
                                style={{ display: 'none' }}
                            />
                        </label>
                    </div>

                    {/* Question Preview */}
                    {questions && questions.length > 0 && (
                        <div className="glass-card" style={{ padding: 28, marginBottom: 20 }}>
                            <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 600, marginBottom: 16 }}>
                                👁️ Question Preview ({questions.length})
                            </h2>
                            <div style={{ maxHeight: 400, overflowY: 'auto', paddingRight: 8 }}>
                                {questions.map((q, i) => (
                                    <div
                                        key={q.id}
                                        style={{
                                            padding: 16,
                                            background: 'var(--bg-primary)',
                                            borderRadius: 'var(--radius-md)',
                                            border: '1px solid var(--border-subtle)',
                                            marginBottom: i < questions.length - 1 ? 12 : 0,
                                        }}
                                    >
                                        <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', marginBottom: 6 }}>
                                            <span className="font-mono">{q.id}</span>
                                        </div>
                                        {/* Render question text with LatexRenderer */}
                                        <div style={{ fontWeight: 500, marginBottom: 10 }}>
                                            <LatexRenderer>{q.text}</LatexRenderer>
                                        </div>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                                            {q.options.map((opt, j) => (
                                                <div
                                                    key={j}
                                                    style={{
                                                        padding: '6px 10px',
                                                        borderRadius: 'var(--radius-sm)',
                                                        fontSize: 'var(--text-sm)',
                                                        background: j === q.answerIndex ? 'var(--color-success-bg)' : 'var(--bg-secondary)',
                                                        color: j === q.answerIndex ? 'var(--color-success)' : 'var(--text-secondary)',
                                                        border: `1px solid ${j === q.answerIndex ? 'rgba(34,197,94,0.2)' : 'var(--border-subtle)'}`,
                                                    }}
                                                >
                                                    <span style={{ marginRight: 8, fontWeight: 600 }}>{String.fromCharCode(65 + j)}.</span>
                                                    <LatexRenderer>{opt}</LatexRenderer>
                                                </div>
                                            ))}
                                        </div>
                                        {q.explanation && (
                                            <div style={{ marginTop: 8, fontSize: 'var(--text-sm)', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                                                💡 <LatexRenderer>{q.explanation}</LatexRenderer>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <button
                        type="submit"
                        className="btn btn-primary btn-full"
                        disabled={submitting || !questions}
                        style={{ padding: '14px 24px', fontSize: 'var(--text-lg)' }}
                    >
                        {submitting ? (
                            <><span className="spinner" /> Creating Exam...</>
                        ) : (
                            '🚀 Create Exam'
                        )}
                    </button>
                </form>
            </div>
        </div>
    );
}
