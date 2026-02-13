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

// ─── Phase 2: Device Tethering ───────────────────────────────
// export const TETHER_REQUEST = 'tether:request';
// export const TETHER_CONNECTED = 'tether:connected';
// export const TETHER_DISCONNECTED = 'tether:disconnected';
// export const TETHER_STATUS = 'tether:status';

// ─── Phase 3: AI Violation Events ────────────────────────────
// export const VIOLATION_DETECTED = 'violation:detected';
// export const VIOLATION_RESOLVED = 'violation:resolved';

// ─── Phase 4: Laptop Security ────────────────────────────────
// export const SECURITY_TAB_SWITCH = 'security:tab_switch';
// export const SECURITY_FULLSCREEN_EXIT = 'security:fullscreen_exit';
// export const SECURITY_VM_DETECTED = 'security:vm_detected';

// ─── Phase 5: Admin / Trust Score ────────────────────────────
// export const TRUST_UPDATE = 'trust:update';
// export const ADMIN_WARN = 'admin:warn';
// export const ADMIN_TERMINATE = 'admin:terminate';
// export const ADMIN_PAUSE = 'admin:pause';
// export const ADMIN_RESUME = 'admin:resume';

// ─── Phase 6: Resilience ─────────────────────────────────────
// export const RECONNECT_REQUEST = 'reconnect:request';
// export const RECONNECT_VERIFIED = 'reconnect:verified';
// export const DEVICE_DROP = 'device:drop';
