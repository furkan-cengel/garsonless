import { expect, test } from '@playwright/test'

const route = '/menu-alerjen-zorunlulugu'

for (const width of [320, 393, 430, 800, 1024, 1440]) {
  test(`illustrated regulation page works at ${width}px`, async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', error => errors.push(error.message))
    await page.route(/googletagmanager\.com|google-analytics\.com/, request => request.abort())
    await page.setViewportSize({ width, height: 960 })
    expect((await page.goto(route))?.status()).toBe(200)
    const reject = page.getByRole('button', { name: 'Reddet', exact: true })
    if (await reject.isVisible()) await reject.click()

    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1)
    const artwork = page.locator('img[src^="/illustrations/menu-regulation"]')
    await expect(artwork).toHaveCount(3)
    for (const image of await artwork.all()) {
      await image.scrollIntoViewIfNeeded()
      await image.evaluate(async element => { await (element as HTMLImageElement).decode() })
      await expect(image).toHaveAttribute('alt', /.+/)
    }
    await expect(page.getByRole('list', { name: '14 temel alerjen' }).getByRole('listitem')).toHaveCount(14)
    const overflow = await page.locator('main *').evaluateAll(elements => elements.filter(element => {
      if (element.closest('table, .sr-only')) return false
      const bounds = element.getBoundingClientRect()
      return bounds.width > 0 && (bounds.right > innerWidth + 1 || bounds.left < -1)
    }).map(element => element.tagName))
    expect(overflow).toEqual([])
    const targets = await page.locator('main header a').evaluateAll(elements => elements.map(element => {
      const { width, height } = element.getBoundingClientRect()
      return width >= 44 && height >= 44
    }))
    expect(targets).toEqual([true, true])
    await expect(page.locator('main header a[href*="/auth/signup"]')).toHaveAttribute('href', /\/auth\/signup\?plan=pro&interval=monthly$/)

    await page.getByRole('link', { name: 'Uyum takvimini inceleyin' }).click()
    await expect(page).toHaveURL(/#uyum-takvimi$/)
    const calendar = page.getByRole('region', { name: /İşletme türüne göre uyum takvimi/ })
    await calendar.focus()
    await expect(calendar).toBeFocused()
    if (width < 600) {
      await page.keyboard.press('ArrowRight')
      await expect.poll(() => calendar.evaluate(element => element.scrollLeft)).toBeGreaterThan(0)
    }
    const question = page.getByRole('button', { name: 'Menüyü yeniden bastırmak zorunda mıyım?' })
    await question.click()
    await expect(question).toHaveAttribute('aria-expanded', 'true')
    await question.press('Enter')
    await expect(question).toHaveAttribute('aria-expanded', 'false')
    expect(errors).toEqual([])
  })
}

test('regulation page keeps server-rendered metadata, FAQs and public discovery links', async ({ request }) => {
  const html = await (await request.get(route)).text()
  expect(html).toContain(`rel="canonical" href="https://masabu.co${route}"`)
  expect(html).toContain('property="og:image"')
  expect(html).toContain('FAQPage')
  expect(html).toContain('BreadcrumbList')
  expect(html).toContain('1 Ocak 2020')
  expect(html).toContain('href="/qr-menu"')
  expect(html).toContain('href="/qr-siparis"')
  expect(await (await request.get('/sitemap.xml')).text()).toContain(`https://masabu.co${route}`)
})
