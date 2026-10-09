import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests run against the production build:
 *   npm run build && npm run test:e2e
 * The web server starts automatically (or reuses one already on the port).
 * Browsers: `npx playwright install chromium` once, on any OS.
 */
const PORT = Number(process.env.PORT ?? 3100);

export default defineConfig({
  testDir: "e2e",
  timeout: 45_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  workers: process.env.CI ? 2 : 3,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
  },
  webServer: {
    command: `npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}/home`,
    reuseExistingServer: true,
    timeout: 60_000,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } }],
});
