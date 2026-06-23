#!/usr/bin/env node
const assert = require('node:assert/strict');
const { validateProductionEnv } = require('./start-production');

const keys = ['NODE_ENV', 'APP_VERSION', 'DATABASE_URL', 'ENABLE_SUPER_MODE', 'JWT_SECRET'];
const original = Object.fromEntries(keys.map((key) => [key, process.env[key]]));

function restore() {
  for (const key of keys) {
    if (original[key] === undefined) delete process.env[key];
    else process.env[key] = original[key];
  }
}

function setEnv(values) {
  restore();
  Object.assign(process.env, values);
}

try {
  setEnv({ NODE_ENV: 'development' });
  assert.doesNotThrow(() => validateProductionEnv(), 'development should not require production secrets');

  setEnv({ NODE_ENV: 'production', APP_VERSION: '0.1.1-alpha', ENABLE_SUPER_MODE: 'false', JWT_SECRET: 'x'.repeat(48) });
  assert.throws(() => validateProductionEnv(), /DATABASE_URL is required/);

  setEnv({
    NODE_ENV: 'production',
    DATABASE_URL: 'postgresql://example',
    ENABLE_SUPER_MODE: 'false',
    JWT_SECRET: 'x'.repeat(48),
  });
  assert.throws(() => validateProductionEnv(), /APP_VERSION is required/);

  setEnv({
    NODE_ENV: 'production',
    APP_VERSION: '0.1.1-alpha',
    DATABASE_URL: 'postgresql://example',
    ENABLE_SUPER_MODE: 'true',
    JWT_SECRET: 'x'.repeat(48),
  });
  assert.throws(() => validateProductionEnv(), /ENABLE_SUPER_MODE must be explicitly false/);

  setEnv({
    NODE_ENV: 'production',
    APP_VERSION: '0.1.1-alpha',
    DATABASE_URL: 'postgresql://example',
    JWT_SECRET: 'x'.repeat(48),
  });
  assert.throws(() => validateProductionEnv(), /ENABLE_SUPER_MODE must be explicitly false/);

  setEnv({
    NODE_ENV: 'production',
    APP_VERSION: '0.1.1-alpha',
    DATABASE_URL: 'postgresql://example',
    ENABLE_SUPER_MODE: 'false',
    JWT_SECRET: 'dev-secret-change-me',
  });
  assert.throws(() => validateProductionEnv(), /JWT_SECRET must be set/);

  setEnv({
    NODE_ENV: 'production',
    APP_VERSION: '0.1.1-alpha',
    DATABASE_URL: 'postgresql://example',
    ENABLE_SUPER_MODE: 'false',
    JWT_SECRET: 'short',
  });
  assert.throws(() => validateProductionEnv(), /JWT_SECRET must be set/);

  setEnv({
    NODE_ENV: 'production',
    APP_VERSION: '0.1.1-alpha',
    DATABASE_URL: 'postgresql://example',
    ENABLE_SUPER_MODE: 'false',
    JWT_SECRET: 'x'.repeat(48),
  });
  assert.doesNotThrow(() => validateProductionEnv());

  console.log(JSON.stringify({ ok: true, checked: 'production-env' }, null, 2));
} finally {
  restore();
}
