import fs from 'fs';
import path from 'path';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { getDb } from './client';

/**
 * Applies all pending Drizzle migrations at boot (idempotent — drizzle tracks
 * applied migrations in `drizzle.__drizzle_migrations`).
 *
 * The migrations folder is copied into the runtime image next to server/dist.
 */
export async function runMigrations(): Promise<void> {
  const folder = path.join(__dirname, '..', '..', 'drizzle');
  if (!fs.existsSync(folder)) {
    console.warn(`[db] No migrations folder at ${folder} — skipping migration run.`);
    return;
  }
  console.log('[db] Applying Postgres migrations…');
  await migrate(getDb(), { migrationsFolder: folder });
  console.log('[db] Migrations up to date.');
}
