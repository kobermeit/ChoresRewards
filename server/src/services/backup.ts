import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import zlib from 'zlib';
import Database from 'better-sqlite3';
import * as tar from 'tar-stream';
import { db } from '../db';
import { APP_VERSION, DATA_DIR, DB_PATH, UPLOADS_DIR } from '../config';

/**
 * Household backup / restore.
 *
 * A backup is a single gzipped tar archive produced by this app:
 *
 *   manifest.json     metadata (format id, version, app version, checksums)
 *   database.db       consistent SQLite snapshot (better-sqlite3 online backup)
 *   secret_key        optional; keeps existing device sessions valid
 *   uploads/**        media: avatars, reward/chore photos, sounds, screensaver
 *
 * Restore never parses or executes SQL from the archive: it only replaces files
 * after validating the SQLite header, a PRAGMA quick_check and the presence of
 * the expected tables. Anything that is not one of the whitelisted entries
 * (symlinks, absolute paths, path traversal, unknown files) is rejected.
 */

export const BACKUP_FORMAT = 'choresrewards-backup';
export const BACKUP_FORMAT_VERSION = 1;
export const BACKUPS_DIR = path.join(DATA_DIR, 'backups');
export const RESTORE_DIR = path.join(DATA_DIR, 'restore');

const SQLITE_MAGIC = 'SQLite format 3\u0000';
const REQUIRED_TABLES = ['person', 'chore', 'app_settings'];
const MAX_ENTRIES = 20000;
const MAX_ARCHIVE_BYTES = 4 * 1024 * 1024 * 1024;

export interface BackupManifest {
  format: string;
  format_version: number;
  app_version: string;
  created_at: string;
  includes_media: boolean;
  database: { file: string; bytes: number; sha256: string };
  media?: { files: number; bytes: number };
}

export interface BackupStats {
  database_bytes: number;
  uploads_files: number;
  uploads_bytes: number;
}

export interface RestoreResult {
  manifest: BackupManifest;
  database_bytes: number;
  media_files: number;
  pre_restore_backup: string | null;
}

function secretKeyPath(): string {
  return path.join(DATA_DIR, 'secret_key');
}

function ensureDir(dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
}

function sha256File(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    stream.on('error', reject);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
  });
}

interface WalkedFile {
  absolute: string;
  relative: string;
  bytes: number;
}

/** Recursively list regular files (symlinks skipped) with POSIX-style relative paths. */
async function walkFiles(root: string, limit = MAX_ENTRIES): Promise<WalkedFile[]> {
  const out: WalkedFile[] = [];

  async function visit(dir: string, prefix: string): Promise<void> {
    if (out.length >= limit) return;
    let entries: fs.Dirent[];
    try {
      entries = await fs.promises.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (out.length >= limit) return;
      const absolute = path.join(dir, entry.name);
      const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) {
        await visit(absolute, relative);
        continue;
      }
      if (!entry.isFile()) continue;
      let stats: fs.Stats;
      try {
        stats = await fs.promises.stat(absolute);
      } catch {
        continue;
      }
      out.push({ absolute, relative, bytes: stats.size });
    }
  }

  await visit(root, '');
  return out;
}

/** Sizes shown in the settings UI before exporting. */
export async function describeDataFootprint(): Promise<BackupStats> {
  let databaseBytes = 0;
  try {
    databaseBytes = (await fs.promises.stat(DB_PATH)).size;
  } catch {
    // ignore
  }
  const uploads = await walkFiles(UPLOADS_DIR);
  return {
    database_bytes: databaseBytes,
    uploads_files: uploads.length,
    uploads_bytes: uploads.reduce((sum, file) => sum + file.bytes, 0),
  };
}

function addFileToArchive(pack: tar.Pack, absolute: string, name: string): Promise<void> {
  return new Promise((resolve, reject) => {
    let size: number;
    try {
      size = fs.statSync(absolute).size;
    } catch (err) {
      reject(err);
      return;
    }
    const entry = pack.entry({ name, mode: 0o644, size }, (err?: Error | null) => {
      if (err) reject(err);
      else resolve();
    });
    const source = fs.createReadStream(absolute);
    source.on('error', reject);
    source.pipe(entry);
  });
}

export interface BackupStream {
  stream: NodeJS.ReadableStream;
  filename: string;
  manifest: BackupManifest;
  cleanup: () => void;
}

/** Removes snapshot temp files left behind by a crash or a killed download. */
function sweepStaleSnapshots(maxAgeMs = 60 * 60 * 1000): void {
  try {
    const now = Date.now();
    for (const name of fs.readdirSync(BACKUPS_DIR)) {
      if (!name.startsWith('.snapshot-')) continue;
      const file = path.join(BACKUPS_DIR, name);
      try {
        if (now - fs.statSync(file).mtimeMs > maxAgeMs) fs.unlinkSync(file);
      } catch {
        // ignore individual failures
      }
    }
  } catch {
    // ignore: directory may not exist yet
  }
}

/**
 * Builds the archive as a stream so the download starts immediately.
 * The SQLite snapshot is written into DATA_DIR/backups first (a consistent copy
 * that does not block the live database) and removed once the stream finishes.
 */
export async function buildBackupStream(includeMedia: boolean): Promise<BackupStream> {
  ensureDir(BACKUPS_DIR);
  sweepStaleSnapshots();
  const snapshotPath = path.join(BACKUPS_DIR, `.snapshot-${Date.now()}-${process.pid}.db`);

  await db.backup(snapshotPath);

  const cleanup = () => {
    try {
      fs.unlinkSync(snapshotPath);
    } catch {
      // already gone
    }
  };

  const databaseBytes = (await fs.promises.stat(snapshotPath)).size;
  const uploads = includeMedia ? await walkFiles(UPLOADS_DIR) : [];

  const manifest: BackupManifest = {
    format: BACKUP_FORMAT,
    format_version: BACKUP_FORMAT_VERSION,
    app_version: APP_VERSION,
    created_at: new Date().toISOString(),
    includes_media: includeMedia,
    database: {
      file: 'database.db',
      bytes: databaseBytes,
      sha256: await sha256File(snapshotPath),
    },
    media: {
      files: uploads.length,
      bytes: uploads.reduce((sum, file) => sum + file.bytes, 0),
    },
  };

  const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
  const filename = `choresrewards-backup-${APP_VERSION}-${stamp}.tar.gz`;

  const pack = tar.pack();

  (async () => {
    pack.entry({ name: 'manifest.json', mode: 0o644 }, JSON.stringify(manifest, null, 2));
    await addFileToArchive(pack, snapshotPath, 'database.db');

    const keyFile = secretKeyPath();
    if (fs.existsSync(keyFile)) {
      await addFileToArchive(pack, keyFile, 'secret_key');
    }

    for (const file of uploads) {
      await addFileToArchive(pack, file.absolute, `uploads/${file.relative}`);
    }

    pack.finalize();
  })().catch((err) => {
    pack.destroy(err);
    cleanup();
  });

  const gzip = zlib.createGzip({ level: 6 });
  pack.pipe(gzip);
  pack.on('error', (err) => gzip.destroy(err));
  // cleanup is idempotent; 'end' fires as soon as the archive is fully read
  gzip.on('end', cleanup);
  gzip.on('close', cleanup);
  gzip.on('error', cleanup);

  return { stream: gzip, filename, manifest, cleanup };
}

/* -------------------------------------------------------------------------- */
/* Restore                                                                     */
/* -------------------------------------------------------------------------- */

interface ExtractedArchive {
  manifest: BackupManifest;
  databasePath: string;
  secretKeyFile: string | null;
  uploadsRoot: string | null;
}

/** Normalises an archive entry name, or returns null when it is unsafe to use. */
function safeEntryName(rawName: string): string | null {
  const name = String(rawName || '').replace(/\\/g, '/');
  if (!name || name.startsWith('/') || name.includes('\u0000')) return null;
  const parts = name.split('/').filter((part) => part && part !== '.');
  if (parts.length === 0) return null;
  if (parts.some((part) => part === '..')) return null;
  return parts.join('/');
}

/** Only the entries this app writes are accepted — anything else aborts the restore. */
function assertAllowedEntry(name: string): void {
  if (name === 'manifest.json' || name === 'database.db' || name === 'secret_key') return;
  if (name.startsWith('uploads/') && name.length > 'uploads/'.length) return;
  throw new Error(`Backup contains an unexpected file: ${name}`);
}

async function extractArchive(archivePath: string, stageDir: string): Promise<ExtractedArchive> {
  ensureDir(stageDir);
  const state = { failure: null as Error | null, entries: 0, bytes: 0 };

  await new Promise<void>((resolve, reject) => {
    const extract = tar.extract();

    extract.on('entry', (header: any, stream: any, next: any) => {
      const bail = (message: string) => {
        if (!state.failure) state.failure = new Error(message);
        stream.resume();
        next();
      };

      if (state.failure) return bail('Rejected after an earlier invalid entry.');

      const type = String(header.type || 'file');
      if (type === 'symlink' || type === 'link') {
        return bail('Backup contains links, which are not allowed.');
      }

      const name = safeEntryName(String(header.name || ''));
      if (!name) return bail('Backup contains an unsafe file path.');

      state.entries += 1;
      if (state.entries > MAX_ENTRIES) return bail('Backup contains too many files.');

      if (type === 'directory') {
        stream.resume();
        next();
        return;
      }

      try {
        assertAllowedEntry(name);
      } catch (err) {
        return bail((err as Error).message);
      }

      state.bytes += Number(header.size || 0);
      if (state.bytes > MAX_ARCHIVE_BYTES) return bail('Backup is too large to restore.');

      const destination = path.join(stageDir, ...name.split('/'));
      if (!destination.startsWith(stageDir)) return bail('Backup contains an unsafe file path.');

      ensureDir(path.dirname(destination));
      let settled = false;
      const finishEntry = () => {
        if (settled) return;
        settled = true;
        next();
      };
      const sink = fs.createWriteStream(destination);
      sink.on('error', (err) => {
        if (!state.failure) state.failure = err;
        stream.resume();
        finishEntry();
      });
      sink.on('finish', finishEntry);
      stream.pipe(sink);
    });

    extract.on('finish', () => (state.failure ? reject(state.failure) : resolve()));
    extract.on('error', (err) => reject(err));

    const gunzip = zlib.createGunzip();
    gunzip.on('error', (err) =>
      reject(new Error(`Backup is not a valid .tar.gz archive (${err.message}).`))
    );
    fs.createReadStream(archivePath)
      .on('error', reject)
      .pipe(gunzip)
      .pipe(extract);
  });

  const manifestPath = path.join(stageDir, 'manifest.json');
  const databasePath = path.join(stageDir, 'database.db');
  if (!fs.existsSync(databasePath)) {
    throw new Error('Backup is missing database.db — it does not look like a ChoresRewards backup.');
  }
  if (!fs.existsSync(manifestPath)) {
    throw new Error('Backup is missing manifest.json — it does not look like a ChoresRewards backup.');
  }

  let manifest: BackupManifest;
  try {
    if (fs.statSync(manifestPath).size > 1024 * 1024) {
      throw new Error('Backup manifest is unreasonably large.');
    }
    manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  } catch {
    throw new Error('Backup manifest is not valid JSON.');
  }
  if (manifest?.format !== BACKUP_FORMAT) {
    throw new Error('Backup was not created by ChoresRewards; refusing to restore it.');
  }
  if (Number(manifest.format_version) > BACKUP_FORMAT_VERSION) {
    throw new Error('Backup was created by a newer version of ChoresRewards. Update this server first.');
  }

  const secretKeyFile = path.join(stageDir, 'secret_key');
  const uploadsRoot = path.join(stageDir, 'uploads');

  return {
    manifest,
    databasePath,
    secretKeyFile: fs.existsSync(secretKeyFile) ? secretKeyFile : null,
    uploadsRoot: fs.existsSync(uploadsRoot) ? uploadsRoot : null,
  };
}

/**
 * Verifies the file really is a healthy SQLite database for this app.
 * Read-only inspection: no SQL from the archive is ever executed.
 */
function validateDatabaseFile(dbFilePath: string): number {
  const handle = fs.openSync(dbFilePath, 'r');
  const magic = Buffer.alloc(16);
  try {
    fs.readSync(handle, magic, 0, 16, 0);
  } finally {
    fs.closeSync(handle);
  }
  if (magic.toString('latin1') !== SQLITE_MAGIC) {
    throw new Error('The database inside the backup is not a SQLite file.');
  }

  let probe: InstanceType<typeof Database> | null = null;
  try {
    probe = new Database(dbFilePath, { readonly: true, fileMustExist: true });
    const quickCheck = String(probe.pragma('quick_check', { simple: true })).toLowerCase();
    if (quickCheck !== 'ok') {
      throw new Error(`Backup database failed its integrity check: ${quickCheck}`);
    }
    const rows = probe
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
      .all() as Array<{ name: string }>;
    const names = new Set(rows.map((row) => row.name));
    const missing = REQUIRED_TABLES.filter((table) => !names.has(table));
    if (missing.length > 0) {
      throw new Error(`Backup database is missing tables: ${missing.join(', ')}.`);
    }
  } finally {
    try {
      probe?.close();
    } catch {
      // ignore
    }
  }

  return fs.statSync(dbFilePath).size;
}

/**
 * Restores a backup over the live household data.
 *
 * The current database is snapshotted into DATA_DIR/backups first, then the
 * database handle is closed, the WAL removed and the restored files swapped in.
 * The caller restarts the process afterwards so the new database is opened
 * cleanly (the route answers first, then exits; Docker/Coolify restarts it).
 */
export async function restoreFromArchive(archivePath: string): Promise<RestoreResult> {
  ensureDir(RESTORE_DIR);
  const stageDir = path.join(RESTORE_DIR, `stage-${Date.now()}-${process.pid}`);

  try {
    const extracted = await extractArchive(archivePath, stageDir);
    const databaseBytes = validateDatabaseFile(extracted.databasePath);

    const expectedBytes = Number(extracted.manifest.database?.bytes || 0);
    if (expectedBytes > 0 && expectedBytes !== databaseBytes) {
      throw new Error('Backup database size does not match its manifest — the file may be corrupt.');
    }

    ensureDir(BACKUPS_DIR);
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    let preRestoreBackup: string | null = path.join(BACKUPS_DIR, `pre-restore-${stamp}.db`);
    try {
      await db.backup(preRestoreBackup);
    } catch {
      preRestoreBackup = null;
    }

    db.close();
    for (const suffix of ['-wal', '-shm']) {
      try {
        fs.unlinkSync(`${DB_PATH}${suffix}`);
      } catch {
        // ignore: file may not exist
      }
    }
    fs.copyFileSync(extracted.databasePath, DB_PATH);

    if (extracted.secretKeyFile) {
      fs.copyFileSync(extracted.secretKeyFile, secretKeyPath());
    }

    let mediaFiles = 0;
    if (extracted.uploadsRoot) {
      for (const file of await walkFiles(extracted.uploadsRoot)) {
        const destination = path.join(UPLOADS_DIR, ...file.relative.split('/'));
        ensureDir(path.dirname(destination));
        fs.copyFileSync(file.absolute, destination);
        mediaFiles += 1;
      }
    }

    return {
      manifest: extracted.manifest,
      database_bytes: databaseBytes,
      media_files: mediaFiles,
      pre_restore_backup: preRestoreBackup,
    };
  } finally {
    // Await the cleanup so no staging directories are left behind on failure.
    await fs.promises.rm(stageDir, { recursive: true, force: true }).catch(() => undefined);
  }
}



