import { loadEnvFile } from 'node:process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { chromium, type BrowserContext, type Page } from '@playwright/test'
import { createClient, createServiceClient } from '../../packages/db/src/client'

const projectRoot = resolve(__dirname, '../..')
loadEnvFile(resolve(projectRoot, 'apps/menu/.env.local'))

const menuURL = 'http://127.0.0.1:3011'
const dashboardURL = 'http://127.0.0.1:3005'
const menuSlug = 'maf-lounge'
const outputDir = resolve(projectRoot, 'test-results/menu-closure-audit')

mkdirSync(outputDir, { recursive: true })

const evidence: {
  screenshots: string[]
  consoleErrors: string[]
  dashboardRestaurantId?: string
  emptyMenuCaptured: boolean
  recommendationDirtyGuardCaptured: boolean
} = {
  screenshots: [],
  consoleErrors: [],
  emptyMenuCaptured: false,
  recommendationDirtyGuardCaptured: false,
}

function observe(page: Page, label: string) {
  page.on('pageerror', (error) => evidence.consoleErrors.push(`${label}: pageerror: ${error.message}`))
  page.on('console', (message) => {
    if (message.type() === 'error') evidence.consoleErrors.push(`${label}: console: ${message.text()}`)
  })
}

async function capture(page: Page, name: string) {
  const path = `${outputDir}/${name}.png`
  await page.screenshot({ path, animations: 'disabled' })
  evidence.screenshots.push(path)
}

async function waitForMenu(page: Page) {
  await page.waitForSelector('html[data-menu-hydrated="true"]', { timeout: 20_000 })
  await page.waitForTimeout(350)
}

async function openPreferredProduct(page: Page) {
  const menemen = page.getByRole('button', { name: /Menemen detayını aç/i }).first()
  const fallback = page.locator('[data-component="card"]').first().getByRole('button', { name: /detayını aç/i })
  const target = await menemen.count() > 0 ? menemen : fallback
  await target.click()
  const dialog = page.locator('[data-component="product-modal"]').last()
  await dialog.waitFor({ state: 'visible' })
  await page.waitForTimeout(700)
  return dialog
}

function dashboardSessionCookies(session: unknown) {
  const projectRef = new URL(process.env['NEXT_PUBLIC_SUPABASE_URL']!).hostname.split('.')[0]!
  const baseName = `sb-${projectRef}-auth-token`
  const value = `base64-${Buffer.from(JSON.stringify(session), 'utf8').toString('base64url')}`
  const chunks = value.match(/.{1,3180}/g) ?? [value]
  return chunks.map((chunk, index) => ({
    name: chunks.length === 1 ? baseName : `${baseName}.${index}`,
    value: chunk,
    url: dashboardURL,
    sameSite: 'Lax' as const,
  }))
}

async function authenticateOwner(context: BrowserContext, ownerId: string) {
  const service = createServiceClient()
  const { data: ownerResult, error: ownerError } = await service.auth.admin.getUserById(ownerId)
  if (ownerError || !ownerResult.user.email) throw ownerError ?? new Error('Owner email is unavailable')
  const { data: magicLink, error: magicLinkError } = await service.auth.admin.generateLink({
    type: 'magiclink',
    email: ownerResult.user.email,
  })
  if (magicLinkError) throw magicLinkError
  const dashboardAuth = createClient()
  const { data: verifiedOwner, error: verifyOwnerError } = await dashboardAuth.auth.verifyOtp({
    token_hash: magicLink.properties.hashed_token,
    type: 'email',
  })
  if (verifyOwnerError || !verifiedOwner.session) throw verifyOwnerError ?? new Error('Owner session is unavailable')
  await context.addCookies(dashboardSessionCookies(verifiedOwner.session))
}

async function main() {
const browser = await chromium.launch({ headless: true })

try {
  const mobileContext = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: 'light' })
  const mobilePage = await mobileContext.newPage()
  observe(mobilePage, 'mobile-menu')
  await mobilePage.goto(`${menuURL}/${menuSlug}?preview=1`, { waitUntil: 'domcontentloaded' })
  await waitForMenu(mobilePage)
  await capture(mobilePage, '01-mobile-catalog')

  const mobileProductDialog = await openPreferredProduct(mobilePage)
  await capture(mobilePage, '02-mobile-product-detail')
  const recommendationOrNote = mobileProductDialog.locator('[data-component="product-recommendations"], [data-component="product-note"]').last()
  await recommendationOrNote.scrollIntoViewIfNeeded()
  await capture(mobilePage, '03-mobile-upsell-note')
  await mobileProductDialog.getByRole('button', { name: /Ürün detayını kapat/i }).click()

  const firstProduct = mobilePage.locator('[data-component="card"]').first()
  await firstProduct.getByRole('button', { name: /detayını aç/i }).click()
  const simpleDialog = mobilePage.locator('[data-component="product-modal"]').last()
  await simpleDialog.getByRole('button', { name: /Sepete ekle/i }).click()
  const cartDialog = mobilePage.getByRole('dialog', { name: 'Sepetiniz' })
  await cartDialog.waitFor({ state: 'visible' })
  await mobilePage.locator('[data-component="cart-checkout-unavailable"]').waitFor({ state: 'visible' })
  await mobilePage.waitForTimeout(700)
  await capture(mobilePage, '04-mobile-cart-browse-only')
  await mobileContext.close()

  const desktopContext = await browser.newContext({ viewport: { width: 1440, height: 950 }, colorScheme: 'light' })
  const desktopPage = await desktopContext.newPage()
  observe(desktopPage, 'desktop-menu')
  await desktopPage.goto(`${menuURL}/${menuSlug}?preview=1`, { waitUntil: 'domcontentloaded' })
  await waitForMenu(desktopPage)
  await capture(desktopPage, '05-desktop-catalog')
  const desktopProductDialog = await openPreferredProduct(desktopPage)
  await capture(desktopPage, '06-desktop-product-modal')
  await desktopProductDialog.getByRole('button', { name: /Ürün detayını kapat/i }).click()
  await desktopContext.close()

  const service = createServiceClient()
  const { data: mafRestaurant, error: mafError } = await service
    .from('restaurants')
    .select('id, owner_id')
    .eq('slug', menuSlug)
    .single()
  if (mafError || !mafRestaurant) throw mafError ?? new Error('MAF restaurant is unavailable')
  evidence.dashboardRestaurantId = mafRestaurant.id

  const dashboardContext = await browser.newContext({ viewport: { width: 1440, height: 950 }, colorScheme: 'light' })
  await authenticateOwner(dashboardContext, mafRestaurant.owner_id)
  const dashboardPage = await dashboardContext.newPage()
  observe(dashboardPage, 'dashboard-menu')
  await dashboardPage.goto(`${dashboardURL}/dashboard/${mafRestaurant.id}/menu`, { waitUntil: 'domcontentloaded' })
  await dashboardPage.getByText('Kategoriler', { exact: true }).waitFor({ state: 'visible', timeout: 20_000 })
  await capture(dashboardPage, '07-dashboard-menu-manager')

  const editButtons = dashboardPage.getByRole('button', { name: /ürününü düzenle$/i })
  if (await editButtons.count() > 1) {
    const recommendationProduct = dashboardPage.getByRole('button', { name: /Cheeburger ürününü düzenle$/i }).first()
    await (await recommendationProduct.count() > 0 ? recommendationProduct : editButtons.first()).click()
    const editor = dashboardPage.locator('.menu-item-editor')
    await editor.waitFor({ state: 'visible' })
    await editor.getByText('Yanında iyi gider', { exact: true }).scrollIntoViewIfNeeded()
    await capture(dashboardPage, '08-dashboard-recommendation-editor')

    const removeRecommendation = editor.getByRole('button', { name: /önerisini kaldır$/i }).first()
    if (await removeRecommendation.count() > 0) {
      await removeRecommendation.click()
    } else {
      const search = editor.getByPlaceholder('Ürün ara ve ekle…')
      await search.fill('a')
      const result = search.locator('xpath=following-sibling::div').getByRole('button').first()
      if (await result.count() > 0) await result.click()
    }

    const dirtyRecommendationLabel = dashboardPage.getByText('Öneriler kaydedilmedi', { exact: true })
    await dirtyRecommendationLabel.waitFor({ state: 'visible', timeout: 5_000 }).catch(() => undefined)
    if (await dirtyRecommendationLabel.isVisible()) {
      await editButtons.nth(1).click()
      const unsavedDialog = dashboardPage.getByRole('alertdialog', { name: /Kaydedilmemiş değişiklikler var/i })
      await unsavedDialog.waitFor({ state: 'visible' })
      await capture(dashboardPage, '09-dashboard-unsaved-recommendation-guard')
      evidence.recommendationDirtyGuardCaptured = true
      await unsavedDialog.getByRole('button', { name: 'Düzenlemeye dön' }).click()
    }
  }
  await dashboardContext.close()

  const { data: restaurants } = await service.from('restaurants').select('id, slug, owner_id').limit(30)
  let emptyRestaurant: { id: string; slug: string; owner_id: string } | null = null
  for (const candidate of restaurants ?? []) {
    const { count } = await service
      .from('menu_categories')
      .select('id', { count: 'exact', head: true })
      .eq('restaurant_id', candidate.id)
      .is('deleted_at', null)
    if (count === 0) {
      emptyRestaurant = candidate
      break
    }
  }

  if (emptyRestaurant) {
    const emptyContext = await browser.newContext({ viewport: { width: 1440, height: 950 }, colorScheme: 'light' })
    await authenticateOwner(emptyContext, emptyRestaurant.owner_id)
    const emptyPage = await emptyContext.newPage()
    observe(emptyPage, 'dashboard-empty-menu')
    await emptyPage.goto(`${dashboardURL}/dashboard/${emptyRestaurant.id}/menu`, { waitUntil: 'domcontentloaded' })
    const categoryAction = emptyPage.getByRole('button', { name: 'Kategori ekle', exact: true }).first()
    await categoryAction.waitFor({ state: 'visible', timeout: 20_000 })
    await capture(emptyPage, '10-dashboard-empty-menu')
    await categoryAction.click()
    await emptyPage.getByPlaceholder('Kategori adı').waitFor({ state: 'visible' })
    await capture(emptyPage, '11-dashboard-empty-menu-category-form')
    evidence.emptyMenuCaptured = true
    await emptyContext.close()
  }
} finally {
  await browser.close()
  writeFileSync(`${outputDir}/evidence.json`, JSON.stringify(evidence, null, 2))
}

if (evidence.consoleErrors.length > 0) {
  throw new Error(`Audit console errors:\n${evidence.consoleErrors.join('\n')}`)
}

console.log(JSON.stringify(evidence, null, 2))
}

void main()
