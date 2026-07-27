import { expect, test } from '@playwright/test'
import { existsSync, readFileSync } from 'node:fs'
import { assertVisualHealth, collectPageFailures } from './visual-health'

const dashboardURL = process.env['SMOKE_DASHBOARD_URL'] ?? 'http://localhost:3005'
const storageState = process.env['DASHBOARD_VISUAL_STORAGE_STATE'] ?? 'test-results/visual-auth/dashboard-storage-state.json'
const generatedMetadata = process.env['DASHBOARD_VISUAL_METADATA'] ?? 'test-results/visual-auth/dashboard-metadata.json'
const templateId = process.env['DASHBOARD_VISUAL_TEMPLATE_ID'] ?? 'default'

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
const hasDashboardVisualEnv = hasExplicitStorageState || hasDashboardVisualCredentials

function getRestaurantId(): string {
  const restaurantId = process.env['DASHBOARD_VISUAL_RESTAURANT_ID'] ?? readGeneratedRestaurantId()
  expect(
    restaurantId,
    'Expected DASHBOARD_VISUAL_RESTAURANT_ID or generated dashboard auth metadata with restaurantId.',
  ).toBeTruthy()
  return restaurantId!
}

test.describe('authenticated dashboard visual smoke', () => {
  test.skip(
    !hasDashboardVisualEnv,
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
    await expect(page.getByText(/Tahsil edilen ciro|Sipariş hacmi|Masa durumu/i).first()).toBeVisible()
    await assertVisualHealth(page, testInfo, 'dashboard-pano')
    expect(failures).toEqual([])
  })

  test('menu manager is visually healthy', async ({ page }, testInfo) => {
    const failures = await collectPageFailures(page)
    const restaurantId = getRestaurantId()
    const response = await page.goto(`${dashboardURL}/dashboard/${restaurantId}/menu`, { waitUntil: 'domcontentloaded' })
    expect(response?.status()).toBe(200)
    await expect(page.getByText(/Kategoriler|Yeni ürün/i).first()).toBeVisible()
    await assertVisualHealth(page, testInfo, 'dashboard-menu-manager')
    expect(failures).toEqual([])
  })

  test('orders board is visually healthy', async ({ page }, testInfo) => {
    const failures = await collectPageFailures(page)
    const restaurantId = getRestaurantId()
    const response = await page.goto(`${dashboardURL}/dashboard/${restaurantId}/orders`, { waitUntil: 'domcontentloaded' })
    expect(response?.status()).toBe(200)
    await expect(page.getByText(/Siparişler|Sipariş Akışı|Sipariş yok/i).first()).toBeVisible()
    await assertVisualHealth(page, testInfo, 'dashboard-orders-board')
    expect(failures).toEqual([])
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

  test('loyalty settings section is visually healthy', async ({ page }, testInfo) => {
    const failures = await collectPageFailures(page)
    const restaurantId = getRestaurantId()
    const response = await page.goto(`${dashboardURL}/dashboard/${restaurantId}/settings`, { waitUntil: 'domcontentloaded' })
    expect(response?.status()).toBe(200)
    await page.getByRole('button', { name: /Sadakat/i }).click()
    await expect(page.getByText(/Damga|Puan|Seviye/i).first()).toBeVisible()
    await assertVisualHealth(page, testInfo, 'dashboard-loyalty-settings')
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
