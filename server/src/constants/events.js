/**
 * Socket.io Event Constants
 * 
 * Centralized event names for all real-time communication.
 * Grouped by domain — new events are added here as phases progress.
 */

// ─── Connection Events ───────────────────────────────────────
export const CONNECTION = 'connection';
export const DISCONNECT = 'disconnect';
export const CONNECT_ERROR = 'connect_error';

// ─── Exam Lifecycle ──────────────────────────────────────────
export const JOIN_EXAM = 'exam:join';
export const LEAVE_EXAM = 'exam:leave';
export const EXAM_STATE = 'exam:state';
export const EXAM_USER_JOINED = 'exam:user_joined';
export const EXAM_USER_LEFT = 'exam:user_left';
export const EXAM_START = 'exam:start';
export const EXAM_END = 'exam:end';

// ─── Phase 2+: Device Tethering & Mobile ─────────────────────
export const MOBILE_JOIN = 'mobile:join';
export const MOBILE_CONNECTED = 'mobile:connected';

// ─── Phase 3: AI Violation Events ────────────────────────────
export const VIOLATION_ALERT = 'violation:alert';
export const VIOLATION_DETECTED = 'violation:detected'; // For admin/laptop
