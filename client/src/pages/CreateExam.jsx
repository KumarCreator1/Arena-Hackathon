import { useState, useRef, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import 'katex/dist/katex.min.css';
import LatexRenderer from '../components/LatexRenderer.jsx';
import api from '../services/api.js';

export default function CreateExam() {
    const navigate = useNavigate();
    const { id } = useParams(); // For edit mode
    const isEditing = Boolean(id);

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // Form State
    const [title, setTitle] = useState('');
    const [maxStudents, setMaxStudents] = useState(50);
    const [duration, setDuration] = useState(60);
    const [startTime, setStartTime] = useState('');
    const [marking, setMarking] = useState({ correct: 4, incorrect: -1 });
    const [questions, setQuestions] = useState([]);

    // File Upload State
    const fileInputRef = useRef(null);
    const [fileName, setFileName] = useState('');

    useEffect(() => {
        if (isEditing) {
            fetchExamDetails();
        }
    }, [id]);

    const fetchExamDetails = async () => {
        try {
            setLoading(true);
            const res = await api.get(`/exams/${id}`);
            const exam = res.exam;

            setTitle(exam.title);
            setMaxStudents(exam.maxStudents);
            setDuration(exam.durationMinutes);
            setMarking(exam.markingScheme);
            setQuestions(exam.questions || []); // Admin view includes questions

            // Format date for datetime-local input
            if (exam.startTime) {
                setStartTime(formatDateForInput(new Date(exam.startTime)));
            }
        } catch (err) {
            setError('Failed to load exam details: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    const formatDateForInput = (date) => {
        const offset = date.getTimezoneOffset() * 60000;
        const localISOTime = (new Date(date - offset)).toISOString().slice(0, 16);
        return localISOTime;
    };

    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setFileName(file.name);
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const json = JSON.parse(event.target.result);

                if (Array.isArray(json)) {
                    // Old format: just questions
                    setQuestions(json);
                    setError('');
                } else if (json.questions && Array.isArray(json.questions)) {
                    // Standard format: { config, questions }
                    setQuestions(json.questions);

                    if (json.config) {
                        if (json.config.title) setTitle(json.config.title);
                        if (json.config.durationMinutes) setDuration(json.config.durationMinutes);
                        if (json.config.maxStudents) setMaxStudents(json.config.maxStudents); // Support if added to standard
                        if (json.config.marking) {
                            setMarking({
                                correct: json.config.marking.correct || 4,
                                incorrect: json.config.marking.incorrect || -1
                            });
                        }
                    }
                    setError('');
                } else {
                    setError('Invalid JSON format. Expected an array of questions or standard exam object.');
                }
            } catch (err) {
                setError('Error parsing JSON file. Please check syntax.');
            }
        };
        reader.readAsText(file);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        if (questions.length === 0) {
            setError('Please upload at least one question.');
            setLoading(false);
            return;
        }

        const payload = {
            config: {
                title,
                durationMinutes: parseInt(duration),
                marking,
            },
            maxStudents: parseInt(maxStudents),
            startTime: new Date(startTime).toISOString(),
            questions,
        };

        try {
            if (isEditing) {
                await api.put(`/exams/${id}`, payload);
                alert('Exam updated successfully!');
            } else {
                await api.post('/exams', payload);
                alert('Exam created successfully!');
            }
            navigate('/dashboard');
        } catch (err) {
            setError(err.message || 'Failed to save exam');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="dashboard-layout">
            <div className="glass-card" style={{ maxWidth: 800, margin: '40px auto', padding: 40 }}>
                <Link to="/dashboard" className="text-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginBottom: 16 }}>
                    ← Back to Dashboard
                </Link>
                <h1 style={{ fontSize: 'var(--text-3xl)', fontWeight: 800, marginBottom: 8 }}>
                    {isEditing ? 'Edit Exam' : 'Create New Exam'}
                </h1>
                <p className="text-muted" style={{ marginBottom: 32 }}>
                    {isEditing ? 'Update exam details and questions.' : 'Configure exam details and upload your question bank.'}
                </p>

                {error && (
                    <div style={{
                        padding: 16, background: 'rgba(239, 68, 68, 0.1)',
                        border: '1px solid var(--color-danger)', borderRadius: 8,
                        marginBottom: 24, color: 'var(--color-danger)'
                    }}>
                        ⚠️ {error}
                    </div>
                )}

                <form onSubmit={handleSubmit}>
                    <div style={{ marginBottom: 24 }}>
                        <label className="label">Exam Title</label>
                        <input
                            type="text" className="input-field"
                            value={title} onChange={e => setTitle(e.target.value)}
                            required
                            placeholder="e.g. Physics Mid-Term 2024"
                        />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 24 }}>
                        <div>
                            <label className="label">Max Students</label>
                            <input
                                type="number" className="input-field"
                                value={maxStudents} onChange={e => setMaxStudents(e.target.value)}
                                min="1" required
                            />
                        </div>
                        <div>
                            <label className="label">Duration (Minutes)</label>
                            <input
                                type="number" className="input-field"
                                value={duration} onChange={e => setDuration(e.target.value)}
                                min="1" required
                            />
                        </div>
                    </div>

                    <div style={{ marginBottom: 24 }}>
                        <label className="label">Start Date & Time</label>
                        <input
                            type="datetime-local" className="input-field"
                            value={startTime} onChange={e => setStartTime(e.target.value)}
                            required
                            style={{ colorScheme: 'dark' }}
                        />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 32 }}>
                        <div>
                            <label className="label">Marks per Correct</label>
                            <input
                                type="number" className="input-field"
                                value={marking.correct} onChange={e => setMarking(prev => ({ ...prev, correct: Number(e.target.value) }))}
                                required
                            />
                        </div>
                        <div>
                            <label className="label">Marks per Incorrect</label>
                            <input
                                type="number" className="input-field"
                                value={marking.incorrect} onChange={e => setMarking(prev => ({ ...prev, incorrect: Number(e.target.value) }))}
                                required
                            />
                        </div>
                    </div>

                    <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 32, marginBottom: 32 }}>
                        <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 600, marginBottom: 16 }}>
                            Questions ({questions.length})
                        </h2>

                        <input
                            type="file"
                            accept=".json"
                            ref={fileInputRef}
                            style={{ display: 'none' }}
                            onChange={handleFileUpload}
                        />

                        <div
                            onClick={() => fileInputRef.current?.click()}
                            style={{
                                border: '2px dashed var(--border-default)',
                                borderRadius: 'var(--radius-md)',
                                padding: 32,
                                textAlign: 'center',
                                cursor: 'pointer',
                                marginBottom: 24,
                                background: fileName ? 'rgba(99, 102, 241, 0.05)' : 'transparent'
                            }}
                        >
                            <div style={{ fontSize: 32, marginBottom: 8 }}>📄</div>
                            <div style={{ fontWeight: 600, marginBottom: 4 }}>
                                {fileName || (isEditing && questions.length > 0 ? 'Upload replacement JSON file' : 'Upload Question Bank (JSON)')}
                            </div>
                            <div className="text-sm text-muted">
                                Click to browse files
                            </div>
                        </div>

                        {questions.length > 0 && (
                            <div style={{
                                background: 'var(--bg-elevated)', padding: 16, borderRadius: 8,
                                maxHeight: 200, overflowY: 'auto'
                            }}>
                                <div className="text-sm text-muted" style={{ marginBottom: 12 }}>Preview (First 3 questions):</div>
                                {questions.slice(0, 3).map((q, i) => (
                                    <div key={i} style={{ marginBottom: 12, paddingBottom: 12, borderBottom: '1px solid var(--border-subtle)' }}>
                                        <div style={{ fontWeight: 600, fontSize: 14 }}>Q{i + 1}: <LatexRenderer>{q.text}</LatexRenderer></div>
                                    </div>
                                ))}
                                {questions.length > 3 && <div className="text-sm text-muted">...and {questions.length - 3} more</div>}
                            </div>
                        )}
                    </div>

                    <div style={{ display: 'flex', gap: 16, justifyContent: 'flex-end' }}>
                        <button type="button" className="btn btn-ghost" onClick={() => navigate('/dashboard')}>
                            Cancel
                        </button>
                        <button type="submit" className="btn btn-primary" disabled={loading}>
                            {loading ? <span className="spinner" /> : (isEditing ? 'Update Exam' : 'Create Exam')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
