
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

export interface QueuedOperation{
  
  id: string;

  queuedAt: string;

  retries: number;
 
  payload: QueuedPayload;
}

//Storage Key 

const STORAGE_KEY = 'sams_offline_queue';

//Helpers

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

export function dequeueAll(): QueuedOperation[] {
  const ops = readQueue();
  writeQueue([]);
  return ops;
}

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


export function peekQueue(): QueuedOperation[] {
  return readQueue();
}
