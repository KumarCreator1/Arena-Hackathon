/**
 * Auth Routes
 * 
 * POST /api/auth/register      — Create a new student (public)
 * POST /api/auth/login          — Authenticate and return JWT
 * GET  /api/auth/me             — Return current user (protected)
 * POST /api/auth/create-user    — Create user with any role (admin only)
 */

import { Router } from 'express';
import User from '../models/User.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();

/**
 * POST /api/auth/register
 * Body: { name, email, password }
 * Always creates a student — admins are created via /create-user
 */
router.post('/register', async (req, res) => {
    try {
        const { name, email, password } = req.body;

        // Validate input before touching the DB
        if (!name || !email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Name, email, and password are required',
            });
        }

        if (password.length < 6) {
            return res.status(400).json({
                success: false,
                message: 'Password must be at least 6 characters',
            });
        }

        // Check if user exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: 'Email already registered',
            });
        }

        // Create student (role is always 'student' on public registration)
        const user = await User.create({ name, email, password, role: 'student' });

        // Generate JWT — if this fails, roll back the user creation
        let token;
        try {
            token = user.generateToken();
        } catch (tokenError) {
            await User.findByIdAndDelete(user._id);
            console.error('Token generation failed, user rolled back:', tokenError);
            return res.status(500).json({
                success: false,
                message: 'Registration failed — please try again',
            });
        }

        res.status(201).json({
            success: true,
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
            },
        });
    } catch (error) {
        // Handle Mongoose validation errors
        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map((e) => e.message);
            return res.status(400).json({
                success: false,
                message: messages.join(', '),
            });
        }
        console.error('Register error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error during registration',
        });
    }
});

/**
 * POST /api/auth/login
 * Body: { email, password }
 */
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Please provide email and password',
            });
        }

        // Find user and explicitly include password field
        const user = await User.findOne({ email }).select('+password');
        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials',
            });
        }

        // Verify password
        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials',
            });
        }

        // Generate JWT
        const token = user.generateToken();

        res.json({
            success: true,
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
            },
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error during login',
        });
    }
});

/**
 * GET /api/auth/me
 * Protected — requires valid JWT
 */
router.get('/me', authenticate, (req, res) => {
    res.json({
        success: true,
        user: req.user,
    });
});

/**
 * POST /api/auth/create-user
 * Body: { name, email, password, role }
 * Admin-only — creates a user with any role
 */
router.post('/create-user', authenticate, authorize('admin'), async (req, res) => {
    try {
        const { name, email, password, role } = req.body;

        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: 'Email already registered',
            });
        }

        const user = await User.create({ name, email, password, role });
        const token = user.generateToken();

        res.status(201).json({
            success: true,
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
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
        console.error('Create user error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error during user creation',
        });
    }
});

export default router;
