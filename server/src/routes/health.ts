import { Router, Request, Response } from 'express';
import { probeDatabase } from '../db/client';
import { getBootState } from '../services/bootState';
import { APP_VERSION } from '../config';

export const healthRouter = Router();

/**
 * Liveness probe for the container runtime (Docker HEALTHCHECK, Coolify,
 * HAOS watchdog, uptime monitors). Registered as `/health`, so it answers on
 * both `/health` and `/api/health`.
 *
 * Responses:
 *   - `200 {"status":"ok",        "database":"ok"}`          — ready and serving.
 *   - `503 {"status":"starting"}`                           — still migrating/seeding (port is
 *                                                             bound early on purpose, so this is
 *                                                             readable instead of a refused connection).
 *   - `503 {"status":"degraded",  "database":"unavailable"}` — running, but Postgres is gone.
 *   - `503 {"status":"failed"}`                             — startup gave up; the process is exiting.
 *
 * `database_error_code` carries only the driver code (e.g. `EAI_AGAIN`), never the
 * message, so this endpoint stays free of filesystem paths and household data.
 */
healthRouter.get('/health', async (_req: Request, res: Response) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  const uptime = Math.round(process.uptime());
  const boot = getBootState();

  if (boot.phase !== 'ready') {
    res.status(503).json({
      status: boot.phase,
      version: APP_VERSION,
      database: 'pending',
      detail: boot.detail,
      uptime_seconds: uptime,
    });
    return;
  }

  const probe = await probeDatabase();
  res.status(probe.ok ? 200 : 503).json({
    status: probe.ok ? 'ok' : 'degraded',
    version: APP_VERSION,
    database: probe.ok ? 'ok' : 'unavailable',
    ...(probe.ok ? {} : { database_error_code: probe.code || 'unreachable' }),
    uptime_seconds: uptime,
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
