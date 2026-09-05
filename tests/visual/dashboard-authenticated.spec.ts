import { expect, test } from '@playwright/test'
import { existsSync, readFileSync } from 'node:fs'
import { assertVisualHealth, collectPageFailures } from './visual-health'

const dashboardURL = process.env['SMOKE_DASHBOARD_URL'] ?? 'http://localhost:3005'
const storageState = process.env['DASHBOARD_VISUAL_STORAGE_STATE'] ?? 'test-results/visual-auth/dashboard-storage-state.json'
const generatedMetadata = process.env['DASHBOARD_VISUAL_METADATA'] ?? 'test-results/visual-auth/dashboard-metadata.json'
const templateId = process.env['DASHBOARD_VISUAL_TEMPLATE_ID'] ?? 'default'
const isCI = Boolean(process.env['CI'])

function readGeneratedRestaurantId(): string | undefined {
  if (!existsSync(generatedMetadata)) return undefined

  try {
    const raw = JSON.parse(readFileSync(generatedMetadata, 'utf8')) as { restaurantId?: unknown }
    return typeof raw.restaurantId === 'string' ? raw.restaurantId : undefined
  } catch {
    return undefined
  }
}

const hasExplicitStorageState = Boolean(
  process.env['DASHBOARD_VISUAL_STORAGE_STATE'] && process.env['DASHBOARD_VISUAL_RESTAURANT_ID'],
)
const hasDashboardVisualCredentials = Boolean(
  process.env['DASHBOARD_VISUAL_EMAIL'] && process.env['DASHBOARD_VISUAL_PASSWORD'],
)
const hasDashboardVisualMagicLink = Boolean(
  process.env['DASHBOARD_VISUAL_MAGICLINK_EMAIL']
  && process.env['NEXT_PUBLIC_SUPABASE_URL']
  && process.env['SUPABASE_SERVICE_ROLE_KEY'],
)
const hasDashboardVisualEnv = hasExplicitStorageState || hasDashboardVisualCredentials || hasDashboardVisualMagicLink

function getRestaurantId(): string {
  const restaurantId = process.env['DASHBOARD_VISUAL_RESTAURANT_ID'] ?? readGeneratedRestaurantId()
  expect(
    restaurantId,
    'Expected DASHBOARD_VISUAL_RESTAURANT_ID or generated dashboard auth metadata with restaurantId.',
  ).toBeTruthy()
  return restaurantId!
}

test.describe('authenticated dashboard visual smoke', () => {
  test.beforeAll(() => {
    if (isCI) {
      expect(hasDashboardVisualEnv, 'Authenticated dashboard visual credentials are mandatory in CI.').toBe(true)
    }
  })
  test.skip(
    !isCI && !hasDashboardVisualEnv,
    'Set DASHBOARD_VISUAL_EMAIL + DASHBOARD_VISUAL_PASSWORD for automatic login, or set DASHBOARD_VISUAL_STORAGE_STATE + DASHBOARD_VISUAL_RESTAURANT_ID.',
  )

  if (hasDashboardVisualEnv) {
    test.use({ storageState })
  }

  test('pano is visually healthy', async ({ page }, testInfo) => {
    const failures = await collectPageFailures(page)
    const restaurantId = getRestaurantId()
    const response = await page.goto(`${dashboardURL}/dashboard/${restaurantId}`, { waitUntil: 'domcontentloaded' })
    expect(response?.status()).toBe(200)
    if (testInfo.project.name === 'dashboard-zoom-200') {
      await page.locator('html').evaluate((element) => { element.style.zoom = '2' })
      await expect.poll(() => page.locator('html').evaluate((element) => getComputedStyle(element).zoom)).toBe('2')
    }
    await expect(page.getByText(/Tahsil edilen ciro|Sipariş hacmi|Masa durumu/i).first()).toBeVisible()
    await expect(page.locator('.page-topbar-tag')).toBeVisible()
    const activePanoLink = page.getByRole('navigation', { name: 'Ana bölümler' }).getByRole('link', { name: 'Pano' })
    await expect(activePanoLink).toHaveAttribute('aria-current', 'page')
    await activePanoLink.focus()
    await expect(activePanoLink).toBeFocused()
    const contextBox = await page.locator('.page-topbar-context').boundingBox()
    const tagBox = await page.locator('.page-topbar-tag').boundingBox()
    if (contextBox && tagBox) {
      const overlaps = !(
        contextBox.x + contextBox.width <= tagBox.x
        || tagBox.x + tagBox.width <= contextBox.x
        || contextBox.y + contextBox.height <= tagBox.y
        || tagBox.y + tagBox.height <= contextBox.y
      )
      expect(overlaps, 'Pano restaurant context and status must not overlap.').toBe(false)
    }
    expect(await page.getByRole('main').count(), 'Dashboard must expose one main landmark.').toBe(1)
    await page.emulateMedia({ reducedMotion: 'reduce' })
    const animated = await page.locator('.pano-shell').evaluate((root) => (
      Array.from(root.querySelectorAll('*')).filter((node) => {
        const style = getComputedStyle(node)
        return style.animationName !== 'none' && style.animationDuration !== '0s'
      }).length
    ))
    expect(animated, 'Pano animations must stop under reduced motion.').toBe(0)
    await page.locator('.pano-shell').locator('..').evaluate((element) => element.scrollTo({ top: element.scrollHeight }))
    await expect(page.getByText('Yoğun saatler')).toBeVisible()
    await assertVisualHealth(page, testInfo, 'dashboard-pano')
    expect(failures).toEqual([])
  })

  test('pano loading skeleton mirrors the mobile layout', async ({ page }, testInfo) => {
    test.skip(
      !['dashboard-mobile', 'dashboard-narrow'].includes(testInfo.project.name),
      'The Pano loading reflow is exercised at 390px and 320px.',
    )
    const failures = await collectPageFailures(page)
    const restaurantId = getRestaurantId()
    const panoPath = `/dashboard/${restaurantId}`
    await page.route('**/*', async (route) => {
      const request = route.request()
      const url = new URL(request.url())
      const headers = request.headers()
      const isPanoRsc = url.pathname === panoPath && headers['rsc'] === '1'
      if (!isPanoRsc) return route.continue()

      // Delay both prefetch and navigation requests. Aborting a prefetch can
      // surface a recoverable client error and make the console assertion noisy.
      await new Promise((resolve) => setTimeout(resolve, 2_000))
      return route.continue()
    })

    await page.goto(`${dashboardURL}${panoPath}/menu`, { waitUntil: 'domcontentloaded' })
    await page.emulateMedia({ reducedMotion: 'reduce' })
    const navigation = page.getByRole('navigation', { name: 'Ana bölümler' }).getByRole('link', { name: 'Pano' }).click()
    const loading = page.getByRole('status', { name: 'Pano yükleniyor' })
    await expect(loading).toBeVisible()
    await expect(loading).toHaveAttribute('aria-busy', 'true')

    const topbar = loading.locator('.dashboard-route-skeleton-topbar--pano')
    await expect(topbar).toHaveCSS('height', '104px')
    const metrics = loading.locator('.dashboard-route-skeleton-pano-metrics > div > div')
    const panels = loading.locator('.dashboard-route-skeleton-pano-panels > div')
    await expect(metrics).toHaveCount(4)
    await expect(panels).toHaveCount(2)
    const layout = await loading.evaluate((root) => {
      const rects = (selector: string) => Array.from(root.querySelectorAll(selector)).map((element) => {
        const rect = element.getBoundingClientRect()
        return { x: rect.x, y: rect.y, width: rect.width }
      })
      const animated = Array.from(root.querySelectorAll('.dashboard-skeleton')).filter((element) => {
        const style = getComputedStyle(element)
        return style.animationName !== 'none' && style.animationDuration !== '0s'
      }).length
      return {
        viewportWidth: window.innerWidth,
        scrollWidth: document.documentElement.scrollWidth,
        contentScrollable: root.querySelector('.dashboard-route-skeleton-pano')?.scrollHeight
          > (root.querySelector('.dashboard-route-skeleton-pano')?.clientHeight ?? 0),
        attentionHeight: root.querySelector('.dashboard-route-skeleton-pano-attention')?.getBoundingClientRect().height ?? 0,
        metrics: rects('.dashboard-route-skeleton-pano-metrics > div > div'),
        panels: rects('.dashboard-route-skeleton-pano-panels > div'),
        animated,
      }
    })
    expect(layout.scrollWidth).toBeLessThanOrEqual(layout.viewportWidth)
    expect(layout.contentScrollable).toBe(true)
    expect(layout.attentionHeight).toBeGreaterThan(180)
    for (const items of [layout.metrics, layout.panels]) {
      expect(items.every((item) => item.width >= layout.viewportWidth - 40)).toBe(true)
      expect(items.slice(1).every((item, index) => item.y > items[index]!.y)).toBe(true)
    }
    expect(layout.animated).toBe(0)
    await expect(page.locator('.restaurant-rail')).toBeVisible()
    await assertVisualHealth(page, testInfo, 'dashboard-pano-loading', { minTextLength: 5 })

    await navigation
    await expect(loading).toBeHidden()
    await expect(page.getByText(/Tahsil edilen ciro|Sipariş hacmi|Masa durumu/i).first()).toBeVisible()
    expect(failures).toEqual([])
  })

  test('pano recovers after the browser returns online', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'dashboard-desktop', 'Reconnect is exercised once on desktop.')
    const restaurantId = getRestaurantId()
    await page.goto(`${dashboardURL}/dashboard/${restaurantId}`, { waitUntil: 'domcontentloaded' })
    await page.context().setOffline(true)
    await expect(page.getByText(/Çevrimdışı/).first()).toBeVisible()
    await page.context().setOffline(false)
    await expect(page.getByText(/Bağlı|Bağlanıyor/).first()).toBeVisible({ timeout: 35_000 })
  })

  test('menu manager is visually healthy', async ({ page }, testInfo) => {
    const failures = await collectPageFailures(page)
    const restaurantId = getRestaurantId()
    if (testInfo.project.name === 'dashboard-zoom-200') {
      await page.setViewportSize({ width: 720, height: 900 })
    }
    const response = await page.goto(`${dashboardURL}/dashboard/${restaurantId}/menu`, { waitUntil: 'domcontentloaded' })
    expect(response?.status()).toBe(200)
    await expect(page.getByText(/Kategoriler|Yeni ürün/i).first()).toBeVisible()
    await page.emulateMedia({ reducedMotion: 'reduce' })

    const viewportWidth = await page.evaluate(() => window.innerWidth)
    const workspace = page.locator('.menu-manager-workspace')
    const categoryWorkspace = page.locator('.menu-category-workspace')
    const itemsWorkspace = page.locator('.menu-items-workspace')
    const editor = page.locator('.menu-item-editor')
    const emptyPanel = page.locator('.menu-manager-empty-panel')
    const pageOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
    expect(pageOverflow, 'Menu must not create document-level horizontal overflow.').toBe(false)

    if (viewportWidth <= 760) {
      await expect(page.locator('.menu-manager-topbar')).toHaveCSS('height', '104px')
      await expect(workspace).toHaveAttribute('data-workspace-stage', 'categories')
      await expect(categoryWorkspace).toBeVisible()
      await expect(itemsWorkspace).toBeHidden()
      await expect(emptyPanel).toBeHidden()
      await expect(page.locator('.restaurant-rail')).toBeVisible()

      const firstCategory = categoryWorkspace.getByRole('button').filter({ hasNotText: /ekle/i }).first()
      await firstCategory.click()
      await expect(workspace).toHaveAttribute('data-workspace-stage', 'items')
      await expect(categoryWorkspace).toBeHidden()
      await expect(itemsWorkspace).toBeVisible()
      await expect(itemsWorkspace.getByRole('button', { name: 'Yeni ürün', exact: true })).toBeVisible()

      const firstEditorAction = itemsWorkspace.locator('[aria-label$="ürününü düzenle"]').first()
      if (await firstEditorAction.count()) {
        await firstEditorAction.click()
        await expect(workspace).toHaveAttribute('data-workspace-stage', 'editor')
        await expect(editor).toBeVisible()
        await expect(itemsWorkspace).toBeHidden()
        const headingId = await editor.getAttribute('aria-labelledby')
        expect(headingId).toBeTruthy()
        await expect(page.locator(`#${headingId}`)).toBeFocused()
        await page.getByRole('button', { name: 'Ürünlere dön', exact: true }).click()
        await expect(firstEditorAction).toBeFocused()
        await firstEditorAction.click()
        await expect(workspace).toHaveAttribute('data-workspace-stage', 'editor')
        await expect(editor).toBeVisible()
        await page.getByRole('button', { name: 'Ürünlere dön', exact: true }).click()

        const newProduct = itemsWorkspace.getByRole('button', { name: 'Yeni ürün', exact: true })
        await newProduct.click()
        const newProductDialog = page.getByRole('dialog', { name: 'Yeni ürün ekle' })
        await expect(newProductDialog).toBeVisible()
        await expect(newProductDialog.getByRole('textbox', { name: 'Ürün adı' })).toBeFocused()
        await page.keyboard.press('Escape')
        await expect(newProductDialog).toBeHidden()
        await expect(newProduct).toBeFocused()
        // A dirty nested confirmation must preserve the draft and restore focus.
        await newProduct.click()
        await newProductDialog.getByRole('textbox', { name: 'Ürün adı' }).fill('Audit taslağı — kaydedilmez')
        await page.keyboard.press('Escape')
        const confirmation = page.getByRole('alertdialog')
        await expect(confirmation).toBeVisible()
        await expect(confirmation.getByRole('button', { name: 'Düzenlemeye dön' })).toBeFocused()
        await page.keyboard.press('Escape')
        await expect(confirmation).toBeHidden()
        await expect(newProductDialog.getByRole('textbox', { name: 'Ürün adı' })).toHaveValue('Audit taslağı — kaydedilmez')
        await page.keyboard.press('Escape')
        await confirmation.getByRole('button', { name: /sil|vazgeç/i }).click()
        await expect(newProductDialog).toBeHidden()
        await expect(newProduct).toBeFocused()

      }
    } else if (viewportWidth <= 1024) {
      await expect(categoryWorkspace).toBeVisible()
      await expect(itemsWorkspace).toBeVisible()
      await expect(emptyPanel).toBeHidden()
      expect((await categoryWorkspace.boundingBox())?.width).toBeCloseTo(220, 0)
      expect((await itemsWorkspace.boundingBox())?.width ?? 0).toBeGreaterThanOrEqual(360)

      const firstEditorAction = itemsWorkspace.locator('[aria-label$="ürününü düzenle"]').first()
      if (await firstEditorAction.count()) {
        await firstEditorAction.click()
        await expect(editor).toBeVisible()
        await expect(editor).toHaveCSS('position', 'absolute')
        expect((await editor.boundingBox())?.width).toBeCloseTo(420, 0)
      }
    } else {
      await expect(categoryWorkspace).toBeVisible()
      await expect(itemsWorkspace).toBeVisible()
      await expect(emptyPanel).toBeVisible()

      const categoryName = (await categoryWorkspace.locator('button[aria-current]').first().innerText()).trim()
      const search = page.getByRole('textbox', { name: 'Ürün veya kategori ara' })
      await search.fill(categoryName.toLocaleUpperCase('tr-TR'))
      await expect(page.getByText('Arama sonuçları', { exact: true })).toBeVisible()
      await expect(itemsWorkspace.locator('.menu-product-breadcrumb').first()).toBeVisible()
      await expect(page.getByRole('button', { name: 'Aramayı temizle', exact: true })).toBeVisible()
      await expect(page.getByRole('button', { name: 'Yeni ürün', exact: true })).toBeHidden()
      await search.press('Escape')
      await expect(search).toHaveValue('')
    }

    const animated = await page.locator('.menu-manager').evaluate((root) => (
      Array.from(root.querySelectorAll('*')).filter((node) => {
        const style = getComputedStyle(node)
        return style.animationName !== 'none' && style.animationDuration !== '0s'
      }).length
    ))
    expect(animated, 'Menu animations must stop under reduced motion.').toBe(0)
    await assertVisualHealth(page, testInfo, 'dashboard-menu-manager')
    expect(failures).toEqual([])
  })

  test('notifications recover from rejected requests and keep keyboard focus inside the panel', async ({ page }, testInfo) => {
    const restaurantId = getRestaurantId()
    await page.goto(`${dashboardURL}/dashboard/${restaurantId}/menu`, { waitUntil: 'domcontentloaded' })
    if (testInfo.project.name === 'dashboard-zoom-200') {
      await page.locator('html').evaluate((element) => { element.style.zoom = '2' })
    }
    await page.emulateMedia({ reducedMotion: 'reduce' })
    const trigger = page.getByRole('button', { name: 'Bildirimler', exact: true })
    await expect(trigger).toBeVisible()
    let failRequests = true
    await page.route('**/dashboard/**', async (route) => {
      if (failRequests && route.request().method() === 'POST' && route.request().headers()['next-action']) {
        await route.abort('failed')
      } else await route.continue()
    })
    await trigger.click()
    const panel = page.getByRole('dialog', { name: 'Bildirimler', exact: true })
    await expect(panel).toBeVisible()
    await expect(panel.getByText('Bildirimler yüklenemedi', { exact: true })).toBeVisible()
    await expect(panel.locator('.dashboard-notifications-list')).toHaveAttribute('aria-busy', 'false')
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
    const close = panel.getByRole('button', { name: 'Bildirimleri kapat' })
    await close.focus()
    await page.keyboard.press('Shift+Tab')
    await expect(panel.getByRole('button', { name: /Tümünü gör/ })).toBeFocused()
    failRequests = false
    await panel.getByRole('button', { name: 'Tekrar dene', exact: true }).click()
    await expect(panel.locator('.dashboard-notifications-list')).toHaveAttribute('aria-busy', 'false')
    await expect(panel.getByText('Bildirimler yüklenemedi', { exact: true })).toBeHidden()
    await page.keyboard.press('Escape')
    await expect(panel).toBeHidden()
    await expect(trigger).toBeFocused()
  })

  test('menu loading skeleton mirrors its responsive workspace', async ({ page }, testInfo) => {
    test.skip(
      !['dashboard-mobile', 'dashboard-narrow', 'dashboard-tablet', 'dashboard-zoom-200'].includes(testInfo.project.name),
      'Menu loading reflow is exercised at mobile, tablet and zoom-equivalent widths.',
    )
    if (testInfo.project.name === 'dashboard-zoom-200') {
      await page.setViewportSize({ width: 720, height: 900 })
    }
    const restaurantId = getRestaurantId()
    const menuPath = `/dashboard/${restaurantId}/menu`
    await page.route('**/*', async (route) => {
      const request = route.request()
      const url = new URL(request.url())
      const isMenuRsc = url.pathname === menuPath && request.headers()['rsc'] === '1'
      if (!isMenuRsc) return route.continue()
      await new Promise((resolve) => setTimeout(resolve, 2_000))
      return route.continue()
    })

    await page.goto(`${dashboardURL}/dashboard/${restaurantId}`, { waitUntil: 'domcontentloaded' })
    await page.emulateMedia({ reducedMotion: 'reduce' })
    const navigation = page.getByRole('navigation', { name: 'Ana bölümler' }).getByRole('link', { name: 'Menü' }).click()
    const loading = page.getByRole('status', { name: 'Menü yükleniyor' })
    await expect(loading).toBeVisible()
    await expect(loading).toHaveAttribute('aria-busy', 'true')

    const layout = await loading.evaluate((root) => {
      const visible = (selector: string) => {
        const element = root.querySelector(selector)
        return Boolean(element && getComputedStyle(element).display !== 'none' && element.getBoundingClientRect().width > 0)
      }
      const animated = Array.from(root.querySelectorAll('.dashboard-skeleton, [data-slot="skeleton"], .animate-spin')).filter((element) => {
        const style = getComputedStyle(element)
        return style.animationName !== 'none' && style.animationDuration !== '0s'
      }).length
      return {
        width: window.innerWidth,
        scrollWidth: document.documentElement.scrollWidth,
        topbarHeight: root.querySelector('.dashboard-route-skeleton-topbar--menu')?.getBoundingClientRect().height ?? 0,
        categoryWidth: root.querySelector('.dashboard-route-skeleton-menu-categories')?.getBoundingClientRect().width ?? 0,
        categories: visible('.dashboard-route-skeleton-menu-categories'),
        items: visible('.dashboard-route-skeleton-menu-items'),
        props: visible('.dashboard-route-skeleton-menu-props'),
        animated,
      }
    })
    expect(layout.scrollWidth).toBeLessThanOrEqual(layout.width)
    expect(layout.categories).toBe(true)
    if (layout.width <= 760) {
      expect(layout.topbarHeight).toBeCloseTo(104, 0)
      expect(layout.categoryWidth).toBeCloseTo(layout.width, 0)
      expect(layout.items).toBe(false)
      expect(layout.props).toBe(false)
    } else {
      expect(layout.topbarHeight).toBeCloseTo(52, 0)
      expect(layout.categoryWidth).toBeCloseTo(220, 0)
      expect(layout.items).toBe(true)
      expect(layout.props).toBe(false)
    }
    expect(layout.animated).toBe(0)
    await expect(page.locator('.restaurant-rail')).toBeVisible()

    await navigation
    await expect(loading).toBeHidden()
    await expect(page.getByText(/Kategoriler|Yeni ürün/i).first()).toBeVisible()
  })

  test('orders board is visually healthy', async ({ page }, testInfo) => {
    const failures = await collectPageFailures(page)
    const restaurantId = getRestaurantId()
    const response = await page.goto(`${dashboardURL}/dashboard/${restaurantId}/orders`, { waitUntil: 'domcontentloaded' })
    expect(response?.status()).toBe(200)
    await expect(page.getByText(/Siparişler|Sipariş Akışı|Sipariş yok/i).first()).toBeVisible()
    await expect(page.locator('.orders-shell')).toBeVisible()
    const responsive = await page.locator('.orders-shell').evaluate((root) => {
      const visibleStages = Array.from(root.querySelectorAll('.orders-column-slot')).filter((element) => getComputedStyle(element).display !== 'none')
      const tabs = Array.from(root.querySelectorAll('.orders-mobile-stage-tabs [role="tab"]')).filter((element) => getComputedStyle(element).display !== 'none')
      return {
        width: window.innerWidth,
        horizontalOverflow: document.documentElement.scrollWidth - window.innerWidth,
        presentation: root.getAttribute('data-orders-presentation'),
        visibleStages: visibleStages.length,
        tabs: tabs.length,
      }
    })
    expect(responsive.horizontalOverflow).toBeLessThanOrEqual(1)
    if (responsive.width <= 760) {
      expect(responsive.presentation).toBe('sheet')
      expect(responsive.visibleStages).toBe(1)
      expect(responsive.tabs).toBe(4)
      await expect(page.getByRole('navigation', { name: 'Ana bölümler' })).toBeVisible()
      const firstCard = page.locator('.order-card-shell').first().getByRole('button', { name: /Sipariş detayını aç/ })
      if (await firstCard.count()) {
        await firstCard.click()
        await expect(page.locator('#order-detail-title')).toBeFocused()
        await page.getByRole('button', { name: /sipariş detayını kapat/i }).click()
        await expect(firstCard).toBeFocused()
      }
    } else if (responsive.width <= 1180) {
      expect(responsive.presentation).toBe('drawer')
      expect(responsive.tabs).toBe(0)
    }
    await assertVisualHealth(page, testInfo, 'dashboard-orders-board')
    expect(failures).toEqual([])
  })

  test('orders loading skeleton mirrors the responsive board', async ({ page }, testInfo) => {
    test.skip(
      !['dashboard-mobile', 'dashboard-narrow', 'dashboard-tablet', 'dashboard-zoom-200'].includes(testInfo.project.name),
      'Orders loading reflow is exercised at mobile, tablet and zoom-equivalent widths.',
    )
    if (testInfo.project.name === 'dashboard-zoom-200') await page.setViewportSize({ width: 720, height: 900 })
    const restaurantId = getRestaurantId()
    const ordersPath = `/dashboard/${restaurantId}/orders`
    await page.route('**/*', async (route) => {
      const request = route.request()
      const url = new URL(request.url())
      if (url.pathname !== ordersPath || request.headers()['rsc'] !== '1') return route.continue()
      await new Promise((resolve) => setTimeout(resolve, 2_000))
      return route.continue()
    })

    await page.goto(`${dashboardURL}/dashboard/${restaurantId}`, { waitUntil: 'domcontentloaded' })
    await page.emulateMedia({ reducedMotion: 'reduce' })
    const navigation = page.getByRole('navigation', { name: 'Ana bölümler' }).getByRole('link', { name: 'Siparişler' }).click()
    const loading = page.getByRole('status', { name: 'Siparişler yükleniyor' })
    await expect(loading).toBeVisible()
    await expect(loading).toHaveAttribute('aria-busy', 'true')

    const layout = await loading.evaluate((root) => {
      const visible = (selector: string) => Array.from(root.querySelectorAll(selector)).filter((element) => getComputedStyle(element).display !== 'none' && element.getBoundingClientRect().width > 0)
      const animated = Array.from(root.querySelectorAll('.dashboard-skeleton, [data-slot="skeleton"], .animate-spin')).filter((element) => {
        const style = getComputedStyle(element)
        return style.animationName !== 'none' && style.animationDuration !== '0s'
      }).length
      return {
        width: window.innerWidth,
        scrollWidth: document.documentElement.scrollWidth,
        topbarHeight: root.querySelector('.dashboard-route-skeleton-topbar--orders')?.getBoundingClientRect().height ?? 0,
        nav: visible('.dashboard-route-skeleton-orders-nav').length,
        detail: visible('.dashboard-route-skeleton-orders-detail').length,
        toolbar: visible('.dashboard-route-skeleton-orders-toolbar').length,
        tabs: visible('.dashboard-route-skeleton-orders-tabs').length,
        columns: visible('.dashboard-route-skeleton-orders-column').length,
        animated,
      }
    })
    expect(layout.scrollWidth).toBeLessThanOrEqual(layout.width)
    expect(layout.topbarHeight).toBeCloseTo(104, 0)
    expect(layout.nav).toBe(0)
    expect(layout.detail).toBe(0)
    expect(layout.toolbar).toBe(1)
    if (layout.width <= 760) {
      expect(layout.tabs).toBe(1)
      expect(layout.columns).toBe(1)
    } else {
      expect(layout.tabs).toBe(0)
      expect(layout.columns).toBeGreaterThan(1)
    }
    expect(layout.animated).toBe(0)
    await expect(page.getByRole('navigation', { name: 'Ana bölümler' })).toBeVisible()
    await navigation
    await expect(loading).toBeHidden()
  })

  test('customers page is visually healthy', async ({ page }, testInfo) => {
    const failures = await collectPageFailures(page)
    const restaurantId = getRestaurantId()
    const response = await page.goto(`${dashboardURL}/dashboard/${restaurantId}/customers`, { waitUntil: 'domcontentloaded' })
    expect(response?.status()).toBe(200)
    await expect(page.getByText(/Müşteriler|Segment/i).first()).toBeVisible()
    await assertVisualHealth(page, testInfo, 'dashboard-customers')
    expect(failures).toEqual([])
  })

  test('tables builder is visually healthy', async ({ page }, testInfo) => {
    const failures = await collectPageFailures(page)
    const restaurantId = getRestaurantId()
    const response = await page.goto(`${dashboardURL}/dashboard/${restaurantId}/tables`, { waitUntil: 'domcontentloaded' })
    expect(response?.status()).toBe(200)
    await expect(page.getByText(/Masalar & QR|Masalar|QR/i).first()).toBeVisible()
    await assertVisualHealth(page, testInfo, 'dashboard-tables-builder', { maxHorizontalOverflow: 16 })
    expect(failures).toEqual([])
  })

  test('settings sections are visually healthy and preserve per-form drafts', async ({ page }, testInfo) => {
    test.setTimeout(180_000)
    const failures = await collectPageFailures(page)
    const restaurantId = getRestaurantId()
    const allSections = [
      'profile', 'workspace', 'team', 'store', 'hours', 'tax', 'languages', 'payments',
      'loyalty', 'kitchen', 'notifications', 'api', 'billing', 'security', 'privacy',
    ] as const
    const responsiveSections = ['team', 'store', 'hours', 'payments', 'loyalty', 'notifications', 'billing', 'security'] as const
    const sections = ['dashboard-desktop', 'dashboard-mobile'].includes(testInfo.project.name)
      ? allSections
      : responsiveSections

    for (const section of sections) {
      const response = await page.goto(`${dashboardURL}/dashboard/${restaurantId}/settings?section=${section}`, { waitUntil: 'domcontentloaded' })
      expect(response?.status()).toBe(200)
      await expect(page.locator('[data-settings-root]')).toBeVisible()
      await expect(page.getByText('Ayarlar güvenli biçimde yükleniyor…')).toBeHidden({ timeout: 15_000 })
      if (testInfo.project.name === 'dashboard-zoom-200') {
        await page.locator('html').evaluate((element) => { element.style.zoom = '2' })
      }
      const layout = await page.evaluate(() => ({
        viewportWidth: window.innerWidth,
        scrollWidth: document.documentElement.scrollWidth,
        settingsButtons: Array.from(document.querySelectorAll<HTMLElement>('[data-settings-root] button')).map((button) => {
          const rect = button.getBoundingClientRect()
          return { width: rect.width, height: rect.height, visible: rect.width > 0 && rect.height > 0 }
        }),
      }))
      expect(layout.scrollWidth, `${section} must not create document-level horizontal overflow.`).toBeLessThanOrEqual(layout.viewportWidth + 1)
      if (['dashboard-mobile', 'dashboard-narrow'].includes(testInfo.project.name)) {
        expect(layout.settingsButtons.filter((button) => button.visible).every((button) => button.height >= 43.5)).toBe(true)
        const rail = page.locator('.restaurant-rail')
        await expect(rail).toBeVisible()
        const railBox = await rail.boundingBox()
        expect((railBox?.y ?? 0) + (railBox?.height ?? 0)).toBeLessThanOrEqual((await page.viewportSize())!.height + 1)
      }
      await assertVisualHealth(page, testInfo, `dashboard-settings-${section}`)
    }

    await page.goto(`${dashboardURL}/dashboard/${restaurantId}/settings?section=store`, { waitUntil: 'domcontentloaded' })
    await expect(page.getByText('Ayarlar güvenli biçimde yükleniyor…')).toBeHidden({ timeout: 15_000 })
    const phone = page.getByRole('textbox', { name: 'Telefon', exact: true })
    const originalPhone = await phone.inputValue()
    await phone.fill(`${originalPhone}1`)
    await phone.fill(originalPhone)
    await page.getByRole('button', { name: /Çalışma Saatleri/i }).click()
    await expect(page.getByRole('alertdialog')).toHaveCount(0)
    await expect(page.getByRole('heading', { name: 'Çalışma Saatleri' })).toBeVisible()

    await page.goto(`${dashboardURL}/dashboard/${restaurantId}/settings?section=store`, { waitUntil: 'domcontentloaded' })
    await expect(page.getByText('Ayarlar güvenli biçimde yükleniyor…')).toBeHidden({ timeout: 15_000 })
    await phone.fill(`${originalPhone}1`)
    await page.getByRole('button', { name: /^Profil / }).click()
    const unsaved = page.getByRole('alertdialog')
    await expect(unsaved).toBeVisible()
    await expect(unsaved.getByRole('button', { name: /Düzenlemeye devam et/i })).toBeFocused()
    await page.keyboard.press('Escape')
    await expect(unsaved).toBeHidden()

    await page.goto(`${dashboardURL}/dashboard/${restaurantId}/settings?section=privacy`, { waitUntil: 'domcontentloaded' })
    await expect(page.getByText('Ayarlar güvenli biçimde yükleniyor…')).toBeHidden({ timeout: 15_000 })
    const deletionRequest = page.getByRole('button', { name: /İşletme kapatma talebi/i })
    await deletionRequest.click()
    const sensitiveDialog = page.getByRole('alertdialog')
    await expect(sensitiveDialog).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(sensitiveDialog).toBeHidden()
    expect(failures).toEqual([])
  })

  test('theme editor is visually healthy', async ({ page }, testInfo) => {
    const failures = await collectPageFailures(page)
    const restaurantId = getRestaurantId()
    const response = await page.goto(`${dashboardURL}/dashboard/${restaurantId}/theme/${templateId}/edit`, {
      waitUntil: 'domcontentloaded',
    })
    expect(response?.status()).toBe(200)
    await expect(page.getByText(/Tema Düzenleyici|Önizleme/i).first()).toBeVisible()
    await page.getByRole('button', { name: /^Bölüm ekle$/i }).click()
    const sectionPicker = page.getByRole('dialog', { name: /Bölüm ekle/i })
    await expect(sectionPicker).toBeVisible()
    await expect(sectionPicker.getByRole('textbox', { name: /Eklenecek bölüm ara/i })).toBeVisible()
    await expect(sectionPicker.getByText(/Geliştiriliyor/i).first()).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(sectionPicker).toBeHidden()
    await assertVisualHealth(page, testInfo, 'dashboard-theme-editor', { maxHorizontalOverflow: 16 })
    expect(failures).toEqual([])
  })
})
