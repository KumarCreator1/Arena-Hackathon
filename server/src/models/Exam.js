/**
 * Exam Model
 *
 * Schema for proctored exams with rich question format,
 * marking scheme, access codes, and lifecycle status.
 *
 * Lifecycle: draft → scheduled → live → completed
 *
 * Security: answerIndex and explanation are NEVER sent to students.
 *           Use Exam.sanitizeQuestions() to strip sensitive fields.
 */

import mongoose from 'mongoose';
import crypto from 'crypto';

// ─── Sub-schemas ─────────────────────────────────────────
const mediaSchema = new mongoose.Schema(
    {
        type: { type: String, enum: ['image', 'video', 'audio'], default: 'image' },
        url: { type: String },
    },
    { _id: false }
);

const questionSchema = new mongoose.Schema(
    {
        id: { type: String, required: true },
        text: { type: String, required: true },
        options: {
            type: [String],
            required: true,
            validate: [arr => arr.length >= 2, 'At least 2 options required'],
        },
        answerIndex: { type: Number, required: true },
        explanation: { type: String, default: '' },
        media: { type: mediaSchema, default: null },
    },
    { _id: false }
);

const markingSchema = new mongoose.Schema(
    {
        correct: { type: Number, default: 4 },
        incorrect: { type: Number, default: -1 },
    },
    { _id: false }
);

// ─── Main Exam Schema ────────────────────────────────────
const examSchema = new mongoose.Schema(
    {
        title: {
            type: String,
            required: [true, 'Exam title is required'],
            trim: true,
            maxlength: [200, 'Title cannot exceed 200 characters'],
        },
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        accessCode: {
            type: String,
            unique: true,
            uppercase: true,
        },
        maxStudents: {
            type: Number,
            required: [true, 'Max students is required'],
            min: [1, 'At least 1 student required'],
        },
        durationMinutes: {
            type: Number,
            required: [true, 'Duration is required'],
            min: [1, 'Duration must be at least 1 minute'],
        },
        startTime: {
            type: Date,
            required: [true, 'Start time is required'],
        },
        status: {
            type: String,
            enum: ['draft', 'scheduled', 'live', 'completed'],
            default: 'draft',
        },
        markingScheme: {
            type: markingSchema,
            default: () => ({ correct: 4, incorrect: -1 }),
        },
        questions: {
            type: [questionSchema],
            required: true,
            validate: [arr => arr.length >= 1, 'At least 1 question required'],
        },
        participants: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'User',
            },
        ],
    },
    {
        timestamps: true,
    }
);

// ─── Pre-save: Generate access code ─────────────────────
examSchema.pre('save', async function () {
    if (!this.accessCode) {
        // Generate unique 6-char alphanumeric code
        let code;
        let exists = true;
        while (exists) {
            code = crypto.randomBytes(3).toString('hex').toUpperCase();
            exists = await mongoose.model('Exam').findOne({ accessCode: code });
        }
        this.accessCode = code;
    }
});

// ─── Static: Strip answers from questions ────────────────
examSchema.statics.sanitizeQuestions = function (questions) {
    return questions.map(q => ({
        id: q.id,
        text: q.text,
        options: q.options,
        media: q.media || null,
    }));
};

const Exam = mongoose.model('Exam', examSchema);
export default Exam;
