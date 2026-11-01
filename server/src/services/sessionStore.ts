import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import { getPool } from '../db/client';

/**
 * Sessions live in Postgres (the `session` table created by the Drizzle
 * migrations), so a container restart / redeploy keeps every wall tablet logged in.
 *
 * `tableName` matches `server/src/db/schema.ts` and `createTableIfMissing` stays
 * off — the migrations own the schema.
 */
const PgSessionStore = connectPgSimple(session);

export function createSessionStore(): session.Store {
  return new PgSessionStore({
    pool: getPool(),
    tableName: 'session',
    createTableIfMissing: false,
    pruneSessionInterval: 60 * 15, // prune expired rows every 15 minutes
    errorLog: (...args: unknown[]) => console.error('[session]', ...args),
  });
}
