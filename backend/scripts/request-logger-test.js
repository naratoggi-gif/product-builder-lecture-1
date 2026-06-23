#!/usr/bin/env node
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { safeRequestLogger } = require('../dist/shared/safe-logger.middleware');

async function captureLogs(callback) {
  const stdout = [];
  const stderr = [];
  const oldStdout = process.stdout.write;
  const oldStderr = process.stderr.write;
  process.stdout.write = (chunk, ...args) => {
    stdout.push(String(chunk));
    if (typeof args.at(-1) === 'function') args.at(-1)();
    return true;
  };
  process.stderr.write = (chunk, ...args) => {
    stderr.push(String(chunk));
    if (typeof args.at(-1) === 'function') args.at(-1)();
    return true;
  };
  try {
    await callback();
  } finally {
    process.stdout.write = oldStdout;
    process.stderr.write = oldStderr;
  }
  return { stdout: stdout.join(''), stderr: stderr.join('') };
}

function mockResponse(statusCode) {
  const response = new EventEmitter();
  response.statusCode = statusCode;
  response.headers = {};
  response.setHeader = (key, value) => {
    response.headers[key.toLowerCase()] = value;
  };
  return response;
}

async function run() {
  const oldAppVersion = process.env.APP_VERSION;
  const oldNodeEnv = process.env.NODE_ENV;
  process.env.APP_VERSION = '0.1.1-alpha';
  process.env.NODE_ENV = 'production';

  try {
    const response = mockResponse(503);
    const request = {
      method: 'POST',
      originalUrl: '/stepquest/goals?token=secret-token&goalTitle=private-goal',
      url: '/stepquest/goals?token=secret-token&goalTitle=private-goal',
      user: { sub: 7 },
      header: (name) => (name.toLowerCase() === 'x-request-id' ? 'req-test-1' : undefined),
    };

    const logs = await captureLogs(async () => {
      safeRequestLogger(request, response, () => {});
      response.emit('finish');
    });

    const accessLog = JSON.parse(logs.stdout.trim());
    assert.equal(accessLog.requestId, 'req-test-1');
    assert.equal(accessLog.path, '/stepquest/goals');
    assert.equal(accessLog.statusCode, 503);
    assert.equal(accessLog.userId, 7);
    assert.ok(!logs.stdout.includes('secret-token'));
    assert.ok(!logs.stdout.includes('private-goal'));

    const errorLog = JSON.parse(logs.stderr.trim());
    assert.equal(errorLog.type, 'app_error');
    assert.equal(errorLog.requestId, 'req-test-1');
    assert.equal(errorLog.path, '/stepquest/goals');
    assert.equal(errorLog.statusCode, 503);
    assert.ok(!logs.stderr.includes('secret-token'));
    assert.ok(!logs.stderr.includes('private-goal'));

    const sensitiveResponse = mockResponse(500);
    const sensitiveRequest = {
      method: 'GET',
      originalUrl: '/reset-password/token/secret-token',
      url: '/reset-password/token/secret-token',
      header: () => undefined,
    };
    const skipped = await captureLogs(async () => {
      safeRequestLogger(sensitiveRequest, sensitiveResponse, () => {});
      sensitiveResponse.emit('finish');
    });
    assert.equal(skipped.stdout, '');
    assert.equal(skipped.stderr, '');
  } finally {
    if (oldAppVersion === undefined) delete process.env.APP_VERSION;
    else process.env.APP_VERSION = oldAppVersion;
    if (oldNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = oldNodeEnv;
  }

  console.log(JSON.stringify({ ok: true, checked: 'request-logger' }, null, 2));
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
