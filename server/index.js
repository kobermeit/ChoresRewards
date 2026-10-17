const fs = require('fs');
const path = require('path');

const distEntry = path.join(__dirname, 'dist', 'index.js');
if (fs.existsSync(distEntry)) {
  require(distEntry);
} else {
  // Fallback to tsx in development if dist/ hasn't been built yet
  require('tsx/cjs');
  require('./src/index.ts');
}
