import path from 'path';
import Database from 'better-sqlite3';
import fs from 'fs';
import { getPool, closePool } from '../db/client';

/**
 * One-off SQLite → Postgres data migration (Phase 4).
 *
 *   npm --prefix server run db:import -- <path to database.db>
 *
 * Reads every table out of the legacy SQLite file, coerces SQLite's 0/1 flags to real
 * booleans, normalises empty-string dates to NULL, inserts rows in FK-safe order,
 * resets the identity sequences and finally verifies row counts.
 * Safe to re-run: inserts use ON CONFLICT DO NOTHING.
 */

const TABLE_ORDER = [
  'person',
  'seasons',
  'seasonal_events',
  'app_settings',
  'chore',
  'chore_log',
  'reward',
  'person_streak',
  'person_badge',
  'organise_item',
  'vehicle_service',
  'shopping_catalog',
  'shopping_purchase_log',
  'recipes',
  'notifications',
  'activity_log',
  'applied_mutation',
];

/** SQLite stores booleans as 0/1 integers; these columns become real booleans. */
const BOOLEAN_COLUMNS: Record<string, string[]> = {
  person: ['is_admin'],
  chore: ['completed', 'is_daily', 'deleted', 'is_extra'],
  reward: ['completed', 'is_recurring'],
  chore_log: ['was_overdue'],
  notifications: ['admin_only'],
  organise_item: ['paid'],
};

const NULLABLE_DATE_HINTS = ['_at', 'date', '_md'];

const isDateish = (column: string) =>
  column === 'date' || NULLABLE_DATE_HINTS.some((hint) => column.endsWith(hint));

async function main(): Promise<void> {
  const sqlitePath = process.argv[2] || path.resolve(__dirname, '../../../instance/database.db');
  console.log(`[import] SQLite source: ${sqlitePath}`);
  const sqlite = new Database(sqlitePath, { readonly: true });
  const pg = await getPool().connect();
  const counts: Array<{ table: string; sqlite: number; postgres: number; ok: boolean }> = [];

  try {
    await pg.query('BEGIN');
    for (const table of TABLE_ORDER) {
      const exists = sqlite
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ?")
        .get(table);
      if (!exists) {
        console.log(`[import] ${table}: not present in source, skipped`);
        continue;
      }

      const columns: string[] = sqlite
        .prepare(`PRAGMA table_info(${table})`)
        .all()
        .map((c: any) => c.name);
      if (columns.length === 0) continue;

      const rows = sqlite.prepare(`SELECT * FROM ${table}`).all() as Array<Record<string, any>>;
      const booleans = new Set(BOOLEAN_COLUMNS[table] || []);
      const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
      const columnList = columns.map((c) => `"${c}"`).join(', ');
      const statement = `INSERT INTO "${table}" (${columnList}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`;

      for (const row of rows) {
        const values = columns.map((column) => {
          const raw = row[column];
          if (raw === undefined) return null;
          if (booleans.has(column)) return raw === null ? null : Boolean(Number(raw));
          // Only date-ish columns turn '' into NULL; text columns keep the empty string
          if (raw === '') return isDateish(column) ? null : raw;
          return raw;
        });
        await pg.query(statement, values);
      }

      if (columns.includes('id')) {
        await pg.query(
          `SELECT setval(pg_get_serial_sequence('${table}', 'id'), GREATEST((SELECT COALESCE(MAX(id), 1) FROM "${table}"), 1))`
        );
      }

      const pgCount = await pg.query(`SELECT COUNT(*)::int AS c FROM "${table}"`);
      const sqliteCount = rows.length;
      const postgresCount = pgCount.rows[0].c;
      counts.push({ table, sqlite: sqliteCount, postgres: postgresCount, ok: postgresCount >= sqliteCount });
      console.log(`[import] ${table}: sqlite=${sqliteCount} postgres=${postgresCount}`);
    }
    await pg.query('COMMIT');
  } catch (err) {
    await pg.query('ROLLBACK').catch(() => undefined);
    throw err;
  } finally {
    pg.release();
    sqlite.close();
  }

  const failures = counts.filter((c) => !c.ok);
  fs.writeFileSync(
    path.resolve(__dirname, '../../../instance/import-report.json'),
    JSON.stringify({ counts, failures: failures.map((f) => f.table) }, null, 2)
  );
  console.log('\n[import] Summary');
  for (const row of counts) console.log(`  ${row.ok ? '✔' : '✖'} ${row.table}: ${row.postgres}/${row.sqlite}`);
  if (failures.length > 0) {
    console.error(`[import] FAILED verification for: ${failures.map((f) => f.table).join(', ')}`);
    await closePool();
    process.exit(1);
  }
  console.log('[import] All row counts verified.');
  await closePool();
}

main().catch(async (err) => {
  console.error('[import] Failed:', err);
  await closePool();
  process.exit(1);
});
