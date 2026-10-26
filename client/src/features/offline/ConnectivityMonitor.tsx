import React, { useCallback, useEffect, useRef } from 'react';
import { useAppDispatch, useAppSelector } from '../../store';
import { markOffline, markOnline } from '../../store/connectivitySlice';
import { useApp } from '../../context/AppContext';
import { resolveApiUrl } from '../../api';

/**
 * Headless connectivity watchdog.
 *
 * Fixes the wall-panel / Chromebook wake problem: after a suspend the radio can
 * take several seconds to come back, and a Home Assistant Ingress token can be
 * rotated while the tab slept (every request then answers with the HA login page).
 *  - Probes a tiny `/api/ping` (204, no-store) instead of the heavy bootstrap payload.
 *  - Uses an 8s timeout so a waking WiFi chip is not mistaken for an outage.
 *  - Probes immediately on visibilitychange / focus / pageshow / online.
 *  - Retries on a 1s → 15s backoff ladder while offline.
 *  - Detects an expired Ingress session (HTML/401/403/redirect) and reloads once.
 */

type ProbeResult = 'ok' | 'offline' | 'auth-required';

const PROBE_TIMEOUT_MS = 8000;
const MAX_BACKOFF_MS = 15000;
const AUTH_RELOAD_GUARD_MS = 60000;

let lastAuthReloadAt = 0;

async function probeHomeAssistant(): Promise<ProbeResult> {
  try {
    const res = await fetch(resolveApiUrl('ping'), {
      method: 'GET',
      cache: 'no-store',
      credentials: 'include',
      headers: { Accept: 'application/json' },
      signal:
        typeof AbortSignal !== 'undefined' && typeof (AbortSignal as any).timeout === 'function'
          ? (AbortSignal as any).timeout(PROBE_TIMEOUT_MS)
          : undefined,
    });

    const contentType = (res.headers.get('content-type') || '').toLowerCase();
    // HA answered with its login page (expired/rotated ingress token) → only a reload heals it.
    if (contentType.includes('text/html') || res.redirected) return 'auth-required';
    if (res.ok) return 'ok';
    if (res.status === 401 || res.status === 403) return 'auth-required';
    return 'offline';
  } catch {
    return 'offline';
  }
}

export const ConnectivityMonitor: React.FC = () => {
  const dispatch = useAppDispatch();
  const status = useAppSelector((state) => state.connectivity.status);
  const queueLength = useAppSelector((state) => state.ui.offlineQueue.length);
  const { refresh, showToast } = useApp();

  const statusRef = useRef(status);
  const queueLengthRef = useRef(queueLength);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  useEffect(() => {
    queueLengthRef.current = queueLength;
  }, [queueLength]);

  const handleProbeResult = useCallback(
    async (result: ProbeResult): Promise<boolean> => {
      if (result === 'ok') {
        const wasOffline = statusRef.current === 'offline';
        dispatch(markOnline());
        // With queued changes the sync manager owns the message + refresh.
        if (wasOffline && queueLengthRef.current === 0) {
          showToast('Back online — reconnected to Family Hub', { type: 'success' });
          await refresh();
        }
        return true;
      }

      if (result === 'auth-required') {
        dispatch(markOffline());
        const now = Date.now();
        if (now - lastAuthReloadAt > AUTH_RELOAD_GUARD_MS) {
          lastAuthReloadAt = now;
          showToast('Reconnecting to Home Assistant…', { type: 'info' });
          window.setTimeout(() => window.location.reload(), 500);
        }
        return false;
      }

      dispatch(markOffline());
      return false;
    },
    [dispatch, refresh, showToast]
  );

  const runProbe = useCallback(async () => {
    await handleProbeResult(await probeHomeAssistant());
  }, [handleProbeResult]);

  // Wake / reconnect triggers
  useEffect(() => {
    const handleOnline = () => void runProbe();
    const handleOffline = () => dispatch(markOffline());
    const handleWake = () => {
      if (document.hidden) return;
      void runProbe();
    };
    const handleVisibility = () => {
      if (!document.hidden) void runProbe();
    };
    const handleManualProbe = () => void runProbe();

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('focus', handleWake);
    window.addEventListener('pageshow', handleWake);
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('cr:probe_connection', handleManualProbe);

    // Mobile browsers drop the socket between cell towers — react to a route change too.
    const connection = (navigator as any).connection;
    connection?.addEventListener?.('change', handleWake);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('focus', handleWake);
      window.removeEventListener('pageshow', handleWake);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('cr:probe_connection', handleManualProbe);
      connection?.removeEventListener?.('change', handleWake);
    };
  }, [dispatch, runProbe]);

  // Offline backoff ladder: quick first retry, then ease off to 15s.
  useEffect(() => {
    if (status !== 'offline') return;

    let cancelled = false;
    let timer: number | undefined;
    let attempt = 0;

    const tick = async () => {
      if (cancelled) return;
      const result = await probeHomeAssistant();
      if (cancelled) return;

      const recovered = await handleProbeResult(result);
      if (cancelled || recovered || result === 'auth-required') return;

      attempt += 1;
      const delay = Math.min(1000 * 2 ** (attempt - 1), MAX_BACKOFF_MS);
      timer = window.setTimeout(tick, delay);
    };

    timer = window.setTimeout(tick, 1200);
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [status, handleProbeResult]);

  return null;
};
