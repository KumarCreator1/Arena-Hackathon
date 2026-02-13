/**
 * ConnectionManager — Tracks all active Socket.io connections.
 * 
 * Central registry of who's connected, their role, device type,
 * and which exam room they belong to. In-memory Map for now,
 * designed with a clean interface for future Redis migration.
 * 
 * Used across phases:
 *  - P2: Tether status (is mobile connected alongside laptop?)
 *  - P5: Admin dashboard (who's online in which exam?)
 *  - P6: Reconnect detection (was this user previously connected?)
 */

class ConnectionManager {
    constructor() {
        /** @type {Map<string, UserConnection>} socketId → user info */
        this._connections = new Map();
    }

    /**
     * Register a new connection.
     * @param {string} socketId
     * @param {object} params
     * @param {string} params.userId
     * @param {string} params.role      - 'student' | 'admin'
     * @param {string} [params.examId]  - exam room the user is joining
     * @param {string} [params.device]  - 'laptop' | 'mobile' (for future tethering)
     */
    addUser(socketId, { userId, role, examId = null, device = 'laptop' }) {
        this._connections.set(socketId, {
            socketId,
            userId,
            role,
            examId,
            device,
            connectedAt: Date.now(),
        });
    }

    /**
     * Remove a connection on disconnect.
     * @param {string} socketId
     * @returns {object|null} The removed user info, or null if not found.
     */
    removeUser(socketId) {
        const user = this._connections.get(socketId);
        if (user) {
            this._connections.delete(socketId);
        }
        return user || null;
    }

    /**
     * Get info about a specific connection.
     * @param {string} socketId
     * @returns {object|null}
     */
    getUser(socketId) {
        return this._connections.get(socketId) || null;
    }

    /**
     * Get all users in a specific exam room.
     * @param {string} examId
     * @returns {object[]}
     */
    getUsersByExam(examId) {
        const users = [];
        for (const user of this._connections.values()) {
            if (user.examId === examId) {
                users.push(user);
            }
        }
        return users;
    }

    /**
     * Get all users with a specific role.
     * @param {string} role - 'student' | 'admin'
     * @returns {object[]}
     */
    getUsersByRole(role) {
        const users = [];
        for (const user of this._connections.values()) {
            if (user.role === role) {
                users.push(user);
            }
        }
        return users;
    }

    /**
     * Total number of active connections.
     * @returns {number}
     */
    getConnectedCount() {
        return this._connections.size;
    }

    /**
     * Summary snapshot — useful for health check / debugging.
     * @returns {object}
     */
    getStats() {
        let students = 0;
        let admins = 0;
        const exams = new Set();

        for (const user of this._connections.values()) {
            if (user.role === 'student') students++;
            if (user.role === 'admin') admins++;
            if (user.examId) exams.add(user.examId);
        }

        return {
            total: this._connections.size,
            students,
            admins,
            activeExams: exams.size,
        };
    }
}

// Singleton instance — shared across the server
const connectionManager = new ConnectionManager();
export default connectionManager;
