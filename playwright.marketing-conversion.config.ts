import { defineConfig, devices } from '@playwright/test'

// Test-only ID; provider requests are intercepted by the tests.
export default defineConfig({
  testDir: './tests/marketing-readiness',
  outputDir: './test-results/marketing-conversion',
  testMatch: ['conversion.spec.ts', 'menu-regulation.spec.ts'],
  timeout: 120_000,
  workers: 1,
  reporter: 'list',
  use: { ...devices['Desktop Chrome'], baseURL: 'http://127.0.0.1:3103', trace: 'retain-on-failure' },
  webServer: {
    command: 'NEXT_PUBLIC_GA4_MEASUREMENT_ID=G-MASABUTEST corepack pnpm --filter @garsonless/marketing exec next dev --hostname 127.0.0.1 --port 3103',
    url: 'http://127.0.0.1:3103', reuseExistingServer: false, timeout: 120_000,
  },
})
