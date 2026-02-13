import {
    JOIN_EXAM,
    LEAVE_EXAM,
    EXAM_START,
    EXAM_END,
    EXAM_STATE,
    EXAM_USER_JOINED,
    EXAM_USER_LEFT
} from '../constants/events.js';
import connectionManager from '../services/ConnectionManager.js';

export default (io, socket) => {
    // JOIN_EXAM: Student joins an exam room
    socket.on(JOIN_EXAM, ({ examId, device = 'laptop' }) => {
        // authenticated userId
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

        // Notify others in the room
        socket.to(roomName).emit(EXAM_USER_JOINED, {
            userId,
            device,
            examId,
            connectedAt: Date.now(),
        });
    });

    // LEAVE_EXAM
    socket.on(LEAVE_EXAM, () => {
        // Logic usually handled by disconnect, but explicit leave supported
        const user = connectionManager.removeUser(socket.id);
        if (user) {
            const roomName = `exam:${user.examId}`;
            socket.to(roomName).emit(EXAM_USER_LEFT, {
                userId: user.userId,
                device: user.device,
                examId: user.examId
            });
            socket.leave(roomName);
        }
    });

    // ADMIN CONTROLS (Protected by role check in socket.js middleware)

    // EXAM_START
    socket.on(EXAM_START, (examId) => {
        if (socket.user.role !== 'admin') return;
        const room = `exam:${examId}`;
        io.to(room).emit(EXAM_START, { timestamp: Date.now() });
        console.log(`Exam ${examId} started by admin`);
    });

    // EXAM_END
    socket.on(EXAM_END, (examId) => {
        if (socket.user.role !== 'admin') return;
        const room = `exam:${examId}`;
        io.to(room).emit(EXAM_END, { timestamp: Date.now() });
        console.log(`Exam ${examId} ended by admin`);
    });
};
