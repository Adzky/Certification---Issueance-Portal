import { defineConfig, devices } from '@playwright/test';
import { E2E_BASE_URL, E2E_ENV, E2E_PORT } from './e2e/env';

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: false,
  workers: 1,
  // Generous: the first visit of a page compiles it in next dev.
  timeout: 60_000,
  globalSetup: './e2e/global-setup.ts',
  use: { baseURL: E2E_BASE_URL },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    // npm runs `predev` (creates/migrates/seeds the e2e DB on first run) before next dev.
    command: `npm run dev -- --port ${E2E_PORT}`,
    // Readiness probe: an API route that needs the DB (pages may 404 while a task is in progress).
    url: `${E2E_BASE_URL}/api/login-options`,
    // Never attach to someone else's server: a stale or foreign server on 3100 fails fast.
    reuseExistingServer: false,
    timeout: 180_000,
    env: E2E_ENV,
  },
});
