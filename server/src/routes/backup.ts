import { Router, Request, Response } from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { requireAuth, requireAdult } from './auth';
import { DATA_DIR } from '../config';
import {
  BACKUPS_DIR,
  buildBackupStream,
  describeDataFootprint,
  restoreFromArchive,
} from '../services/backup';

/**
 * Household backup / restore (parent-only).
 *
 *   GET  /api/backup/info     sizes shown in Settings → Backup & Restore
 *   GET  /api/backup/export   streams a .tar.gz (database + secret + uploads)
 *   POST /api/backup/import   restores a .tar.gz produced by the export endpoint
 *
 * The import endpoint only ever replaces files with validated content: the
 * archive is parsed as a tar, never as SQL, and only whitelisted entries are
 * accepted (see services/backup.ts).
 */

const importDir = path.join(DATA_DIR, 'restore', 'incoming');
fs.mkdirSync(importDir, { recursive: true });

const backupUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, importDir),
    filename: (_req, _file, cb) =>
      cb(null, `upload-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.tar.gz`),
  }),
  limits: { fileSize: 4 * 1024 * 1024 * 1024, files: 1 },
});

function removeFileQuietly(filePath: string | undefined): void {
  if (!filePath) return;
  fs.promises.unlink(filePath).catch(() => undefined);
}

async function handleInfo(_req: Request, res: Response): Promise<void> {
  try {
    const stats = await describeDataFootprint();
    res.json({ success: true, ...stats });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Could not read data footprint' });
  }
}

async function handleExport(req: Request, res: Response): Promise<void> {
  try {
    const includeMedia = String(req.query.media ?? '1') !== '0';
    const backup = await buildBackupStream(includeMedia);

    res.setHeader('Content-Type', 'application/gzip');
    res.setHeader('Content-Disposition', `attachment; filename="${backup.filename}"`);
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    res.setHeader('X-ChoresRewards-Backup-Version', String(backup.manifest.format_version));

    const cleanup = () => backup.cleanup();
    res.on('close', cleanup);
    res.on('error', cleanup);
    backup.stream.on('error', (err) => {
      console.error('[backup] Export stream failed:', err);
      cleanup();
      res.destroy(err as Error);
    });

    backup.stream.pipe(res);
  } catch (err: any) {
    console.error('[backup] Export failed:', err);
    if (!res.headersSent) {
      res.status(500).json({ success: false, error: err?.message || 'Backup export failed' });
    } else {
      res.destroy();
    }
  }
}

async function handleImport(req: Request, res: Response): Promise<void> {
  const uploaded = req.file?.path;

  if (!uploaded) {
    res.status(400).json({ success: false, error: 'No backup file was uploaded.' });
    return;
  }

  try {
    const result = await restoreFromArchive(uploaded);
    removeFileQuietly(uploaded);

    // The database handle is closed and replaced; restart so the restored
    // database is opened cleanly by the container runtime.
    res.json({
      success: true,
      restarting: true,
      message: 'Backup restored. The app is restarting now.',
      restored: {
        created_at: result.manifest.created_at,
        backup_app_version: result.manifest.app_version,
        includes_media: result.manifest.includes_media,
        media_files: result.media_files,
        database_bytes: result.database_bytes,
        pre_restore_backup: result.pre_restore_backup ? path.basename(result.pre_restore_backup) : null,
        backups_dir: BACKUPS_DIR,
      },
    });

    setTimeout(() => {
      console.log('[backup] Restore complete — exiting so the container restarts with the new database.');
      process.exit(0);
    }, 750);
  } catch (err: any) {
    removeFileQuietly(uploaded);
    console.error('[backup] Restore failed:', err);
    res.status(400).json({
      success: false,
      error: err?.message || 'The backup could not be restored.',
    });
  }
}

export const backupRouter = Router();

backupRouter.get(['/api/backup/info', '/backup/info'], requireAuth, requireAdult, handleInfo);
backupRouter.get(['/api/backup/export', '/backup/export'], requireAuth, requireAdult, handleExport);
backupRouter.post(
  ['/api/backup/import', '/backup/import'],
  requireAuth,
  requireAdult,
  backupUpload.single('backup'),
  handleImport
);
