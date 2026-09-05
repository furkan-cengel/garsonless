import { devices, expect, test } from '@playwright/test'

const enabled = process.env['SMOKE_PERFORMANCE_BUDGETS'] === '1'
const base = process.env['SMOKE_MENU_URL'] ?? 'http://127.0.0.1:3011'
const slug = process.env['SMOKE_MENU_SLUG'] ?? 'maf-lounge'

test.use({ ...devices['Pixel 7'], defaultBrowserType: 'chromium' })

test.describe('public menu mobile cold and warm browser cache', () => {
  test.skip(!enabled, 'Requires a production build and SMOKE_PERFORMANCE_BUDGETS=1.')

  test('records both cache states under a mobile network profile', async ({ page }, testInfo) => {
    test.setTimeout(90_000)
    const cdp = await page.context().newCDPSession(page)
    await cdp.send('Network.enable')
    await cdp.send('Network.clearBrowserCache')
    await cdp.send('Network.setBypassServiceWorker', { bypass: true })
    // Fixed lab profile: 150 ms latency, 1.6 Mbps down / 750 Kbps up.
    // The server/data cache is deliberately not described as cold.
    await cdp.send('Network.emulateNetworkConditions', {
      offline: false, latency: 150, downloadThroughput: 1_600_000 / 8,
      uploadThroughput: 750_000 / 8, connectionType: 'cellular4g',
    })
    await page.addInitScript(() => {
      const metrics = { lcp: 0, cls: 0 }
      Object.assign(window, { __mobileMenuMetrics: metrics })
      new PerformanceObserver((list) => {
        const last = list.getEntries().at(-1)
        if (last) metrics.lcp = last.startTime
      }).observe({ type: 'largest-contentful-paint', buffered: true })
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const shift = entry as PerformanceEntry & { hadRecentInput: boolean; value: number }
          if (!shift.hadRecentInput) metrics.cls += shift.value
        }
      }).observe({ type: 'layout-shift', buffered: true })
    })
    for (const cache of ['cold-browser', 'warm-browser'] as const) {
      await test.step(cache, async () => {
        const response = await page.goto(`${base}/${encodeURIComponent(slug)}`, { waitUntil: 'networkidle' })
        expect(response?.status()).toBe(200)
        await expect(page.locator('html')).toHaveAttribute('data-menu-hydrated', 'true')
        // A bounded settling window captures late images and layout shifts.
        await page.waitForTimeout(1_000)
        const navigation = await page.evaluate(() => {
          const entry = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming
          const scripts = (performance.getEntriesByType('resource') as PerformanceResourceTiming[])
            .filter((resource) => resource.name.includes('/_next/static/') && resource.name.includes('.js'))
          const metrics = (window as Window & { __mobileMenuMetrics: { lcp: number; cls: number } }).__mobileMenuMetrics
          return {
            ...metrics, ttfb: entry.responseStart - entry.requestStart,
            // Zero transfer from a cache hit must stay zero.
            jsTransferBytes: scripts.reduce((sum, resource) => sum + resource.transferSize, 0),
            jsEncodedBytes: scripts.reduce((sum, resource) => sum + resource.encodedBodySize, 0),
          }
        })
        const button = page.getByRole('button', { name: /detayını aç/i }).first()
        await expect(button).toBeVisible()
        const start = await page.evaluate(() => performance.now())
        await button.click()
        await expect(page.getByRole('dialog').last()).toBeVisible()
        const interactionMs = await page.evaluate(() => performance.now()) - start
        const evidence = { kind: 'lab', cache, serverCache: 'uncontrolled', viewport: 'Pixel 7', latencyMs: 150, downloadMbps: 1.6, interactionMs, ...navigation }
        await testInfo.attach(`menu-${cache}.json`, { body: JSON.stringify(evidence, null, 2), contentType: 'application/json' })
        expect.soft(navigation.lcp, `${cache} LCP`).toBeGreaterThan(0)
        expect.soft(navigation.lcp, `${cache} LCP`).toBeLessThanOrEqual(2_500)
        expect.soft(navigation.cls, `${cache} sampled CLS`).toBeLessThanOrEqual(0.1)
        expect.soft(navigation.jsEncodedBytes, `${cache} JS`).toBeLessThanOrEqual(330_000)
        // This click-to-dialog lab duration is not field INP.
        expect.soft(interactionMs, `${cache} product interaction`).toBeLessThanOrEqual(300)
      })
    }
    await cdp.detach()
  })
})
