import { defineConfig, devices } from '@playwright/test';

const port = Number(process.env.E2E_PORT || 3100);
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: {
    timeout: 5_000,
  },
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  webServer: process.env.E2E_EXTERNAL_SERVER === 'true'
    ? undefined
    : {
      command: `node dist/main.js`,
      url: `${baseURL}/goals.html`,
      reuseExistingServer: !process.env.CI,
      env: {
        ...process.env,
        PORT: String(port),
        NODE_ENV: 'production',
        ENABLE_SUPER_MODE: 'false',
        APP_VERSION: '0.1.1-alpha',
        JWT_SECRET: process.env.JWT_SECRET || 'e2e-secret-with-at-least-32-characters',
      },
    },
  projects: [
    {
      name: 'desktop-chrome',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 7'] },
    },
    {
      name: 'mobile-safari',
      use: { ...devices['iPhone 14'] },
    },
  ],
});
