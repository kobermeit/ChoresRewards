/**
 * Registers the offline app-shell service worker (`client/public/sw.js`).
 *
 * The URL is built from the current document directory so the registration also
 * works behind the dynamic Home Assistant Ingress prefix
 * (`/api/hassio_ingress/<token>/sw.js`).
 *
 * Service workers require a secure context: this is a no-op when the app is
 * opened over plain HTTP on a LAN address (offline mode is HTTPS/localhost only).
 */
export function registerServiceWorker(): void {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

  const { protocol, hostname, pathname } = window.location;
  const isSecureContextHost = protocol === 'https:' || hostname === 'localhost' || hostname === '127.0.0.1';
  if (!isSecureContextHost) return;

  const directory = pathname.endsWith('/') ? pathname : `${pathname}/`;
  const swUrl = `${directory}sw.js`;

  window.addEventListener('load', () => {
    navigator.serviceWorker.register(swUrl).catch((err) => {
      console.warn('[PWA] Service worker registration failed:', err);
    });
  });
}
