import express, { Request, Response, NextFunction } from 'express';
import session from 'express-session';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { PORT, STATIC_DIR, UPLOADS_DIR, CLIENT_DIST_DIR, loadSecretKey } from './config';
import { initDatabase } from './db';
import { describeDatabaseTarget } from './db/client';
import { withDbRetry } from './db/retry';
import { isBootReady, setBootPhase } from './services/bootState';
import { startDatabaseWatchdog } from './services/dbWatchdog';
import { authRouter } from './routes/auth';
import { stateRouter } from './routes/state';
import { peopleRouter } from './routes/people';
import { choresRouter } from './routes/chores';
import { rewardsRouter, runDailyRewardPriceSync } from './routes/rewards';
import { householdRouter, migrateExistingRecipeIngredients } from './routes/household';
import { organiseRouter } from './routes/organise';
import { settingsRouter } from './routes/settings';
import { mediaRouter } from './routes/media';
import { seasonalRouter } from './routes/seasonal';
import { healthRouter } from './routes/health';
import { backupRouter } from './routes/backup';
import { choreHistoryRouter } from './routes/choreHistory';
import { mutationDedupeMiddleware } from './services/mutationDedupe';
import { createSessionStore } from './services/sessionStore';

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
    store: createSessionStore(),
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

/**
 * Startup gate.
 *
 * The HTTP port is bound *before* the database work starts (see `bootDatabase()`), so a
 * few requests can arrive while migrations are still running. Answering them with
 * a clear 503 keeps them from turning into a wall of unexplained 500s, and gives
 * the orchestrator's health check something meaningful to read.
 * Health/ping probes and static assets always pass through.
 */
const BOOT_PROBE_PATHS = /^\/(api\/)?(health|ping)$/;
app.use((req: Request, res: Response, next: NextFunction) => {
  if (isBootReady() || BOOT_PROBE_PATHS.test(req.path) || (req.method === 'GET' && !req.path.startsWith('/api/'))) {
    next();
    return;
  }
  res.setHeader('Cache-Control', 'no-store');
  res.status(503).json({ success: false, error: 'The server is still starting up. Please retry in a moment.' });
});

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
  choreHistoryRouter,
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

/**
 * Express 4 does not await async handlers, so a rejected promise would otherwise
 * take the whole container down (Node >= 15 default). Log it and keep serving —
 * the individual route has already failed, the household should not.
 */
process.on('unhandledRejection', (reason) => {
  console.error('[ChoresRewards] Unhandled promise rejection:', reason);
});

/**
 * Everything that needs a live database: migrations, settings cache, seeds, the
 * one-time data tidy-up (which used to run at module import time, *before* the
 * tables existed — one of the errors in the v1.20.0 deploy log).
 *
 * Retried across transient failures (DNS/EAI_AGAIN, a Postgres that is still
 * starting, a connection reset mid-migration). Only a bounded budget is spent:
 * a database that is genuinely down still fails the container promptly instead of
 * hanging the orchestrator's health check.
 */
async function bootDatabase(): Promise<void> {
  console.log(`[boot] Postgres target: ${describeDatabaseTarget()}`);
  setBootPhase('starting', 'Connecting to the database…');
  await withDbRetry(() => initDatabase(), { label: 'database initialisation' });
  await migrateExistingRecipeIngredients();
  setBootPhase('ready', 'Serving household data.');
}

/** Reward-price sync + the Postgres availability watcher. */
function startBackgroundWork(): void {
  // Safe daily reward price sync: Initial run after 2 minutes of uptime, then every 24 hours
  setTimeout(() => {
    runDailyRewardPriceSync().catch((err) => console.warn('[RewardSyncCron] Initial run error:', err));
  }, 120_000);

  setInterval(() => {
    runDailyRewardPriceSync().catch((err) => console.warn('[RewardSyncCron] Scheduled run error:', err));
  }, 24 * 60 * 60 * 1000);

  startDatabaseWatchdog();
}

/**
 * Bind the port first (so probes get an answer immediately, even if the database
 * takes a while), then bring the database side up.
 */
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`[ChoresRewards] Server listening on http://0.0.0.0:${PORT}`);
});

server.on('error', (err) => {
  console.error('[ChoresRewards] Could not bind the HTTP port:', err);
  process.exit(1);
});

/**
 * Graceful shutdown.
 *
 * A rolling deploy starts the new container, waits for it to be healthy and only
 * then stops this one. Draining instead of dropping makes that handover invisible
 * to whoever is mid-request on the wall tablet.
 */
for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.on(signal, () => {
    console.log(`[ChoresRewards] ${signal} received — draining connections…`);
    server.close(() => process.exit(0));
    // Keep-alive sockets can hold the server open; do not wait forever.
    setTimeout(() => process.exit(0), 10_000).unref();
  });
}

bootDatabase()
  .then(startBackgroundWork)
  .catch((err) => {
    const reason = err instanceof Error ? err.message : String(err);
    setBootPhase('failed', 'Startup failed — the database could not be reached. See the container log.');
    console.error('[ChoresRewards] Fatal startup error:', err);
    console.error(
      `[ChoresRewards] Could not use Postgres at ${describeDatabaseTarget()} (${reason}).\n` +
        '[ChoresRewards] Fix: Coolify → the Postgres resource must be RUNNING, and DATABASE_URL must be its\n' +
        '               internal URL (postgres://user:pass@<resource-uuid>:5432/dbname) on the same Docker\n' +
        '               network as this application. The container now exits so the orchestrator restarts it.'
    );
    // Small delay so the message above reaches the container log before we exit.
    setTimeout(() => process.exit(1), 250);
  });

