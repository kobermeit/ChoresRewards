import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

/**
 * Postgres connection (Coolify: add a Postgres resource and set DATABASE_URL).
 * A single pooled connection is shared by the whole server process.
 */
let pool: Pool | null = null;
let db: NodePgDatabase<typeof schema> | null = null;

export function databaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      'DATABASE_URL is not set. Point it at the Postgres instance (Coolify → Postgres resource → internal URL).'
    );
  }
  return url;
}

export function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: databaseUrl(),
      max: Number(process.env.PG_POOL_MAX || 10),
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
    });
    pool.on('error', (err) => console.error('[pg] idle client error:', err.message));
  }
  return pool;
}

export function getDb(): NodePgDatabase<typeof schema> {
  if (!db) db = drizzle(getPool(), { schema });
  return db;
}

export async function closePool(): Promise<void> {
  if (pool) {
    const current = pool;
    pool = null;
    db = null;
    await current.end().catch(() => undefined);
  }
}

/** Cheap liveness probe used by /api/health. */
export async function pingDatabase(): Promise<boolean> {
  try {
    await getPool().query('SELECT 1');
    return true;
  } catch {
    return false;
  }
}

export { schema };
