/**
 * Device recovery helpers — the escape hatch for a device whose browser storage
 * holds state that the current client cannot render.
 *
 * When is this needed? A crash inside a React tree can be recovered by remounting,
 * but if the crash is re-triggered by persisted state (redux-persist, a stale
 * service-worker cache, a half-written payload), every reload lands on the same
 * error screen and the household is locked out of the panel until someone clears
 * site data by hand. The root error boundary exposes this as "Clear device cache".
 *
 * Scope note: only THIS app's keys are touched. Applications behind Home Assistant
 * Ingress share an origin with HA itself (`hassTokens`, Lovelace config, …), so a
 * blanket `localStorage.clear()` would be destructive.
 */

const PERSIST_KEY = 'persist:choresrewards';
const APP_KEY_PREFIXES = ['persist:choresrewards', 'cr:', 'cr-'];
const SW_CACHE_PREFIX = 'cr-';

function isAppKey(key: string): boolean {
  return APP_KEY_PREFIXES.some((prefix) => key.startsWith(prefix));
}

/** Removes this app's persisted state, its session scratch data and its offline caches. */
export async function clearDeviceCache(): Promise<void> {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(PERSIST_KEY);
      for (const key of Object.keys(localStorage)) {
        if (isAppKey(key)) localStorage.removeItem(key);
      }
    }
  } catch {
    /* storage may be blocked (private mode / tracking prevention) — keep going */
  }

  try {
    if (typeof sessionStorage !== 'undefined') {
      for (const key of Object.keys(sessionStorage)) {
        if (isAppKey(key)) sessionStorage.removeItem(key);
      }
    }
  } catch {
    /* ignore */
  }

  try {
    if (typeof caches !== 'undefined') {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((key) => key.startsWith(SW_CACHE_PREFIX)).map((key) => caches.delete(key))
      );
    }
  } catch {
    /* ignore */
  }
}

/** Clears this device's cached/app state and reloads, so the app boots clean. */
export async function resetDeviceAndReload(): Promise<void> {
  await clearDeviceCache();
  if (typeof window !== 'undefined') {
    window.location.reload();
  }
}
