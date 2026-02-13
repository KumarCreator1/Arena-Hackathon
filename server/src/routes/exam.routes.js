/**
 * Exam Routes
 *
 * Admin:
 *   POST   /api/exams              — Create exam
 *   GET    /api/exams              — List admin's exams
 *   GET    /api/exams/:id          — Get full exam (with answers)
 *   PUT    /api/exams/:id          — Update exam (draft only)
 *   DELETE /api/exams/:id          — Delete exam
 *   PATCH  /api/exams/:id/status   — Change lifecycle status
 *
 * Student:
 *   POST   /api/exams/join         — Join exam via access code
 *   GET    /api/exams/:id/questions — Get questions (answers stripped)
 */

import { Router } from 'express';
import Exam from '../models/Exam.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();

// ═══════════════════════════════════════════════════════════
// ADMIN ROUTES
// ═══════════════════════════════════════════════════════════

/**
 * POST /api/exams — Create a new exam
 * Body: { config: { title, durationMinutes, marking }, questions: [...] }
 *       + maxStudents, startTime
 */
router.post('/', authenticate, authorize('admin'), async (req, res) => {
    try {
        const { config, questions, maxStudents, startTime } = req.body;

        // Validate structure
        if (!config || !questions || !Array.isArray(questions)) {
            return res.status(400).json({
                success: false,
                message: 'Request must include config object and questions array',
            });
        }

        if (!config.title || !config.durationMinutes) {
            return res.status(400).json({
                success: false,
                message: 'Config must include title and durationMinutes',
            });
        }

        if (!maxStudents || !startTime) {
            return res.status(400).json({
                success: false,
                message: 'maxStudents and startTime are required',
            });
        }

        // Validate each question has required fields
        for (let i = 0; i < questions.length; i++) {
            const q = questions[i];
            if (!q.id || !q.text || !q.options || q.answerIndex === undefined) {
                return res.status(400).json({
                    success: false,
                    message: `Question ${i + 1} is missing required fields (id, text, options, answerIndex)`,
                });
            }
            if (q.answerIndex < 0 || q.answerIndex >= q.options.length) {
                return res.status(400).json({
                    success: false,
                    message: `Question "${q.id}": answerIndex out of range`,
                });
            }
        }

        const exam = await Exam.create({
            title: config.title,
            createdBy: req.user.userId,
            maxStudents,
            durationMinutes: config.durationMinutes,
            startTime: new Date(startTime),
            markingScheme: config.marking || { correct: 4, incorrect: -1 },
            questions,
            status: 'scheduled',
        });

        res.status(201).json({
            success: true,
            exam: {
                id: exam._id,
                title: exam.title,
                accessCode: exam.accessCode,
                maxStudents: exam.maxStudents,
                durationMinutes: exam.durationMinutes,
                startTime: exam.startTime,
                status: exam.status,
                markingScheme: exam.markingScheme,
                questionCount: exam.questions.length,
                createdAt: exam.createdAt,
            },
        });
    } catch (error) {
        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map((e) => e.message);
            return res.status(400).json({
                success: false,
                message: messages.join(', '),
            });
        }
        console.error('Create exam error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error during exam creation',
        });
    }
});

/**
 * GET /api/exams — List all exams created by this admin
 */
router.get('/', authenticate, authorize('admin'), async (req, res) => {
    try {
        const exams = await Exam.find({ createdBy: req.user.userId })
            .select('-questions')
            .sort({ createdAt: -1 });

        res.json({
            success: true,
            count: exams.length,
            exams: exams.map((e) => ({
                id: e._id,
                title: e.title,
                accessCode: e.accessCode,
                maxStudents: e.maxStudents,
                durationMinutes: e.durationMinutes,
                startTime: e.startTime,
                status: e.status,
                participantCount: e.participants.length,
                createdAt: e.createdAt,
            })),
        });
    } catch (error) {
        console.error('List exams error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

/**
 * GET /api/exams/:id — Get full exam details (admin only, includes answers)
 */
router.get('/:id', authenticate, authorize('admin'), async (req, res) => {
    try {
        const exam = await Exam.findOne({
            _id: req.params.id,
            createdBy: req.user.userId,
        }).populate('participants', 'name email');

        if (!exam) {
            return res.status(404).json({
                success: false,
                message: 'Exam not found',
            });
        }

        res.json({ success: true, exam });
    } catch (error) {
        console.error('Get exam error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

/**
 * PUT /api/exams/:id — Update exam (draft status only)
 */
router.put('/:id', authenticate, authorize('admin'), async (req, res) => {
    try {
        const exam = await Exam.findOne({
            _id: req.params.id,
            createdBy: req.user.userId,
        });

        if (!exam) {
            return res.status(404).json({
                success: false,
                message: 'Exam not found',
            });
        }

        if (exam.status !== 'draft' && exam.status !== 'scheduled') {
            return res.status(400).json({
                success: false,
                message: `Cannot edit exam in "${exam.status}" status — only drafts and scheduled exams can be modified`,
            });
        }

        const { config, questions, maxStudents, startTime } = req.body;

        if (config?.title) exam.title = config.title;
        if (config?.durationMinutes) exam.durationMinutes = config.durationMinutes;
        if (config?.marking) exam.markingScheme = config.marking;
        if (maxStudents) exam.maxStudents = maxStudents;
        if (startTime) exam.startTime = new Date(startTime);

        // If exam was in draft, promote to scheduled on save (publishing)
        if (exam.status === 'draft') {
            exam.status = 'scheduled';
        }

        if (questions && questions.length > 0) {
            // Validate questions similar to create... (simplified for now as schema handles some)
            exam.questions = questions;
        }

        await exam.save();

        res.json({
            success: true,
            message: 'Exam updated successfully',
            exam,
        });
    } catch (error) {
        console.error('Update exam error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

/**
 * PATCH /api/exams/:id/status — Update exam status (lifecycle)
 */
router.patch('/:id/status', authenticate, authorize('admin'), async (req, res) => {
    try {
        const { status } = req.body;
        const validStatuses = ['draft', 'scheduled', 'live', 'completed'];

        if (!validStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
            });
        }

        const exam = await Exam.findOne({
            _id: req.params.id,
            createdBy: req.user.userId,
        });

        if (!exam) {
            return res.status(404).json({ success: false, message: 'Exam not found' });
        }

        exam.status = status;
        await exam.save();

        res.json({ success: true, message: `Exam status updated to ${status}`, status });
    } catch (error) {
        console.error('Update status error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

/**
 * DELETE /api/exams/:id — Delete exam
 */
router.delete('/:id', authenticate, authorize('admin'), async (req, res) => {
    try {
        const exam = await Exam.findOneAndDelete({
            _id: req.params.id,
            createdBy: req.user.userId,
        });

        if (!exam) {
            return res.status(404).json({
                success: false,
                message: 'Exam not found',
            });
        }

        res.json({ success: true, message: 'Exam deleted' });
    } catch (error) {
        console.error('Delete exam error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

/**
 * PATCH /api/exams/:id/status — Change exam lifecycle status
 * Body: { status: 'scheduled' | 'live' | 'completed' }
 */
router.patch('/:id/status', authenticate, authorize('admin'), async (req, res) => {
    try {
        const { status } = req.body;
        const validTransitions = {
            draft: ['scheduled'],
            scheduled: ['live', 'draft'],
            live: ['completed'],
            completed: [],
        };

        const exam = await Exam.findOne({
            _id: req.params.id,
            createdBy: req.user.userId,
        });

        if (!exam) {
            return res.status(404).json({
                success: false,
                message: 'Exam not found',
            });
        }

        if (!validTransitions[exam.status]?.includes(status)) {
            return res.status(400).json({
                success: false,
                message: `Cannot transition from "${exam.status}" to "${status}"`,
            });
        }

        exam.status = status;
        await exam.save();

        res.json({
            success: true,
            exam: { id: exam._id, title: exam.title, status: exam.status },
        });
    } catch (error) {
        console.error('Status change error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// ═══════════════════════════════════════════════════════════
// STUDENT ROUTES
// ═══════════════════════════════════════════════════════════

/**
 * POST /api/exams/join — Join exam via access code
 * Body: { accessCode: 'ABC123' }
 */
router.post('/join', authenticate, async (req, res) => {
    try {
        const { accessCode } = req.body;

        if (!accessCode) {
            return res.status(400).json({
                success: false,
                message: 'Access code is required',
            });
        }

        const exam = await Exam.findOne({ accessCode: accessCode.toUpperCase() });

        if (!exam) {
            return res.status(404).json({
                success: false,
                message: 'Invalid access code',
            });
        }

        if (exam.status !== 'scheduled' && exam.status !== 'live') {
            return res.status(400).json({
                success: false,
                message: `Exam is not available (status: ${exam.status})`,
            });
        }

        // Check seat limit
        if (exam.participants.length >= exam.maxStudents) {
            return res.status(400).json({
                success: false,
                message: 'Exam is full — max students reached',
            });
        }

        // Check if already joined
        if (exam.participants.includes(req.user.userId)) {
            return res.json({
                success: true,
                message: 'Already joined',
                exam: {
                    id: exam._id,
                    title: exam.title,
                    durationMinutes: exam.durationMinutes,
                    startTime: exam.startTime,
                    status: exam.status,
                },
            });
        }

        exam.participants.push(req.user.userId);
        await exam.save();

        res.json({
            success: true,
            message: 'Joined exam successfully',
            exam: {
                id: exam._id,
                title: exam.title,
                durationMinutes: exam.durationMinutes,
                startTime: exam.startTime,
                status: exam.status,
            },
        });
    } catch (error) {
        console.error('Join exam error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

/**
 * GET /api/exams/:id/questions — Get questions WITHOUT answers
 * Only for participants of the exam
 */
router.get('/:id/questions', authenticate, async (req, res) => {
    try {
        const exam = await Exam.findById(req.params.id);

        if (!exam) {
            return res.status(404).json({
                success: false,
                message: 'Exam not found',
            });
        }

        // Check if user is a participant
        if (!exam.participants.includes(req.user.userId)) {
            return res.status(403).json({
                success: false,
                message: 'You have not joined this exam',
            });
        }

        const now = new Date();
        const startTime = new Date(exam.startTime);

        // Allow if live OR (scheduled AND time reached)
        const isLive = exam.status === 'live';
        const isAutoStart = exam.status === 'scheduled' && now >= startTime;

        if (!isLive && !isAutoStart) {
            return res.status(400).json({
                success: false,
                message: `Exam is not live. Status: ${exam.status}. Starts at: ${startTime.toLocaleString()}`,
            });
        }

        // If auto-starting, we should ideally update status to live, 
        // to avoid repeated time checks or inconsistent states.
        // However, updating in a GET request is side-effectual but acceptable here for "lazy" state transition.
        if (isAutoStart && exam.status === 'scheduled') {
            exam.status = 'live';
            await exam.save();
        }

        // Strip answers and explanations
        const safeQuestions = Exam.sanitizeQuestions(exam.questions);

        res.json({
            success: true,
            exam: {
                id: exam._id,
                title: exam.title,
                durationMinutes: exam.durationMinutes,
                markingScheme: exam.markingScheme,
            },
            questions: safeQuestions,
        });
    } catch (error) {
        console.error('Get questions error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

import Submission from '../models/Submission.js';

// ... (existing routes)

/**
 * POST /api/exams/:id/submit — Submit exam answers
 * Body: { answers: { "0": 1, "1": 3, ... } }
 */
router.post('/:id/submit', authenticate, async (req, res) => {
    try {
        const { answers } = req.body;
        const exam = await Exam.findById(req.params.id);

        if (!exam) {
            return res.status(404).json({ success: false, message: 'Exam not found' });
        }

        // Check if user is a participant
        if (!exam.participants.includes(req.user.userId)) {
            return res.status(403).json({ success: false, message: 'Not joined this exam' });
        }

        // Allow submission if status is live or recently completed (grace period handled by client/admin)
        // For strictness, only 'live'.
        if (exam.status !== 'live') {
            return res.status(400).json({ success: false, message: `Exam is not live (${exam.status})` });
        }

        // Check if already submitted
        const existingSubmission = await Submission.findOne({
            exam: exam._id,
            student: req.user.userId,
        });

        if (existingSubmission) {
            return res.status(400).json({ success: false, message: 'Already submitted' });
        }

        // Calculate Score
        let score = 0;
        let correctCount = 0;
        let incorrectCount = 0;

        const { correct, incorrect } = exam.markingScheme;
        const totalMarks = exam.questions.length * correct;

        exam.questions.forEach((q, index) => {
            const studentAnswer = answers[index]; // array index or q.id if map is key-based
            if (studentAnswer !== undefined && studentAnswer !== null) {
                if (studentAnswer === q.answerIndex) {
                    score += correct;
                    correctCount++;
                } else {
                    score += incorrect;
                    incorrectCount++;
                }
            }
        });

        const submission = await Submission.create({
            exam: exam._id,
            student: req.user.userId,
            answers,
            score,
            totalMarks,
            submittedAt: new Date(),
        });

        res.json({
            success: true,
            message: 'Exam submitted successfully',
            result: {
                score,
                totalMarks,
                correctCount,
                incorrectCount,
            },
        });

    } catch (error) {
        console.error('Submit exam error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

export default router;
