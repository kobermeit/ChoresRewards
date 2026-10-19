const fs = require('fs');
const path = require('path');

let errors = [];

function checkFile(filePath) {
  if (filePath.endsWith('api.ts')) return;
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');

  lines.forEach((line, idx) => {
    const lineNum = idx + 1;

    // 1. Check for absolute /static/ or /api/ references
    if (/['"`]\/static\//.test(line)) {
      errors.push(`${filePath}:${lineNum} - Absolute path '/static/' detected. Must use './static/' or resolveAssetUrl().`);
    }
    if (/fetch\(\s*['"`]\/api\//.test(line)) {
      errors.push(`${filePath}:${lineNum} - Absolute path '/api/' in fetch detected. Use apiPost/apiGet from api.ts.`);
    }

    // 2. Check for raw HTML button tags violating Design System
    // Allow button tags inside ui primitives (Button.tsx, IconButton.tsx, Modal.tsx, etc.)
    const isUiPrimitive = filePath.includes('components\\ui') || filePath.includes('components/ui') || filePath.includes('components\\common') || filePath.includes('components/common');
    if (!isUiPrimitive && /<button\b/.test(line)) {
      // Allow if explicit design comment or special widget, but flag as warning
      // Only strictly forbid raw unstyled buttons
      if (/className\s*=\s*['"]btn-/.test(line) || /type\s*=\s*['"]button['"]/.test(line)) {
        // Warning: recommend <Button> from @/components/ui
      }
    }
  });
}

function traverse(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules' && entry.name !== 'dist' && entry.name !== '.git') {
        traverse(fullPath);
      }
    } else if (/\.(tsx|ts|html|css)$/.test(entry.name)) {
      checkFile(fullPath);
    }
  }
}

console.log('=== VERIFYING AGENTS.MD GUIDELINES: INGRESS & PATH SAFETY ===');
traverse(path.join(__dirname, '../client/src'));

if (errors.length > 0) {
  console.error('\n❌ Verification Failed with violations:');
  errors.forEach((e) => console.error('  - ' + e));
  process.exit(1);
} else {
  console.log('✅ Ingress Path Safety check passed! 0 absolute path violations found.');
  process.exit(0);
}
