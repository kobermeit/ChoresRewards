/**
 * Ingress-safe relative URL helpers.
 * Under Home Assistant Ingress, the app is served at /api/hassio_ingress/<token>/
 * Using './api/...' and './static/...' ensures all requests resolve inside the Ingress prefix.
 */

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
    throw new ApiError(errorMsg, res.status, data);
  }

  return (data !== null ? data : { success: true }) as T;
}

export async function apiGet<T = any>(endpoint: string): Promise<T> {
  const res = await fetch(resolveApiUrl(endpoint), {
    method: 'GET',
    credentials: 'include',
    headers: { Accept: 'application/json' },
  });
  return handleResponse<T>(res);
}

import { store } from './store';
import { enqueueOfflineMutation } from './store/uiSlice';

export async function apiPostDirect<T = any>(endpoint: string, body?: any): Promise<T> {
  const isFormData = body instanceof FormData;
  const res = await fetch(resolveApiUrl(endpoint), {
    method: 'POST',
    credentials: 'include',
    headers: isFormData
      ? { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' }
      : { 'Content-Type': 'application/json', Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
    body: isFormData ? body : JSON.stringify(body ?? {}),
  });
  return handleResponse<T>(res);
}

export async function apiPost<T = any>(endpoint: string, body?: any): Promise<T> {
  const isFormData = body instanceof FormData;
  const isOnline = typeof navigator === 'undefined' || navigator.onLine;

  // If explicitly offline and mutation is not auth/pin or FormData, queue immediately
  if (!isOnline && !isFormData && !endpoint.includes('pin') && !endpoint.includes('auth')) {
    try {
      store.dispatch(enqueueOfflineMutation({ endpoint, body }));
    } catch {
      // ignore
    }
    return { success: true, offline: true } as T;
  }

  try {
    return await apiPostDirect<T>(endpoint, body);
  } catch (err: any) {
    if (!isFormData && !endpoint.includes('pin') && !endpoint.includes('auth')) {
      const isNetworkFail =
        (typeof navigator !== 'undefined' && !navigator.onLine) ||
        err?.name === 'TypeError' ||
        String(err?.message || '').toLowerCase().includes('failed to fetch') ||
        String(err?.message || '').toLowerCase().includes('network');

      if (isNetworkFail) {
        try {
          store.dispatch(enqueueOfflineMutation({ endpoint, body }));
        } catch {
          // ignore
        }
        return { success: true, offline: true } as T;
      }
    }
    throw err;
  }
}

export async function apiPut<T = any>(endpoint: string, body?: any): Promise<T> {
  const res = await fetch(resolveApiUrl(endpoint), {
    method: 'PUT',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body ?? {}),
  });
  return handleResponse<T>(res);
}

export async function apiDelete<T = any>(endpoint: string): Promise<T> {
  const res = await fetch(resolveApiUrl(endpoint), {
    method: 'DELETE',
    credentials: 'include',
    headers: { Accept: 'application/json' },
  });
  return handleResponse<T>(res);
}
