/**
 * offlineQueue.ts
 * ───────────────────────────────────────────────────────────────────
 * Lightweight localStorage-backed queue for Firestore write operations
 * that are attempted while the device is offline (or Firestore is
 * temporarily unreachable).
 *
 * Each operation is stored as a plain JSON-serialisable object.
 * On reconnection, `replayOfflineQueue()` in database.ts drains this
 * queue and re-submits every pending operation to Firestore.
 *
 * The queue survives page reloads — data is never lost.
 * ───────────────────────────────────────────────────────────────────
 */

import type { AttendanceRecord, TermMark, LeaveRequest, Student } from './models';

// ─── Queue Operation Types ───────────────────────────────────────────────────

export type QueuedOpType =
  | 'saveAttendance'
  | 'saveTermMarks'
  | 'insertLeaveRequest'
  | 'updateLeaveRequest';

export interface QueuedSaveAttendance {
  type: 'saveAttendance';
  records: AttendanceRecord[];
  teacherName: string;
  studentMap: Record<string, Student>;
}

export interface QueuedSaveTermMarks {
  type: 'saveTermMarks';
  marks: TermMark[];
}

export interface QueuedInsertLeaveRequest {
  type: 'insertLeaveRequest';
  request: LeaveRequest;
}

export interface QueuedUpdateLeaveRequest {
  type: 'updateLeaveRequest';
  request: LeaveRequest;
}

export type QueuedPayload =
  | QueuedSaveAttendance
  | QueuedSaveTermMarks
  | QueuedInsertLeaveRequest
  | QueuedUpdateLeaveRequest;

export interface QueuedOperation {
  /** Unique operation identifier */
  id: string;
  /** ISO timestamp of when the operation was queued */
  queuedAt: string;
  /** Number of replay attempts (informational) */
  retries: number;
  /** The actual operation data */
  payload: QueuedPayload;
}

// ─── Storage Key ─────────────────────────────────────────────────────────────

const STORAGE_KEY = 'sams_offline_queue';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function readQueue(): QueuedOperation[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as QueuedOperation[];
  } catch {
    return [];
  }
}

function writeQueue(ops: QueuedOperation[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ops));
  } catch (e) {
    console.warn('[OfflineQueue] Failed to persist queue to localStorage:', e);
  }
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Add a new operation to the offline queue.
 * Returns the ID of the newly queued operation.
 */
export function enqueueOperation(payload: QueuedPayload): string {
  const id = `oq_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const op: QueuedOperation = {
    id,
    queuedAt: new Date().toISOString(),
    retries: 0,
    payload,
  };
  const existing = readQueue();
  writeQueue([...existing, op]);
  console.info(`[OfflineQueue] Enqueued operation: ${payload.type} (id=${id})`);
  return id;
}

/**
 * Return all pending operations and clear the queue.
 * The caller is responsible for re-enqueueing any that fail.
 */
export function dequeueAll(): QueuedOperation[] {
  const ops = readQueue();
  writeQueue([]);
  return ops;
}

/**
 * Re-enqueue a single operation (e.g., if replay failed).
 * Increments the retry counter.
 */
export function requeueOperation(op: QueuedOperation): void {
  const existing = readQueue();
  const updated: QueuedOperation = { ...op, retries: op.retries + 1 };
  writeQueue([...existing, updated]);
}

/**
 * Return the number of operations currently waiting to sync.
 */
export function getQueueLength(): number {
  return readQueue().length;
}

/**
 * Peek at the queue without consuming it.
 */
export function peekQueue(): QueuedOperation[] {
  return readQueue();
}
