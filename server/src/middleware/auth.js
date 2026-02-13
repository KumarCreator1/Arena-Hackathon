/**
 * Auth Middleware
 * 
 * Two middleware functions for Express route protection:
 *  - authenticate: Verify JWT from Authorization header
 *  - authorize:    Check user role against allowed roles
 * 
 * Usage in routes:
 *   router.get('/admin-only', authenticate, authorize('admin'), handler)
 *   router.get('/any-user',   authenticate, handler)
 */

import jwt from 'jsonwebtoken';
import User from '../models/User.js';

/**
 * Verify JWT token and attach user to request.
 * Expects: Authorization: Bearer <token>
 */
export const authenticate = async (req, res, next) => {
    try {
        // Extract token from header
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                message: 'Access denied — no token provided',
            });
        }

        const token = authHeader.split(' ')[1];

        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Fetch user (exclude password)
        const user = await User.findById(decoded.userId);
        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'User no longer exists',
            });
        }

        // Attach user to request for downstream handlers
        req.user = {
            userId: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
        };

        next();
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                success: false,
                message: 'Token expired — please login again',
            });
        }
        return res.status(401).json({
            success: false,
            message: 'Invalid token',
        });
    }
};

/**
 * Role-based authorization.
 * Must be used AFTER authenticate middleware.
 * 
 * @param  {...string} roles - Allowed roles (e.g., 'admin', 'student')
 */
export const authorize = (...roles) => {
    return (req, res, next) => {
        if (!req.user || !roles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                message: `Access denied — requires role: ${roles.join(' or ')}`,
            });
        }
        next();
    };
};
