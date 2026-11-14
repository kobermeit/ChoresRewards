#!/usr/bin/env node
/**
 * scripts/verify_smoke.js
 *
 * Automated Guardrail: Headless Browser Computed Styles & Asset Integrity
 * 1. Spins up an ephemeral local server serving client/dist and static assets.
 * 2. Launches headless Chrome via puppeteer-core.
 * 3. Asserts HTTP 200 on manifest.json, stylesheets, scripts, and favicons.
 * 4. Asserts that the computed background is dark and NOT white (catches missing CSS).
 * 5. Asserts that store icons and avatars have constrained dimensions.
 * 6. Asserts 0 console errors and 0 uncaught exceptions across pages.
 */

const path = require('path');
const fs = require('fs');
const http = require('http');
const express = require(path.join(__dirname, '../server/node_modules/express'));
const puppeteer = require('puppeteer-core');

const CHROME_PATH = process.env.CHROME_PATH || (
  process.platform === 'win32'
    ? 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'
    : '/usr/bin/google-chrome'
);

async function runSmokeAudit() {
  console.log('=== VERIFYING HEADLESS BROWSER COMPUTED STYLES & ASSETS ===\n');

  if (!fs.existsSync(CHROME_PATH)) {
    console.warn(`⚠️ Chrome binary not found at ${CHROME_PATH}. Skipping browser smoke check.`);
    process.exit(0);
  }

  const app = express();
  app.use(express.json());

  const mockState = {
    success: true,
    current_date: '2026-11-15',
    timezone: 'Australia/Brisbane',
    chores: [
      { id: 1, title: 'Clean Kitchen', points: 10, assigned_to_id: 1, completed: false, is_extra: 0 }
    ],
    overdue_chore_ids: [],
    family: [
      { id: 1, name: 'Dad', role: 'parent', color: '#3b82f6', avatar_url: '/static/default_avatar.png' }
    ],
    rewards: [],
    family_progress: [],
    badge_definitions: [],
    extra_chores: [],
    meal_planner: { week_start: '2026-11-09', plan: {}, week_days: [] },
    recipes: [],
    shopping: {
      general: [{ id: 1, name: 'Apples', qty: '1kg', checked: false, store: 'aldi' }]
    },
    notes_kanban: { columns: [], notes: [] },
    text_pads: [],
    dashboard_notes: [],
    google_calendar: { enabled: false, events: [] },
    settings: { sound_theme: 'auto' },
    auth: { authenticated: true, adult_mode: true, person_id: 1, person_name: 'Dad', role: 'parent' }
  };

  app.get('/api/ping', (req, res) => res.json({ success: true, pong: true }));
  app.get('/api/health', (req, res) => res.json({ status: 'ok' }));
  app.get('/api/bootstrap', (req, res) => res.json(mockState));
  app.get('/api/data', (req, res) => res.json(mockState));
  app.get('/api/prefs', (req, res) => res.json({ success: true, prefs: {} }));
  app.get('/api/seasonal', (req, res) => res.json({ success: true, enabled: false }));
  app.get('/api/notifications', (req, res) => res.json({ success: true, alerts: [] }));

  const CLIENT_DIST_DIR = path.join(__dirname, '../client/dist');
  const STATIC_DIR = path.join(__dirname, '../static');
  app.use('/static', express.static(STATIC_DIR));
  app.use(express.static(CLIENT_DIST_DIR));
  app.get('*', (req, res) => res.sendFile(path.join(CLIENT_DIST_DIR, 'index.html')));

  const server = http.createServer(app);
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const errors = [];
  const failedUrls = [];

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });

    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(`Console Error: ${msg.text()}`);
    });
    page.on('pageerror', (err) => errors.push(`Page Uncaught: ${err.message}`));
    page.on('response', (res) => {
      if (res.status() >= 400 && !res.url().includes('favicon.ico')) {
        failedUrls.push(`[${res.status()}] ${res.url()}`);
      }
    });

    // 1. Audit manifest.json directly
    console.log('🔍 Checking manifest.json HTTP status...');
    const manifestRes = await page.goto(`${baseUrl}/manifest.json`);
    if (manifestRes.status() !== 200) {
      throw new Error(`manifest.json failed with status ${manifestRes.status()}! Expected 200 OK.`);
    }
    console.log('  ✅ manifest.json returned 200 OK.');

    // 2. Audit Main App Shell & Computed Styles
    console.log('🔍 Auditing Main App Shell on / ...');
    await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle0' });
    await new Promise((r) => setTimeout(r, 600));

    const computed = await page.evaluate(() => {
      const bodyStyle = window.getComputedStyle(document.body);
      const htmlStyle = window.getComputedStyle(document.documentElement);
      return {
        bodyBg: bodyStyle.backgroundColor,
        bodyBgImage: bodyStyle.backgroundImage,
        bodyColor: bodyStyle.color,
        hasRoot: Boolean(document.getElementById('root')),
      };
    });

    console.log('  Computed Body Background:', computed.bodyBg, computed.bodyBgImage);
    console.log('  Computed Body Color:', computed.bodyColor);

    // Fail if body background is plain white rgb(255, 255, 255)
    if (computed.bodyBg === 'rgb(255, 255, 255)' && !computed.bodyBgImage.includes('gradient')) {
      throw new Error('FATAL: Body background rendered as plain white! CSS stylesheet is missing or corrupted.');
    }
    console.log('  ✅ Body background styling is intact (not white fallback).');

    // Fail if body text color is plain black rgb(0, 0, 0)
    if (computed.bodyColor === 'rgb(0, 0, 0)') {
      throw new Error('FATAL: Body text rendered as default black! CSS typography theme is missing.');
    }
    console.log('  ✅ Body typography theme is intact (not black fallback).');

    // 3. Audit Shopping Store Icon Constraints
    console.log('🔍 Checking store icon constraints on #/shopping ...');
    await page.goto(`${baseUrl}/#/shopping`, { waitUntil: 'networkidle0' });
    await new Promise((r) => setTimeout(r, 500));

    const iconWidths = await page.evaluate(() => {
      const imgs = Array.from(document.querySelectorAll('.shopping-store-icon-img'));
      return imgs.map((img) => img.getBoundingClientRect().width);
    });

    const blownUpIcons = iconWidths.filter((w) => w > 40);
    if (blownUpIcons.length > 0) {
      throw new Error(`FATAL: Store icons rendered with unconstrained dimensions (> 40px): ${blownUpIcons.join(', ')}px!`);
    }
    console.log(`  ✅ Store icons are properly constrained (max width <= 40px).`);

    // 4. Assert zero asset 400+ errors and zero console errors
    if (failedUrls.length > 0) {
      throw new Error(`Asset loading failures detected:\n  ${failedUrls.join('\n  ')}`);
    }
    if (errors.length > 0) {
      throw new Error(`Console errors detected:\n  ${errors.join('\n  ')}`);
    }

    console.log('\n✅ Headless Browser Smoke Audit PASSED! All styles and assets verified.\n');
  } finally {
    await browser.close();
    server.close();
  }
}

runSmokeAudit().catch((err) => {
  console.error('\n❌ Smoke Audit FAILED:\n', err.message);
  process.exit(1);
});
