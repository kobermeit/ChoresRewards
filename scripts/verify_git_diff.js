#!/usr/bin/env node
/**
 * scripts/verify_git_diff.js
 *
 * Automated Guardrail: Pre-Commit / Pre-Deploy Mass Deletion Canary
 * Checks git diff for critical files to ensure an over-broad string replacement
 * or accidental deletion never slips into a commit.
 */

const { execSync } = require('child_process');

console.log('=== VERIFYING GIT DIFF FOR ACCIDENTAL MASS DELETIONS ===\n');

if (process.env.ALLOW_LARGE_DELETION === '1') {
  console.log('⚠️ ALLOW_LARGE_DELETION=1 set. Skipping deletion limit check.\n');
  process.exit(0);
}

let diffStat = '';
try {
  diffStat = execSync('git diff HEAD --stat', { encoding: 'utf8' }).trim();
} catch (err) {
  // If no git repo or head, skip gracefully
  console.log('ℹ️ Git diff not available. Skipping.');
  process.exit(0);
}

if (!diffStat) {
  console.log('✅ Working directory clean against HEAD. No deletions.\n');
  process.exit(0);
}

// Critical files with maximum allowed net deletion threshold
const CRITICAL_FILES = [
  { pattern: /client\/src\/styles\/components\.css/, maxDeletions: 50 },
  { pattern: /client\/src\/styles\/tokens\.css/, maxDeletions: 25 },
  { pattern: /server\/src\/db\/schema\.ts/, maxDeletions: 30 },
  { pattern: /client\/src\/types\b/, maxDeletions: 40 },
];

const lines = diffStat.split('\n');
let violation = false;

for (const line of lines) {
  for (const crit of CRITICAL_FILES) {
    if (crit.pattern.test(line)) {
      // Example line: client/src/styles/components.css | 1266 +-------------------
      const match = line.match(/\|\s*\d+\s*(\+*)(-*)/);
      if (match) {
        const minusCount = match[2] ? match[2].length : 0;
        // In git diff --stat, '-' characters indicate relative deletions
        const numMatch = line.match(/(\d+)\s*insertions?\(\+\),\s*(\d+)\s*deletions?\(-\)/);
        if (numMatch) {
          const deletions = parseInt(numMatch[2], 10);
          const insertions = parseInt(numMatch[1], 10);
          if (deletions - insertions > crit.maxDeletions) {
            console.error(`\n❌ FATAL: Mass deletion detected in ${line.split('|')[0].trim()}!`);
            console.error(`   Net deletions (${deletions - insertions}) exceeded safety limit (${crit.maxDeletions} lines).`);
            console.error('   If this was an intentional refactor, set ALLOW_LARGE_DELETION=1 to bypass.\n');
            violation = true;
          }
        }
      }
    }
  }
}

if (violation) {
  process.exit(1);
}

console.log('✅ Git diff sanity check passed! No accidental mass deletions detected.\n');
process.exit(0);
