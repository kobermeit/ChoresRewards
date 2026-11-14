import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { UPLOADS_DIR } from '../config';
import { sqlAll, sqlRun } from '../db/sql';

const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'image/svg+xml': '.svg',
};

/**
 * Downloads a remote image (http/https) and stores it in DATA_DIR/uploads/<subfolder>.
 * Returns the local URL (e.g. /static/uploads/rewards/<filename>).
 * If the URL is already local or download fails, returns the input URL gracefully as fallback.
 */
export async function downloadAndStoreImage(
  url: string | null | undefined,
  subfolder: 'rewards' | 'meals' | 'chores' | 'library' = 'rewards'
): Promise<string | null> {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed) return null;

  // If already a local static upload or bundled image, keep as-is
  if (trimmed.startsWith('/static/') || trimmed.startsWith('./static/') || trimmed.startsWith('data:')) {
    return trimmed;
  }

  // Only download remote HTTP / HTTPS URLs
  if (!/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  try {
    const targetDir = path.join(UPLOADS_DIR, subfolder);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000); // 12s timeout

    const resp = await fetch(trimmed, {
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
      },
    });
    clearTimeout(timeout);

    if (!resp.ok) {
      console.warn(`[imageDownloader] Failed to fetch image ${trimmed} (HTTP ${resp.status})`);
      return trimmed;
    }

    const contentType = (resp.headers.get('content-type') || '').toLowerCase().split(';')[0].trim();
    let ext = MIME_TO_EXT[contentType];
    if (!ext) {
      try {
        const parsed = new URL(trimmed);
        const parsedExt = path.extname(parsed.pathname).toLowerCase();
        if (['.jpg', '.jpeg', '.png', '.webp', '.gif', '.svg'].includes(parsedExt)) {
          ext = parsedExt === '.jpeg' ? '.jpg' : parsedExt;
        }
      } catch {
        // ignore
      }
    }
    if (!ext) ext = '.jpg';

    const arrayBuffer = await resp.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Guard against oversized or empty images (> 20MB or < 100 bytes)
    if (buffer.length > 20 * 1024 * 1024 || buffer.length < 100) {
      console.warn(
        `[imageDownloader] Image from ${trimmed} has suspicious size (${buffer.length} bytes), skipping local storage`
      );
      return trimmed;
    }

    const filename = `${Date.now()}_${crypto.randomBytes(4).toString('hex')}${ext}`;
    const targetPath = path.join(targetDir, filename);
    fs.writeFileSync(targetPath, buffer);

    const localUrl = `/static/uploads/${subfolder}/${filename}`;
    console.log(`[imageDownloader] Localized ${trimmed} -> ${localUrl}`);
    return localUrl;
  } catch (err: any) {
    console.warn(`[imageDownloader] Error downloading image ${trimmed}:`, err?.message || err);
    return trimmed;
  }
}

/**
 * Backfill existing rewards and recipes that reference external HTTP(S) images.
 * Runs asynchronously in background on startup.
 */
export async function backfillRemoteImages(): Promise<void> {
  try {
    // 1. Rewards
    const rewards = (await sqlAll(
      `SELECT id, image_url FROM reward WHERE image_url LIKE 'http://%' OR image_url LIKE 'https://%'`
    )) as Array<{ id: number; image_url: string }>;

    for (const r of rewards) {
      try {
        const local = await downloadAndStoreImage(r.image_url, 'rewards');
        if (local && local !== r.image_url) {
          await sqlRun(`UPDATE reward SET image_url = ? WHERE id = ?`, [local, r.id]);
        }
      } catch {
        // continue
      }
    }

    // 2. Recipes
    const recipeRows = (await sqlAll(
      `SELECT meal_key, image_url FROM recipes WHERE image_url LIKE 'http://%' OR image_url LIKE 'https://%'`
    )) as Array<{ meal_key: string; image_url: string }>;

    for (const rec of recipeRows) {
      try {
        const local = await downloadAndStoreImage(rec.image_url, 'meals');
        if (local && local !== rec.image_url) {
          await sqlRun(`UPDATE recipes SET image_url = ? WHERE meal_key = ?`, [local, rec.meal_key]);
        }
      } catch {
        // continue
      }
    }
  } catch (err) {
    console.error('[imageDownloader] Error in backfillRemoteImages:', err);
  }
}
