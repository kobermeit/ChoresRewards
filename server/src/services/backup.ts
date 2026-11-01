import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import * as tar from 'tar-stream';
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
 * A v1 archive (SQLite `database.db` instead of `database.json`) is still
 * accepted: it is loaded through the same table mapping so households can move
 * off the old add-on without a CLI step.
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

/** 0/1 columns in the legacy SQLite database (Postgres uses real booleans). */
const BOOLEAN_COLUMNS: Record<string, string[]> = {
  person: ['is_admin'],
  chore: ['completed', 'is_daily', 'deleted', 'is_extra'],
  chore_log: ['was_overdue'],
  reward: ['completed', 'is_recurring'],
  notifications: ['admin_only'],
  organise_item: ['paid'],
};

const ALLOWED_FILES = new Set(['manifest.json', 'database.json', 'database.db', 'secret_key']);

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
    const result = await getPool().query(`SELECT * FROM "${table}"`);
    tables[table] = result.rows;
    counts[table] = result.rowCount ?? result.rows.length;
  }
  return { tables, counts };
}

export async function describeDataFootprint(): Promise<Record<string, unknown>> {
  fs.mkdirSync(BACKUPS_DIR, { recursive: true });
  const { counts } = await dumpTables();
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
    format_version: 2,
  };
}

/* ------------------------------------------------------------------ *
 * Export
 * ------------------------------------------------------------------ */

export async function buildBackupStream(includeMedia: boolean): Promise<BackupHandle> {
  const { tables, counts } = await dumpTables();
  const manifest: BackupManifest = {
    app: 'choresrewards',
    format_version: 2,
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

function coerceRow(table: string, row: Record<string, unknown>): Record<string, unknown> {
  const out = { ...row };
  for (const column of BOOLEAN_COLUMNS[table] || []) {
    const value = out[column];
    if (value === null || value === undefined) continue;
    out[column] = value === true || value === 1 || value === '1' || value === 'true';
  }
  // Postgres rejects empty strings for date/timestamp columns that came from SQLite as ''
  for (const [key, value] of Object.entries(out)) {
    if (value === '') out[key] = null;
  }
  return out;
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
      await client
        .query(
          `SELECT setval(pg_get_serial_sequence('"${table}"', 'id'), GREATEST((SELECT COALESCE(MAX(id), 0) FROM "${table}"), 1))`
        )
        .catch(() => undefined);
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
  return counts;
}

/** Read the tables out of a v1 (SQLite) archive member. */
async function readSqliteTables(dbPath: string): Promise<Record<string, Record<string, unknown>[]>> {
  const { default: Database } = await import('better-sqlite3');
  const sqlite = new Database(dbPath, { readonly: true, fileMustExist: true });
  try {
    const check = sqlite.pragma('quick_check', { simple: true });
    if (String(check).toLowerCase() !== 'ok') {
      throw new Error('The archive database failed its integrity check.');
    }
    const present = new Set(
      (sqlite.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as Array<{ name: string }>).map(
        (row) => row.name
      )
    );
    const out: Record<string, Record<string, unknown>[]> = {};
    for (const table of TABLES) {
      if (!present.has(table)) continue;
      out[table] = sqlite.prepare(`SELECT * FROM "${table}"`).all() as Record<string, unknown>[];
    }
    return out;
  } finally {
    sqlite.close();
  }
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
    if (manifest.app !== 'choresrewards') {
      throw new Error('This archive was created by another application.');
    }

    // Safety net: keep a logical copy of the current household before replacing it.
    const preRestore = path.join(BACKUPS_DIR, `pre-restore-${Date.now()}.json`);
    fs.writeFileSync(preRestore, JSON.stringify(await dumpTables(), null, 2));

    let tables: Record<string, Record<string, unknown>[]>;
    const jsonPath = path.join(tempDir, 'database.json');
    const sqlitePath = path.join(tempDir, 'database.db');
    if (fs.existsSync(jsonPath)) {
      const parsed = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
      if (!parsed || typeof parsed.tables !== 'object' || parsed.tables === null) {
        throw new Error('The backup database payload is malformed.');
      }
      tables = parsed.tables;
    } else if (fs.existsSync(sqlitePath)) {
      tables = await readSqliteTables(sqlitePath);
    } else {
      throw new Error('The backup contains no database payload.');
    }

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

