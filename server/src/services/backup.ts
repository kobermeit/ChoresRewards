import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import * as tar from 'tar-stream';
import type { PoolClient } from 'pg';
import { getPool } from '../db/client';
import { AppSetting } from '../db';
import { APP_VERSION, DATA_DIR, UPLOADS_DIR } from '../config';

/**
 * Household backup / restore (Postgres edition).
 *
 * The archive is a single `.tar.gz`:
 *   manifest.json  — format metadata + per-table row counts
 *   database.json  — logical dump of every household table (Postgres rows)
 *   secret_key     — so existing device logins survive a migration
 *   uploads/**     — avatars, reward/chore photos, sounds, screensaver media
 *
 * A v2 archive is the only format accepted. Legacy v1 archives (a SQLite
 * `database.db` member instead of `database.json`) must be upgraded first with
 * `scripts/convert-v1-backup.js` — the app no longer links a SQLite driver.
 *
 * Nothing in the archive is ever executed as SQL — rows are validated against a
 * fixed table/column whitelist and written through parameterised inserts.
 */

export const BACKUPS_DIR = path.join(DATA_DIR, 'backups');

/** Insertion order (FK-safe); deletes run in reverse. */
const TABLES = [
  'person',
  'seasons',
  'seasonal_events',
  'app_settings',
  'shopping_catalog',
  'recipes',
  'reward',
  'chore',
  'chore_log',
  'shopping_purchase_log',
  'person_streak',
  'person_badge',
  'notifications',
  'activity_log',
  'organise_item',
  'vehicle_service',
  'applied_mutation',
] as const;

/** Columns that hold booleans. Exports already contain real booleans; the map keeps
 *  hand-written or converted archives (`0` / `1` / `"true"`) importable. */
const BOOLEAN_COLUMNS: Record<string, string[]> = {
  person: ['is_admin'],
  chore: ['completed', 'is_daily', 'deleted', 'is_extra'],
  chore_log: ['was_overdue'],
  reward: ['completed', 'is_recurring'],
  notifications: ['admin_only'],
  organise_item: ['paid'],
};

const ALLOWED_FILES = new Set(['manifest.json', 'database.json', 'secret_key']);

/** Format identifier written into `manifest.app` by every v2 export. */
const BACKUP_FORMAT_ID = 'choresrewards';
/** Current archive format. v1 (SQLite) archives are converted offline first. */
const BACKUP_FORMAT_VERSION = 2;

export interface BackupManifest {
  app: string;
  format_version: number;
  app_version: string;
  created_at: string;
  includes_media: boolean;
  tables?: Record<string, number>;
}

export interface BackupHandle {
  stream: NodeJS.ReadableStream;
  filename: string;
  manifest: BackupManifest;
  cleanup: () => void;
}

async function dumpTables(): Promise<{ tables: Record<string, unknown[]>; counts: Record<string, number> }> {
  const tables: Record<string, unknown[]> = {};
  const counts: Record<string, number> = {};
  for (const table of TABLES) {
    // `json_agg` makes Postgres render DATE / TIMESTAMP columns as plain text
    // ('YYYY-MM-DD', 'YYYY-MM-DDTHH:MM:SS') instead of letting the driver turn
    // them into JS Dates. That keeps the archive timezone-independent: the same
    // file restores identically on a UTC container and on a local dev machine.
    const result = await getPool().query(
      `SELECT COALESCE(json_agg(t), '[]'::json) AS rows FROM "${table}" t`
    );
    const rows = (result.rows[0]?.rows ?? []) as unknown[];
    tables[table] = rows;
    counts[table] = rows.length;
  }
  return { tables, counts };
}

async function countTables(): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  for (const table of TABLES) {
    const result = await getPool().query(`SELECT COUNT(*)::int AS c FROM "${table}"`);
    counts[table] = Number(result.rows[0]?.c ?? 0);
  }
  return counts;
}

export async function describeDataFootprint(): Promise<Record<string, unknown>> {
  fs.mkdirSync(BACKUPS_DIR, { recursive: true });
  const counts = await countTables();
  let uploadsBytes = 0;
  let uploadsFiles = 0;
  const walk = (dir: string): void => {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else {
        uploadsFiles += 1;
        uploadsBytes += fs.statSync(full).size;
      }
    }
  };
  walk(UPLOADS_DIR);

  return {
    database: 'postgres',
    tables: counts,
    total_rows: Object.values(counts).reduce((a, b) => a + b, 0),
    uploads_files: uploadsFiles,
    uploads_bytes: uploadsBytes,
    backups_dir: BACKUPS_DIR,
    format_version: BACKUP_FORMAT_VERSION,
  };
}

/* ------------------------------------------------------------------ *
 * Export
 * ------------------------------------------------------------------ */

export async function buildBackupStream(includeMedia: boolean): Promise<BackupHandle> {
  const { tables, counts } = await dumpTables();
  const manifest: BackupManifest = {
    app: BACKUP_FORMAT_ID,
    format_version: BACKUP_FORMAT_VERSION,
    app_version: APP_VERSION,
    created_at: new Date().toISOString(),
    includes_media: includeMedia,
    tables: counts,
  };

  const tarGz = zlib.createGzip({ level: 6 });
  const pack = tar.pack();
  pack.pipe(tarGz);

  const writeEntry = (name: string, content: Buffer | string): Promise<void> =>
    new Promise((resolve, reject) => {
      const body = Buffer.isBuffer(content) ? content : Buffer.from(content);
      pack.entry({ name, size: body.length }, body, (err) => (err ? reject(err) : resolve()));
    });

  void (async () => {
    try {
      await writeEntry('manifest.json', JSON.stringify(manifest, null, 2));
      await writeEntry('database.json', JSON.stringify({ tables }, null, 2));

      const secretPath = path.join(DATA_DIR, 'secret_key');
      if (fs.existsSync(secretPath)) {
        await writeEntry('secret_key', fs.readFileSync(secretPath));
      }

      if (includeMedia && fs.existsSync(UPLOADS_DIR)) {
        const walk = async (dir: string): Promise<void> => {
          for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) await walk(full);
            else await writeEntry(path.relative(DATA_DIR, full).split(path.sep).join('/'), fs.readFileSync(full));
          }
        };
        await walk(UPLOADS_DIR);
      }
      pack.finalize();
    } catch (err) {
      pack.destroy(err as Error);
    }
  })();

  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  return {
    stream: tarGz,
    filename: `choresrewards-backup-${stamp}.tar.gz`,
    manifest,
    cleanup: () => tarGz.destroy(),
  };
}


/* ------------------------------------------------------------------ *
 * Restore
 * ------------------------------------------------------------------ */

async function extractArchive(archivePath: string, dest: string): Promise<string[]> {
  const extracted: string[] = [];
  await new Promise<void>((resolve, reject) => {
    const extract = tar.extract();
    const gunzip = zlib.createGunzip();
    extract.on('entry', (header, stream, next) => {
      const name = header.name.replace(/\\/g, '/');
      const isUpload = name.startsWith('uploads/');
      const safeName = !name.startsWith('/') && !name.split('/').includes('..');
      if (header.type !== 'file' || !safeName || (!ALLOWED_FILES.has(name) && !isUpload)) {
        stream.resume();
        next();
        return;
      }
      const chunks: Buffer[] = [];
      stream.on('data', (chunk) => chunks.push(chunk as Buffer));
      stream.on('error', reject);
      stream.on('end', () => {
        const target = path.join(dest, name);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, Buffer.concat(chunks));
        extracted.push(name);
        next();
      });
    });
    extract.on('finish', () => resolve());
    extract.on('error', reject);
    gunzip.on('error', reject);
    fs.createReadStream(archivePath).pipe(gunzip).pipe(extract);
  });
  return extracted;
}

/** Columns holding a date/timestamp — SQLite stored `''` here, Postgres needs NULL. */
const isDateish = (column: string): boolean =>
  column === 'date' || column.endsWith('_at') || column.endsWith('_date') || column.endsWith('_md');

function coerceRow(table: string, row: Record<string, unknown>): Record<string, unknown> {
  const booleans = BOOLEAN_COLUMNS[table] || [];
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    if (value === undefined || value === null) {
      out[key] = null;
      continue;
    }
    // Postgres needs real booleans, never 0/1 or '1'.
    if (booleans.includes(key)) {
      out[key] =
        typeof value === 'boolean' ? value : value === 1 || value === '1' || value === 'true';
      continue;
    }
    // Postgres rejects '' for date/timestamp columns; text columns keep it.
    if (value === '' && isDateish(key)) {
      out[key] = null;
      continue;
    }
    out[key] = value;
  }
  return out;
}

/**
 * Reset the identity sequence behind a table's integer `id`.
 *
 * `pg_get_serial_sequence()` raises an error for tables without an `id` column
 * (e.g. `applied_mutation`, keyed by a text `mutation_id`). Inside a transaction
 * that error would abort everything and the final COMMIT would silently degrade
 * to a ROLLBACK — so the column is checked first and the sequence reset is
 * parameterised instead of string-interpolated.
 */
async function resetIdentity(client: PoolClient, table: string): Promise<void> {
  const column = await client.query(
    `SELECT 1 FROM information_schema.columns
      WHERE table_schema = current_schema() AND table_name = $1 AND column_name = 'id'`,
    [table]
  );
  if (column.rowCount === 0) return;

  const sequence = await client.query(`SELECT pg_get_serial_sequence($1, 'id') AS seq`, [table]);
  const seq = sequence.rows[0]?.seq;
  if (!seq) return;

  await client.query(
    `SELECT setval($1::regclass, GREATEST((SELECT COALESCE(MAX(id), 0) FROM "${table}"), 1), true)`,
    [seq]
  );
}

async function replaceTables(tables: Record<string, Record<string, unknown>[]>): Promise<Record<string, number>> {
  const client = await getPool().connect();
  const counts: Record<string, number> = {};
  try {
    await client.query('BEGIN');
    for (const table of [...TABLES].reverse()) {
      await client.query(`DELETE FROM "${table}"`);
    }
    for (const table of TABLES) {
      const rows = Array.isArray(tables[table]) ? tables[table] : [];
      counts[table] = rows.length;
      for (const raw of rows) {
        const row = coerceRow(table, raw);
        const columns = Object.keys(row);
        if (columns.length === 0) continue;
        const placeholders = columns.map((_, index) => `$${index + 1}`).join(', ');
        const sql = `INSERT INTO "${table}" (${columns.map((c) => `"${c}"`).join(', ')}) VALUES (${placeholders})`;
        await client.query(sql, columns.map((c) => row[c]));
      }
      await resetIdentity(client, table);
    }
    const commit = await client.query('COMMIT');
    // Postgres answers COMMIT on an aborted transaction with a ROLLBACK tag and
    // no error, which would otherwise be reported to the user as a success.
    if (commit.command === 'ROLLBACK') {
      throw new Error('Postgres rolled the restore back — no data was changed.');
    }
    // Confirm the committed rows are really there.
    for (const table of TABLES) {
      const result = await client.query(`SELECT COUNT(*)::int AS c FROM "${table}"`);
      if (Number(result.rows[0].c) !== counts[table]) {
        throw new Error(
          `Restore verification failed for ${table}: expected ${counts[table]} row(s), found ${result.rows[0].c}.`
        );
      }
    }
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
  return counts;
}

export interface RestoreResult {
  manifest: BackupManifest;
  tables: Record<string, number>;
  media_files: number;
  database_bytes: number;
  pre_restore_backup: string | null;
}


export async function restoreFromArchive(archivePath: string): Promise<RestoreResult> {
  fs.mkdirSync(BACKUPS_DIR, { recursive: true });
  const tempDir = fs.mkdtempSync(path.join(DATA_DIR, 'restore-'));
  try {
    await extractArchive(archivePath, tempDir);

    const manifestPath = path.join(tempDir, 'manifest.json');
    if (!fs.existsSync(manifestPath)) {
      throw new Error('Not a ChoresRewards backup — manifest.json is missing.');
    }
    let manifest: BackupManifest;
    try {
      manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    } catch {
      throw new Error('The backup manifest is not valid JSON.');
    }
    // v1 archives carry `format: 'choresrewards-backup'` and a SQLite payload;
    // they are rejected with a pointer to the offline converter, not loaded.
    const rawManifest = manifest as unknown as Record<string, unknown>;
    const legacyV1 =
      rawManifest.app !== BACKUP_FORMAT_ID &&
      (rawManifest.format === 'choresrewards-backup' || Number(rawManifest.format_version) === 1);
    if (legacyV1) {
      throw new Error(
        'This is a legacy v1 (SQLite) backup. Convert it first with ' +
          '`node scripts/convert-v1-backup.js <archive.tar.gz>` and import the converted file.'
      );
    }
    if (manifest.app !== BACKUP_FORMAT_ID) {
      throw new Error('This archive was created by another application.');
    }
    if (Number(manifest.format_version) !== BACKUP_FORMAT_VERSION) {
      throw new Error(
        `Unsupported backup format version ${manifest.format_version ?? 'unknown'} — this app reads format v${BACKUP_FORMAT_VERSION} archives.`
      );
    }

    // Safety net: keep a logical copy of the current household before replacing it.
    const preRestore = path.join(BACKUPS_DIR, `pre-restore-${Date.now()}.json`);
    fs.writeFileSync(preRestore, JSON.stringify(await dumpTables(), null, 2));

    const jsonPath = path.join(tempDir, 'database.json');
    if (!fs.existsSync(jsonPath)) {
      throw new Error('The backup contains no database.json payload — this is not a format v2 archive.');
    }
    const parsed = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    if (!parsed || typeof parsed.tables !== 'object' || parsed.tables === null) {
      throw new Error('The backup database payload is malformed.');
    }
    const tables = parsed.tables as Record<string, Record<string, unknown>[]>;

    const counts = await replaceTables(tables);
    // Settings are cache-backed — reload them from the restored rows.
    await AppSetting.load();

    let mediaFiles = 0;
    const restoredUploads = path.join(tempDir, 'uploads');
    if (fs.existsSync(restoredUploads)) {
      fs.mkdirSync(UPLOADS_DIR, { recursive: true });
      const copy = (dir: string): void => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          const full = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            copy(full);
            continue;
          }
          const rel = path.relative(restoredUploads, full);
          const target = path.join(UPLOADS_DIR, rel);
          fs.mkdirSync(path.dirname(target), { recursive: true });
          fs.copyFileSync(full, target);
          mediaFiles += 1;
        }
      };
      copy(restoredUploads);
    }

    const restoredSecret = path.join(tempDir, 'secret_key');
    if (fs.existsSync(restoredSecret)) {
      if (process.env.CR_SECRET_KEY) {
        console.warn('[backup] CR_SECRET_KEY is set — the restored signing key will NOT be used.');
      } else {
        fs.writeFileSync(path.join(DATA_DIR, 'secret_key'), fs.readFileSync(restoredSecret), { mode: 0o600 });
        console.log('[backup] Restored session signing key from the archive.');
      }
    }

    console.log(`[backup] Restore complete: ${Object.values(counts).reduce((a, b) => a + b, 0)} rows, ${mediaFiles} media file(s).`);

    return {
      manifest,
      tables: counts,
      media_files: mediaFiles,
      database_bytes: fs.statSync(manifestPath).size,
      pre_restore_backup: preRestore,
    };
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

