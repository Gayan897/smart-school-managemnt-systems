/**
 * OfflineBanner.tsx
 * ─────────────────────────────────────────────────────────────────
 * A smart status banner that shows offline / syncing / synced states.
 * Designed to be dropped at the top of any data-entry screen.
 * ─────────────────────────────────────────────────────────────────
 */

import { useEffect, useState } from 'react';
import { WifiOff, RefreshCw, CheckCircle2, AlertTriangle, CloudUpload } from 'lucide-react';
import type { NetworkStatus } from '../utils/useNetworkStatus';

interface OfflineBannerProps {
  networkStatus: NetworkStatus;
}

export default function OfflineBanner({ networkStatus }: OfflineBannerProps) {
  const { isOnline, isSyncing, lastSyncedAt, pendingCount, syncError } = networkStatus;

  // Show "Synced!" briefly after coming back online
  const [showSyncedMsg, setShowSyncedMsg] = useState(false);
  const [prevSyncedAt, setPrevSyncedAt] = useState<string | null>(lastSyncedAt);

  useEffect(() => {
    if (lastSyncedAt && lastSyncedAt !== prevSyncedAt) {
      setPrevSyncedAt(lastSyncedAt);
      setShowSyncedMsg(true);
      const t = setTimeout(() => setShowSyncedMsg(false), 4000);
      return () => clearTimeout(t);
    }
  }, [lastSyncedAt, prevSyncedAt]);

  // Nothing to show when fully online, nothing pending, no recent sync
  if (isOnline && !isSyncing && !showSyncedMsg && pendingCount === 0 && !syncError) {
    return null;
  }

  // ── Determine banner state ────────────────────────────────────
  let bgColor: string;
  let borderColor: string;
  let icon: React.ReactNode;
  let title: string;
  let subtitle: string;

  if (!isOnline) {
    bgColor = 'rgba(245, 158, 11, 0.12)';
    borderColor = 'rgba(245, 158, 11, 0.5)';
    icon = <WifiOff size={16} style={{ color: '#f59e0b', flexShrink: 0 }} />;
    title = 'You are offline';
    subtitle = pendingCount > 0
      ? `${pendingCount} change${pendingCount !== 1 ? 's' : ''} saved locally — will sync automatically when reconnected`
      : 'Data entry is still available. Changes will sync when internet is restored.';
  } else if (isSyncing) {
    bgColor = 'rgba(99, 102, 241, 0.12)';
    borderColor = 'rgba(99, 102, 241, 0.5)';
    icon = <RefreshCw size={16} style={{ color: '#6366f1', flexShrink: 0, animation: 'spin 1.2s linear infinite' }} />;
    title = 'Syncing offline data…';
    subtitle = `Uploading ${pendingCount} pending record${pendingCount !== 1 ? 's' : ''} to the server`;
  } else if (syncError) {
    bgColor = 'rgba(239, 68, 68, 0.10)';
    borderColor = 'rgba(239, 68, 68, 0.45)';
    icon = <AlertTriangle size={16} style={{ color: '#ef4444', flexShrink: 0 }} />;
    title = 'Sync error';
    subtitle = pendingCount > 0
      ? `${pendingCount} records still pending. Will retry automatically.`
      : syncError;
  } else if (showSyncedMsg) {
    bgColor = 'rgba(16, 185, 129, 0.10)';
    borderColor = 'rgba(16, 185, 129, 0.45)';
    icon = <CheckCircle2 size={16} style={{ color: '#10b981', flexShrink: 0 }} />;
    title = 'All data synced ✅';
    subtitle = 'Offline records have been saved to the server successfully';
  } else if (pendingCount > 0) {
    // Online but still has items in queue (edge case)
    bgColor = 'rgba(245, 158, 11, 0.10)';
    borderColor = 'rgba(245, 158, 11, 0.4)';
    icon = <CloudUpload size={16} style={{ color: '#f59e0b', flexShrink: 0 }} />;
    title = 'Pending sync';
    subtitle = `${pendingCount} record${pendingCount !== 1 ? 's' : ''} queued — reconnecting will trigger sync`;
  } else {
    return null;
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '10px',
        padding: '10px 16px',
        marginBottom: '16px',
        borderRadius: '10px',
        background: bgColor,
        border: `1px solid ${borderColor}`,
        backdropFilter: 'blur(6px)',
        animation: 'fadeInDown 0.3s ease',
      }}
    >
      <div style={{ marginTop: '1px' }}>{icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: '13px',
          fontWeight: 600,
          color: 'var(--text-primary)',
          lineHeight: 1.3,
        }}>
          {title}
        </div>
        <div style={{
          fontSize: '12px',
          color: 'var(--text-secondary)',
          marginTop: '2px',
          lineHeight: 1.4,
        }}>
          {subtitle}
        </div>
      </div>
    </div>
  );
}
