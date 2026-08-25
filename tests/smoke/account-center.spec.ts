import { expect, test, type Page } from '@playwright/test'

const menuURL = process.env['SMOKE_MENU_URL'] ?? 'http://127.0.0.1:3011'
const menuSlug = process.env['SMOKE_MENU_SLUG'] ?? 'maf-lounge'

function accountFixture(state: string) {
  return `${menuURL}/${encodeURIComponent(menuSlug)}/menu?__customerAccountPreview=${encodeURIComponent(state)}`
}

async function waitForAccount(page: Page) {
  await expect(page.locator('html')).toHaveAttribute('data-menu-hydrated', 'true', { timeout: 15_000 })
  const dialog = page.getByRole('dialog', { name: 'Müşteri hesabı' })
  await expect(dialog).toBeVisible({ timeout: 15_000 })
  return dialog
}

test.describe('customer account center', () => {
  test.describe.configure({ timeout: 60_000 })

  test('keeps one scroller, responsive bounds and 44px targets', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto(accountFixture('overview'), { waitUntil: 'domcontentloaded' })

    const dialog = await waitForAccount(page)
    const close = dialog.getByRole('button', { name: 'Hesabı kapat' })
    await expect(dialog).toBeVisible()
    await expect(close).toBeFocused()

    for (const viewport of [
      { width: 320, height: 720 },
      { width: 390, height: 844 },
      { width: 768, height: 900 },
      { width: 1440, height: 1000 },
    ]) {
      await page.setViewportSize(viewport)
      const metrics = await page.evaluate(() => {
        const accountDialog = document.querySelector<HTMLElement>('.ml-account-dialog')
        const tabs = document.querySelector<HTMLElement>('.ac-tabs')
        const scrollContainers = accountDialog
          ? [...accountDialog.querySelectorAll<HTMLElement>('*')].filter((element) => {
              const overflowY = getComputedStyle(element).overflowY
              return /auto|scroll/.test(overflowY) && element.scrollHeight > element.clientHeight + 1
            })
          : []
        const undersizedTargets = accountDialog
          ? [...accountDialog.querySelectorAll<HTMLElement>('button,a,input,select,textarea,[tabindex]:not([tabindex="-1"])')]
              .filter((element) => {
                const rect = element.getBoundingClientRect()
                return rect.width > 0 && rect.height > 0 && (rect.width < 44 || rect.height < 44)
              })
          : []
        return {
          bodyOverflow: getComputedStyle(document.body).overflow,
          dialogWidth: accountDialog?.getBoundingClientRect().width ?? 0,
          pageOverflowX: document.documentElement.scrollWidth > window.innerWidth,
          tabsOverflowX: Boolean(tabs && tabs.scrollWidth > tabs.clientWidth + 1),
          scrollers: scrollContainers.map((element) => element.className),
          undersizedTargets: undersizedTargets.length,
        }
      })
      expect(metrics.bodyOverflow).toBe('hidden')
      expect(metrics.dialogWidth).toBeLessThanOrEqual(720)
      expect(metrics.pageOverflowX).toBe(false)
      expect(metrics.tabsOverflowX).toBe(false)
      expect(metrics.scrollers).toEqual(['ac-content'])
      expect(metrics.undersizedTargets).toBe(0)
    }

    const overviewTab = dialog.getByRole('tab', { name: 'Özet' })
    await overviewTab.press('ArrowRight')
    await expect(dialog.getByRole('tab', { name: 'Siparişler' })).toBeFocused()
    await dialog.getByRole('tab', { name: 'Siparişler' }).press('End')
    await expect(dialog.getByRole('tab', { name: 'Profil' })).toBeFocused()
    await dialog.getByRole('tab', { name: 'Profil' }).press('Home')
    await expect(overviewTab).toBeFocused()

    const durations = await page.evaluate(() => {
      const skeleton = document.querySelector<HTMLElement>('.ac-geometry-skeleton span')
      const tab = document.querySelector<HTMLElement>('.ac-tab')
      return {
        animation: skeleton ? getComputedStyle(skeleton).animationName : 'none',
        transition: tab ? getComputedStyle(tab).transitionDuration : '0s',
      }
    })
    expect(durations.animation).toBe('none')
    expect(durations.transition).toBe('0s')
  })

  test('layers order detail and account in browser history', async ({ page }) => {
    await page.goto(accountFixture('overview'), { waitUntil: 'domcontentloaded' })
    const dialog = await waitForAccount(page)
    await dialog.getByRole('button', { name: 'Hesabı kapat' }).click()
    await expect(dialog).toBeHidden()
    await page.getByRole('button', { name: 'Menüyü aç' }).click()
    const accountEntry = page.getByRole('button', { name: 'Hesap ve üyelik' })
    await expect(accountEntry).toBeVisible()
    await accountEntry.click()
    await expect(dialog).toBeVisible()
    await dialog.getByRole('tab', { name: 'Siparişler' }).click()
    await dialog.getByRole('button', { name: /MAF Cafe Lounge, Hazırlanıyor/ }).click()
    await expect(dialog.getByRole('button', { name: 'Siparişlere dön' })).toBeVisible()

    await page.goBack()
    await expect(dialog).toBeVisible()
    await expect(dialog.getByRole('button', { name: 'Siparişlere dön' })).toBeHidden()
    await expect(dialog.getByRole('tab', { name: 'Siparişler' })).toHaveAttribute('aria-selected', 'true')

    await page.goBack()
    await expect(dialog).toBeHidden()
    await expect(page.getByRole('button', { name: 'Menüyü aç' })).toBeFocused()
    await expect.poll(() => page.evaluate(() => getComputedStyle(document.body).overflow)).not.toBe('hidden')
  })

  test('renders recoverable loading, error and empty states', async ({ page }) => {
    await page.goto(accountFixture('loading'), { waitUntil: 'domcontentloaded' })
    let dialog = await waitForAccount(page)
    await expect(dialog.locator('.ac-geometry-skeleton[role="status"]')).toHaveAttribute('aria-label', 'Hesabın hazırlanıyor…')

    await page.goto(accountFixture('error'), { waitUntil: 'domcontentloaded' })
    dialog = await waitForAccount(page)
    await expect(dialog.getByRole('alert')).toContainText('Hesap bilgileri şu anda alınamıyor.')
    await expect(dialog.getByRole('button', { name: 'Tekrar dene' })).toBeVisible()

    await page.goto(accountFixture('empty'), { waitUntil: 'domcontentloaded' })
    dialog = await waitForAccount(page)
    await expect(dialog.getByText('Sadakat kartın henüz yok')).toBeVisible()
    await expect(dialog.getByText('Aktif siparişin yok')).toBeVisible()
  })

  test('keeps Masabu branding and scopes favorites to the open restaurant', async ({ page }) => {
    await page.goto(accountFixture('favorites'), { waitUntil: 'domcontentloaded' })
    const dialog = await waitForAccount(page)

    await expect(dialog.locator('.ac-brand-mark img')).toHaveAttribute('src', /android-chrome-192x192\.png/)
    await expect(dialog.getByRole('tab', { name: 'Favoriler' })).toHaveAttribute('aria-selected', 'true')
    await expect(dialog.getByText('MAF Cafe Lounge: 2 favori ürün')).toBeVisible()
    await expect(dialog.getByRole('heading', { name: 'MAF Cafe Lounge' })).toBeVisible()
    await expect(dialog.getByText('Mahalle Fırın')).toHaveCount(0)
  })
})
