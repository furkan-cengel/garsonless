import { expect, test, type Page } from '@playwright/test'

const events = (page: Page) => page.evaluate(() => (window as unknown as { dataLayer?: ArrayLike<unknown>[] }).dataLayer?.map(entry => Array.from(entry)).filter(entry => entry[0] === 'event') ?? [])
async function clickWithoutNavigation(page: Page, selector: string) {
  const link = page.locator(selector).first()
  await link.evaluate(element => element.addEventListener('click', event => event.preventDefault(), { once: true }))
  await link.click()
}

test.beforeEach(async ({ page }) => {
  await page.route(/googletagmanager\.com|google-analytics\.com/, route => route.fulfill({ contentType: 'application/javascript', body: '' }))
  // Provider stub; no contact or analytics request reaches a third party.
  await page.route('https://www.google.com/recaptcha/api.js**', route => route.fulfill({ contentType: 'application/javascript', body: 'window.grecaptcha={render:function(el,opts){opts.callback("test-token");return 1},reset:function(){}}' }))
  await page.route('https://app.supademo.com/**', route => route.fulfill({ contentType: 'text/html', body: '<p>Demo provider test fixture</p>' }))
})

test('click events respect consent and classify signup, demo, pricing and allergen actions once', async ({ page }) => {
  await page.goto('/')
  await clickWithoutNavigation(page, '.marketing-hero__primary')
  expect(await events(page)).toEqual([])
  await page.getByRole('button', { name: 'Kabul et', exact: true }).click()
  await clickWithoutNavigation(page, '.marketing-hero__primary')
  let names = (await events(page)).map(event => event[1])
  expect(names.filter(name => name === 'signup_click')).toHaveLength(1)
  expect(names.filter(name => name === 'free_trial_click')).toHaveLength(1)
  await page.goto('/fiyatlar')
  await clickWithoutNavigation(page, '.pricing-cta')
  names = (await events(page)).map(event => event[1])
  expect(names.filter(name => name === 'pricing_cta_click')).toHaveLength(1)
  await page.goto('/menu-alerjen-zorunlulugu?email=private@example.com#top')
  await clickWithoutNavigation(page, 'header [data-conversion-event="demo_request_click"]')
  names = (await events(page)).map(event => event[1])
  expect(names.filter(name => name === 'demo_request_click')).toHaveLength(1)
  expect(names.filter(name => name === 'allergen_landing_cta_click')).toHaveLength(1)
  expect(JSON.stringify(await events(page))).not.toContain('private@example.com')
  await clickWithoutNavigation(page, 'header a[href*="/auth/signup"]')
  names = (await events(page)).map(event => event[1])
  expect(names.filter(name => name === 'free_trial_click')).toHaveLength(1)
  expect(names.filter(name => name === 'allergen_landing_cta_click')).toHaveLength(2)
  await page.getByRole('button', { name: 'Çerez yönetimi' }).click()
  await page.getByRole('button', { name: 'Reddet', exact: true }).click()
  await expect(page.locator('#masabu-ga4')).toHaveCount(0)
  await clickWithoutNavigation(page, 'header a[href*="/auth/signup"]')
  expect(await events(page)).toEqual([])
})

test('existing form records accepted submissions only and keeps sales context', async ({ page }) => {
  await page.goto('/iletisim?subject=business#satis-formu')
  await page.getByRole('button', { name: 'Kabul et', exact: true }).click()
  await expect(page.getByRole('combobox')).toContainText('Ürün ve fiyatlandırma')
  await page.getByLabel('Ad soyad').fill('Test Kullanıcı')
  await page.getByLabel('E-posta', { exact: false }).fill('test@example.com')
  await page.getByLabel('İşletme adı').fill('Test İşletme')
  await page.getByLabel('Telefon').fill('05551234567')
  await page.getByLabel('Şube sayısı').fill('1')
  await page.getByLabel('Mesajınız').fill('Demo talebi test kaydı.')
  await page.route('**/api/contact', route => route.fulfill({ status: 503, json: { message: 'Test gönderim hatası' } }))
  await page.locator('button[type="submit"]').click()
  await expect(page.locator('.contact-form').getByRole('alert')).toHaveText('Test gönderim hatası')
  expect((await events(page)).some(event => event[1] === 'contact_form_submit')).toBe(false)
  // Fresh widget token after the simulated failed delivery.
  await page.reload()
  await page.getByLabel('Ad soyad').fill('Test Kullanıcı')
  await page.getByLabel('E-posta', { exact: false }).fill('test@example.com')
  await page.getByLabel('İşletme adı').fill('Test İşletme')
  await page.getByLabel('Telefon').fill('05551234567')
  await page.getByLabel('Şube sayısı').fill('1')
  await page.getByLabel('Mesajınız').fill('Demo talebi test kaydı.')
  await page.route('**/api/contact', route => route.fulfill({ json: { success: true, leadAccepted: true } }))
  await page.locator('button[type="submit"]').click()
  await expect(page.locator('.contact-form').getByRole('status')).toContainText('Mesajınız alındı')
  expect((await events(page)).filter(event => event[1] === 'contact_form_submit')).toHaveLength(1)
  expect((await events(page)).filter(event => event[1] === 'generate_lead')).toHaveLength(1)
  expect(JSON.stringify(await events(page))).not.toMatch(/test@example|05551234567|Test İşletme/)
})

for (const width of [320, 390, 768, 1440]) {
  test(`conversion pages and animation-first mobile hero work at ${width}px`, async ({ page, context }, testInfo) => {
    const errors: string[] = []
    page.on('pageerror', error => errors.push(error.message))
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
    await context.addCookies([{ name: 'masabu_analytics_consent', value: '2026-09-09:denied', url: 'http://127.0.0.1:3103' }])
    await page.setViewportSize({ width, height: width === 320 ? 568 : 900 })
    for (const route of ['/', '/fiyatlar', '/menu-alerjen-zorunlulugu', '/iletisim?subject=business']) {
      expect((await page.goto(route))?.status()).toBe(200)
      await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1)
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
      expect(await page.locator('a button, button a').count()).toBe(0)
      if (route === '/' && width <= 700) {
        const bounds = await page.locator('.marketing-hero__primary').boundingBox()
        const animation = await page.locator('.marketing-hero .hero-flow').boundingBox()
        const copy = await page.locator('.marketing-hero__copy').boundingBox()
        expect(animation!.y + animation!.height).toBeLessThanOrEqual(copy!.y)
        expect(bounds!.height).toBeGreaterThanOrEqual(44)
        await expect(page.locator('#customer-proof-title')).toHaveCount(0)
        await page.locator('.marketing-hero__secondary').click()
        await expect(page).toHaveURL(/#demo$/)
        await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }))
      }
      await page.screenshot({ path: testInfo.outputPath(`${route.split('?')[0].replaceAll('/', '') || 'home'}-${width}.png`), fullPage: true, animations: 'disabled' })
    }
    expect(errors).toEqual([])
  })
}

test('internal routes, anchors and image assets are valid on conversion pages', async ({ page, request }) => {
  const checked = new Set<string>()
  for (const route of ['/', '/fiyatlar', '/menu-alerjen-zorunlulugu', '/iletisim']) {
    await page.goto(route)
    const links = await page.locator('a[href]').evaluateAll(anchors => anchors.map(anchor => (anchor as HTMLAnchorElement).href))
    for (const href of links) {
      const url = new URL(href)
      if (url.origin !== 'http://127.0.0.1:3103' || checked.has(href)) continue
      checked.add(href)
      const response = await request.get(url.pathname + url.search)
      expect(response.status(), href).toBeLessThan(400)
      if (url.hash) expect(await response.text(), href).toContain(`id="${decodeURIComponent(url.hash.slice(1))}"`)
    }
    for (const src of await page.locator('img').evaluateAll(images => images.map(image => image.getAttribute('src')).filter(Boolean))) {
      expect((await request.get(src!)).status(), src!).toBe(200)
    }
  }
})


test('first-visit consent and mobile navigation keep the hero CTA usable', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 320, height: 568 })
  await page.goto('/')
  await expect(page.getByRole('button', { name: 'Reddet', exact: true })).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('first-visit-320.png') })
  await page.getByRole('button', { name: 'Tercihler', exact: true }).click()
  await expect(page.getByRole('region', { name: 'Çerez tercihleri' })).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('button', { name: 'Tercihler', exact: true })).toBeFocused()
  await page.getByRole('button', { name: 'Reddet', exact: true }).click()
  await clickWithoutNavigation(page, '.marketing-hero__primary')
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }))
  const menu = page.getByRole('button', { name: 'Menüyü aç', exact: true })
  await menu.click()
  await expect(page.getByRole('button', { name: 'Menüyü kapat', exact: true })).toHaveAttribute('aria-expanded', 'true')
  await page.keyboard.press('Escape')
  await expect(page.getByRole('button', { name: 'Menüyü aç', exact: true })).toHaveAttribute('aria-expanded', 'false')
})

for (const viewport of [
  { width: 320, height: 568 },
  { width: 320, height: 701 },
  { width: 360, height: 640 },
  { width: 375, height: 667 },
  { width: 390, height: 844 },
  { width: 419, height: 758 },
  { width: 430, height: 932 },
]) {
  test(`entire mobile hero fits at ${viewport.width}x${viewport.height}`, async ({ page, context }, testInfo) => {
    await context.addCookies([{ name: 'masabu_analytics_consent', value: '2026-09-09:denied', url: 'http://127.0.0.1:3103' }])
    await page.setViewportSize(viewport)
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/')
    await page.evaluate(() => document.fonts.ready)
    const hero = await page.locator('.marketing-hero').boundingBox()
    const copy = await page.locator('.marketing-hero__copy').boundingBox()
    const card = await page.locator('.hero-flow__node[data-position="active"]').boundingBox()
    expect(hero!.y + hero!.height).toBeLessThanOrEqual(viewport.height)
    expect(card!.y + card!.height).toBeLessThanOrEqual(copy!.y)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    for (const selector of ['.marketing-hero__primary', '.marketing-hero__secondary']) {
      const bounds = await page.locator(selector).boundingBox()
      expect(bounds!.height).toBeGreaterThanOrEqual(44)
      expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(viewport.height)
    }
    await page.screenshot({ path: testInfo.outputPath(`hero-${viewport.width}x${viewport.height}.png`) })
    if (viewport.width === 320) {
      await page.emulateMedia({ reducedMotion: 'no-preference' })
      for (const step of ['scan', 'route', 'kitchen', 'settle']) {
        const activeCard = page.locator(`.hero-flow__node--${step}[data-position="active"]`)
        await expect(activeCard).toHaveCount(1, { timeout: 12_000 })
        const bounds = await activeCard.boundingBox()
        expect(bounds!.y + bounds!.height, step).toBeLessThanOrEqual(copy!.y)
      }
    }
  })
}
