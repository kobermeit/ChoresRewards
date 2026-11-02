#!/usr/bin/env node
'use strict';

/**
 * verify_deploy.js — prove a Coolify deploy will work *before* you push.
 *
 *   npm run verify:deploy              # build the real image, then verify it
 *   npm run verify:deploy -- --no-build   # reuse choresrewards:verify (fast rerun)
 *   npm run verify:deploy -- --keep       # leave the containers up for debugging
 *
 * Why this exists
 * ---------------
 * v1.20.0 built fine and still took the site down: the container could not resolve
 * the Postgres hostname at boot (`EAI_AGAIN`), exited, and Coolify reported
 * "New container is unhealthy" and rolled back. Nothing in `npm run build` can catch
 * that — the failure only exists in the *container runtime* against a *real*
 * Postgres on a *Docker network*.
 *
 * This script reproduces that pipeline on the workstation:
 *
 *   1. `docker build` the exact root Dockerfile Coolify builds (so `npm run verify`
 *      and the client/server bundles run too).
 *   2. Start Postgres on an isolated network under a Coolify-shaped UUID hostname,
 *      so `DATABASE_URL` exercises Docker's embedded DNS exactly like production.
 *   3. REGRESSION: start the app while Postgres is *down*. It must stay up and keep
 *      retrying, and must go healthy by itself once Postgres starts — no crash loop,
 *      no restart. That is the exact scenario that failed.
 *   4. Smoke the HTTP surface: /api/health, /api/ping, /api/bootstrap, the SPA
 *      shell and a /static asset.
 *   5. Restart the container: migrations must be idempotent and the seed must not
 *      duplicate (a redeploy runs them again).
 *   6. Stop Postgres at runtime: /api/health must answer 503 with a driver code,
 *      then recover to 200 without restarting the app once Postgres returns.
 *
 * Exit code is 0 only if every check passed, so it can gate a push.
 * No npm dependencies — plain Node 18+ with the `docker` CLI on PATH.
 */

const { spawnSync } = require('child_process');
const path = require('path');
const crypto = require('crypto');

const REPO_ROOT = path.resolve(__dirname, '..');

/* ------------------------------------------------------------------ *
 * CLI options
 * ------------------------------------------------------------------ */
const argv = process.argv.slice(2);
const hasFlag = (name) => argv.includes(`--${name}`);
const flagValue = (name, fallback) => {
  const hit = argv.find((arg) => arg.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};

const SKIP_BUILD = hasFlag('no-build');
const KEEP_CONTAINERS = hasFlag('keep');
const HOST_PORT = Number(flagValue('port', 18099));
const IMAGE = flagValue('image', 'choresrewards:verify');
const PG_IMAGE = flagValue('pg-image', 'postgres:16-alpine');

const RUN_ID = `${process.pid}${Date.now().toString(36).slice(-4)}`;
const NETWORK = `cr-verify-net-${RUN_ID}`;
const VOLUME = `cr-verify-data-${RUN_ID}`;
/** Coolify names services with a lowercase 25-char id — mirror that shape. */
const PG_CONTAINER = `cr${crypto.randomBytes(13).toString('hex')}`.slice(0, 25);
const APP_CONTAINER = `choresrewards-verify-${RUN_ID}`;
const BASE_URL = `http://127.0.0.1:${HOST_PORT}`;

const DB_USER = 'choresrewards';
const DB_PASS = 'verify-only';
const DB_NAME = 'choresrewards';
const DATABASE_URL = `postgres://${DB_USER}:${DB_PASS}@${PG_CONTAINER}:5432/${DB_NAME}`;

/* ------------------------------------------------------------------ *
 * Tiny harness
 * ------------------------------------------------------------------ */
const results = [];
let currentStep = '';

function step(title) {
  currentStep = title;
  console.log(`\n\u25b6 ${title}`);
}

function check(name, ok, extra = '') {
  results.push({ name: `${currentStep} :: ${name}`, ok: Boolean(ok), extra });
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? `  (${extra})` : ''}`);
  return Boolean(ok);
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function docker(args, options = {}) {
  const result = spawnSync('docker', args, {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
    timeout: options.timeoutMs || 15 * 60 * 1000,
  });
  if (result.error) throw result.error;
  const output = `${result.stdout || ''}${result.stderr || ''}`.trim();
  if (result.status !== 0 && !options.allowFailure) {
    throw new Error(`docker ${args.join(' ')} exited ${result.status}\n${output}`);
  }
  return { status: result.status, output };
}

/** Run docker and return stdout only (trimmed). */
const dockerOut = (args, options) => docker(args, options).output.trim();

function containerState(name) {
  const raw = dockerOut(['inspect', '--format', '{{json .State}}', name], { allowFailure: true });
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function waitFor(description, predicate, { timeoutMs = 120_000, intervalMs = 1_000 } = {}) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const value = await predicate();
    if (value) return value;
    if (Date.now() > deadline) {
      throw new Error(`Timed out after ${Math.round(timeoutMs / 1000)}s waiting for ${description}`);
    }
    await sleep(intervalMs);
  }
}

/** GET a URL; never throws, returns { status, body, text }. */
async function httpGet(urlPath, timeoutMs = 30_000) {
  try {
    const response = await fetch(`${BASE_URL}${urlPath}`, {
      redirect: 'manual',
      signal: AbortSignal.timeout(timeoutMs),
    });
    const text = await response.text();
    let body;
    try {
      body = JSON.parse(text);
    } catch {
      body = undefined;
    }
    return { status: response.status, text, body };
  } catch (error) {
    return { status: 0, text: String(error && error.message), body: undefined };
  }
}

const tail = (name, lines = 25) =>
  dockerOut(['logs', '--tail', String(lines), name], { allowFailure: true }) || '(no logs)';

/** Full container log (stdout + stderr, as Docker stores it). */
const logText = (name) => dockerOut(['logs', name], { allowFailure: true });

/** RestartCount lives on the container, not inside `.State`. */
const restartCount = (name) => {
  const value = dockerOut(['inspect', '--format', '{{.RestartCount}}', name], { allowFailure: true });
  const count = Number(value);
  return Number.isFinite(count) ? count : -1;
};



/* ------------------------------------------------------------------ *
 * 1. Preflight + build the exact Coolify image
 * ------------------------------------------------------------------ */
async function buildImage() {
  step('Preflight: Docker');
  const version = dockerOut(['version', '--format', '{{.Server.Version}}'], { allowFailure: true });
  if (!check('Docker daemon reachable', Boolean(version), version || 'docker not running')) {
    throw new Error('Docker is required for verify:deploy');
  }

  if (SKIP_BUILD) {
    // `docker image inspect` on a missing image still prints to stderr, so trust the
    // exit status rather than "output is non-empty".
    const inspectStatus = docker(['image', 'inspect', IMAGE, '--format', '{{.Id}}'], { allowFailure: true }).status;
    check(`Image ${IMAGE} present (--no-build)`, inspectStatus === 0, inspectStatus === 0 ? '' : 'missing');
    if (inspectStatus !== 0) throw new Error(`${IMAGE} not found — run without --no-build`);
    return;
  }

  step('Build: the same root Dockerfile Coolify builds');
  console.log('  (npm run verify + client/server bundles run inside the build stage)\n');
  const startedAt = Date.now();
  docker(['build', '-t', IMAGE, '.'], { timeoutMs: 30 * 60 * 1000 });
  check('docker build succeeded', true, `${Math.round((Date.now() - startedAt) / 1000)}s`);
}

/* ------------------------------------------------------------------ *
 * 2. A Postgres that looks like a Coolify resource
 * ------------------------------------------------------------------ */
async function startPostgres() {
  step('Infrastructure: Postgres on a Coolify-style hostname');
  docker(['network', 'create', NETWORK]);
  docker(['volume', 'create', VOLUME]);

  docker([
    'run', '-d',
    '--name', PG_CONTAINER,
    '--network', NETWORK,
    '-e', `POSTGRES_USER=${DB_USER}`,
    '-e', `POSTGRES_PASSWORD=${DB_PASS}`,
    '-e', `POSTGRES_DB=${DB_NAME}`,
    PG_IMAGE,
  ]);
  check('Postgres container started', true, PG_CONTAINER);

  await waitFor('Postgres to accept connections', () => postgresReady(), { timeoutMs: 90_000 });
  check('Postgres accepting connections', true, `${PG_CONTAINER}:5432/${DB_NAME}`);
}

function postgresReady() {
  const result = docker(['exec', PG_CONTAINER, 'pg_isready', '-U', DB_USER, '-d', DB_NAME], {
    allowFailure: true,
  });
  return result.status === 0;
}

/* ------------------------------------------------------------------ *
 * 3. Start the app while Postgres is DOWN (the v1.20.0 regression)
 * ------------------------------------------------------------------ */
function startApp() {
  docker([
    'run', '-d',
    '--name', APP_CONTAINER,
    '--network', NETWORK,
    '-p', `127.0.0.1:${HOST_PORT}:8099`,
    '-v', `${VOLUME}:/data`,
    '-e', `DATABASE_URL=${DATABASE_URL}`,
    '-e', 'DATA_DIR=/data',
    '-e', 'PORT=8099',
    '-e', 'TZ=Australia/Brisbane',
    // A generous budget so the test can hold Postgres down for ~6s and prove the
    // retry loop is what carries the container, not a restart.
    '-e', 'DB_BOOT_TIMEOUT_MS=60000',
    IMAGE,
  ]);
}

const healthStatus = () => {
  const state = containerState(APP_CONTAINER);
  return state && state.Health && state.Health.Status;
};

async function waitForHealthy(timeoutMs = 150_000) {
  return waitFor(
    'the container HEALTHCHECK to report healthy',
    () => {
      const status = healthStatus();
      if (status === 'unhealthy') throw new Error('container reported unhealthy');
      return status === 'healthy' ? status : undefined;
    },
    { timeoutMs, intervalMs: 1_500 }
  );
}

async function coldDatabaseScenario() {
  step('Regression: app starts while Postgres is stopped');
  docker(['stop', PG_CONTAINER]);
  check('Postgres stopped (the DATABASE_URL host no longer resolves)', true);

  startApp();

  // Poll instead of sleeping a fixed time: under Docker Desktop the container can
  // take several seconds to produce its first log line, and the whole point of the
  // check is *what* it logs while the database is unreachable.
  const outcome = await waitFor(
    'the app to log a retry (or to exit)',
    () => {
      const state = containerState(APP_CONTAINER);
      if (state && state.Running === false) return { died: true, exitCode: state.ExitCode };
      const line = logText(APP_CONTAINER)
        .split('\n')
        .find((entry) => /Retrying in/i.test(entry));
      return line ? { died: false, line: line.trim() } : undefined;
    },
    { timeoutMs: 60_000, intervalMs: 1_000 }
  );

  check(
    'Container is still running (no crash loop)',
    !outcome.died,
    outcome.died ? `exit=${outcome.exitCode}` : ''
  );
  check(
    'Boot retries instead of dying on the first failure',
    !outcome.died && Boolean(outcome.line),
    outcome.line ? outcome.line.slice(0, 110) : 'no retry line found'
  );

  if (outcome.died) {
    console.log(tail(APP_CONTAINER, 40));
    throw new Error('The container died while the database was down — boot resilience regressed');
  }

  step('Recovery: Postgres comes back, container goes healthy by itself');
  docker(['start', PG_CONTAINER]);
  await waitFor('Postgres to accept connections again', () => postgresReady(), { timeoutMs: 90_000 });

  check('Docker HEALTHCHECK reports healthy (the signal Coolify reads)', (await waitForHealthy()) === 'healthy');
  check(
    'Recovered in-process — the container never restarted',
    restartCount(APP_CONTAINER) === 0,
    `restarts=${restartCount(APP_CONTAINER)}`
  );
  check('Boot logged the successful retry', /recovered on attempt/i.test(logText(APP_CONTAINER)));
}



/* ------------------------------------------------------------------ *
 * 4. The HTTP surface the household actually uses
 * ------------------------------------------------------------------ */
function migrationsApplied() {
  const out = dockerOut(
    ['exec', PG_CONTAINER, 'psql', '-U', DB_USER, '-d', DB_NAME, '-tAc', 'select count(*) from drizzle.__drizzle_migrations'],
    { allowFailure: true }
  );
  const count = Number(String(out).trim());
  return Number.isFinite(count) ? count : -1;
}

async function httpSmoke() {
  step('Smoke: HTTP surface');
  await waitFor(
    'the server to accept connections',
    async () => (await httpGet('/api/health')).status !== 0,
    { timeoutMs: 60_000 }
  );

  const health = await httpGet('/api/health');
  check('GET /api/health → 200', health.status === 200, `status=${health.status}`);
  check(
    'health status=ok',
    Boolean(health.body && health.body.status === 'ok'),
    JSON.stringify(health.body || {}).slice(0, 120)
  );
  check('health database=ok', Boolean(health.body && health.body.database === 'ok'));
  check('health reports the app version', Boolean(health.body && health.body.version), health.body && health.body.version);

  const ping = await httpGet('/api/ping');
  check('GET /api/ping → 204', ping.status === 204, `status=${ping.status}`);

  const shell = await httpGet('/');
  check('GET / serves the SPA shell', shell.status === 200 && /<div id="root"/i.test(shell.text), `status=${shell.status}`);

  const bootstrap = await httpGet('/api/bootstrap');
  const people = Array.isArray(bootstrap.body && bootstrap.body.family) ? bootstrap.body.family.length : 0;
  check('GET /api/bootstrap → 200', bootstrap.status === 200, `status=${bootstrap.status}`);
  check('bootstrap returns the seeded household', people > 0, `people=${people}`);

  const migrations = migrationsApplied();
  check('Drizzle migrations applied to the database', migrations > 0, `${migrations} migration(s)`);

  // Static assets must answer on /api/static as well as /static (Home Assistant
  // Ingress requests arrive under a dynamic prefix, so both paths are mounted).
  const avatar = await httpGet('/api/static/uploads/default_avatar.png');
  check('GET /api/static/uploads/default_avatar.png → 200', avatar.status === 200, `status=${avatar.status}`);

  return { people, migrations };
}

/* ------------------------------------------------------------------ *
 * 5. Redeploy simulation: migrations and seeds must be idempotent
 * ------------------------------------------------------------------ */
async function restartScenario({ people, migrations }) {
  step('Redeploy simulation: restart the container');
  docker(['restart', APP_CONTAINER]);
  await waitForHealthy();

  const bootstrap = await httpGet('/api/bootstrap');
  const peopleAfter = Array.isArray(bootstrap.body && bootstrap.body.family) ? bootstrap.body.family.length : -1;
  check('bootstrap still 200 after restart', bootstrap.status === 200, `status=${bootstrap.status}`);
  check('seed did not duplicate on restart', peopleAfter === people, `${peopleAfter} == ${people}`);
  const migrationsAfter = migrationsApplied();
  check('migration ledger unchanged', migrationsAfter === migrations, `${migrationsAfter}`);
}

/* ------------------------------------------------------------------ *
 * 6. Postgres disappears *while serving* (the 2026-11-02 incident)
 * ------------------------------------------------------------------ */
async function databaseOutageScenario() {
  step('Runtime: Postgres disappears while the app is serving');
  docker(['stop', PG_CONTAINER]);

  const degraded = await waitFor(
    '/api/health to report the outage',
    async () => {
      const response = await httpGet('/api/health');
      return response.status === 503 ? response : undefined;
    },
    { timeoutMs: 60_000 }
  );
  check('/api/health → 503 while Postgres is down', degraded.status === 503, `status=${degraded.status}`);
  check(
    'health explains the outage (code shown instead of a bare "unavailable")',
    Boolean(degraded.body && degraded.body.database_error_code),
    degraded.body && degraded.body.database_error_code
  );
  const state = containerState(APP_CONTAINER);
  check('the app stays up instead of crash-looping', Boolean(state && state.Running));

  docker(['start', PG_CONTAINER]);
  await waitFor('Postgres to accept connections again', () => postgresReady(), { timeoutMs: 90_000 });

  const recovered = await waitFor(
    '/api/health to recover',
    async () => {
      const response = await httpGet('/api/health');
      return response.status === 200 ? response : undefined;
    },
    { timeoutMs: 120_000 }
  );
  check('/api/health back to 200 without a restart', recovered.status === 200);
  check(
    'same container instance — no restart was needed',
    restartCount(APP_CONTAINER) === 0,
    `restarts=${restartCount(APP_CONTAINER)}`
  );
}

/* ------------------------------------------------------------------ *
 * Teardown + summary
 * ------------------------------------------------------------------ */
function teardown() {
  docker(['rm', '-f', APP_CONTAINER], { allowFailure: true });
  docker(['rm', '-f', PG_CONTAINER], { allowFailure: true });
  docker(['network', 'rm', NETWORK], { allowFailure: true });
  docker(['volume', 'rm', '-f', VOLUME], { allowFailure: true });
}

function summarise() {
  const failed = results.filter((result) => !result.ok);
  console.log(`\n${'='.repeat(66)}`);
  console.log(`${results.length - failed.length}/${results.length} checks passed`);
  if (failed.length > 0) {
    console.log('\nFAILED:');
    for (const item of failed) console.log(`  - ${item.name}${item.extra ? `  (${item.extra})` : ''}`);
    console.log('\nDEPLOY NOT VERIFIED — fix the failures above before pushing.\n');
  } else {
    console.log('\nDEPLOY VERIFIED — this image builds, boots, migrates, serves and self-heals.\n');
  }
  return failed.length === 0;
}

(async () => {
  let ok = false;
  try {
    await buildImage();
    await startPostgres();
    await coldDatabaseScenario();
    const baseline = await httpSmoke();
    await restartScenario(baseline);
    await databaseOutageScenario();
    ok = summarise();
  } catch (error) {
    console.error(`\n\u2716 ${error.message}`);
    const logs = tail(APP_CONTAINER, 40);
    if (logs !== '(no logs)') console.error(`\n--- last log lines (${APP_CONTAINER}) ---\n${logs}\n`);
    summarise();
  } finally {
    if (KEEP_CONTAINERS) {
      console.log(
        `Left behind for inspection:\n  app=${APP_CONTAINER}\n  db=${PG_CONTAINER}\n  network=${NETWORK}\n  volume=${VOLUME}\n`
      );
      console.log(`  docker logs -f ${APP_CONTAINER}`);
    } else {
      teardown();
    }
  }
  process.exit(ok ? 0 : 1);
})();

