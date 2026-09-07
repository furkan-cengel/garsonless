import { expect, test } from '@playwright/test'

const dashboardURL = process.env['SMOKE_DASHBOARD_URL'] ?? 'http://127.0.0.1:3005'
const menuURL = process.env['SMOKE_MENU_URL'] ?? 'http://127.0.0.1:3011'
const marketingURL = process.env['SMOKE_MARKETING_URL'] ?? 'http://127.0.0.1:3003'
const menuSlug = process.env['SMOKE_MENU_SLUG'] ?? 'maf-lounge'

test.describe('critical browser matrix', () => {
  test('public and authentication entry points render without browser-specific failures', async ({ page }) => {
    const pageErrors: string[] = []
    page.on('pageerror', (error) => pageErrors.push(error.message))

    await page.goto(marketingURL, { waitUntil: 'domcontentloaded' })
    await expect(page.locator('body')).toContainText(/masabu/i)

    await page.goto(`${dashboardURL}/auth/login`, { waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Tekrar hoş geldin.')

    const menuResponse = await page.goto(`${menuURL}/${encodeURIComponent(menuSlug)}`, {
      waitUntil: 'domcontentloaded',
    })
    expect(menuResponse?.status()).toBe(200)
    await expect(page.locator('html')).toHaveAttribute('data-menu-hydrated', 'true')
    expect(pageErrors).toEqual([])
  })
})
