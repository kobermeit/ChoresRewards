#!/usr/bin/env node
/**
 * scripts/start_app.js
 *
 * One-click runner for ChoresRewards:
 * 1. Checks if the Docker daemon is running; if not, automatically launches Docker Desktop.
 * 2. Waits for the Docker daemon to become responsive.
 * 3. Starts the Postgres database and app container via Docker Compose (`docker compose up -d`).
 * 4. Waits for the application health check on http://localhost:8099/api/health.
 * 5. Prints the ready banner with URLs and helpful commands.
 */

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 8099;
const HEALTH_URL = `http://127.0.0.1:${PORT}/api/health`;
const APP_URL = `http://localhost:${PORT}/`;

function isDockerRunning() {
  try {
    execSync('docker info', { stdio: 'ignore', timeout: 4000 });
    return true;
  } catch {
    return false;
  }
}

function launchDockerDesktop() {
  console.log('⏳ Docker daemon is not running. Attempting to start Docker Desktop...');

  if (process.platform === 'win32') {
    const candidates = [
      'C:\\Program Files\\Docker\\Docker\\Docker Desktop.exe',
      path.join(process.env.LOCALAPPDATA || '', 'Programs\\Docker\\Docker\\Docker Desktop.exe')
    ];
    const exe = candidates.find(p => fs.existsSync(p));
    if (!exe) {
      console.error('❌ Could not locate Docker Desktop executable on Windows.');
      console.error('   Please start Docker Desktop manually from the Start Menu.');
      process.exit(1);
    }

    try {
      // Launch detached using PowerShell Start-Process with working directory set
      spawn('powershell', [
        '-NoProfile',
        '-Command',
        `Start-Process -FilePath "${exe}" -WorkingDirectory "${path.dirname(exe)}"`
      ], { stdio: 'ignore', detached: true }).unref();
    } catch (err) {
      console.warn('⚠️ Could not launch Docker Desktop automatically:', err.message);
    }
  } else if (process.platform === 'darwin') {
    try {
      execSync('open -a Docker', { stdio: 'ignore' });
    } catch {
      console.warn('⚠️ Could not launch Docker.app automatically.');
    }
  } else {
    console.log('ℹ️ On Linux, please ensure the docker daemon is running: sudo systemctl start docker');
  }
}

async function waitForDocker(timeoutSec = 60) {
  process.stdout.write('⏳ Waiting for Docker engine to be ready');
  const start = Date.now();
  while (Date.now() - start < timeoutSec * 1000) {
    if (isDockerRunning()) {
      process.stdout.write(' ✅ Ready!\n');
      return true;
    }
    process.stdout.write('.');
    await new Promise(r => setTimeout(r, 2000));
  }
  process.stdout.write('\n');
  return false;
}

async function waitForHealth(timeoutSec = 45) {
  process.stdout.write('⏳ Waiting for ChoresRewards server to initialize');
  const start = Date.now();
  while (Date.now() - start < timeoutSec * 1000) {
    try {
      const res = await fetch(HEALTH_URL);
      if (res.ok) {
        const body = await res.json().catch(() => ({}));
        if (body.status === 'ok') {
          process.stdout.write(' ✅ Ready!\n');
          return true;
        }
      }
    } catch {
      // server still starting
    }
    process.stdout.write('.');
    await new Promise(r => setTimeout(r, 1500));
  }
  process.stdout.write('\n');
  return false;
}

async function main() {
  const wantsBuild = process.argv.includes('--build');

  console.log('\n======================================================');
  console.log('  🚀 Starting ChoresRewards Stack (App + Postgres)');
  console.log('======================================================\n');

  if (!isDockerRunning()) {
    launchDockerDesktop();
    const ready = await waitForDocker(75);
    if (!ready) {
      console.error('\n❌ Timed out waiting for Docker engine. Please make sure Docker Desktop is open and try again.\n');
      process.exit(1);
    }
  } else {
    console.log('✅ Docker daemon is running.');
  }

  const composeArgs = ['compose', 'up', '-d'];
  if (wantsBuild) {
    composeArgs.push('--build');
    console.log('📦 Rebuilding container image and starting services...');
  } else {
    console.log('🐳 Starting containers with docker compose...');
  }

  try {
    execSync(`docker ${composeArgs.join(' ')}`, { stdio: 'inherit' });
  } catch (err) {
    console.error('❌ Failed to run docker compose up:', err.message);
    process.exit(1);
  }

  const healthy = await waitForHealth(45);
  if (!healthy) {
    console.warn('\n⚠️ Server took longer than expected to report healthy.');
    console.warn('   Check container logs with: docker compose logs choresrewards\n');
  }

  console.log('\n======================================================');
  console.log(`  🎉 ChoresRewards is running at:`);
  console.log(`     👉 \x1b[36m${APP_URL}\x1b[0m`);
  console.log('------------------------------------------------------');
  console.log('  Helpful Commands:');
  console.log('   • Stop server:       npm run stop');
  console.log('   • Rebuild & start:   npm run start:build');
  console.log('   • View live logs:    npm run docker:logs');
  console.log('======================================================\n');
}

main().catch(err => {
  console.error('Unhandled error:', err);
  process.exit(1);
});
