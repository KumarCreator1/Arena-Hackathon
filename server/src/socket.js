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
import examHandler from './socket/examHandler.js';
import mobileHandler from './socket/mobileHandler.js';
import { EXAM_STATE, EXAM_USER_LEFT } from './constants/events.js';

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

export function initSocket(httpServer) {
    io = new Server(httpServer, {
        cors: {
            origin: process.env.CLIENT_URL || 'http://localhost:5173',
            methods: ['GET', 'POST'],
        },
        pingTimeout: 60000,
        pingInterval: 25000,
    });

    // ─── /exam Namespace ─────────────────────────────────────
    const examNamespace = io.of('/exam');
    examNamespace.use(socketAuthMiddleware);

    examNamespace.on('connection', (socket) => {
        console.log(`📡 [/exam] Connected: ${socket.id} (${socket.user.userId})`);

        // Attach modules
        examHandler(examNamespace, socket);
        mobileHandler(examNamespace, socket);

        socket.on('disconnect', (reason) => {
            console.log(`📡 [/exam] Disconnected: ${socket.id} (${reason})`);
            const user = connectionManager.removeUser(socket.id);

            if (user) {
                const roomName = `exam:${user.examId}`;
                socket.to(roomName).emit(EXAM_USER_LEFT, {
                    userId: user.userId,
                    device: user.device,
                    examId: user.examId,
                });
                socket.leave(roomName);
            }
        });
    });

    // ─── /admin Namespace ────────────────────────────────────
    const adminNamespace = io.of('/admin');
    adminNamespace.use(socketAuthMiddleware);

    adminNamespace.use((socket, next) => {
        if (socket.user.role !== 'admin') {
            return next(new Error('Access denied — admin role required'));
        }
        next();
    });

    adminNamespace.on('connection', (socket) => {
        console.log(`🛡️  [/admin] Connected: ${socket.id}`);

        connectionManager.addUser(socket.id, {
            userId: socket.user.userId,
            role: 'admin',
        });

        socket.emit(EXAM_STATE, {
            stats: connectionManager.getStats(),
            message: 'Admin connected — receiving live updates',
        });

        // TODO: Admin monitor rooms logic if needed
        // e.g. socket.join('monitor:<examId>') 

        socket.on('disconnect', (reason) => {
            console.log(`🛡️  [/admin] Disconnected: ${socket.id} (${reason})`);
            connectionManager.removeUser(socket.id);
        });
    });

    console.log('🔌 Socket.io initialized with /exam and /admin namespaces');
    return io;
}

export function getIO() {
    if (!io) throw new Error('Socket.io not initialized');
    return io;
}
