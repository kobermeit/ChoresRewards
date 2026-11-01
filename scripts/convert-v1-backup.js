#!/usr/bin/env node
/**
 * Convert a legacy ChoresRewards backup (format v1, SQLite) into the current
 * format v2 archive (logical JSON dump) that the Postgres app can import.
 *
 *   node scripts/convert-v1-backup.js <input .tar.gz> [output .tar.gz]
 *
 * Why this exists: the app used to ship the household database in SQLite. Since
 * v1.17.0 the household lives in Postgres and the restore endpoint only accepts
 * format v2 (`manifest.json` + `database.json`). This offline tool upgrades an
 * old archive so it can be uploaded through Settings → Backup & Restore.
 *
 * Coercion mirrors the original Postgres importer exactly:
 *   - SQLite 0/1 flags become real booleans (Postgres rejects integers there)
 *   - '' is kept for text columns but becomes NULL for date-ish columns
 *     (Postgres rejects '' for `date` / `timestamp`)
 *   - only columns that exist in the Postgres schema are written
 *
 * Requires `better-sqlite3` (the only legacy reader), resolved from
 * server/node_modules. If it was pruned, install it temporarily:
 *   npm --prefix server install --no-save better-sqlite3
 */
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');
const tar = require(path.join(__dirname, '..', 'server', 'node_modules', 'tar-stream'));

const FORMAT_V2 = 2;
const ALLOWED_UPLOAD_PREFIX = 'uploads/';

/** Postgres columns per table, in FK-safe insertion order. */
const TABLE_COLUMNS = {
  person: [
    'id', 'name', 'points', 'bonus_points', 'last_reset', 'last_bonus_awarded',
    'last_daily_chores_added', 'avatar', 'color', 'order', 'pin', 'is_admin', 'age',
    'role', 'calendar_ical_url', 'dob', 'created_at', 'updated_at',
  ],
  seasons: [
    'id', 'key', 'name', 'enabled', 'start_md', 'end_md', 'emoji', 'accent',
    'sound_key', 'created_at', 'updated_at',
  ],
  seasonal_events: [
    'id', 'key', 'name', 'enabled', 'rule_type', 'month_day', 'days_before',
    'days_after', 'emoji', 'accent', 'sound_key', 'created_at', 'updated_at',
  ],
  app_settings: ['id', 'key', 'value', 'created_at', 'updated_at'],
  shopping_catalog: [
    'id', 'name', 'normalized_key', 'default_store', 'times_added', 'times_purchased',
    'last_added_at', 'last_purchased_at', 'avg_interval_days', 'created_at', 'updated_at',
  ],
  recipes: [
    'id', 'meal_key', 'title', 'image_url', 'ingredients_json', 'instructions',
    'servings', 'prep_time', 'notion_id', 'created_at', 'updated_at',
  ],
  reward: [
    'id', 'title', 'points_required', 'image_url', 'description', 'assigned_to_id',
    'assigned_to', 'completed', 'date_completed', 'is_recurring', 'source_url',
    'source_name', 'created_at', 'updated_at', 'last_synced_at', 'sync_error_count',
  ],
  chore: [
    'id', 'title', 'assigned_to_id', 'assigned_to', 'points', 'completed',
    'date_completed', 'is_daily', 'days_of_week', 'due_date', 'due_datetime', 'deleted',
    'icon', 'is_extra', 'extra_id', 'image_url', 'duration_seconds', 'description',
    'created_at', 'updated_at',
  ],
  chore_log: [
    'id', 'chore_id', 'chore_title', 'person_id', 'person_name', 'completed_by_id',
    'completed_by_name', 'points_awarded', 'for_date', 'completed_at', 'target_seconds',
    'actual_seconds', 'seconds_saved', 'timer_status', 'was_overdue', 'notes',
    'created_at', 'updated_at',
  ],
  shopping_purchase_log: [
    'id', 'catalog_id', 'purchased_at', 'store', 'qty', 'created_at', 'updated_at',
  ],
  person_streak: [
    'id', 'person_id', 'current_streak', 'longest_streak', 'last_completed_date',
    'created_at', 'updated_at',
  ],
  person_badge: ['id', 'person_id', 'badge_key', 'earned_at', 'created_at', 'updated_at'],
  notifications: [
    'id', 'dedupe_key', 'kind', 'severity', 'days', 'title', 'detail', 'target',
    'admin_only', 'read_at', 'dismissed_at', 'created_at', 'updated_at',
  ],
  activity_log: ['id', 'date', 'type', 'description', 'user_name', 'created_at', 'updated_at'],
  organise_item: [
    'id', 'category', 'title', 'provider', 'notes', 'due_date', 'last_date', 'paid',
    'cost', 'reminder_days', 'icon', 'sort_order', 'photo_filename', 'vehicle_make',
    'vehicle_model', 'vehicle_year', 'vehicle_rego', 'current_odometer',
    'next_service_date', 'next_service_mileage', 'parent_id', 'created_at', 'updated_at',
  ],
  vehicle_service: [
    'id', 'organise_item_id', 'service_type', 'service_date', 'next_service_date',
    'next_service_mileage', 'mileage', 'cost', 'provider', 'notes', 'created_at',
    'updated_at',
  ],
  applied_mutation: ['mutation_id', 'endpoint', 'applied_at'],
};

const TABLES = Object.keys(TABLE_COLUMNS);

const BOOLEAN_COLUMNS = {
  person: ['is_admin'],
  chore: ['completed', 'is_daily', 'deleted', 'is_extra'],
  chore_log: ['was_overdue'],
  reward: ['completed', 'is_recurring'],
  notifications: ['admin_only'],
  organise_item: ['paid'],
};

const isDateish = (column) =>
  column === 'date' || column.endsWith('_at') || column.endsWith('_date') || column.endsWith('_md');

function loadSqlite() {
  const candidates = [
    path.join(__dirname, '..', 'server', 'node_modules', 'better-sqlite3'),
    'better-sqlite3',
  ];
  for (const candidate of candidates) {
    try {
      return require(candidate);
    } catch {
      // try the next location
    }
  }
  throw new Error(
    'better-sqlite3 is required to read a legacy archive. Install it temporarily:\n' +
      '  npm --prefix server install --no-save better-sqlite3'
  );
}

/** Reads manifest.json / database.db / secret_key / uploads/** out of a tar.gz. */
function readArchive(archivePath) {
  return new Promise((resolve, reject) => {
    const files = { uploads: [] };
    const extract = tar.extract();
    const gunzip = zlib.createGunzip();
    extract.on('entry', (header, stream, next) => {
      const name = header.name.replace(/\\/g, '/');
      const safe = !name.startsWith('/') && !name.split('/').includes('..');
      const wanted =
        safe &&
        (['manifest.json', 'database.db', 'secret_key'].includes(name) ||
          name.startsWith(ALLOWED_UPLOAD_PREFIX));
      if (header.type !== 'file' || !wanted) {
        stream.resume();
        next();
        return;
      }
      const chunks = [];
      stream.on('data', (chunk) => chunks.push(chunk));
      stream.on('error', reject);
      stream.on('end', () => {
        const body = Buffer.concat(chunks);
        if (name.startsWith(ALLOWED_UPLOAD_PREFIX)) files.uploads.push({ name, body });
        else files[name] = body;
        next();
      });
    });
    extract.on('error', reject);
    gunzip.on('error', reject);
    fs.createReadStream(archivePath).pipe(gunzip).pipe(extract).on('finish', () => resolve(files));
  });
}

/** Writes a format v2 tar.gz (manifest.json + database.json + secret_key + uploads). */
function writeArchive(outputPath, manifest, database, secretKey, uploads) {
  return new Promise((resolve, reject) => {
    const gzip = zlib.createGzip({ level: 6 });
    const pack = tar.pack();
    const out = fs.createWriteStream(outputPath);
    pack.pipe(gzip).pipe(out);

    const add = (name, body) =>
      new Promise((res, rej) => {
        const buffer = Buffer.isBuffer(body) ? body : Buffer.from(body);
        pack.entry({ name, size: buffer.length }, buffer, (err) => (err ? rej(err) : res()));
      });

    (async () => {
      await add('manifest.json', JSON.stringify(manifest, null, 2));
      await add('database.json', JSON.stringify({ tables: database }, null, 2));
      if (secretKey) await add('secret_key', secretKey);
      for (const file of uploads) await add(file.name, file.body);
      pack.finalize();
    })().catch((err) => pack.destroy(err));

    out.on('finish', resolve);
    out.on('error', reject);
    gzip.on('error', reject);
    pack.on('error', reject);
  });
}

function coerceValue(table, column, raw) {
  if (raw === undefined) return null;
  if ((BOOLEAN_COLUMNS[table] || []).includes(column)) {
    return raw === null ? null : Boolean(Number(raw));
  }
  if (raw === '') return isDateish(column) ? null : raw;
  return raw;
}

function dumpSqlite(sqlite) {
  const check = String(sqlite.pragma('quick_check', { simple: true })).toLowerCase();
  if (check !== 'ok') throw new Error(`The legacy database failed its integrity check: ${check}`);

  const present = new Set(
    sqlite.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().map((row) => row.name)
  );
  const tables = {};
  const counts = {};
  for (const table of TABLES) {
    if (!present.has(table)) {
      tables[table] = [];
      counts[table] = 0;
      continue;
    }
    const available = new Set(
      sqlite.prepare(`PRAGMA table_info("${table}")`).all().map((c) => c.name)
    );
    const columns = TABLE_COLUMNS[table].filter((column) => available.has(column));
    const rows = sqlite.prepare(`SELECT * FROM "${table}"`).all();
    tables[table] = rows.map((row) => {
      const out = {};
      for (const column of columns) out[column] = coerceValue(table, column, row[column]);
      return out;
    });
    counts[table] = rows.length;
  }
  return { tables, counts };
}

async function main() {
  const input = process.argv[2];
  if (!input) {
    console.error('Usage: node scripts/convert-v1-backup.js <input v1 .tar.gz> [output .tar.gz]');
    process.exit(1);
  }
  const inputPath = path.resolve(input);
  if (!fs.existsSync(inputPath)) throw new Error(`Input archive not found: ${inputPath}`);

  const defaultOutput = inputPath.replace(/\.tar\.gz$/i, '') + '.v2.tar.gz';
  const outputPath = path.resolve(process.argv[3] || defaultOutput);

  const files = await readArchive(inputPath);
  if (!files['manifest.json']) throw new Error('manifest.json is missing — not a ChoresRewards archive.');
  if (!files['database.db']) {
    throw new Error('This archive has no database.db — it is not a v1 (SQLite) archive.');
  }

  let manifest;
  try {
    manifest = JSON.parse(files['manifest.json'].toString('utf8'));
  } catch {
    throw new Error('manifest.json is not valid JSON.');
  }
  const isV1 =
    manifest.format === 'choresrewards-backup' ||
    manifest.format_version === 1 ||
    manifest.app !== 'choresrewards';
  if (!isV1) throw new Error('This archive already looks like a format v2 backup — no conversion needed.');

  const expectedSha = manifest.database && manifest.database.sha256;
  if (expectedSha) {
    const actual = crypto.createHash('sha256').update(files['database.db']).digest('hex');
    if (actual !== expectedSha) {
      throw new Error(
        `database.db does not match the manifest checksum (expected ${expectedSha}, got ${actual}).\n` +
          'The archive is corrupt — re-export it from the old install instead of converting this copy.'
      );
    }
    console.log('[convert] database.db matches the manifest sha256 ✔');
  }

  // better-sqlite3 only opens from a filesystem path, so stage the member once.
  const stageDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cr-convert-'));
  const stagedDb = path.join(stageDir, 'database.db');
  let dump;
  try {
    fs.writeFileSync(stagedDb, files['database.db']);
    const Database = loadSqlite();
    const sqlite = new Database(stagedDb, { readonly: true, fileMustExist: true });
    try {
      dump = dumpSqlite(sqlite);
    } finally {
      sqlite.close();
    }
  } finally {
    fs.rmSync(stageDir, { recursive: true, force: true });
  }

  const totalRows = Object.values(dump.counts).reduce((a, b) => a + b, 0);
  const nextManifest = {
    app: 'choresrewards',
    format_version: FORMAT_V2,
    app_version: manifest.app_version || 'unknown',
    created_at: new Date().toISOString(),
    includes_media: Boolean(manifest.includes_media),
    legacy_source: {
      format: manifest.format || 'choresrewards-backup',
      format_version: manifest.format_version || 1,
      created_at: manifest.created_at || null,
      app_version: manifest.app_version || null,
    },
    tables: dump.counts,
  };

  await writeArchive(outputPath, nextManifest, dump.tables, files['secret_key'], files.uploads);

  const size = fs.statSync(outputPath).size;
  console.log(`\n[convert] ${path.basename(inputPath)} → ${path.basename(outputPath)}`);
  console.log(
    `[convert] ${totalRows} rows across ${TABLES.length} tables · ${files.uploads.length} media file(s) · ${(
      size /
      1024 /
      1024
    ).toFixed(1)} MB`
  );
  for (const table of TABLES) console.log(`  ${table}: ${dump.counts[table]}`);
  console.log('\nUpload this file from Settings → Backup & Restore → Choose backup file.');
}

main().catch((err) => {
  console.error('[convert] Failed:', err.message || err);
  process.exit(1);
});




