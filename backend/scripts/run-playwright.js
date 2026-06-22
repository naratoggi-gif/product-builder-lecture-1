#!/usr/bin/env node
const { spawn } = require('node:child_process');
const { setTimeout: sleep } = require('node:timers/promises');

const port = Number(process.env.E2E_PORT || 3100);
const baseURL = `http://127.0.0.1:${port}`;

function spawnServer() {
  return spawn(process.execPath, ['dist/main.js'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PORT: String(port),
      NODE_ENV: 'production',
      ENABLE_SUPER_MODE: 'false',
      APP_VERSION: '0.1.0-alpha',
    },
    stdio: ['ignore', 'inherit', 'inherit'],
  });
}

async function waitForServer() {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${baseURL}/goals.html`);
      if (response.ok) return;
    } catch {
      // Keep polling until the Nest server has finished booting.
    }
    await sleep(250);
  }
  throw new Error(`Timed out waiting for ${baseURL}/goals.html`);
}

function stopServer(server) {
  if (!server.killed) server.kill();
}

async function run() {
  const server = spawnServer();
  let exitCode = 1;

  const stop = () => stopServer(server);
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);

  try {
    await waitForServer();
    exitCode = await new Promise((resolve) => {
      const child = spawn('npx playwright test', {
        cwd: process.cwd(),
        env: {
          ...process.env,
          E2E_EXTERNAL_SERVER: 'true',
          E2E_PORT: String(port),
        },
        stdio: 'inherit',
        shell: true,
      });
      child.on('exit', (code) => resolve(code ?? 1));
    });
  } finally {
    stopServer(server);
  }

  process.exit(exitCode);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
