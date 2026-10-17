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
import { rewardsRouter } from './routes/rewards';
import { householdRouter } from './routes/household';
import { organiseRouter } from './routes/organise';
import { settingsRouter } from './routes/settings';

initDatabase();

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
    name: 'choresrewards.sid',
    secret: loadSecretKey(),
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 365 * 24 * 60 * 60 * 1000, // 1 year for wall tablet convenience
    },
  })
);

// Serve persistent uploads first, then bundled static assets
app.use('/static/uploads', express.static(UPLOADS_DIR));
app.use('/static', express.static(STATIC_DIR));

// Also support /api/static/* in case relative API prefix is used
app.use('/api/static/uploads', express.static(UPLOADS_DIR));
app.use('/api/static', express.static(STATIC_DIR));

// Mount API & application routes at both root and /api so relative calls work under HA Ingress
const routers = [
  authRouter,
  stateRouter,
  peopleRouter,
  choresRouter,
  rewardsRouter,
  householdRouter,
  organiseRouter,
  settingsRouter,
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
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
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
});
