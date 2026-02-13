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
import connectionManager from './services/ConnectionManager.js';
import {
    JOIN_EXAM,
    LEAVE_EXAM,
    EXAM_STATE,
    EXAM_USER_JOINED,
    EXAM_USER_LEFT,
} from './constants/events.js';

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

    examNamespace.on('connection', (socket) => {
        console.log(`📡 [/exam] Connected: ${socket.id}`);

        /**
         * JOIN_EXAM — Student joins an exam room.
         * Payload: { userId, examId, device? }
         */
        socket.on(JOIN_EXAM, ({ userId, examId, device = 'laptop' }) => {
            if (!userId || !examId) {
                socket.emit('error', { message: 'userId and examId are required' });
                return;
            }

            const roomName = `exam:${examId}`;

            // Register in connection manager
            connectionManager.addUser(socket.id, {
                userId,
                role: 'student',
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

    adminNamespace.on('connection', (socket) => {
        console.log(`🛡️  [/admin] Connected: ${socket.id}`);

        // Register admin in connection manager
        connectionManager.addUser(socket.id, {
            userId: `admin-${socket.id}`,
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
