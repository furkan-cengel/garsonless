import { expect, test } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

const dashboardURL = process.env['SMOKE_DASHBOARD_URL'] ?? 'http://localhost:3005'
const email = process.env['DASHBOARD_VISUAL_EMAIL']
const password = process.env['DASHBOARD_VISUAL_PASSWORD']
const storageStatePath = process.env['DASHBOARD_VISUAL_STORAGE_STATE'] ?? 'test-results/visual-auth/dashboard-storage-state.json'
const metadataPath = process.env['DASHBOARD_VISUAL_METADATA'] ?? 'test-results/visual-auth/dashboard-metadata.json'
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

test('create dashboard authenticated storage state', async ({ page }) => {
  test.skip(!email || !password, 'Set DASHBOARD_VISUAL_EMAIL and DASHBOARD_VISUAL_PASSWORD to generate dashboard storage state.')

  await page.goto(`${dashboardURL}/auth/login`, { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('heading', { name: /Tekrar/i }).first()).toBeVisible()

  await page.locator('input[name="email"]').fill(email!)
  await page.locator('input[name="password"]').fill(password!)
  await page.getByRole('button', { name: /^Giriş yap/i }).click()

  await page.waitForURL(/\/dashboard(\/|$)/, { timeout: 20_000 })

  if (new URL(page.url()).pathname === '/dashboard') {
    await page.waitForURL(/\/dashboard\/[^/]+/, { timeout: 20_000 })
  }

  const current = new URL(page.url())
  const restaurantId = current.pathname.match(/^\/dashboard\/([^/]+)/)?.[1]
  expect(
    restaurantId,
    `Expected login to land on a restaurant dashboard, got ${current.pathname}`,
  ).toMatch(uuidPattern)

  mkdirSync(dirname(storageStatePath), { recursive: true })
  mkdirSync(dirname(metadataPath), { recursive: true })

  await page.context().storageState({ path: storageStatePath })
  writeFileSync(metadataPath, JSON.stringify({
    restaurantId,
    dashboardURL,
    createdAt: new Date().toISOString(),
    source: 'dashboard-auth.setup.ts',
  }, null, 2))
})
