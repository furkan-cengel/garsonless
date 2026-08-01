import { chromium, type BrowserContext } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { loadEnvFile } from 'node:process'
import { createClient, createServiceClient } from '../../packages/db/src/client'

const dashboardURL = process.env['ANALYTICS_AUDIT_DASHBOARD_URL'] ?? 'http://127.0.0.1:3011'
const evidenceDir = process.env['ANALYTICS_AUDIT_EVIDENCE_DIR'] ?? '/private/tmp/analytics-f08-runtime'
const repositoryRoot = fileURLToPath(new URL('../../', import.meta.url))
if (!process.env['NEXT_PUBLIC_SUPABASE_URL']) loadEnvFile(`${repositoryRoot}apps/dashboard/.env.local`)

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

async function authenticate(context: BrowserContext, ownerId: string) {
  const service = createServiceClient()
  const { data: owner, error: ownerError } = await service.auth.admin.getUserById(ownerId)
  if (ownerError || !owner.user.email) throw ownerError ?? new Error('Owner unavailable')
  const { data: link, error: linkError } = await service.auth.admin.generateLink({ type: 'magiclink', email: owner.user.email })
  if (linkError) throw linkError
  const { data: verified, error: verifyError } = await createClient().auth.verifyOtp({ token_hash: link.properties.hashed_token, type: 'email' })
  if (verifyError || !verified.session) throw verifyError ?? new Error('Session unavailable')
  await context.addCookies(dashboardSessionCookies(verified.session))
}

function localDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

async function waitForUrlWithUiRetry(
  page: import('@playwright/test').Page,
  predicate: (url: URL) => boolean,
) {
  let retries = 0
  while (retries <= 2) {
    const outcome = await Promise.race([
      page.waitForURL(predicate, { timeout: 90_000 }).then(() => 'committed' as const),
      page.getByRole('button', { name: 'Tekrar dene' })
        .waitFor({ state: 'visible', timeout: 90_000 }).then(() => 'retry' as const),
    ])
    if (outcome === 'committed') return retries
    retries += 1
    await page.getByRole('button', { name: 'Tekrar dene' }).click()
  }
  throw new Error('Analytics request did not recover after UI retries')
}

async function main() {
  const service = createServiceClient()
  const { data: restaurant, error } = await service
    .from('restaurants')
    .select('id, owner_id')
    .eq('name', process.env['ANALYTICS_AUDIT_RESTAURANT_NAME'] ?? 'MAF Cafe Lounge')
    .is('deleted_at', null)
    .single()
  if (error || !restaurant) throw error ?? new Error('Restaurant unavailable')

  mkdirSync(evidenceDir, { recursive: true })
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
  const page = await context.newPage()
  const pageErrors: string[] = []
  const reportRequests: Array<{ range?: string; source?: string; paymentMethod?: string; status?: string }> = []
  page.on('pageerror', (pageError) => pageErrors.push(pageError.message))
  page.on('request', (request) => {
    if (!request.url().endsWith('/api/analytics/report') || request.method() !== 'POST') return
    try {
      const body = request.postDataJSON() as { query?: { range?: string; filters?: { source?: string; paymentMethod?: string; status?: string } } }
      reportRequests.push({ range: body.query?.range, ...body.query?.filters })
    } catch { /* malformed requests are asserted by response status below */ }
  })

  try {
    await authenticate(context, restaurant.owner_id)
    await page.goto(`${dashboardURL}/dashboard/${restaurant.id}/analytics`, { waitUntil: 'domcontentloaded', timeout: 60_000 })
    await page.getByRole('heading', { name: 'Satış Raporu' }).waitFor({ timeout: 60_000 })
    const range = page.getByRole('combobox', { name: 'Rapor dönemi' })

    await range.selectOption('yesterday')
    await page.waitForURL((url) => url.searchParams.get('range') === 'yesterday', { timeout: 60_000 })
    await page.getByText('Dün · önceki güne göre', { exact: true }).waitFor({ timeout: 60_000 })

    await page.getByRole('combobox', { name: 'Sipariş kanalı' }).selectOption('customer')
    await page.waitForURL((url) => url.searchParams.get('source') === 'customer', { timeout: 60_000 })
    await page.getByRole('combobox', { name: 'Ödeme yöntemi' }).selectOption('cash')
    await page.waitForURL((url) => url.searchParams.get('payment') === 'cash', { timeout: 60_000 })
    await page.getByRole('combobox', { name: 'Sipariş durumu' }).selectOption('served')
    await page.waitForURL((url) => url.searchParams.get('status') === 'served', { timeout: 60_000 })

    const combinedRequest = reportRequests.at(-1)
    const combinedAndApplied = combinedRequest?.source === 'customer'
      && combinedRequest.paymentMethod === 'cash'
      && combinedRequest.status === 'served'

    await page.getByRole('button', { name: 'Filtreleri temizle' }).click()
    const transientRetries = await waitForUrlWithUiRetry(
      page,
      (url) => !url.searchParams.has('source') && !url.searchParams.has('payment') && !url.searchParams.has('status'),
    )

    const today = new Date()
    const from = new Date(today)
    from.setDate(from.getDate() - 6)
    await range.selectOption('custom')
    const customDialog = page.getByRole('dialog', { name: 'Özel tarih aralığı' })
    await customDialog.waitFor()
    await customDialog.getByLabel('Başlangıç').fill(localDateKey(from))
    await customDialog.getByLabel('Bitiş').fill(localDateKey(today))
    await customDialog.getByRole('button', { name: 'Uygula' }).click()
    await page.waitForURL((url) => url.searchParams.get('range') === 'custom' && Boolean(url.searchParams.get('from')) && Boolean(url.searchParams.get('to')), { timeout: 60_000 })
    const customUrl = page.url()

    await page.goBack()
    await page.waitForURL((url) => url.searchParams.get('range') === 'yesterday', { timeout: 60_000 })
    await page.waitForFunction(() => (document.querySelector('[aria-label="Rapor dönemi"]') as HTMLSelectElement | null)?.value === 'yesterday')
    await page.goForward()
    await page.waitForURL((url) => url.searchParams.get('range') === 'custom', { timeout: 60_000 })
    await page.waitForFunction(() => (document.querySelector('[aria-label="Rapor dönemi"]') as HTMLSelectElement | null)?.value === 'custom')

    await page.reload({ waitUntil: 'domcontentloaded' })
    await page.getByRole('heading', { name: 'Satış Raporu' }).waitFor({ timeout: 60_000 })
    const deepLinkRestored = await range.inputValue() === 'custom' && page.url() === customUrl

    await page.locator('.analytics-report-tab:visible').filter({ hasText: 'Ürünler' }).click()
    await page.getByRole('heading', { name: 'Ürün Performansı' }).waitFor({ timeout: 60_000 })
    await page.getByLabel('Sırala').selectOption('count')
    const sortSerialized = new URL(page.url()).searchParams.get('sort') === 'count'
    const detailButtons = page.getByRole('button', { name: 'Detay', exact: true })
    const hasRows = await detailButtons.count() > 0
    let detailDeepLink = false
    if (hasRows) {
      await detailButtons.first().click()
      await page.locator('.analytics-detail-dialog[open]').waitFor()
      const detailSerialized = Boolean(new URL(page.url()).searchParams.get('detail'))
      const detailUrl = page.url()
      await page.keyboard.press('Escape')
      await page.locator('.analytics-detail-dialog[open]').waitFor({ state: 'detached' })
      await page.goto(detailUrl, { waitUntil: 'domcontentloaded' })
      await page.getByRole('heading', { name: 'Ürün Performansı' }).waitFor({ timeout: 60_000 })
      await page.locator('.analytics-detail-dialog[open]').waitFor()
      detailDeepLink = detailSerialized
    }

    const foreignUrl = new URL(page.url())
    foreignUrl.searchParams.set('detail', '__foreign_detail__')
    await page.goto(foreignUrl.toString(), { waitUntil: 'domcontentloaded' })
    await page.getByRole('heading', { name: 'Ürün Performansı' }).waitFor({ timeout: 60_000 })
    await page.waitForTimeout(1_000)
    const foreignDetailIgnored = await page.locator('.analytics-detail-dialog[open]').count() === 0

    const malformedStatus = await page.evaluate(async ({ id }) => {
      const response = await fetch('/api/analytics/report', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          restaurantId: id,
          report: 'sales',
          query: { range: 'forever', from: null, to: null, filters: { source: 'provider', paymentMethod: 'crypto', status: 'deleted' } },
        }),
      })
      return response.status
    }, { id: restaurant.id })

    const output = {
      presets: { yesterday: true, custom: true },
      combinedAndApplied,
      clearRemovedAllFilters: true,
      transientRetries,
      historyRestoredQueries: true,
      deepLinkRestored,
      table: { sortSerialized, paginationPresent: await page.locator('.analytics-pagination').count() === 1, hasRows, detailDeepLink },
      foreignDetailIgnored,
      malformedQueryStatus: malformedStatus,
      pageErrors,
    }
    writeFileSync(`${evidenceDir}/result.json`, JSON.stringify(output, null, 2))
    process.stdout.write(`${JSON.stringify(output, null, 2)}\n`)

    if (!combinedAndApplied || !deepLinkRestored || !sortSerialized || !hasRows || !detailDeepLink || !foreignDetailIgnored || malformedStatus !== 400 || pageErrors.length > 0) {
      throw new Error('F-08 runtime contract failed')
    }
  } finally {
    await context.close()
    await browser.close()
  }
}

void main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
