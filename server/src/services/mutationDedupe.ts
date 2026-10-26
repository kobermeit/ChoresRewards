import { Request, Response, NextFunction } from 'express';
import { db } from '../db';

/**
 * Idempotent offline replay protection.
 *
 * The client queues mutations while offline and replays them on reconnect.
 * A replayed POST may already have been committed by the server before the
 * client's request timed out (2s abort on a slow Pi / HA proxy), which would
 * double-apply non-idempotent writes such as recurring reward redemptions.
 *
 * The client attaches `X-Client-Mutation-Id` to every queued mutation (the id
 * is generated once, before the first attempt, so a "committed but timed out"
 * write is covered too). We record applied ids and short-circuit duplicates.
 */
const MUTATION_HEADER = 'x-client-mutation-id';
const RETENTION_DAYS = 14;
const PRUNE_EVERY = 200;

let insertCounter = 0;

export function mutationDedupeMiddleware(req: Request, res: Response, next: NextFunction) {
  if (req.method !== 'POST') {
    next();
    return;
  }

  const mutationId = String(req.header(MUTATION_HEADER) || '').trim();
  if (!mutationId) {
    next();
    return;
  }

  try {
    const alreadyApplied = db
      .prepare('SELECT 1 AS applied FROM applied_mutation WHERE mutation_id = ?')
      .get(mutationId);

    if (alreadyApplied) {
      // The original attempt succeeded server-side; report success without re-running it.
      res.json({ success: true, deduplicated: true });
      return;
    }
  } catch {
    // Never block household traffic because of a ledger hiccup.
  }

  res.on('finish', () => {
    if (res.statusCode >= 400) return;
    try {
      db.prepare('INSERT OR IGNORE INTO applied_mutation (mutation_id, endpoint) VALUES (?, ?)').run(
        mutationId,
        req.path
      );
      insertCounter += 1;
      if (insertCounter % PRUNE_EVERY === 0) {
        db.prepare(
          `DELETE FROM applied_mutation WHERE applied_at < datetime('now', '-${RETENTION_DAYS} days')`
        ).run();
      }
    } catch {
      // ignore ledger write failures
    }
  });

  next();
}
