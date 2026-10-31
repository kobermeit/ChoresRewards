import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const REPO_ROOT = path.resolve(__dirname, '../..');
/**
 * Deployment detection for the persistent data directory:
 *   - Home Assistant OS add-on: Supervisor sets SUPERVISOR_TOKEN and mounts /data
 *   - Coolify / plain Docker:   DATA_DIR=/data with a mounted volume (see Dockerfile)
 *   - Local development:        ./instance inside the repo
 * An explicit DATA_DIR environment variable always wins (see .env.example).
 */
const IS_HA_ADDON = Boolean(process.env.SUPERVISOR_TOKEN) || fs.existsSync('/data');

export const PORT = Number(process.env.PORT || 8099);

function readYamlVersion(): string {
  if (process.env.APP_VERSION) return process.env.APP_VERSION;
  try {
    const cfgPath = path.join(REPO_ROOT, 'choresrewards', 'config.yaml');
    if (fs.existsSync(cfgPath)) {
      const raw = fs.readFileSync(cfgPath, 'utf-8');
      const m = raw.match(/^version:\s*["']?([^"'\r\n]+)["']?/m);
      if (m && m[1]) return m[1].trim();
    }
  } catch {
    // ignore
  }
  return '1.0.0';
}

export const APP_VERSION = readYamlVersion();

export const DATA_DIR = process.env.DATA_DIR || (IS_HA_ADDON ? '/data' : path.join(REPO_ROOT, 'instance'));
export const DB_PATH = process.env.DB_PATH || path.join(DATA_DIR, 'database.db');
export const STATIC_DIR = path.join(REPO_ROOT, 'static');
// Uploads follow DATA_DIR (Coolify/Docker volume) instead of the image's static folder
const USES_DATA_DIR = Boolean(process.env.DATA_DIR) || IS_HA_ADDON;
export const UPLOADS_DIR =
  process.env.UPLOADS_DIR ||
  (USES_DATA_DIR ? path.join(DATA_DIR, 'uploads') : path.join(STATIC_DIR, 'uploads'));
export const CLIENT_DIST_DIR = path.join(REPO_ROOT, 'client', 'dist');

// Ensure persistent directories exist
for (const dir of [
  DATA_DIR,
  UPLOADS_DIR,
  path.join(UPLOADS_DIR, 'chores'),
  path.join(UPLOADS_DIR, 'rewards'),
  path.join(UPLOADS_DIR, 'library'),
  path.join(UPLOADS_DIR, 'meals'),
  path.join(UPLOADS_DIR, 'organise'),
  path.join(UPLOADS_DIR, 'sounds'),
  path.join(UPLOADS_DIR, 'screensaver'),
]) {
  fs.mkdirSync(dir, { recursive: true });
}

// Copy default_avatar.png into UPLOADS_DIR if missing
const bundledDefaultAvatar = path.join(STATIC_DIR, 'uploads', 'default_avatar.png');
const targetDefaultAvatar = path.join(UPLOADS_DIR, 'default_avatar.png');
if (fs.existsSync(bundledDefaultAvatar) && !fs.existsSync(targetDefaultAvatar)) {
  try {
    fs.copyFileSync(bundledDefaultAvatar, targetDefaultAvatar);
  } catch {
    // ignore
  }
}

export function loadSecretKey(): string {
  const envKey = process.env.CR_SECRET_KEY || process.env.SECRET_KEY;
  if (envKey) return envKey;

  const keyPath = path.join(DATA_DIR, 'secret_key');
  try {
    if (fs.existsSync(keyPath)) {
      const existing = fs.readFileSync(keyPath, 'utf-8').trim();
      if (existing) return existing;
    }
    const generated = crypto.randomBytes(32).toString('hex');
    fs.writeFileSync(keyPath, generated, { mode: 0o600 });
    return generated;
  } catch {
    return crypto.randomBytes(32).toString('hex');
  }
}
