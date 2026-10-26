/* ChoresRewards service worker.
 *
 * Purpose: keep the Family Hub usable when the wall panel / phone loses the
 * network (e.g. inside a supermarket), and give cold starts something to render.
 *
 * - Navigation requests: network-first, fall back to the cached app shell.
 * - Hashed build assets + bundled images/sounds: cache-first (immutable names).
 * - Uploaded photos: stale-while-revalidate so avatars never render broken offline.
 * - GET .../bootstrap: network-first with a snapshot cache. A cached replay is
 *   tagged with `X-CR-From-Cache: 1` so the app knows it is really offline.
 *
 * Served from client/public, so it lives at the app base path (Ingress safe).
 * Bump SW_VERSION whenever the caching strategy changes.
 */
const SW_VERSION = 'cr-v1';
const SHELL_CACHE = `${SW_VERSION}-shell`;
const ASSET_CACHE = `${SW_VERSION}-asset`;
const API_CACHE = `${SW_VERSION}-api`;

const NAV_TIMEOUT_MS = 3500;
const API_TIMEOUT_MS = 3500;

const SCOPE_URL = self.registration.scope;
const INDEX_URL = new URL('index.html', SCOPE_URL).href;

/**
 * On the very first visit the worker is not controlling the page yet, so nothing
 * the page loads passes through the fetch handler. Precache by fetching the shell
 * HTML itself and caching every same-origin asset it references (hashed JS/CSS).
 */
async function precacheShell() {
  const shellCache = await caches.open(SHELL_CACHE);
  const assetCache = await caches.open(ASSET_CACHE);

  let html = null;
  try {
    const response = await fetch(SCOPE_URL, { cache: 'reload' });
    if (response && response.ok) {
      html = await response.clone().text();
      await shellCache.put(SCOPE_URL, response.clone());
      await shellCache.put(INDEX_URL, response.clone());
    }
  } catch {
    /* first run may already be offline — fall back to whatever is cached */
  }

  if (!html) {
    const cached = (await shellCache.match(INDEX_URL)) || (await shellCache.match(SCOPE_URL));
    if (cached) html = await cached.text();
  }
  if (!html) return;

  const urls = new Set();
  const attrPattern = /(?:src|href)="([^"]+)"/g;
  let match = attrPattern.exec(html);
  while (match) {
    const raw = match[1];
    if (raw && !raw.startsWith('http') && !raw.startsWith('data:') && !raw.startsWith('#')) {
      try {
        const absolute = new URL(raw, SCOPE_URL).href;
        if (absolute.startsWith(SCOPE_URL)) urls.add(absolute);
      } catch {
        /* ignore malformed URL */
      }
    }
    match = attrPattern.exec(html);
  }

  await Promise.all(
    [...urls].map(async (url) => {
      try {
        await assetCache.add(new Request(url, { cache: 'reload' }));
      } catch {
        /* individual asset failures must not abort the install */
      }
    })
  );
}


self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      await precacheShell();
      await self.skipWaiting();
    })()
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((key) => !key.startsWith(SW_VERSION)).map((key) => caches.delete(key))
      );
      await self.clients.claim();
    })()
  );
});

function timeoutFetch(request, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(request, { signal: controller.signal }).finally(() => clearTimeout(timer));
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (response && (response.ok || response.type === 'opaque')) {
    cache.put(request, response.clone()).catch(() => {});
  }
  return response;
}

async function staleWhileRevalidate(event, request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  const network = fetch(request)
    .then((response) => {
      if (response && response.ok) {
        cache.put(request, response.clone()).catch(() => {});
      }
      return response;
    })
    .catch(() => null);

  if (cached) {
    event.waitUntil(network.then(() => undefined));
    return cached;
  }

  const response = await network;
  return response || Response.error();
}

async function navigationResponse(request) {
  const cache = await caches.open(SHELL_CACHE);
  try {
    const response = await timeoutFetch(request, NAV_TIMEOUT_MS);
    if (response && response.ok) {
      cache.put(INDEX_URL, response.clone()).catch(() => {});
    }
    return response;
  } catch {
    const cached =
      (await cache.match(request, { ignoreSearch: true })) ||
      (await cache.match(INDEX_URL)) ||
      (await cache.match(SCOPE_URL));
    return cached || Response.error();
  }
}

async function bootstrapResponse(request) {
  const cache = await caches.open(API_CACHE);
  try {
    const response = await timeoutFetch(request, API_TIMEOUT_MS);
    if (response && response.ok && !response.redirected) {
      cache.put(request, response.clone()).catch(() => {});
    }
    return response;
  } catch {
    const cached = await cache.match(request);
    if (!cached) return Response.error();

    const headers = new Headers(cached.headers);
    const dateHeader = cached.headers.get('date');
    headers.set('X-CR-From-Cache', '1');
    if (dateHeader) headers.set('X-CR-Cached-At', String(new Date(dateHeader).getTime()));

    const body = await cached.blob();
    return new Response(body, { status: cached.status, statusText: cached.statusText, headers });
  }
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  if (request.headers.has('range')) return;

  let url;
  try {
    url = new URL(request.url);
  } catch {
    return;
  }

  // Font Awesome icons come from a CDN — cache them so glyphs survive offline.
  if (url.origin !== self.location.origin) {
    if (url.hostname === 'cdnjs.cloudflare.com') {
      event.respondWith(cacheFirst(request, ASSET_CACHE));
    }
    return;
  }

  const path = url.pathname;

  // Offline data snapshot for cold starts / reconnect attempts
  if (/\/bootstrap\/?$/.test(path)) {
    event.respondWith(bootstrapResponse(request));
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(navigationResponse(request));
    return;
  }

  if (
    path.includes('/assets/') ||
    path.includes('/static/images/') ||
    path.includes('/static/sounds/') ||
    path.endsWith('/manifest.json')
  ) {
    event.respondWith(cacheFirst(request, ASSET_CACHE));
    return;
  }

  if (path.includes('/static/uploads/')) {
    event.respondWith(staleWhileRevalidate(event, request, ASSET_CACHE));
  }
});
