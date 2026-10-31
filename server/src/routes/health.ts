import { Router, Request, Response } from 'express';
import { db } from '../db';
import { APP_VERSION } from '../config';

export const healthRouter = Router();

/**
 * Liveness probe for the container runtime (Docker HEALTHCHECK, Coolify,
 * HAOS watchdog, uptime monitors). Registered as `/health`, so it answers on
 * both `/health` and `/api/health`.
 *
 * Returns 200 when the SQLite handle is usable and 503 when it is not, so the
 * orchestrator can show "unhealthy" instead of a silently broken app.
 * Deliberately free of filesystem paths and household data.
 */
healthRouter.get('/health', (_req: Request, res: Response) => {
  let database = 'ok';
  try {
    db.prepare('SELECT 1').get();
  } catch {
    database = 'unavailable';
  }

  const healthy = database === 'ok';
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  res.status(healthy ? 200 : 503).json({
    status: healthy ? 'ok' : 'degraded',
    version: APP_VERSION,
    database,
    uptime_seconds: Math.round(process.uptime()),
  });
});

/**
 * Ultra-light connectivity probe used by the client while reconnecting
 * (weak mobile signal, Chromebook / wall-panel wake from sleep).
 *
 * Deliberately NOT the heavy `bootstrap` payload: this is polled every few
 * seconds during an outage, so it must stay tiny and uncacheable.
 * Registered as `/ping`, so it is reachable at both `/ping` and `/api/ping`.
 */
healthRouter.get('/ping', (_req: Request, res: Response) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  res.status(204).end();
});
