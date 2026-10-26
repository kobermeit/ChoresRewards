/**
 * Last-resort error capture for failures React error boundaries never see:
 * event handlers, timers, `Promise` rejections and service-worker callbacks.
 *
 * These errors do not unmount the app, but without a record they vanish into the
 * console of a device nobody is watching (wall tablet). We keep the most recent
 * one in `sessionStorage` so the crash screen can show it and the user can copy it.
 *
 * Keys are namespaced (`cr:`) because Home Assistant Ingress shares an origin.
 */
const LAST_ERROR_KEY = 'cr:lastError';

export interface LastErrorRecord {
  message: string;
  stack?: string;
  /** Where it came from: 'error' | 'unhandledrejection' | 'boundary:<level>' */
  source: string;
  at: number;
}

export function recordLastError(input: { message: string; stack?: string; source: string }): void {
  const record: LastErrorRecord = {
    message: String(input.message || 'Unknown error'),
    stack: input.stack,
    source: input.source,
    at: Date.now(),
  };
  try {
    sessionStorage.setItem(LAST_ERROR_KEY, JSON.stringify(record));
  } catch {
    /* storage unavailable — the console line below is still useful */
  }
  console.error(`[ChoresRewards:${record.source}] ${record.message}`, record.stack || '');
}

export function readLastError(): LastErrorRecord | null {
  try {
    const raw = sessionStorage.getItem(LAST_ERROR_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed.message === 'string' ? parsed : null;
  } catch {
    return null;
  }
}

export function clearLastError(): void {
  try {
    sessionStorage.removeItem(LAST_ERROR_KEY);
  } catch {
    /* ignore */
  }
}

/** Installs the global listeners once (safe to call on every boot). */
export function installGlobalErrorHandlers(): void {
  if (typeof window === 'undefined') return;
  const marker = '__crGlobalErrorHandlers';
  if ((window as any)[marker]) return;
  (window as any)[marker] = true;

  window.addEventListener('error', (event) => {
    recordLastError({
      message: event.message || 'Script error',
      stack: event.error?.stack,
      source: 'error',
    });
  });

  window.addEventListener('unhandledrejection', (event) => {
    const reason: any = (event as PromiseRejectionEvent).reason;
    recordLastError({
      message: reason?.message || String(reason),
      stack: reason?.stack,
      source: 'unhandledrejection',
    });
  });
}
