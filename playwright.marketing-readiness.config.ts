import { defineConfig, devices } from '@playwright/test'

const measurementId = process.env.MARKETING_TEST_ANALYTICS_DISABLED === '1' ? '' : 'G-MASABUTEST'

export default defineConfig({
  testDir: './tests/marketing-readiness',
  outputDir: './test-results/marketing-readiness',
  timeout: 60_000,
  workers: 1,
  reporter: 'list',
  use: { ...devices['Desktop Chrome'], baseURL: 'http://127.0.0.1:3103', trace: 'retain-on-failure' },
  webServer: [{
    command: `NEXT_PUBLIC_ANALYTICS_DEBUG=${measurementId ? 'true' : 'false'} NEXT_PUBLIC_GA4_MEASUREMENT_ID=${measurementId} corepack pnpm --filter @garsonless/marketing exec next dev --hostname 127.0.0.1 --port 3103`,
    url: 'http://127.0.0.1:3103', reuseExistingServer: false, timeout: 120_000,
  }, {
    command: `NEXT_DIST_DIR=.next-marketing-readiness NEXT_PUBLIC_ANALYTICS_DEBUG=${measurementId ? 'true' : 'false'} NEXT_PUBLIC_GA4_MEASUREMENT_ID=${measurementId} corepack pnpm --filter @garsonless/dashboard exec next dev --hostname 127.0.0.1 --port 3110`,
    url: 'http://127.0.0.1:3110/auth/signup', reuseExistingServer: false, timeout: 120_000,
  }],
})
