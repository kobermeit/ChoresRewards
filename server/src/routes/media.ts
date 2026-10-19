import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { UPLOADS_DIR } from '../config';

export const mediaRouter = Router();

const LIBRARY_UPLOAD_DIR = path.join(UPLOADS_DIR, 'library');
if (!fs.existsSync(LIBRARY_UPLOAD_DIR)) {
  fs.mkdirSync(LIBRARY_UPLOAD_DIR, { recursive: true });
}

const mediaUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      cb(null, LIBRARY_UPLOAD_DIR);
    },
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase() || '.png';
      const safeBase = path
        .basename(file.originalname, path.extname(file.originalname))
        .replace(/[^a-zA-Z0-9_-]/g, '_')
        .slice(0, 40);
      cb(null, `${Date.now()}_${crypto.randomUUID().slice(0, 6)}_${safeBase}${ext}`);
    },
  }),
  limits: { fileSize: 30 * 1024 * 1024 }, // 30MB limit per image
});

const ALLOWED_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.svg']);

/**
 * GET /api/media/custom_library
 * Returns all custom uploaded images stored across the library, chores, and rewards upload folders.
 */
mediaRouter.get(['/api/media/custom_library', '/media/custom_library'], (_req: Request, res: Response) => {
  try {
    const foldersToScan = [
      { folder: LIBRARY_UPLOAD_DIR, subPath: 'library' },
      { folder: path.join(UPLOADS_DIR, 'chores'), subPath: 'chores' },
      { folder: path.join(UPLOADS_DIR, 'rewards'), subPath: 'rewards' },
    ];

    const images: { url: string; filename: string; mtime: number }[] = [];
    const seenFiles = new Set<string>();

    for (const { folder, subPath } of foldersToScan) {
      if (!fs.existsSync(folder)) continue;
      const files = fs.readdirSync(folder);
      for (const file of files) {
        const ext = path.extname(file).toLowerCase();
        if (!ALLOWED_EXTENSIONS.has(ext)) continue;
        if (seenFiles.has(file)) continue;

        seenFiles.add(file);
        const fullPath = path.join(folder, file);
        try {
          const stat = fs.statSync(fullPath);
          images.push({
            filename: file,
            url: `./static/uploads/${subPath}/${file}`,
            mtime: stat.mtimeMs,
          });
        } catch {
          // ignore unreadable file
        }
      }
    }

    // Sort newest uploaded first
    images.sort((a, b) => b.mtime - a.mtime);

    res.json({ success: true, images });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || 'Failed to list custom library' });
  }
});

/**
 * POST /api/media/bulk_upload
 * Accepts multiple image files (up to 50 at once) and stores them in /data/uploads/library/
 */
mediaRouter.post(
  ['/api/media/bulk_upload', '/media/bulk_upload'],
  mediaUpload.fields([
    { name: 'files', maxCount: 50 },
    { name: 'file', maxCount: 1 },
    { name: 'image_file', maxCount: 1 },
    { name: 'image', maxCount: 1 },
  ]),
  (req: Request, res: Response) => {
    try {
      const filesObj = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
      const allFiles: Express.Multer.File[] = [];

      if (filesObj) {
        if (Array.isArray(filesObj.files)) allFiles.push(...filesObj.files);
        if (Array.isArray(filesObj.file)) allFiles.push(...filesObj.file);
        if (Array.isArray(filesObj.image_file)) allFiles.push(...filesObj.image_file);
        if (Array.isArray(filesObj.image)) allFiles.push(...filesObj.image);
      }

      if (allFiles.length === 0) {
        return res.status(400).json({ success: false, error: 'No image files provided' });
      }

      const uploaded = allFiles.map((f) => ({
        filename: f.filename,
        originalname: f.originalname,
        url: `./static/uploads/library/${f.filename}`,
        size: f.size,
      }));

      res.json({
        success: true,
        count: uploaded.length,
        files: uploaded,
        primaryUrl: uploaded[0].url,
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message || 'Failed to bulk upload images' });
    }
  }
);
