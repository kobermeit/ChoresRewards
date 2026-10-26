import React, { useCallback, useEffect, useRef } from 'react';
import { useAppSelector, useAppDispatch } from '../store';
import { dequeueOfflineMutation } from '../store/uiSlice';
import { ApiError, apiPostDirect, notifyNetworkFailure } from '../api';
import { useApp } from '../context/AppContext';

/**
 * Headless replay engine for the persisted offline queue.
 *
 * Every replayed mutation carries its idempotency key (`X-Client-Mutation-Id`),
 * so a write the server already committed before the client timed out is never
 * applied twice (recurring reward redemptions were the dangerous case).
 * The visible status lives in `features/offline/OfflineStatusBanner.tsx`.
 */
export const OfflineSyncManager: React.FC = () => {
  const dispatch = useAppDispatch();
  const queue = useAppSelector((state) => state.ui.offlineQueue || []);
  const status = useAppSelector((state) => state.connectivity.status);
  const { refresh, showToast } = useApp();
  const isFlushingRef = useRef(false);

  const flushQueue = useCallback(async () => {
    if (isFlushingRef.current || status === 'offline' || queue.length === 0) return;

    isFlushingRef.current = true;
    let syncedCount = 0;

    for (const item of queue) {
      if (typeof navigator !== 'undefined' && !navigator.onLine) break;

      try {
        await apiPostDirect(item.endpoint, item.body, { mutationId: item.mutationId || item.id });
        dispatch(dequeueOfflineMutation(item.id));
        syncedCount += 1;
      } catch (err: any) {
        if (err instanceof ApiError) {
          if (err.status === 401 || err.status === 403) {
            // Ingress session expired while we were away — the monitor reloads the app.
            window.dispatchEvent(new Event('cr:probe_connection'));
            break;
          }
          // Rejected payload (validation / duplicate / already applied): drop it so
          // one bad item can never block the rest of the queue.
          dispatch(dequeueOfflineMutation(item.id));
          continue;
        }

        // Still offline or a wake-up timeout: keep the queue and wait for the next attempt.
        notifyNetworkFailure();
        break;
      }
    }

    isFlushingRef.current = false;

    if (syncedCount > 0) {
      showToast(`Back online — synced ${syncedCount} offline change${syncedCount > 1 ? 's' : ''}!`);
      await refresh();
    }
  }, [queue, status, dispatch, refresh, showToast]);

  // Flush as soon as the connectivity slice reports online with pending work
  useEffect(() => {
    void flushQueue();
  }, [flushQueue]);

  // Safety net: periodic retry + immediate attempt when the tab wakes / regains focus
  useEffect(() => {
    if (status !== 'online' || queue.length === 0) return;

    const interval = window.setInterval(() => void flushQueue(), 30000);
    const handleWake = () => {
      if (!document.hidden) void flushQueue();
    };

    window.addEventListener('focus', handleWake);
    window.addEventListener('pageshow', handleWake);
    document.addEventListener('visibilitychange', handleWake);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', handleWake);
      window.removeEventListener('pageshow', handleWake);
      document.removeEventListener('visibilitychange', handleWake);
    };
  }, [status, queue.length, flushQueue]);

  return null;
};

