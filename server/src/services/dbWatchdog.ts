/**
 * Postgres availability watcher.
 *
 * A stopped Postgres resource is the failure mode that took the household offline
 * in v1.20.0, and it was invisible: the app crash-looped, the orchestrator rolled
 * the deploy back, and nothing in the logs said *why* or *when*. This writes one
 * loud line when the database disappears and one when it comes back, so a
 * `docker logs` / Coolify log scroll tells the whole story:
 *
 *   [db] Postgres unreachable (ECONNREFUSED …) — requests will fail until it returns
 *   [db] Postgres back online after 3m12s
 *
 * Deliberately quiet: it only logs on transitions, never every poll.
 */
import { probeDatabase } from '../db/client';

export interface DatabaseWatchdog {
  /** Stop polling (used by tests and graceful shutdown). */
  stop: () => void;
}

export function startDatabaseWatchdog(intervalMs = 30_000): DatabaseWatchdog {
  let online: boolean | null = null;
  let downSince: number | null = null;

  const poll = async (): Promise<void> => {
    const probe = await probeDatabase();
    if (probe.ok) {
      if (online === false && downSince !== null) {
        const seconds = Math.round((Date.now() - downSince) / 1000);
        const human = seconds >= 60 ? `${Math.floor(seconds / 60)}m${seconds % 60}s` : `${seconds}s`;
        console.warn(`[db] Postgres back online after ${human}.`);
      }
      online = true;
      downSince = null;
      return;
    }
    if (online !== false) {
      downSince = Date.now();
      console.error(
        `[db] Postgres unreachable (${probe.error}) — household requests will fail until it returns. ` +
          'Check the Postgres resource in Coolify (is the container running?).'
      );
    }
    online = false;
  };

  const timer = setInterval(() => {
    void poll();
  }, intervalMs);
  // Never keep the process alive just to poll.
  timer.unref?.();

  return {
    stop: () => clearInterval(timer),
  };
}

