#!/usr/bin/env node
/**
 * scripts/verify_bundle_budget.js
 *
 * Automated Guardrail: CSS & JS Bundle Size & Critical Selector Integrity
 * 1. Asserts compiled CSS bundle size is above the minimum budget threshold (> 145 kB).
 * 2. Scans the compiled production CSS for foundational selectors that must NEVER go missing.
 */

const fs = require('fs');
const path = require('path');

const ASSETS_DIR = path.join(__dirname, '../client/dist/assets');

console.log('=== VERIFYING PRODUCTION BUNDLE INTEGRITY & SELECTOR BUDGET ===\n');

if (!fs.existsSync(ASSETS_DIR)) {
  console.error('❌ client/dist/assets does not exist. Run "npm run build:client" first.');
  process.exit(1);
}

const files = fs.readdirSync(ASSETS_DIR);
const cssFile = files.find((f) => f.startsWith('index-') && f.endsWith('.css'));
const jsFile = files.find((f) => f.startsWith('index-') && f.endsWith('.js'));

if (!cssFile) {
  console.error('❌ Could not locate compiled CSS bundle in client/dist/assets.');
  process.exit(1);
}

const cssPath = path.join(ASSETS_DIR, cssFile);
const cssStats = fs.statSync(cssPath);
const cssSizeKb = (cssStats.size / 1024).toFixed(2);
const cssContent = fs.readFileSync(cssPath, 'utf8');

console.log(`📦 Compiled CSS Bundle: ${cssFile} (${cssSizeKb} kB)`);

// 1. Bundle Size Floor (Healthy is ~155 kB; dropping below 145 kB indicates truncated CSS)
const MIN_CSS_SIZE_KB = 145;
if (cssStats.size < MIN_CSS_SIZE_KB * 1024) {
  console.error(`\n❌ FATAL: CSS bundle size (${cssSizeKb} kB) is below the minimum budget floor of ${MIN_CSS_SIZE_KB} kB!`);
  console.error('   A large portion of the stylesheet was likely deleted or corrupted.\n');
  process.exit(1);
}
console.log(`  ✅ CSS bundle size meets budget threshold (>= ${MIN_CSS_SIZE_KB} kB).`);

// 2. Critical Foundation Selectors Canary
const REQUIRED_SELECTORS = [
  { name: 'Body Background Styling', pattern: /body\s*\{[^}]*background/ },
  { name: 'Avatar Sizing & Masking (.avatar)', pattern: /\.avatar\s*\{/ },
  { name: 'Store Icon Sizing (.shopping-store-icon-img)', pattern: /\.shopping-store-icon-img\s*\{/ },
  { name: 'Dashboard Card Shell (.dashboard-card)', pattern: /\.dashboard-card\b/ },
  { name: 'Kanban Column Container (.column)', pattern: /\.column\b/ },
  { name: 'Shopping Management Block (.shopping-manage-block)', pattern: /\.shopping-manage-block\b/ },
  { name: 'Modal Dialog Overlay (.cr-modal-overlay)', pattern: /\.cr-modal-overlay\b/ },
  { name: 'Design Tokens (--cr-page-bg)', pattern: /--cr-page-bg/ },
];

let missingCount = 0;
for (const sel of REQUIRED_SELECTORS) {
  if (sel.pattern.test(cssContent)) {
    console.log(`  ✅ Critical selector present: ${sel.name}`);
  } else {
    console.error(`  ❌ MISSING CRITICAL SELECTOR: ${sel.name}`);
    missingCount++;
  }
}

if (missingCount > 0) {
  console.error(`\n❌ FATAL: ${missingCount} critical CSS foundation selector(s) missing from production bundle!`);
  process.exit(1);
}

console.log('\n✅ Bundle Budget & Selector Integrity check passed!\n');
process.exit(0);
