import {
    MOBILE_JOIN,
    MOBILE_CONNECTED,
    VIOLATION_ALERT,
    VIOLATION_DETECTED
} from '../constants/events.js';

export default (io, socket) => {
    // MOBILE_JOIN: Mobile device joins a session room
    socket.on(MOBILE_JOIN, (sessionId) => {
        if (!sessionId) return;
        const room = `session:${sessionId}`;
        socket.join(room);

        // Notify the laptop that mobile has connected
        io.to(room).emit(MOBILE_CONNECTED, { deviceId: socket.id });
        console.log(`📱 Mobile ${socket.id} joined session ${room}`);
    });

    // Laptop joins the same session room to listen for mobile events
    // We can reuse MOBILE_JOIN or a specific 'session:join' event. 
    // For simplicity, let's use the same room logic but maybe a different event if needed.
    // Actually, the laptop generates the session ID and listens.
    socket.on('session:join', (sessionId) => {
        if (!sessionId) return;
        const room = `session:${sessionId}`;
        socket.join(room);
        console.log(`💻 Laptop ${socket.id} joined session ${room}`);
    });

    // VIOLATION_ALERT: Mobile sends a violation
    socket.on(VIOLATION_ALERT, (data) => {
        // data: { sessionId, violation, confidence, timestamp, examId }
        const { sessionId, ...rest } = data;
        const room = `session:${sessionId}`;

        // Forward to laptop
        io.to(room).emit(VIOLATION_DETECTED, rest);

        // Forward to Admin Monitor if examId is present
        if (data.examId) {
            // We assume admin joins room `monitor:${examId}`
            io.to(`monitor:${data.examId}`).emit(VIOLATION_DETECTED, {
                sessionId,
                userId: socket.user ? socket.user.userId : 'anonymous-mobile', // Mobile might not be auth'd as user yet? 
                // Actually mobile should be auth'd ideally, but for now it might just have the token from QR.
                ...rest
            });
        }
    });
};
