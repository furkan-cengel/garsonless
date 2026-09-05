import { defineConfig, devices } from '@playwright/test'

const serverMode = process.env['VISUAL_PRODUCTION'] === '1' ? 'start' : 'dev'
const isCI = Boolean(process.env['CI'])
const hasDashboardVisualCredentials = Boolean(
  process.env['DASHBOARD_VISUAL_EMAIL'] && process.env['DASHBOARD_VISUAL_PASSWORD'],
)
  || Boolean(process.env['DASHBOARD_VISUAL_MAGICLINK_EMAIL'] && process.env['SUPABASE_SERVICE_ROLE_KEY'])

const dashboardURL = process.env['SMOKE_DASHBOARD_URL'] ?? 'http://localhost:3005'
const menuURL = process.env['SMOKE_MENU_URL'] ?? 'http://localhost:3011'
const kitchenURL = process.env['SMOKE_KITCHEN_URL'] ?? 'http://localhost:3002'
const marketingURL = process.env['SMOKE_MARKETING_URL'] ?? 'http://localhost:3003'
const authSetupProject = 'dashboard-auth-setup'

export default defineConfig({
  globalTeardown: './tests/visual/dashboard-fixture.ts',
  testDir: './tests/visual',
  timeout: 45_000,
  expect: { timeout: 8_000 },
  fullyParallel: false,
  retries: isCI ? 1 : 0,
  workers: 1,
  reporter: [['list']],
  outputDir: 'test-results/visual',
  use: {
    browserName: 'chromium',
    colorScheme: 'light',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: authSetupProject,
      testMatch: /dashboard-auth\.setup\.ts/,
      use: { viewport: { width: 1440, height: 950 } },
    },
    {
      name: 'public-desktop',
      testMatch: /public\.spec\.ts/,
      use: { viewport: { width: 1440, height: 950 } },
    },
    {
      name: 'public-mobile',
      testMatch: /public\.spec\.ts/,
      use: { ...devices['iPhone 15'], colorScheme: 'light' },
    },
    {
      name: 'public-tablet',
      testMatch: /public\.spec\.ts/,
      use: { viewport: { width: 768, height: 1024 }, colorScheme: 'light' },
    },
    {
      name: 'dashboard-desktop',
      testMatch: /dashboard-authenticated\.spec\.ts/,
      dependencies: hasDashboardVisualCredentials ? [authSetupProject] : [],
      use: { viewport: { width: 1440, height: 950 } },
    },
    {
      name: 'dashboard-mobile',
      testMatch: /dashboard-authenticated\.spec\.ts/,
      dependencies: hasDashboardVisualCredentials ? [authSetupProject] : [],
      use: { viewport: { width: 390, height: 844 }, colorScheme: 'light' },
    },
    {
      name: 'dashboard-narrow',
      testMatch: /dashboard-authenticated\.spec\.ts/,
      dependencies: hasDashboardVisualCredentials ? [authSetupProject] : [],
      use: { viewport: { width: 320, height: 568 }, colorScheme: 'light' },
    },
    {
      name: 'dashboard-tablet',
      testMatch: /dashboard-authenticated\.spec\.ts/,
      dependencies: hasDashboardVisualCredentials ? [authSetupProject] : [],
      use: { viewport: { width: 768, height: 1024 }, colorScheme: 'light' },
    },
    {
      name: 'dashboard-zoom-200',
      testMatch: /dashboard-authenticated\.spec\.ts/,
      dependencies: hasDashboardVisualCredentials ? [authSetupProject] : [],
      use: { viewport: { width: 1440, height: 900 }, colorScheme: 'light' },
    },
  ],
  webServer: [
    {
      command: `corepack pnpm --filter @garsonless/dashboard exec next ${serverMode} --port 3005`,
      url: `${dashboardURL}/auth/login`,
      reuseExistingServer: !isCI,
      timeout: 120_000,
    },
    {
      command: `corepack pnpm --filter @garsonless/menu exec next ${serverMode} --port 3011`,
      url: menuURL,
      reuseExistingServer: !isCI,
      timeout: 120_000,
    },
    {
      command: `corepack pnpm --filter @garsonless/kitchen exec next ${serverMode} --port 3002`,
      url: kitchenURL,
      reuseExistingServer: !isCI,
      timeout: 120_000,
    },
    {
      command: `corepack pnpm --filter @garsonless/marketing exec next ${serverMode} --port 3003`,
      url: marketingURL,
      reuseExistingServer: !isCI,
      timeout: 120_000,
    },
  ],
})
