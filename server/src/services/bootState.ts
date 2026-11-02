/**
 * Where the process is in its startup sequence.
 *
 * The HTTP port is bound *before* the database work starts, so `/api/health` can
 * answer `503 {"status":"starting"}` while migrations run instead of the port
 * refusing connections entirely. That single distinction is what makes a failed
 * deploy legible in Coolify's log panel: "starting — waiting for Postgres" beats
 * a container that vanished at second 3.
 */

export type BootPhase = 'starting' | 'ready' | 'failed';

export interface BootState {
  phase: BootPhase;
  /** Short, log-safe explanation (never contains credentials or filesystem paths). */
  detail: string;
  /** ISO timestamp of process start. */
  started_at: string;
  /** Seconds between process start and the moment boot completed. */
  ready_after_seconds: number | null;
}

const startedAt = Date.now();

let phase: BootPhase = 'starting';
let detail = 'Starting up…';
let readyAfterSeconds: number | null = null;

export function setBootPhase(next: BootPhase, nextDetail: string): void {
  const changed = next !== phase;
  phase = next;
  detail = nextDetail;
  if (next === 'ready' && readyAfterSeconds === null) {
    readyAfterSeconds = Math.round((Date.now() - startedAt) / 100) / 10;
  }
  if (changed) {
    const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
    console.log(`[boot] phase=${next} (${elapsed}s) — ${nextDetail}`);
  }
}

export function getBootState(): BootState {
  return {
    phase,
    detail,
    started_at: new Date(startedAt).toISOString(),
    ready_after_seconds: readyAfterSeconds,
  };
}

/** True once migrations/seeding finished and the app may serve household data. */
export function isBootReady(): boolean {
  return phase === 'ready';
}
