/**
 * Socket.io Server Setup
 * 
 * Initializes Socket.io with two namespaces:
 *  - /exam  → Student connections (laptop & mobile devices)
 *  - /admin → Proctor/Admin connections (dashboard)
 * 
 * Each namespace has its own connection handlers. Rooms are used
 * within /exam to scope events per exam session (exam:<examId>).
 */

import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import connectionManager from './services/ConnectionManager.js';
import {
    JOIN_EXAM,
    LEAVE_EXAM,
    EXAM_STATE,
    EXAM_USER_JOINED,
    EXAM_USER_LEFT,
} from './constants/events.js';

/**
 * Socket.io JWT Authentication Middleware
 * Verifies token from socket.handshake.auth.token
 * Attaches decoded user to socket.user
 */
function socketAuthMiddleware(socket, next) {
    const token = socket.handshake.auth?.token;

    if (!token) {
        return next(new Error('Authentication required — provide token in handshake auth'));
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        socket.user = { userId: decoded.userId, role: decoded.role };
        next();
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return next(new Error('Token expired — please login again'));
        }
        return next(new Error('Invalid token'));
    }
}

/** @type {Server} */
let io;

/**
 * Initialize Socket.io on the given HTTP server.
 * @param {import('http').Server} httpServer
 * @returns {Server}
 */
export function initSocket(httpServer) {
    io = new Server(httpServer, {
        cors: {
            origin: process.env.CLIENT_URL || 'http://localhost:5173',
            methods: ['GET', 'POST'],
        },
        // Reconnect-friendly settings (Phase 6 groundwork)
        pingTimeout: 60000,
        pingInterval: 25000,
    });

    // ─── /exam Namespace ─────────────────────────────────────
    const examNamespace = io.of('/exam');
    examNamespace.use(socketAuthMiddleware);

    examNamespace.on('connection', (socket) => {
        console.log(`📡 [/exam] Connected: ${socket.id}`);

        /**
         * JOIN_EXAM — Student joins an exam room.
         * Payload: { userId, examId, device? }
         */
        socket.on(JOIN_EXAM, ({ examId, device = 'laptop' }) => {
            // userId comes from authenticated JWT, not client payload
            const userId = socket.user.userId;

            if (!examId) {
                socket.emit('error', { message: 'examId is required' });
                return;
            }

            const roomName = `exam:${examId}`;

            // Register in connection manager
            connectionManager.addUser(socket.id, {
                userId,
                role: socket.user.role,
                examId,
                device,
            });

            // Join the exam room
            socket.join(roomName);

            console.log(`📝 [/exam] ${userId} (${device}) joined room ${roomName}`);

            // Get current room roster
            const roomUsers = connectionManager.getUsersByExam(examId);

            // Confirm to the joining user
            socket.emit(EXAM_STATE, {
                examId,
                users: roomUsers.map((u) => ({
                    userId: u.userId,
                    device: u.device,
                    connectedAt: u.connectedAt,
                })),
                message: `Joined exam ${examId}`,
            });

            // Notify others in the room (including admin listeners)
            socket.to(roomName).emit(EXAM_USER_JOINED, {
                userId,
                device,
                examId,
                connectedAt: Date.now(),
            });

            // Also broadcast to admin namespace
            adminNamespace.emit(EXAM_USER_JOINED, {
                userId,
                device,
                examId,
                totalInRoom: roomUsers.length,
            });
        });

        /**
         * LEAVE_EXAM — Student explicitly leaves (before disconnect).
         */
        socket.on(LEAVE_EXAM, () => {
            handleExamDisconnect(socket, examNamespace);
        });

        /**
         * disconnect — Cleanup when socket drops.
         */
        socket.on('disconnect', (reason) => {
            console.log(`📡 [/exam] Disconnected: ${socket.id} (${reason})`);
            handleExamDisconnect(socket, examNamespace);
        });
    });

    // ─── /admin Namespace ────────────────────────────────────
    const adminNamespace = io.of('/admin');
    adminNamespace.use(socketAuthMiddleware);

    // Additional check: only 'admin' role can connect to /admin namespace
    adminNamespace.use((socket, next) => {
        if (socket.user.role !== 'admin') {
            return next(new Error('Access denied — admin role required'));
        }
        next();
    });

    adminNamespace.on('connection', (socket) => {
        console.log(`🛡️  [/admin] Connected: ${socket.id} (user: ${socket.user.userId})`);

        // Register admin in connection manager
        connectionManager.addUser(socket.id, {
            userId: socket.user.userId,
            role: 'admin',
        });

        // Send current system stats on connect
        socket.emit(EXAM_STATE, {
            stats: connectionManager.getStats(),
            message: 'Admin connected — receiving live updates',
        });

        socket.on('disconnect', (reason) => {
            console.log(`🛡️  [/admin] Disconnected: ${socket.id} (${reason})`);
            connectionManager.removeUser(socket.id);
        });
    });

    console.log('🔌 Socket.io initialized with /exam and /admin namespaces');
    return io;
}

/**
 * Handle a student leaving or disconnecting from an exam.
 * Cleans up ConnectionManager and notifies the room + admin.
 */
function handleExamDisconnect(socket, examNamespace) {
    const user = connectionManager.removeUser(socket.id);
    if (!user) return;

    const roomName = `exam:${user.examId}`;

    // Notify remaining students in the room
    socket.to(roomName).emit(EXAM_USER_LEFT, {
        userId: user.userId,
        device: user.device,
        examId: user.examId,
    });

    // Notify admin namespace
    const adminNs = io.of('/admin');
    adminNs.emit(EXAM_USER_LEFT, {
        userId: user.userId,
        device: user.device,
        examId: user.examId,
        remainingInRoom: connectionManager.getUsersByExam(user.examId).length,
    });

    // Leave the room
    socket.leave(roomName);
}

/**
 * Get the Socket.io server instance (for use in route handlers).
 * @returns {Server}
 */
export function getIO() {
    if (!io) throw new Error('Socket.io not initialized — call initSocket first');
    return io;
}
