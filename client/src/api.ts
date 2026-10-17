/**
 * Ingress-safe relative URL helpers.
 * Under Home Assistant Ingress, the app is served at /api/hassio_ingress/<token>/
 * Using './api/...' and './static/...' ensures all requests resolve inside the Ingress prefix.
 */

export function resolveAssetUrl(url: string | null | undefined): string {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:') || url.startsWith('./')) {
    return url;
  }
  if (url.startsWith('/')) {
    return `.${url}`;
  }
  return `./static/uploads/${url}`;
}

export function resolveAvatarUrl(avatar: string | null | undefined): string {
  if (!avatar || avatar === 'default_avatar.png') {
    return './static/uploads/default_avatar.png';
  }
  if (avatar.startsWith('http') || avatar.startsWith('./') || avatar.startsWith('/')) {
    return resolveAssetUrl(avatar);
  }
  return `./static/uploads/${avatar}`;
}

export function resolveApiUrl(endpoint: string): string {
  const clean = endpoint.replace(/^\.?\//, '');
  if (clean.startsWith('api/')) {
    return `./${clean}`;
  }
  return `./api/${clean}`;
}

export async function apiGet<T = any>(endpoint: string): Promise<T> {
  const res = await fetch(resolveApiUrl(endpoint), {
    method: 'GET',
    credentials: 'include',
    headers: { Accept: 'application/json' },
  });
  const data = await res.json();
  if (!res.ok && !data) {
    throw new Error(`HTTP ${res.status}`);
  }
  return data as T;
}

export async function apiPost<T = any>(endpoint: string, body?: any): Promise<T> {
  const isFormData = body instanceof FormData;
  const res = await fetch(resolveApiUrl(endpoint), {
    method: 'POST',
    credentials: 'include',
    headers: isFormData
      ? { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' }
      : { 'Content-Type': 'application/json', Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
    body: isFormData ? body : JSON.stringify(body ?? {}),
  });
  const data = await res.json().catch(() => ({ success: res.ok }));
  return data as T;
}

export async function apiPut<T = any>(endpoint: string, body?: any): Promise<T> {
  const res = await fetch(resolveApiUrl(endpoint), {
    method: 'PUT',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body ?? {}),
  });
  return (await res.json()) as T;
}

export async function apiDelete<T = any>(endpoint: string): Promise<T> {
  const res = await fetch(resolveApiUrl(endpoint), {
    method: 'DELETE',
    credentials: 'include',
    headers: { Accept: 'application/json' },
  });
  return (await res.json()) as T;
}
