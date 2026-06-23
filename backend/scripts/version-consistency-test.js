#!/usr/bin/env node
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const repoRoot = path.resolve(root, '..');
const packageJson = require(path.join(root, 'package.json'));
const packageLock = require(path.join(root, 'package-lock.json'));
const version = packageJson.version;
const cacheVersion = `stepquest-v${version}`;

function readRepo(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

function readBackend(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

assert.equal(packageLock.version, version, 'package-lock root version must match package.json');
assert.equal(packageLock.packages[''].version, version, 'package-lock package entry version must match package.json');

assert.ok(readBackend('src/shared/app-version.ts').includes(`DEFAULT_APP_VERSION = '${version}'`), 'default app version must match package.json');
assert.ok(readRepo('render.yaml').includes(`value: ${version}`), 'Render APP_VERSION must match package.json');
assert.ok(readRepo('.github/workflows/ci.yml').includes(`APP_VERSION: ${version}`), 'CI APP_VERSION must match package.json');
assert.ok(readRepo('.github/workflows/staging-smoke.yml').includes(`default: "${version}"`), 'staging smoke workflow default version must match package.json');
assert.ok(readRepo('README.md').includes(`v${version}`), 'README current version must match package.json');
assert.ok(readRepo('STAGING_RUNBOOK.md').includes(`APP_VERSION=${version}`), 'staging runbook APP_VERSION must match package.json');

const goalsHtml = readBackend('public/goals.html');
assert.ok(goalsHtml.includes(`/assets/css/app.css?v=${version}`), 'goals shell CSS cache key must match package.json');
assert.ok(goalsHtml.includes(`/dev/super-mode.js?v=${version}`), 'goals shell super hook cache key must match package.json');
assert.ok(goalsHtml.includes(`/assets/js/app.js?v=${version}`), 'goals shell JS cache key must match package.json');

const serviceWorker = readBackend('public/sw.js');
assert.ok(serviceWorker.includes(`const CACHE_VERSION = '${cacheVersion}'`), 'service worker cache version must match package.json');
assert.ok(serviceWorker.includes(`/assets/css/app.css?v=${version}`), 'service worker CSS cache key must match package.json');
assert.ok(serviceWorker.includes(`/assets/js/app.js?v=${version}`), 'service worker JS cache key must match package.json');

const stagingSmoke = readBackend('scripts/staging-smoke-test.js');
assert.ok(stagingSmoke.includes('packageVersion'), 'staging smoke must derive its default expected version from package.json');
assert.ok(stagingSmoke.includes('expectedVersion'), 'staging smoke must compare deployed version metadata');

const runPlaywright = readBackend('scripts/run-playwright.js');
assert.ok(runPlaywright.includes('packageVersion'), 'E2E production server must derive APP_VERSION from package.json');

console.log(JSON.stringify({ ok: true, checked: 'version-consistency', version }, null, 2));
