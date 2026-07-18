import { expect, test } from '@playwright/test'

const dashboardURL = process.env['SMOKE_DASHBOARD_URL'] ?? 'http://127.0.0.1:3005'
const menuURL = process.env['SMOKE_MENU_URL'] ?? 'http://127.0.0.1:3011'
const kitchenURL = process.env['SMOKE_KITCHEN_URL'] ?? 'http://127.0.0.1:3002'
const marketingURL = process.env['SMOKE_MARKETING_URL'] ?? 'http://127.0.0.1:3003'
const menuSlug = process.env['SMOKE_MENU_SLUG'] ?? 'maf-lounge'

test.describe('route smoke', () => {
  test('dashboard protects private routes and serves login', async ({ request }) => {
    const privateRoute = await request.get(`${dashboardURL}/dashboard`, { maxRedirects: 0 })
    expect(privateRoute.status()).toBe(307)
    expect(privateRoute.headers()['location']).toContain('/auth/login')

    const login = await request.get(`${dashboardURL}/auth/login`)
    expect(login.status()).toBe(200)
    expect(await login.text()).toMatch(/garsonless|giriş/i)
  })

  test('marketing home renders', async ({ request }) => {
    const response = await request.get(marketingURL)
    expect(response.status()).toBe(200)
    expect(await response.text()).toMatch(/masabu/i)
  })

  test('menu public route renders the smoke fixture', async ({ request }) => {
    const response = await request.get(`${menuURL}/${encodeURIComponent(menuSlug)}?preview=1`)
    expect(response.status()).toBe(200)
    expect(await response.text()).toMatch(/menu|menü|garsonless/i)
  })

  test('kitchen route fails closed without token instead of crashing', async ({ request }) => {
    const response = await request.get(`${kitchenURL}/kitchen/00000000-0000-0000-0000-000000000000`)
    expect(response.status()).toBe(200)
    expect(await response.text()).toMatch(/oturumu gerekli/i)
  })
})
