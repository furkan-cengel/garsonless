import { expect, test } from '@playwright/test'
import { assertVisualHealth, collectPageFailures } from './visual-health'

const dashboardURL = process.env['SMOKE_DASHBOARD_URL'] ?? 'http://localhost:3005'
const menuURL = process.env['SMOKE_MENU_URL'] ?? 'http://localhost:3011'
const kitchenURL = process.env['SMOKE_KITCHEN_URL'] ?? 'http://localhost:3002'
const marketingURL = process.env['SMOKE_MARKETING_URL'] ?? 'http://localhost:3003'
const menuSlug = process.env['SMOKE_MENU_SLUG'] ?? 'maf-lounge'

test.describe('public visual smoke', () => {
  test('dashboard login is visually healthy', async ({ page }, testInfo) => {
    const failures = await collectPageFailures(page)
    const response = await page.goto(`${dashboardURL}/auth/login`, { waitUntil: 'domcontentloaded' })
    expect(response?.status()).toBe(200)
    await expect(page.getByRole('heading', { name: /Tekrar/i }).first()).toBeVisible()
    await assertVisualHealth(page, testInfo, 'dashboard-login')
    expect(failures).toEqual([])
  })

  test('marketing home is visually healthy', async ({ page }, testInfo) => {
    const failures = await collectPageFailures(page)
    const response = await page.goto(marketingURL, { waitUntil: 'domcontentloaded' })
    expect(response?.status()).toBe(200)
    await expect(page.getByText(/garsonless/i).first()).toBeVisible()
    await assertVisualHealth(page, testInfo, 'marketing-home')
    expect(failures).toEqual([])
  })

  test('public menu fixture is visually healthy', async ({ page }, testInfo) => {
    const failures = await collectPageFailures(page)
    const response = await page.goto(`${menuURL}/${encodeURIComponent(menuSlug)}?preview=1`, {
      waitUntil: 'domcontentloaded',
    })
    expect(response?.status()).toBe(200)
    await assertVisualHealth(page, testInfo, 'menu-fixture', { minTextLength: 16 })
    expect(failures).toEqual([])
  })

  test('kitchen fail-closed screen is visually healthy', async ({ page }, testInfo) => {
    const failures = await collectPageFailures(page)
    const response = await page.goto(`${kitchenURL}/kitchen/00000000-0000-0000-0000-000000000000`, {
      waitUntil: 'domcontentloaded',
    })
    expect(response?.status()).toBe(200)
    await expect(page.getByText(/token gerekli/i)).toBeVisible()
    await assertVisualHealth(page, testInfo, 'kitchen-token-required', { minTextLength: 16, minVisibleCount: 3 })
    expect(failures).toEqual([])
  })
})
