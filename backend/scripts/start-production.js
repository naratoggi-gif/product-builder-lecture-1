#!/usr/bin/env node
const { spawnSync, spawn } = require('node:child_process');

function runDbInitIfNeeded() {
  if (process.env.SKIP_DB_INIT === 'true') return;
  if (!process.env.DATABASE_URL) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('DATABASE_URL is required in production.');
    }
    process.stdout.write('DATABASE_URL is not set; skipping db:init outside production.\n');
    return;
  }

  const result = spawnSync(process.execPath, ['scripts/db-init.js'], {
    cwd: process.cwd(),
    env: process.env,
    stdio: 'inherit',
  });
  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

function startServer() {
  const child = spawn(process.execPath, ['dist/main.js'], {
    cwd: process.cwd(),
    env: process.env,
    stdio: 'inherit',
  });
  child.on('exit', (code) => process.exit(code || 0));
}

try {
  runDbInitIfNeeded();
  startServer();
} catch (error) {
  console.error(error);
  process.exit(1);
}
