/**
 * useNetworkStatus.ts
 * ───────────────────────────────────────────────────────────────────
 * React hook that tracks online/offline connectivity status.
 *
 * - Returns real-time `isOnline` boolean.
 * - Returns `pendingCount` — the number of operations waiting to sync.
 * - Returns `isSyncing` — true while the replay is in progress.
 * - Automatically triggers `databaseService.replayOfflineQueue()` the
 *   moment the browser transitions back to online.
 * ───────────────────────────────────────────────────────────────────
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { getQueueLength } from '../data/offlineQueue';

export interface NetworkStatus {
  isOnline: boolean;
  isSyncing: boolean;
  lastSyncedAt: string | null;
  pendingCount: number;
  syncError: string | null;
}

/**
 * Accepts an optional `onReplay` callback that will be called when
 * connectivity is restored — this is how the App root triggers a
 * Firestore queue flush without creating a circular dependency.
 */
export function useNetworkStatus(onReplay?: () => Promise<unknown>): NetworkStatus {
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [pendingCount, setPendingCount] = useState<number>(getQueueLength());
  const [syncError, setSyncError] = useState<string | null>(null);

  // Track if replay has already been triggered for this online transition
  const replayLock = useRef(false);

  const refreshPendingCount = useCallback(() => {
    setPendingCount(getQueueLength());
  }, []);

  const handleOnline = useCallback(async () => {
    setIsOnline(true);
    if (replayLock.current) return;
    const count = getQueueLength();
    if (count === 0 || !onReplay) return;

    replayLock.current = true;
    setIsSyncing(true);
    setSyncError(null);

    try {
      await onReplay();
      setLastSyncedAt(new Date().toISOString());
      setPendingCount(getQueueLength());
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[useNetworkStatus] Replay failed:', msg);
      setSyncError(msg);
      setPendingCount(getQueueLength());
    } finally {
      setIsSyncing(false);
      replayLock.current = false;
    }
  }, [onReplay]);

  const handleOffline = useCallback(() => {
    setIsOnline(false);
    replayLock.current = false;
  }, []);

  useEffect(() => {
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Poll pending count every 3 s (covers cases where the queue is
    // updated from other code paths without a connectivity event)
    const intervalId = setInterval(refreshPendingCount, 3000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(intervalId);
    };
  }, [handleOnline, handleOffline, refreshPendingCount]);

  return { isOnline, isSyncing, lastSyncedAt, pendingCount, syncError };
}
