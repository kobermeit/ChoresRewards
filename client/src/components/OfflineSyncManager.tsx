import React, { useCallback, useEffect, useRef } from 'react';
import { useAppSelector, useAppDispatch } from '../store';
import { bumpOfflineMutationAttempt, dequeueOfflineMutation, dropExpiredOfflineMutations } from '../store/uiSlice';
import { ApiError, apiPostDirect, notifyNetworkFailure } from '../api';
import { useApp } from '../context/AppContext';

/**
 * A queued write is retried at most this many times before it is discarded. Without
 * it, one write the server never accepts (a 2s request timeout on a busy box, a
 * poison payload) keeps the "Syncing 1 change…" banner on screen forever — the
 * banner is derived from the queue, so it even survives a full page reload.
 */
const MAX_REPLAY_ATTEMPTS = 4;
/** Queued writes older than this are stale on arrival (e.g. a shopping tick from days ago). */
const MAX_QUEUE_AGE_MS = 12 * 60 * 60 * 1000;
/**
 * Replays get a far longer timeout than an interactive request: this is a background
 * retry, not a tap the user is waiting on, and the default 2s is easily exceeded by a
 * busy household write.
 */
const REPLAY_TIMEOUT_MS = 20_000;

/**
 * Headless replay engine for the persisted offline queue.
 *
 * Every replayed mutation carries its idempotency key (`X-Client-Mutation-Id`),
 * so a write the server already committed before the client timed out is never
 * applied twice (recurring reward redemptions were the dangerous case).
 * The visible status lives in `features/offline/OfflineStatusBanner.tsx`.
 *
 * The queue can never latch: an item is either replayed successfully, rejected by
 * the server (dropped immediately), or given up on after `MAX_REPLAY_ATTEMPTS`.
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
    let droppedCount = 0;

    try {
      for (const item of queue) {
        if (typeof navigator !== 'undefined' && !navigator.onLine) break;

        const age = Date.now() - Number(item.timestamp || 0);
        const attempts = Number(item.attempts || 0);
        if (age > MAX_QUEUE_AGE_MS || attempts >= MAX_REPLAY_ATTEMPTS) {
          // Never let one unsyncable write hold the banner hostage.
          dispatch(dequeueOfflineMutation(item.id));
          droppedCount += 1;
          continue;
        }

        try {
          await apiPostDirect(item.endpoint, item.body, {
            mutationId: item.mutationId || item.id,
            timeoutMs: REPLAY_TIMEOUT_MS,
          });
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

          // Still offline or a wake-up timeout: count the attempt, keep the item and
          // wait for the next cycle — until the attempt budget runs out.
          dispatch(bumpOfflineMutationAttempt(item.id));
          notifyNetworkFailure();
          break;
        }
      }
    } finally {
      // Always release the guard: an exception mid-flush must not disable syncing
      // for the rest of the session ("stuck on Syncing…").
      isFlushingRef.current = false;
    }

    if (syncedCount > 0) {
      showToast(`Back online — synced ${syncedCount} offline change${syncedCount > 1 ? 's' : ''}!`);
      await refresh();
    }
    if (droppedCount > 0) {
      showToast(
        `Couldn't sync ${droppedCount} saved change${droppedCount > 1 ? 's' : ''} — discarded. Please redo it.`,
        { type: 'error' }
      );
      await refresh();
    }
  }, [queue, status, dispatch, refresh, showToast]);

  // Drop anything that went stale while this device was asleep / closed.
  useEffect(() => {
    dispatch(dropExpiredOfflineMutations(MAX_QUEUE_AGE_MS));
  }, [dispatch]);

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

