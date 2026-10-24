import React, { useEffect, useRef, useState } from 'react';
import { useAppSelector, useAppDispatch } from '../store';
import { dequeueOfflineMutation } from '../store/uiSlice';
import { apiPostDirect } from '../api';
import { useApp } from '../context/AppContext';

export const OfflineSyncManager: React.FC = () => {
  const dispatch = useAppDispatch();
  const queue = useAppSelector((state) => state.ui.offlineQueue || []);
  const { refresh, showToast } = useApp();
  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const isFlushingRef = useRef(false);

  // Monitor browser online/offline events
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Flush queued mutations sequentially when online
  useEffect(() => {
    if (!isOnline || queue.length === 0 || isFlushingRef.current) return;

    const flushQueue = async () => {
      isFlushingRef.current = true;
      let syncedCount = 0;

      for (const item of queue) {
        if (!navigator.onLine) break;
        try {
          await apiPostDirect(item.endpoint, item.body);
          dispatch(dequeueOfflineMutation(item.id));
          syncedCount++;
        } catch (err: any) {
          // If still offline/network error, stop flushing and wait for reconnect
          const isNet =
            !navigator.onLine ||
            err?.name === 'TypeError' ||
            String(err?.message || '').toLowerCase().includes('failed to fetch');
          if (isNet) {
            break;
          } else {
            // Bad payload or 4xx, remove from queue so it does not block the pipeline
            dispatch(dequeueOfflineMutation(item.id));
          }
        }
      }

      if (syncedCount > 0) {
        showToast(`Back online — synced ${syncedCount} offline change${syncedCount > 1 ? 's' : ''}!`);
        await refresh();
      }

      isFlushingRef.current = false;
    };

    flushQueue();
  }, [isOnline, queue, dispatch, refresh, showToast]);

  // If online and queue is empty, render nothing
  if (isOnline && queue.length === 0) return null;

  return (
    <div
      className="offline-status-pill"
      style={{
        position: 'fixed',
        bottom: 'calc(var(--mobile-nav-height, 58px) + 12px)',
        left: 16,
        zIndex: 9990,
        background: 'rgba(15, 23, 42, 0.94)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        border: '1px solid rgba(245, 158, 11, 0.4)',
        borderRadius: 20,
        padding: '6px 14px',
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5), 0 0 12px rgba(245, 158, 11, 0.2)',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        fontSize: '0.8rem',
        fontWeight: 600,
        color: '#fef3c7',
        pointerEvents: 'none',
        animation: 'crDrawerFadeIn 0.2s ease-out',
      }}
    >
      <i
        className={isOnline ? 'fas fa-rotate fa-spin' : 'fas fa-wifi-slash'}
        style={{ color: '#f59e0b', fontSize: '0.85rem' }}
      />
      <span>
        {!isOnline
          ? `Working offline${queue.length > 0 ? ` (${queue.length} saved)` : ''}`
          : `Syncing ${queue.length} offline change${queue.length > 1 ? 's' : ''}…`}
      </span>
    </div>
  );
};
