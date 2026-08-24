import { defineConfig } from "@playwright/test";

const dashboardURL =
  process.env["TABLES_RUNTIME_DASHBOARD_URL"] ?? "http://127.0.0.1:3010";

export default defineConfig({
  testDir: "./tests/tables-runtime",
  timeout: 300_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env["CI"] ? 1 : 0,
  reporter: [["list"]],
  outputDir: "test-results/tables-runtime/playwright",
  use: {
    browserName: "chromium",
    actionTimeout: 15_000,
    colorScheme: "light",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "corepack pnpm --filter @garsonless/dashboard start --port 3010",
    url: `${dashboardURL}/auth/login`,
    reuseExistingServer: !process.env["CI"],
    timeout: 120_000,
  },
});
