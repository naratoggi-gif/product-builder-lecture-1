#!/usr/bin/env node
const assert = require('node:assert/strict');
const { ServiceUnavailableException } = require('@nestjs/common');
const { HealthController } = require('../dist/health/health.controller');
const { commitSha } = require('../dist/shared/app-version');

async function run() {
  const oldAppVersion = process.env.APP_VERSION;
  const oldRenderCommit = process.env.RENDER_GIT_COMMIT;
  const oldGitCommit = process.env.GIT_COMMIT_SHA;
  const oldNodeEnv = process.env.NODE_ENV;

  process.env.APP_VERSION = '0.1.1-alpha';
  process.env.NODE_ENV = 'production';
  delete process.env.GIT_COMMIT_SHA;
  process.env.RENDER_GIT_COMMIT = 'render-commit-smoke';

  try {
    assert.equal(commitSha(), 'render-commit-smoke', 'commitSha must read Render deploy commit metadata');

    const healthy = new HealthController({ query: async () => ({ rows: [{ ok: 1 }] }) });
    assert.deepEqual(await healthy.getHealth(), {
      status: 'ok',
      database: 'connected',
      version: '0.1.1-alpha',
      commit: 'render-commit-smoke',
      environment: 'production',
    });

    const degraded = new HealthController({ query: async () => { throw new Error('db down'); } });
    await assert.rejects(
      () => degraded.getHealth(),
      (error) => {
        assert.ok(error instanceof ServiceUnavailableException);
        assert.equal(error.getStatus(), 503);
        assert.deepEqual(error.getResponse(), {
          status: 'degraded',
          database: 'unavailable',
          version: '0.1.1-alpha',
          commit: 'render-commit-smoke',
          environment: 'production',
        });
        return true;
      },
    );
  } finally {
    if (oldAppVersion === undefined) delete process.env.APP_VERSION;
    else process.env.APP_VERSION = oldAppVersion;
    if (oldRenderCommit === undefined) delete process.env.RENDER_GIT_COMMIT;
    else process.env.RENDER_GIT_COMMIT = oldRenderCommit;
    if (oldGitCommit === undefined) delete process.env.GIT_COMMIT_SHA;
    else process.env.GIT_COMMIT_SHA = oldGitCommit;
    if (oldNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = oldNodeEnv;
  }

  console.log(JSON.stringify({ ok: true, checked: 'health' }, null, 2));
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
