import express, { Request, Response, NextFunction } from 'express';
import session from 'express-session';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { PORT, STATIC_DIR, UPLOADS_DIR, CLIENT_DIST_DIR, loadSecretKey } from './config';
import { initDatabase } from './db';
import { authRouter } from './routes/auth';
import { stateRouter } from './routes/state';
import { peopleRouter } from './routes/people';
import { choresRouter } from './routes/chores';
import { rewardsRouter, runDailyRewardPriceSync } from './routes/rewards';
import { householdRouter } from './routes/household';
import { organiseRouter } from './routes/organise';
import { settingsRouter } from './routes/settings';
import { mediaRouter } from './routes/media';
import { seasonalRouter } from './routes/seasonal';
import { healthRouter } from './routes/health';
import { backupRouter } from './routes/backup';
import { mutationDedupeMiddleware } from './services/mutationDedupe';

initDatabase();

import { SqliteSessionStore } from './services/sessionStore';

const app = express();
app.set('trust proxy', 1);

app.use(
  cors({
    origin: true,
    credentials: true,
  })
);
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

app.use(
  session({
    store: new SqliteSessionStore(),
    name: 'choresrewards.sid',
    secret: loadSecretKey(),
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days for tablet/kiosk persistence
    },
  })
);

// Serve persistent uploads first, then bundled static assets with aggressive client disk caching
const staticCacheOptions = { maxAge: '30d', immutable: true };
const uploadsCacheOptions = { maxAge: '1d' };

app.use('/static/uploads', express.static(UPLOADS_DIR, uploadsCacheOptions));
app.use('/static', express.static(STATIC_DIR, staticCacheOptions));

// Also support /api/static/* in case relative API prefix is used
app.use('/api/static/uploads', express.static(UPLOADS_DIR, uploadsCacheOptions));
app.use('/api/static', express.static(STATIC_DIR, staticCacheOptions));

// Replay protection for queued offline mutations (idempotency ledger)
app.use(mutationDedupeMiddleware);

// Mount API & application routes at both root and /api so relative calls work under HA Ingress
const routers = [
  healthRouter,
  authRouter,
  stateRouter,
  peopleRouter,
  choresRouter,
  rewardsRouter,
  householdRouter,
  organiseRouter,
  settingsRouter,
  mediaRouter,
  seasonalRouter,
  backupRouter,
];

for (const router of routers) {
  app.use('/', router);
  app.use('/api', router);
}

// Serve built Vite React frontend from client/dist when available
if (fs.existsSync(CLIENT_DIST_DIR)) {
  app.use(express.static(CLIENT_DIST_DIR));
  app.get('*', (req: Request, res: Response, next: NextFunction) => {
    if (req.path.startsWith('/api/') || req.path.startsWith('/static/')) {
      next();
      return;
    }
    const indexHtml = path.join(CLIENT_DIST_DIR, 'index.html');
    if (fs.existsSync(indexHtml)) {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
      res.sendFile(indexHtml);
    } else {
      next();
    }
  });
}

// Multer & general error handler
app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
  // A response already in flight (e.g. the backup restore path) must not be re-answered
  if (res.headersSent) {
    next(err);
    return;
  }
  if (err?.code === 'LIMIT_FILE_SIZE') {
    res.status(413).json({
      success: false,
      error: 'Upload too large. Please upload fewer/smaller files at once.',
    });
    return;
  }
  console.error('[Server Error]:', err);
  res.status(500).json({
    success: false,
    error: err?.message || 'Internal server error',
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[ChoresRewards] Server listening on http://0.0.0.0:${PORT}`);

  // Safe daily reward price sync: Initial run after 2 minutes of uptime, then every 24 hours
  setTimeout(() => {
    runDailyRewardPriceSync().catch((err) => console.warn('[RewardSyncCron] Initial run error:', err));
  }, 120_000);

  setInterval(() => {
    runDailyRewardPriceSync().catch((err) => console.warn('[RewardSyncCron] Scheduled run error:', err));
  }, 24 * 60 * 60 * 1000);
});
