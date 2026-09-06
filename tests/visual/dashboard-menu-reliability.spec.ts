import { expect, test } from '@playwright/test'
import { existsSync, readFileSync } from 'node:fs'

const dashboardURL = process.env['SMOKE_DASHBOARD_URL'] ?? 'http://localhost:3005'
const storageState = process.env['DASHBOARD_VISUAL_STORAGE_STATE'] ?? 'test-results/visual-auth/dashboard-storage-state.json'
const metadataPath = process.env['DASHBOARD_VISUAL_METADATA'] ?? 'test-results/visual-auth/dashboard-metadata.json'
const configured = Boolean(process.env['DASHBOARD_VISUAL_STORAGE_STATE'] || process.env['DASHBOARD_VISUAL_EMAIL'] || process.env['DASHBOARD_VISUAL_MAGICLINK_EMAIL'])

test.describe('menu draft reliability', () => {
  test.skip(!configured, 'Authenticated dashboard fixture required')
  if (configured) test.use({ storageState })
  test.beforeEach(async ({ page }, testInfo) => {
    const metadata = existsSync(metadataPath) ? JSON.parse(readFileSync(metadataPath, 'utf8')) : {}
    const restaurantId = process.env['DASHBOARD_VISUAL_RESTAURANT_ID'] ?? metadata.restaurantId
    expect(restaurantId).toBeTruthy()
    await page.goto(`${dashboardURL}/dashboard/${restaurantId}/menu`)
    if (testInfo.project.name === 'dashboard-zoom-200') await page.locator('html').evaluate((element) => { element.style.zoom = '2' })
    const categories = page.getByRole('complementary', { name: 'Kategoriler' })
    if (await categories.isVisible()) await categories.locator('.menu-category-select').first().click()
    await page.getByRole('button', { name: /ürününü düzenle$/ }).first().click()
    await expect(page.locator('.menu-item-editor')).toBeVisible()
  })

  test('closing a dirty editor preserves every field when cancelled', async ({ page }) => {
    const editor = page.locator('.menu-item-editor')
    await editor.getByRole('textbox', { name: 'Ad', exact: true }).fill('Kaydedilmemiş ürün')
    await editor.getByRole('button', { name: 'Kapat', exact: true }).click()
    await expect(page.getByRole('alertdialog')).toBeVisible()
    await page.getByRole('button', { name: 'Düzenlemeye dön', exact: true }).click()
    await expect(editor.getByRole('textbox', { name: 'Ad', exact: true })).toHaveValue('Kaydedilmemiş ürün')
    await expect(editor.getByRole('button', { name: 'Değişiklikleri kaydet' })).toBeInViewport()
    await editor.getByRole('button', { name: 'Kapat', exact: true }).click()
    await page.getByRole('button', { name: 'Değişiklikleri sil', exact: true }).click()
    await expect(editor).toHaveCount(0)
  })

  test('image selection stays local and discard performs no product write', async ({ page }) => {
    const writes: string[] = []
    page.on('request', (request) => { if (request.method() === 'POST' && request.headers()['next-action']) writes.push(request.url()) })
    const editor = page.locator('.menu-item-editor')
    await editor.locator('input[type=file]').setInputFiles({
      name: 'draft.png', mimeType: 'image/png',
      buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jC1kAAAAASUVORK5CYII=', 'base64'),
    })
    await expect(editor.locator('img').first()).toHaveAttribute('src', /^blob:/)
    await editor.getByRole('button', { name: 'Kapat', exact: true }).click()
    await page.getByRole('button', { name: 'Değişiklikleri sil', exact: true }).click()
    expect(writes).toEqual([])
  })

  test('section navigation asks before leaving a product draft', async ({ page }) => {
    const editor = page.locator('.menu-item-editor')
    const before = page.url()
    await editor.getByRole('textbox', { name: 'Ad', exact: true }).fill('Bölüm geçişi taslağı')
    await page.getByRole('navigation').getByRole('link', { name: 'Masalar', exact: true }).click()
    await expect(page.getByRole('alertdialog')).toBeVisible()
    expect(page.url()).toBe(before)
    await page.getByRole('button', { name: 'Düzenlemeye dön', exact: true }).click()
    await expect(editor.getByRole('textbox', { name: 'Ad', exact: true })).toHaveValue('Bölüm geçişi taslağı')
  })

  test('a transport failure keeps the draft and enables another save attempt', async ({ page }) => {
    const editor = page.locator('.menu-item-editor')
    await editor.getByRole('textbox', { name: 'Ad', exact: true }).fill('Ağ hatası taslağı')
    let attempts = 0
    await page.route('**/dashboard/**/menu', (route) => {
      if (route.request().method() === 'POST' && route.request().headers()['next-action']) { attempts += 1; return route.abort('failed') }
      return route.continue()
    })
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      await editor.getByRole('button', { name: 'Değişiklikleri kaydet' }).click()
      await expect(editor.getByRole('alert')).toContainText('Taslağın korundu')
      await expect(editor.getByRole('textbox', { name: 'Ad', exact: true })).toHaveValue('Ağ hatası taslağı')
      await expect(editor.getByRole('button', { name: 'Değişiklikleri kaydet' })).toBeEnabled()
      expect(attempts).toBe(attempt)
    }
  })
})
