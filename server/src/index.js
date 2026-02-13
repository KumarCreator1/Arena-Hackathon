import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createServer } from 'http';
import connectDB from './config/db.js';
import { initSocket } from './socket.js';
import connectionManager from './services/ConnectionManager.js';
import authRoutes from './routes/auth.routes.js';
import examRoutes from './routes/exam.routes.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Create HTTP server (required for Socket.io attachment)
const httpServer = createServer(app);

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ─── Routes ─────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/exams', examRoutes);

// Health check (includes live connection stats)
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        service: 'parallax-server',
        timestamp: new Date().toISOString(),
        connections: connectionManager.getStats(),
    });
});

// Initialize Socket.io on the HTTP server
initSocket(httpServer);

// Connect to MongoDB, then start server
connectDB().then(() => {
    httpServer.listen(PORT, () => {
        console.log(`🚀 Parallax Server listening on port ${PORT}`);
    });
});

export default app;
