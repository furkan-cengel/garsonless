import { expect, test } from '@playwright/test'

test('GA loads only after consent; navigation is counted once and withdrawal clears cookies', async ({ page, context }) => {
  const requests: string[] = []
  // Intercept the real provider boundary: these checks send no visitor data to Google.
  await page.route(/googletagmanager\.com|google-analytics\.com/, async (route) => {
    requests.push(route.request().url())
    await route.fulfill({ contentType: 'application/javascript', body: '' })
  })
  await page.goto('/?email=person@example.com&token=secret&utm_source=google')
  await expect(page.getByRole('button', { name: 'Reddet', exact: true })).toBeVisible()
  expect(requests).toHaveLength(0)
  await page.getByRole('button', { name: 'Reddet', exact: true }).click()
  await page.reload()
  await expect(page.getByRole('button', { name: 'Çerez tercihleri' })).toBeVisible()
  expect(requests).toHaveLength(0)
  await page.getByRole('button', { name: 'Çerez tercihleri' }).click()
  await page.getByRole('button', { name: 'Kabul et', exact: true }).click()
  await expect.poll(() => requests.length).toBe(1)
  const commands = () => page.evaluate(() => (window as unknown as { dataLayer: ArrayLike<unknown>[] }).dataLayer?.map((entry) => Array.from(entry)) ?? [])
  const initial = await commands()
  expect(initial.filter((entry) => entry[1] === 'page_view')).toHaveLength(1)
  expect(JSON.stringify(initial)).not.toMatch(/person@|secret|email=|token=/)
  await page.locator('a[href="/qr-menu"]').first().click()
  await expect(page).toHaveURL('/qr-menu')
  await expect.poll(async () => (await commands()).filter((entry) => entry[1] === 'page_view').length).toBe(2)
  await page.waitForTimeout(1700)
  expect((await commands()).filter((entry) => entry[1] === 'page_view')).toHaveLength(2)
  await context.addCookies(['_ga', 'masabu_signup_pending'].map((name) => ({ name, value: 'test', url: 'http://127.0.0.1:3103' })))
  await page.getByRole('button', { name: 'Çerez tercihleri' }).click()
  await page.getByRole('button', { name: 'Reddet', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Çerez tercihleri' })).toBeVisible()
  expect((await context.cookies()).some((cookie) => /^_ga/.test(cookie.name))).toBe(false)
  expect((await context.cookies()).some((cookie) => cookie.name === 'masabu_signup_pending')).toBe(false)
  expect(requests).toHaveLength(1)
  expect(await page.locator('#masabu-ga4').count()).toBe(0)
})

test('public metadata renders and the commercial pages fit mobile screens', async ({ page, request }, testInfo) => {
  for (const path of ['/', '/fiyatlar', '/qr-menu', '/dijital-adisyon', '/qr-siparis', '/mutfak-ekrani', '/blog/pdf-menu-ve-dinamik-qr-menu']) {
    const response = await request.get(path)
    expect(response.status()).toBe(200)
    const html = await response.text()
    expect(html).toContain(`rel="canonical" href="https://masabu.co${path === '/' ? '' : path}`)
    expect(html).toContain('property="og:image" content="https://masabu.co/og-image.png"')
    expect(html).toContain('name="twitter:image" content="https://masabu.co/og-image.png"')
    expect(html).toContain(path === '/' ? 'Organization' : 'BreadcrumbList')
  }
  await page.setViewportSize({ width: 390, height: 844 })
  for (const path of ['/', '/fiyatlar', '/qr-menu']) {
    await page.goto(path)
    const reject = page.getByRole('button', { name: 'Reddet', exact: true })
    if (await reject.isVisible()) await reject.click()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.screenshot({ path: testInfo.outputPath(`${path.replaceAll('/', '') || 'home'}-mobile.png`), fullPage: true, animations: 'disabled' })
  }
})

test('consent crosses subdomains; signup receipt is consumed once and private routes stop measurement', async ({ page, context }) => {
  // Both Masabu origins are served entirely by local test servers, including assets.
  // No account or request is created in production.
  await context.routeWebSocket(/.*/, (socket) => socket.close())
  await context.route('**/*', async (route) => {
    const url = new URL(route.request().url())
    if (url.hostname === 'www.googletagmanager.com') {
      await route.fulfill({ contentType: 'application/javascript', body: '' }); return
    }
    const port = url.hostname === 'masabu.co' ? 3103 : url.hostname === 'app.masabu.co' ? 3110 : null
    if (!port) { await route.abort(); return }
    const response = await route.fetch({ url: `http://127.0.0.1:${port}${url.pathname}${url.search}` })
    await route.fulfill({ response })
  })
  await page.goto('https://masabu.co/')
  await page.getByRole('button', { name: 'Kabul et', exact: true }).click()
  const preference = (await context.cookies()).find((cookie) => cookie.name === 'masabu_analytics_consent')
  expect(preference?.domain).toBe('.masabu.co')
  expect(preference?.secure).toBe(true)
  await context.addCookies([{ name: 'masabu_signup_receipt', value: 'email', url: 'https://app.masabu.co', secure: true }])
  await page.goto('https://app.masabu.co/auth/signup?email=private@example.com&code=not-a-real-code')
  await expect(page.getByRole('button', { name: 'Çerez tercihleri' })).toBeVisible()
  const commands = () => page.evaluate(() => (window as unknown as { dataLayer?: ArrayLike<unknown>[] }).dataLayer?.map((entry) => Array.from(entry)) ?? [])
  expect((await commands()).filter((entry) => entry[1] === 'sign_up')).toHaveLength(1)
  expect(JSON.stringify(await commands())).not.toMatch(/private@|not-a-real-code|email=|code=/)
  await page.reload()
  await expect(page.getByRole('button', { name: 'Çerez tercihleri' })).toBeVisible()
  expect((await commands()).filter((entry) => entry[1] === 'sign_up')).toHaveLength(0)
  await page.getByRole('button', { name: 'Çerez tercihleri' }).click()
  await page.getByRole('button', { name: 'Reddet', exact: true }).click()
  await page.goto('https://masabu.co/qr-menu')
  await expect(page.getByRole('button', { name: 'Çerez tercihleri' })).toBeVisible()
  expect(await page.locator('#masabu-ga4').count()).toBe(0)
  await page.goto('https://app.masabu.co/auth/login')
  expect(await page.locator('#masabu-ga4').count()).toBe(0)
})
