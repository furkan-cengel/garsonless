import { expect, type Page, type TestInfo } from '@playwright/test'

type VisualHealthOptions = {
  minTextLength?: number
  minVisibleCount?: number
  maxHorizontalOverflow?: number
}

export async function assertVisualHealth(
  page: Page,
  testInfo: TestInfo,
  name: string,
  options: VisualHealthOptions = {},
) {
  await page.waitForLoadState('domcontentloaded')
  await page.waitForTimeout(400)

  const health = await page.evaluate(() => {
    const doc = document.documentElement
    const body = document.body
    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight
    const visibleElements = Array.from(document.querySelectorAll('body *')).filter((node) => {
      const el = node as HTMLElement
      const rect = el.getBoundingClientRect()
      const style = window.getComputedStyle(el)
      return (
        rect.width > 1 &&
        rect.height > 1 &&
        rect.bottom > 0 &&
        rect.right > 0 &&
        rect.top < viewportHeight &&
        rect.left < viewportWidth &&
        style.visibility !== 'hidden' &&
        style.display !== 'none' &&
        Number(style.opacity) !== 0
      )
    })

    const overflowing = Array.from(document.querySelectorAll('body *'))
      .map((node) => {
        const el = node as HTMLElement
        const rect = el.getBoundingClientRect()
        return {
          tag: el.tagName.toLowerCase(),
          className: typeof el.className === 'string' ? el.className : '',
          text: el.innerText?.trim().slice(0, 64) ?? '',
          left: Math.round(rect.left),
          right: Math.round(rect.right),
          width: Math.round(rect.width),
        }
      })
      .filter((item) => item.width > 1 && (item.right > viewportWidth + 4 || item.left < -4))
      .slice(0, 5)

    return {
      title: document.title,
      textLength: body.innerText.trim().length,
      visibleCount: visibleElements.length,
      scrollWidth: doc.scrollWidth,
      clientWidth: doc.clientWidth,
      viewportWidth,
      overflowing,
    }
  })

  const maxOverflow = options.maxHorizontalOverflow ?? 4
  expect(health.textLength, `${name} should have visible text`).toBeGreaterThan(options.minTextLength ?? 24)
  expect(health.visibleCount, `${name} should have visible elements`).toBeGreaterThan(options.minVisibleCount ?? 8)
  expect(
    health.scrollWidth,
    `${name} should not create page-level horizontal overflow (${health.scrollWidth} > ${health.clientWidth}); offenders: ${JSON.stringify(health.overflowing)}`,
  ).toBeLessThanOrEqual(health.clientWidth + maxOverflow)

  const screenshot = await page.screenshot({
    fullPage: true,
    animations: 'disabled',
  })
  expect(screenshot.byteLength, `${name} screenshot should not be blank`).toBeGreaterThan(12_000)

  await testInfo.attach(`${name}.png`, {
    body: screenshot,
    contentType: 'image/png',
  })
}

export async function collectPageFailures(page: Page) {
  const failures: string[] = []
  page.on('pageerror', (error) => {
    failures.push(`pageerror: ${error.message}`)
  })
  page.on('console', (message) => {
    if (message.type() !== 'error') return
    failures.push(`console: ${message.text()}`)
  })
  return failures
}
