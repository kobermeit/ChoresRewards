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

/* ------------------------------------------------------------------ *
 * Legacy-shape read helpers
 *
 * The route handlers are written against the original SQLite row shape
 * (`assigned_to_id`, `is_admin`, …) and that snake_case shape is also the JSON
 * contract the React client consumes. These helpers run a Drizzle query and
 * hand back rows with the column names the rest of the code already expects, so
 * a ported call site keeps the identical response payload.
 * ------------------------------------------------------------------ */

type Row = Record<string, unknown>;

const snakeKey = (key: string): string => key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);

function snakeRow(row: Row): Row {
  const out: Row = {};
  for (const [key, value] of Object.entries(row)) out[snakeKey(key)] = value;
  return out;
}

/** Await a Drizzle query builder and return every row with snake_case columns. */
export async function many<T = any>(query: PromiseLike<unknown[]>): Promise<T[]> {
  const rows = (await query) as Row[];
  return rows.map(snakeRow) as T[];
}

/** Await a Drizzle query builder and return the first row (`.get()` equivalent). */
export async function one<T = any>(query: PromiseLike<unknown[]>): Promise<T | undefined> {
  const rows = (await query) as Row[];
  return rows.length > 0 ? (snakeRow(rows[0]) as T) : undefined;
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
