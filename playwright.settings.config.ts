import { defineConfig } from '@playwright/test'

const dashboardURL = process.env['SMOKE_DASHBOARD_URL'] ?? 'http://localhost:3005'
const hasCredentials = Boolean(process.env['DASHBOARD_VISUAL_EMAIL'] && process.env['DASHBOARD_VISUAL_PASSWORD'])
  || Boolean(process.env['DASHBOARD_VISUAL_MAGICLINK_EMAIL'] && process.env['SUPABASE_SERVICE_ROLE_KEY'])
const authSetupProject = 'dashboard-auth-setup'

const dashboardProject = (name: string, viewport: { width: number; height: number }) => ({
  name,
  testMatch: /dashboard-authenticated\.spec\.ts/,
  grep: /settings sections are visually healthy/,
  dependencies: hasCredentials ? [authSetupProject] : [],
  use: { viewport, colorScheme: 'light' as const },
})

export default defineConfig({
  globalTeardown: './tests/visual/dashboard-fixture.ts',
  testDir: './tests/visual',
  timeout: 180_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  retries: process.env['CI'] ? 1 : 0,
  workers: 1,
  reporter: [['list']],
  outputDir: 'test-results/settings-visual',
  use: {
    browserName: 'chromium',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: authSetupProject,
      testMatch: /dashboard-auth\.setup\.ts/,
      use: { viewport: { width: 1440, height: 950 } },
    },
    dashboardProject('dashboard-desktop', { width: 1440, height: 950 }),
    dashboardProject('dashboard-mobile', { width: 390, height: 844 }),
    dashboardProject('dashboard-narrow', { width: 320, height: 568 }),
    dashboardProject('dashboard-tablet', { width: 768, height: 1024 }),
    dashboardProject('dashboard-zoom-200', { width: 1440, height: 900 }),
  ],
  webServer: {
    command: `corepack pnpm --filter @garsonless/dashboard exec next ${process.env['VISUAL_PRODUCTION'] === '1' ? 'start' : 'dev'} --port 3005`,
    url: `${dashboardURL}/auth/login`,
    reuseExistingServer: !process.env['CI'],
    timeout: 120_000,
  },
})
