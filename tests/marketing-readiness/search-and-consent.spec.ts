import { expect, test } from '@playwright/test'

// Capture the local debug transport; these tests never enable a real Google tag.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const target = window as unknown as { analyticsDebugCommands: unknown[][] }
    target.analyticsDebugCommands = []
    window.addEventListener('masabu:analytics-debug', event => {
      const detail = (event as CustomEvent<{ name: string; parameters: Record<string, string> }>).detail
      target.analyticsDebugCommands.push(['event', detail.name, detail.parameters])
    })
  })
})

test('local analytics emits only after consent; navigation is counted once and withdrawal clears cookies', async ({ page, context }) => {
  test.skip(process.env.MARKETING_TEST_ANALYTICS_DISABLED === '1')
  const requests: string[] = []
  // Intercept the real provider boundary: these checks send no visitor data to Google.
  await page.route(/googletagmanager\.com|google-analytics\.com/, async (route) => {
    requests.push(route.request().url())
    await route.fulfill({ contentType: 'application/javascript', body: '' })
  })
  await context.addCookies([{ name: 'masabu_analytics_consent', value: '2026-09-09:essential', url: 'http://127.0.0.1:3103' }])
  await page.goto('/?email=person@example.com&token=secret&utm_source=google')
  await expect(page.getByRole('button', { name: 'Reddet', exact: true })).toBeVisible()
  expect(requests).toHaveLength(0)
  await page.getByRole('button', { name: 'Reddet', exact: true }).click()
  await page.reload()
  await expect(page.getByRole('button', { name: 'Çerez yönetimi' })).toBeVisible()
  expect(requests).toHaveLength(0)
  await page.getByRole('button', { name: 'Çerez yönetimi' }).click()
  await page.getByRole('button', { name: 'Kabul et', exact: true }).click()
  expect(requests).toHaveLength(0)
  const commands = () => page.evaluate(() => (window as unknown as { analyticsDebugCommands: ArrayLike<unknown>[] }).analyticsDebugCommands?.map((entry) => Array.from(entry)) ?? [])
  const initial = await commands()
  expect(initial.filter((entry) => entry[1] === 'page_view')).toHaveLength(1)
  expect(JSON.stringify(initial)).not.toMatch(/person@|secret|email=|token=/)
  await page.locator('footer a[href="/qr-menu"]').first().click()
  // The local Next dev server compiles this destination on its first request.
  await expect(page).toHaveURL('/qr-menu', { timeout: 20_000 })
  await expect.poll(async () => (await commands()).filter((entry) => entry[1] === 'page_view').length).toBe(2)
  await page.waitForTimeout(1700)
  expect((await commands()).filter((entry) => entry[1] === 'page_view')).toHaveLength(2)
  await context.addCookies(['_ga', 'masabu_signup_pending'].map((name) => ({ name, value: 'test', url: 'http://127.0.0.1:3103' })))
  await page.getByRole('button', { name: 'Çerez yönetimi' }).click()
  await page.getByRole('button', { name: 'Reddet', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Çerez yönetimi' })).toBeVisible()
  expect((await context.cookies()).some((cookie) => /^_ga/.test(cookie.name))).toBe(false)
  expect((await context.cookies()).some((cookie) => cookie.name === 'masabu_signup_pending')).toBe(false)
  expect(requests).toHaveLength(0)
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
  test.skip(process.env.MARKETING_TEST_ANALYTICS_DISABLED === '1')
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
  // Keep this click in-page so its queued event can be checked before navigation.
  const signupLink = page.locator('a[href*="/auth/signup"]').first()
  await signupLink.evaluate((element) => element.addEventListener('click', event => event.preventDefault(), { once: true }))
  await signupLink.click()
  const clicks = await page.evaluate(() => (window as unknown as { analyticsDebugCommands?: ArrayLike<unknown>[] }).analyticsDebugCommands?.map(entry => Array.from(entry)).filter(entry => entry[1] === 'signup_click') ?? [])
  expect(clicks).toHaveLength(1)
  await context.addCookies([{ name: 'masabu_signup_receipt', value: 'email', url: 'https://app.masabu.co', secure: true }])
  await page.goto('https://app.masabu.co/auth/signup?email=private@example.com&code=not-a-real-code')
  await expect(page.getByRole('button', { name: 'Çerez yönetimi' })).toBeVisible()
  const commands = () => page.evaluate(() => (window as unknown as { analyticsDebugCommands?: ArrayLike<unknown>[] }).analyticsDebugCommands?.map((entry) => Array.from(entry)) ?? [])
  expect((await commands()).filter((entry) => entry[1] === 'sign_up')).toHaveLength(1)
  expect(JSON.stringify(await commands())).not.toMatch(/private@|not-a-real-code|email=|code=/)
  await page.reload()
  await expect(page.getByRole('button', { name: 'Çerez yönetimi' })).toBeVisible()
  expect((await commands()).filter((entry) => entry[1] === 'sign_up')).toHaveLength(0)
  await page.getByRole('button', { name: 'Çerez yönetimi' }).click()
  await page.getByRole('button', { name: 'Reddet', exact: true }).click()
  // A completed signup without consent must not reappear when consent is granted later.
  await context.addCookies([{ name: 'masabu_signup_receipt', value: 'google', url: 'https://app.masabu.co', secure: true }])
  await page.reload()
  await expect(page.getByRole('button', { name: 'Çerez yönetimi' })).toBeVisible()
  expect((await context.cookies()).some(cookie => cookie.name === 'masabu_signup_receipt')).toBe(false)
  await page.getByRole('button', { name: 'Çerez yönetimi' }).click()
  await page.getByRole('button', { name: 'Kabul et', exact: true }).click()
  expect((await commands()).filter(entry => entry[1] === 'sign_up')).toHaveLength(0)
  await page.getByRole('button', { name: 'Çerez yönetimi' }).click()
  await page.getByRole('button', { name: 'Reddet', exact: true }).click()
  await page.goto('https://masabu.co/qr-menu')
  await expect(page.getByRole('button', { name: 'Çerez yönetimi' })).toBeVisible()
  expect(await page.locator('#masabu-ga4').count()).toBe(0)
  await page.goto('https://app.masabu.co/auth/login')
  expect(await page.locator('#masabu-ga4').count()).toBe(0)
  // Settings and login are unmeasured routes, but preferences must still open.
  const trigger = page.getByRole('button', { name: 'Çerez yönetimi', exact: true })
  await expect(trigger).toBeVisible()
  expect(await trigger.evaluate(element => getComputedStyle(element).position)).not.toBe('fixed')
  await expect(page.getByRole('button', { name: 'Çerez tercihleri', exact: true })).toHaveCount(0)
  await trigger.click()
  await expect(page.getByRole('region', { name: 'Çerez tercihleri' })).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(trigger).toBeFocused()
  await trigger.click()
  await page.getByRole('button', { name: 'Kabul et', exact: true }).click()
  await expect(page.getByRole('region', { name: 'Çerez tercihleri' })).toHaveCount(0)
  expect(await page.locator('#masabu-ga4').count()).toBe(0)
  expect((await context.cookies()).find(cookie => cookie.name === 'masabu_analytics_consent')?.value).toBe('2026-09-09:granted')
})


test('cookie notice opens automatically, remembers choices and returns after cookies are cleared', async ({ page, context, baseURL }, testInfo) => {
  test.skip(process.env.MARKETING_TEST_ANALYTICS_DISABLED !== '1')
  const googleRequests: string[] = []
  await page.route(/googletagmanager\.com|google-analytics\.com/, async (route) => {
    googleRequests.push(route.request().url())
    await route.fulfill({ contentType: 'application/javascript', body: '' })
  })
  await context.addCookies([
    { name: '_ga', value: 'old-cookie', url: baseURL! },
    { name: 'masabu_signup_receipt', value: 'email', url: baseURL! },
  ])
  await page.goto('/')
  const panel = page.getByRole('region', { name: 'Çerez tercihleri' })
  const trigger = page.getByRole('button', { name: 'Çerez yönetimi', exact: true })
  await expect(panel).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('cookie-notice-desktop.png') })
  await panel.getByRole('button', { name: 'Kabul et', exact: true }).click()
  await expect(panel).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Çerez tercihleri', exact: true })).toHaveCount(0)
  expect((await context.cookies()).find(c => c.name === 'masabu_analytics_consent')?.value).toBe('2026-09-09:essential')
  await page.reload()
  await expect(page.getByRole('button', { name: 'Çerez yönetimi', exact: true })).toBeVisible()
  await expect(panel).toHaveCount(0)
  await page.goto('/qr-menu')
  await expect(page.getByRole('button', { name: 'Çerez yönetimi', exact: true })).toBeVisible()
  await expect(panel).toHaveCount(0)
  await trigger.click()
  await expect(panel).toBeFocused()
  await expect(panel.getByText('Kullanımda değil', { exact: true })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(panel).toHaveCount(0)
  await expect(trigger).toBeFocused()
  await context.clearCookies()
  await page.reload()
  await expect(panel).toBeVisible()
  await page.setViewportSize({ width: 390, height: 844 })
  const bounds = await panel.boundingBox()
  expect(bounds!.x).toBeGreaterThanOrEqual(0)
  expect(bounds!.y).toBeGreaterThanOrEqual(0)
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390)
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(844)
  await page.screenshot({ path: testInfo.outputPath('cookie-notice-mobile.png') })
  await panel.getByRole('button', { name: 'Tercihler', exact: true }).click()
  await expect(panel).toBeFocused()
  await panel.getByRole('button', { name: 'Reddet', exact: true }).click()
  await page.reload()
  await expect(page.getByRole('button', { name: 'Çerez yönetimi', exact: true })).toBeVisible()
  const cookies = await context.cookies()
  expect(cookies.find(c => c.name === 'masabu_analytics_consent')?.value).toBe('2026-09-09:denied')
  expect(cookies.some(c => c.name.startsWith('_ga') || c.name === 'masabu_signup_receipt')).toBe(false)
  await page.getByRole('button', { name: 'Çerez yönetimi', exact: true }).click()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('button', { name: 'Çerez yönetimi', exact: true })).toBeFocused()
  expect(googleRequests).toHaveLength(0)
  expect(await page.locator('#masabu-ga4').count()).toBe(0)
})
