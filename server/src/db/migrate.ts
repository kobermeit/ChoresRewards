import fs from 'fs';
import path from 'path';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { getDb, getPool } from './client';

/**
 * Advisory-lock key that serialises migration runs across processes.
 *
 * A rolling deploy (Coolify) or a blue/green flip runs the old and the new
 * container at the same time, and both call this on boot. Without a lock they
 * race on the same DDL (`CREATE SCHEMA`, `CREATE TABLE`, the
 * `drizzle.__drizzle_migrations` bookkeeping) and one of them dies with
 * "tuple concurrently updated" or "duplicate key value" — which the orchestrator
 * reports as a failed deploy. `pg_advisory_lock` is session-scoped and released
 * automatically if the process dies, so it needs no cleanup.
 */
const MIGRATION_LOCK_KEY = 7_340_001;

/** How long a waiting container will queue behind another one's migration run. */
const MIGRATION_LOCK_TIMEOUT = '120s';

/**
 * Applies all pending Drizzle migrations at boot (idempotent — drizzle tracks
 * applied migrations in `drizzle.__drizzle_migrations`).
 *
 * The migrations folder is copied into the runtime image next to server/dist.
 *
 * No retry loop of its own: the caller wraps the whole boot step in
 * `withDbRetry()` (server/src/db/retry.ts), so a transient DNS/connection blip
 * retries the entire, idempotent, sequence.
 */
export async function runMigrations(): Promise<void> {
  const folder = path.join(__dirname, '..', '..', 'drizzle');
  if (!fs.existsSync(folder)) {
    console.warn(`[db] No migrations folder at ${folder} — skipping migration run.`);
    return;
  }

  // Hold the lock on a dedicated connection while the migrator uses its own.
  const lockClient = await getPool().connect();
  try {
    await lockClient.query(`SET lock_timeout = '${MIGRATION_LOCK_TIMEOUT}'`);
    const waitingSince = Date.now();
    await lockClient.query('SELECT pg_advisory_lock($1)', [MIGRATION_LOCK_KEY]);
    const waitedMs = Date.now() - waitingSince;
    if (waitedMs > 500) {
      console.log(`[db] Waited ${(waitedMs / 1000).toFixed(1)}s for another container's migration run.`);
    }

    console.log('[db] Applying Postgres migrations…');
    await migrate(getDb(), { migrationsFolder: folder });
    console.log('[db] Migrations up to date.');
  } finally {
    await lockClient.query('SELECT pg_advisory_unlock($1)', [MIGRATION_LOCK_KEY]).catch(() => undefined);
    lockClient.release();
  }
}

