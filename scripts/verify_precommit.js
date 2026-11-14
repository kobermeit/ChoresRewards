#!/usr/bin/env node
/**
 * scripts/verify_precommit.js
 *
 * Comprehensive local pre-commit guardrail suite.
 * Run locally to verify code integrity BEFORE committing to Git.
 * Does NOT run inside Docker / Coolify.
 */

const { execSync } = require('child_process');

console.log('======================================================');
console.log('  🛡️ Running Pre-Commit Verification Guardrail Suite');
console.log('======================================================\n');

function runStep(name, cmd) {
  console.log(`▶ Step: ${name}`);
  try {
    execSync(cmd, { stdio: 'inherit' });
    console.log(`  ✅ PASSED\n`);
  } catch (err) {
    console.error(`\n❌ FAILED at step: ${name}`);
    console.error(`   Commit blocked. Please resolve the issue above before committing.\n`);
    process.exit(1);
  }
}

// 1. Ingress & Path Safety
runStep('Ingress & Path Safety Audit', 'node scripts/verify_ingress.js');

// 2. Production Bundle Compilation
runStep('Compile Production Bundles (Client & Server)', 'npm run build');

// 3. CSS Bundle Budget & Selector Integrity
runStep('CSS Bundle Size Floor & Critical Selector Canary', 'node scripts/verify_bundle_budget.js');

// 4. Headless Chrome Computed Styles & Asset Audit
runStep('Headless Chrome Computed Styles & Asset Status Check', 'node scripts/verify_smoke.js');

// 5. Git Diff Mass-Deletion Canary
runStep('Git Diff Mass-Deletion Canary', 'node scripts/verify_git_diff.js');

console.log('======================================================');
console.log('  🎉 All Pre-Commit Guardrails PASSED! Safe to commit.');
console.log('======================================================\n');
process.exit(0);
