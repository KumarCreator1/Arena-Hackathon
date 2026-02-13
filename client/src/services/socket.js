import { io } from 'socket.io-client';

const URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

let socket;

export const connectSocket = (token) => {
    if (socket?.connected) return socket;

    socket = io(`${URL}/exam`, {
        auth: { token },
        transports: ['websocket'],
        reconnection: true,
    });

    socket.on('connect', () => {
        console.log('✅ Socket connected:', socket.id);
    });

    socket.on('connect_error', (err) => {
        console.error('❌ Socket connection error:', err.message);
    });

    return socket;
};

export const getSocket = () => {
    if (!socket) {
        throw new Error('Socket not initialized. Call connectSocket first.');
    }
    return socket;
};

export const disconnectSocket = () => {
    if (socket) {
        socket.disconnect();
        socket = null;
    }
};
