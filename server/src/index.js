import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { initSocket } from './socket.js';
import connectionManager from './services/ConnectionManager.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Create HTTP server (required for Socket.io attachment)
const httpServer = createServer(app);

// Middleware
app.use(cors());
app.use(express.json());

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

// Start server
httpServer.listen(PORT, () => {
    console.log(`🚀 Parallax Server listening on port ${PORT}`);
});

export default app;
