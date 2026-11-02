import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool, types } from 'pg';
import * as schema from './schema';
import { describeDbError, findErrorCode } from './retry';

/**
 * Keep DATE columns as the exact 'YYYY-MM-DD' text Postgres sent.
 *
 * The driver's default parses a DATE as *local* midnight, so on a non-UTC host
 * (the local container runs TZ=Australia/Brisbane) '2026-10-31' becomes
 * 2026-10-30T14:00Z and Drizzle's string mapper renders '2026-10-30' — every due
 * date shifts a day. Timestamps are unaffected: they stay naive 'YYYY-MM-DD
 * HH:MM:SS' strings, which is the contract the whole app already uses.
 */
types.setTypeParser(1082, (value: string) => value);

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
  return (await probeDatabase()).ok;
}

/**
 * Liveness probe that also explains *why* the database is unreachable.
 *
 * A bare `false` is useless in a container log — the household's v1.20.0 outage
 * was a stopped Postgres whose hostname no longer resolved, and the health probe
 * could only say "unavailable". The error string is safe to log and to expose on
 * /api/health: `describeDbError()` returns a driver code plus the driver message
 * (host names appear, passwords never do — the message never contains the URL).
 */
export async function probeDatabase(): Promise<{ ok: boolean; error?: string; code?: string }> {
  try {
    await getPool().query('SELECT 1');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: describeDbError(err), code: findErrorCode(err) };
  }
}

/**
 * `host:port/database` for DATABASE_URL — used in startup failure messages.
 * Never includes the password, so it is safe to log in a Coolify build/deploy log.
 */
export function describeDatabaseTarget(): string {
  const url = process.env.DATABASE_URL;
  if (!url) return '(DATABASE_URL is not set)';
  try {
    const parsed = new URL(url);
    const database = parsed.pathname.replace(/^\//, '') || '(no database)';
    return `${parsed.hostname}:${parsed.port || '5432'}/${database}`;
  } catch {
    return '(DATABASE_URL is not a valid URL)';
  }
}


export { schema };
