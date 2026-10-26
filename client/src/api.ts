/**
 * Ingress-safe relative URL helpers.
 * Under Home Assistant Ingress, the app is served at /api/hassio_ingress/<token>/
 * Using './api/...' and './static/...' ensures all requests resolve inside the Ingress prefix.
 */

import { store } from './store';
import { enqueueOfflineMutation, generateMutationId } from './store/uiSlice';
import { markServedFromCache, reportNetworkFailure, reportNetworkSuccess } from './store/connectivitySlice';

/** Header set by the service worker when it replays a cached GET while offline. */
const CACHE_MARKER_HEADER = 'X-CR-From-Cache';
const CACHE_TIMESTAMP_HEADER = 'X-CR-Cached-At';
/** Idempotency header consumed by server/services/mutationDedupe.ts */
const MUTATION_ID_HEADER = 'X-Client-Mutation-Id';

/**
 * Endpoints that must never enter the offline queue: they gate access (PIN /
 * login / household setup), so replaying a stale attempt could lock people out
 * or undo setup. Everything else is queued and replayed idempotently.
 *
 * NOTE: do NOT go back to a bare `endpointIncludes('pin')` test — the word
 * "shopping" contains "pin", which silently dropped every shopping-list tick
 * from the offline queue (found by the headless E2E test).
 */
const NON_REPLAYABLE_ENDPOINTS = new Set([
  'login',
  'logout',
  'adult_login',
  'adult_logout',
  'setup',
  'clear_pin',
  'save_pin_settings',
  'save_person_pin',
  'verify_pin',
  'verify_person_pin',
  'set_pin',
  'switch_user',
]);

function isNonReplayableEndpoint(endpoint: string): boolean {
  const name = endpoint.replace(/^\.?\/?api\//i, '').toLowerCase();
  if (NON_REPLAYABLE_ENDPOINTS.has(name)) return true;
  if (/(^|[/_])(auth|login|logout|setup)([/_]|$)/.test(name)) return true;
  // Token-boundary pin match: matches `clear_pin` / `pin_settings`, never `shopping`.
  return /(^|[/_])pin([/_]|$)/.test(name);
}

function isReplayableRequest(endpoint: string, body: any): boolean {
  if (body instanceof FormData) return false;
  return !isNonReplayableEndpoint(endpoint);
}

export function resolveAssetUrl(url: string | null | undefined): string {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) {
    return url;
  }
  // Strip any leading ./, /, or duplicate relative slashes
  const clean = url.replace(/^(\.\/|\/)+/, '');
  if (clean.startsWith('static/')) {
    return `./${clean}`;
  }
  if (clean.startsWith('uploads/')) {
    return `./static/${clean}`;
  }
  return `./static/uploads/${clean}`;
}

export function resolveAvatarUrl(avatar: string | null | undefined): string {
  if (!avatar || avatar === 'default_avatar.png' || avatar.endsWith('/default_avatar.png')) {
    return './static/uploads/default_avatar.png';
  }
  if (avatar.startsWith('http://') || avatar.startsWith('https://') || avatar.startsWith('data:')) {
    return avatar;
  }
  // Strip any leading ./, /, static/, uploads/ to avoid duplicate folder segments
  const clean = avatar.replace(/^(\.\/)?\/?(static\/)?(uploads\/)?/, '');
  return `./static/uploads/${clean}`;
}

export function resolveApiUrl(endpoint: string): string {
  const clean = endpoint.replace(/^\.?\//, '');
  if (clean.startsWith('api/')) {
    return `./${clean}`;
  }
  return `./api/${clean}`;
}

export class ApiError extends Error {
  status: number;
  data: any;

  constructor(message: string, status: number, data?: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

export function dispatchGlobalToast(message: string, type: 'error' | 'warning' | 'info' | 'success' = 'error') {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('cr:toast', { detail: { message, type } }));
  }
}


/**
 * Connectivity is tracked in the `connectivity` Redux slice so that the banner,
 * the sync manager and the reconnect probe all share one answer.
 */
export function notifyNetworkFailure() {
  try {
    store.dispatch(reportNetworkFailure());
  } catch {
    // store may be unavailable during very early boot
  }
}

export function notifyNetworkSuccess() {
  try {
    store.dispatch(reportNetworkSuccess());
  } catch {
    // ignore
  }
}

/** True once the app has established that we are cut off from Home Assistant. */
export function isKnownOffline(): boolean {
  try {
    return store.getState().connectivity.status === 'offline';
  } catch {
    return typeof navigator !== 'undefined' && navigator.onLine === false;
  }
}

function getFetchSignal(timeoutMs = 2000): AbortSignal {
  if (typeof AbortSignal !== 'undefined' && typeof (AbortSignal as any).timeout === 'function') {
    return (AbortSignal as any).timeout(timeoutMs);
  }
  const controller = new AbortController();
  setTimeout(() => controller.abort(new Error('Network request timed out')), timeoutMs);
  return controller.signal;
}

async function handleResponse<T>(res: Response): Promise<T> {
  let data: any = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }

  if (!res.ok || (data && typeof data === 'object' && data.success === false)) {
    const errorMsg =
      data?.error ||
      data?.message ||
      (res.status === 403
        ? 'Access forbidden — Parent authorisation required'
        : res.status === 401
        ? 'Authentication required — please sign in'
        : `Request failed (HTTP ${res.status})`);
    if (!isKnownOffline()) {
      dispatchGlobalToast(errorMsg, 'error');
    }
    throw new ApiError(errorMsg, res.status, data);
  }

  if (res.headers.get(CACHE_MARKER_HEADER) === '1') {
    // The service worker answered from its offline snapshot: we are actually offline.
    const cachedAt = Number(res.headers.get(CACHE_TIMESTAMP_HEADER) || 0) || null;
    try {
      store.dispatch(markServedFromCache(cachedAt));
    } catch {
      // ignore
    }
  } else {
    notifyNetworkSuccess();
  }

  return (data !== null ? data : { success: true }) as T;
}

export async function apiGet<T = any>(endpoint: string, timeoutMs = 2000): Promise<T> {
  try {
    const res = await fetch(resolveApiUrl(endpoint), {
      method: 'GET',
      credentials: 'include',
      headers: { Accept: 'application/json' },
      signal: getFetchSignal(timeoutMs),
    });
    return await handleResponse<T>(res);
  } catch (err: any) {
    if (!(err instanceof ApiError)) {
      notifyNetworkFailure();
      // While we already know we are offline the banner owns the messaging:
      // do not stack a red toast on top of it every poll tick.
      if (!isKnownOffline()) {
        dispatchGlobalToast(err?.message || 'Network request failed', 'error');
      }
    }
    throw err;
  }
}

export interface ApiPostOptions {
  /** Idempotency key — see server/services/mutationDedupe.ts */
  mutationId?: string;
  timeoutMs?: number;
}

export async function apiPostDirect<T = any>(
  endpoint: string,
  body?: any,
  options: ApiPostOptions = {}
): Promise<T> {
  const isFormData = body instanceof FormData;
  const headers: Record<string, string> = isFormData
    ? { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' }
    : { 'Content-Type': 'application/json', Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' };

  if (options.mutationId) {
    headers[MUTATION_ID_HEADER] = options.mutationId;
  }

  const res = await fetch(resolveApiUrl(endpoint), {
    method: 'POST',
    credentials: 'include',
    headers,
    body: isFormData ? body : JSON.stringify(body ?? {}),
    signal: isFormData ? undefined : getFetchSignal(options.timeoutMs ?? 2000),
  });
  return handleResponse<T>(res);
}

export async function apiPost<T = any>(endpoint: string, body?: any): Promise<T> {
  const isOnline = typeof navigator === 'undefined' || navigator.onLine;
  const isReplayable = isReplayableRequest(endpoint, body);
  // Generate the idempotency key BEFORE the first attempt: if the server commits the
  // write but the response times out, the queued replay is recognised as already applied.
  const mutationId = isReplayable ? generateMutationId() : undefined;

  // If explicitly offline and mutation is not auth/pin or FormData, queue immediately
  if (!isOnline && isReplayable) {
    try {
      store.dispatch(enqueueOfflineMutation({ endpoint, body, mutationId }));
    } catch {
      // never block the UI because the queue could not be written
    }
    return { success: true, offline: true } as T;
  }

  try {
    return await apiPostDirect<T>(endpoint, body, { mutationId });
  } catch (err: any) {
    if (isReplayable) {
      const isNetworkFail =
        (typeof navigator !== 'undefined' && !navigator.onLine) ||
        err?.name === 'TypeError' ||
        err?.name === 'TimeoutError' ||
        err?.name === 'AbortError' ||
        String(err?.message || '').toLowerCase().includes('timed out') ||
        String(err?.message || '').toLowerCase().includes('failed to fetch') ||
        String(err?.message || '').toLowerCase().includes('network');

      if (isNetworkFail) {
        notifyNetworkFailure();
        try {
          store.dispatch(enqueueOfflineMutation({ endpoint, body, mutationId }));
        } catch {
          // never block the UI because the queue could not be written
        }
        return { success: true, offline: true } as T;
      }
    }
    if (!(err instanceof ApiError)) {
      notifyNetworkFailure();
    }
    throw err;
  }
}

export async function apiPut<T = any>(endpoint: string, body?: any): Promise<T> {
  try {
    const res = await fetch(resolveApiUrl(endpoint), {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body ?? {}),
      signal: getFetchSignal(2000),
    });
    return await handleResponse<T>(res);
  } catch (err: any) {
    if (!(err instanceof ApiError)) {
      notifyNetworkFailure();
      if (!isKnownOffline()) {
        dispatchGlobalToast(err?.message || 'Network request failed', 'error');
      }
    }
    throw err;
  }
}

export async function apiDelete<T = any>(endpoint: string): Promise<T> {
  try {
    const res = await fetch(resolveApiUrl(endpoint), {
      method: 'DELETE',
      credentials: 'include',
      headers: { Accept: 'application/json' },
      signal: getFetchSignal(2000),
    });
    return await handleResponse<T>(res);
  } catch (err: any) {
    if (!(err instanceof ApiError)) {
      notifyNetworkFailure();
      if (!isKnownOffline()) {
        dispatchGlobalToast(err?.message || 'Network request failed', 'error');
      }
    }
    throw err;
  }
}
