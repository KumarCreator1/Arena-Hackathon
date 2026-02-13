/**
 * API Service
 * 
 * Lightweight fetch wrapper with JWT auto-attach.
 * All API calls go through the Vite proxy (/api → localhost:5000).
 */

const API_BASE = '/api';

/**
 * Make an API request with automatic JWT attachment.
 */
async function request(endpoint, options = {}) {
    const token = localStorage.getItem('parallax_token');

    const config = {
        headers: {
            'Content-Type': 'application/json',
            ...(token && { Authorization: `Bearer ${token}` }),
            ...options.headers,
        },
        ...options,
    };

    const response = await fetch(`${API_BASE}${endpoint}`, config);
    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.message || 'Something went wrong');
    }

    return data;
}

export const api = {
    get: (endpoint) => request(endpoint, { method: 'GET' }),

    post: (endpoint, body) =>
        request(endpoint, {
            method: 'POST',
            body: JSON.stringify(body),
        }),

    put: (endpoint, body) =>
        request(endpoint, {
            method: 'PUT',
            body: JSON.stringify(body),
        }),

    delete: (endpoint) => request(endpoint, { method: 'DELETE' }),
};

export default api;
