import { Request, Response, NextFunction } from 'express';
import { eq, lt } from 'drizzle-orm';
import { getDb } from '../db/client';
import { appliedMutation } from '../db/schema';

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
 *
 * Fails open: any ledger error (including "no DATABASE_URL yet") must never
 * block household traffic.
 */
const MUTATION_HEADER = 'x-client-mutation-id';
const RETENTION_DAYS = 14;
const PRUNE_EVERY = 200;

let insertCounter = 0;

export async function mutationDedupeMiddleware(req: Request, res: Response, next: NextFunction) {
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
    const [alreadyApplied] = await getDb()
      .select({ id: appliedMutation.mutationId })
      .from(appliedMutation)
      .where(eq(appliedMutation.mutationId, mutationId))
      .limit(1);

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
    void (async () => {
      try {
        const db = getDb();
        await db
          .insert(appliedMutation)
          .values({ mutationId, endpoint: req.path })
          .onConflictDoNothing();
        insertCounter += 1;
        if (insertCounter % PRUNE_EVERY === 0) {
          const cutoff = new Date(Date.now() - RETENTION_DAYS * 86_400_000)
            .toISOString()
            .slice(0, 19)
            .replace('T', ' ');
          await db.delete(appliedMutation).where(lt(appliedMutation.appliedAt, cutoff));
        }
      } catch {
        // ignore ledger write failures
      }
    })();
  });

  next();
}
