#!/usr/bin/env node
const { spawnSync, spawn } = require('node:child_process');

function validateProductionEnv() {
  if (process.env.NODE_ENV !== 'production') return;
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required in production.');
  }
  if (process.env.ENABLE_SUPER_MODE === 'true') {
    throw new Error('ENABLE_SUPER_MODE must be false in production.');
  }
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'dev-secret-change-me' || process.env.JWT_SECRET.length < 32) {
    throw new Error('JWT_SECRET must be set to a strong random value in production.');
  }
}

function runDbInitIfNeeded() {
  if (process.env.SKIP_DB_INIT === 'true') return;
  if (!process.env.DATABASE_URL) {
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

function main() {
  try {
    validateProductionEnv();
    runDbInitIfNeeded();
    startServer();
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  validateProductionEnv,
};
