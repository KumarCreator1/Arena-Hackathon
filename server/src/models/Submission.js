import mongoose from 'mongoose';

const submissionSchema = new mongoose.Schema({
    exam: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Exam',
        required: true,
    },
    student: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    answers: {
        // Map of question index (string) to selected option index (number)
        type: Map,
        of: Number,
        required: true,
    },
    score: {
        type: Number,
        required: true,
    },
    totalMarks: {
        type: Number,
        required: true,
    },
    flags: {
        type: Number,
        default: 0, // Trust Score violations count (future proofing)
    },
    submittedAt: {
        type: Date,
        default: Date.now,
    },
});

// Prevent multiple submissions for same exam/student
submissionSchema.index({ exam: 1, student: 1 }, { unique: true });

export default mongoose.model('Submission', submissionSchema);
