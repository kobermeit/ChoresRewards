import { Router, Request, Response } from 'express';

export const healthRouter = Router();

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
