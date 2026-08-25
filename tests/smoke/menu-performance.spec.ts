import { expect, test } from '@playwright/test'

const enabled = process.env['SMOKE_PERFORMANCE_BUDGETS'] === '1'
const menuURL = process.env['SMOKE_MENU_URL'] ?? 'http://127.0.0.1:3011'
const menuSlug = process.env['SMOKE_MENU_SLUG'] ?? 'maf-lounge'
const maxTtfbMs = Number(process.env['SMOKE_MAX_TTFB_MS'] ?? 1_200)
const maxLcpMs = Number(process.env['SMOKE_MAX_LCP_MS'] ?? 2_500)
const maxInitialJsBytes = Number(process.env['SMOKE_MAX_INITIAL_JS_BYTES'] ?? 330_000)
const maxInteractionMs = Number(process.env['SMOKE_MAX_INTERACTION_MS'] ?? 300)

test.describe('production public-menu performance budgets', () => {
  test.skip(!enabled, 'Set SMOKE_PERFORMANCE_BUDGETS=1 against a production build to enforce Web Vitals budgets.')

  test('TTFB, LCP, initial JS and product interaction stay inside budgets', async ({ page }) => {
    // Prime the short-lived public catalogue cache so this budget measures a
    // normal production request rather than a fresh process + database TLS
    // handshake. Cold-start latency remains visible in deployment telemetry.
    const warmup = await page.request.get(`${menuURL}/${encodeURIComponent(menuSlug)}`)
    expect(warmup.status()).toBe(200)
    await page.addInitScript(() => {
      ;(window as Window & { __menuLcp?: number }).__menuLcp = 0
      new PerformanceObserver((list) => {
        const entries = list.getEntries()
        const last = entries.at(-1)
        if (last) (window as Window & { __menuLcp?: number }).__menuLcp = last.startTime
      }).observe({ type: 'largest-contentful-paint', buffered: true })
    })
    const response = await page.goto(`${menuURL}/${encodeURIComponent(menuSlug)}`, {
      waitUntil: 'networkidle',
    })
    expect(response?.status()).toBe(200)
    await expect(page.locator('html')).toHaveAttribute('data-menu-hydrated', 'true')
    await page.waitForTimeout(500)

    const navigation = await page.evaluate(() => {
      const entry = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming
      const scripts = performance.getEntriesByType('resource')
        .filter((resource) => resource.name.includes('/_next/static/') && resource.name.includes('.js')) as PerformanceResourceTiming[]
      return {
        ttfb: entry.responseStart - entry.requestStart,
        lcp: (window as Window & { __menuLcp?: number }).__menuLcp ?? 0,
        jsBytes: scripts.reduce((sum, resource) => sum + (resource.transferSize || resource.encodedBodySize), 0),
      }
    })
    console.info('[menu-performance]', JSON.stringify(navigation))
    expect(navigation.ttfb).toBeLessThanOrEqual(maxTtfbMs)
    expect(navigation.lcp).toBeGreaterThan(0)
    expect(navigation.lcp).toBeLessThanOrEqual(maxLcpMs)
    expect(navigation.jsBytes).toBeLessThanOrEqual(maxInitialJsBytes)

    const productButton = page.getByRole('button', { name: /detayını aç/i }).first()
    const startedAt = await page.evaluate(() => performance.now())
    await productButton.click()
    await expect(page.getByRole('dialog').last()).toBeVisible()
    const completedAt = await page.evaluate(() => performance.now())
    expect(completedAt - startedAt).toBeLessThanOrEqual(maxInteractionMs)
  })
})
