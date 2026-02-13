/**
 * User Model
 * 
 * Schema: name, email, password, role (student|admin)
 * 
 * Features:
 *  - Pre-save hook: bcrypt password hashing
 *  - Instance method: comparePassword() for login verification
 *  - Instance method: generateToken() for JWT creation
 * 
 * Future extensions:
 *  - P2: deviceId field for tether pairing
 *  - P5: trustScore field for admin dashboard
 *  - P6: examState field for resume tokens
 */

import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const userSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, 'Name is required'],
            trim: true,
            maxlength: [50, 'Name cannot exceed 50 characters'],
        },
        email: {
            type: String,
            required: [true, 'Email is required'],
            unique: true,
            lowercase: true,
            trim: true,
            match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email'],
        },
        password: {
            type: String,
            required: [true, 'Password is required'],
            minlength: [6, 'Password must be at least 6 characters'],
            select: false, // Never return password in queries by default
        },
        role: {
            type: String,
            enum: ['student', 'admin'],
            default: 'student',
        },
        // ── Future Phase Fields (uncomment when needed) ──
        // deviceId: { type: String },        // P2: tethered mobile device
        // trustScore: { type: Number },       // P5: integrity score
        // examState: { type: Object },        // P6: resume token state
    },
    {
        timestamps: true, // createdAt, updatedAt
    }
);

// ─── Pre-save: Hash password ──────────────────────────────
userSchema.pre('save', async function () {
    // Only hash if password was modified (not on every save)
    if (!this.isModified('password')) return;

    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
});

// ─── Compare password for login ───────────────────────────
userSchema.methods.comparePassword = async function (candidatePassword) {
    return bcrypt.compare(candidatePassword, this.password);
};

// ─── Generate JWT ─────────────────────────────────────────
userSchema.methods.generateToken = function () {
    return jwt.sign(
        { userId: this._id, role: this.role },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRE || '6h' }
    );
};

const User = mongoose.model('User', userSchema);
export default User;
