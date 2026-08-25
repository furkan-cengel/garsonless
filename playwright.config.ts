import { defineConfig, devices } from '@playwright/test'

const isCI = Boolean(process.env['CI'])

const dashboardURL = process.env['SMOKE_DASHBOARD_URL'] ?? 'http://127.0.0.1:3005'
const menuURL = process.env['SMOKE_MENU_URL'] ?? 'http://127.0.0.1:3011'
const kitchenURL = process.env['SMOKE_KITCHEN_URL'] ?? 'http://127.0.0.1:3002'
const marketingURL = process.env['SMOKE_MARKETING_URL'] ?? 'http://127.0.0.1:3003'

export default defineConfig({
  testDir: './tests/smoke',
  outputDir: './test-results/playwright-smoke',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: true,
  retries: isCI ? 1 : 0,
  workers: isCI ? 1 : undefined,
  reporter: [['list']],
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'webkit-critical',
      testMatch: /cross-browser-critical\.spec\.ts/,
      use: { ...devices['Desktop Safari'] },
    },
    {
      name: 'firefox-critical',
      testMatch: /cross-browser-critical\.spec\.ts/,
      use: { ...devices['Desktop Firefox'] },
    },
  ],
  use: {
    trace: 'retain-on-failure',
  },
  webServer: [
    {
      command: 'corepack pnpm --filter @garsonless/dashboard exec next start --port 3005',
      url: `${dashboardURL}/auth/login`,
      reuseExistingServer: !isCI,
      timeout: 120_000,
    },
    {
      command: 'SMOKE_FIXTURES_ENABLED=true corepack pnpm --filter @garsonless/menu exec next start --port 3011',
      url: menuURL,
      reuseExistingServer: !isCI,
      timeout: 120_000,
    },
    {
      command: 'corepack pnpm --filter @garsonless/kitchen exec next start --port 3002',
      url: kitchenURL,
      reuseExistingServer: !isCI,
      timeout: 120_000,
    },
    {
      command: 'corepack pnpm --filter @garsonless/marketing exec next start --port 3003',
      url: marketingURL,
      reuseExistingServer: !isCI,
      timeout: 120_000,
    },
  ],
})
