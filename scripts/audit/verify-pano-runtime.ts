import { chromium, type BrowserContext } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { loadEnvFile } from 'node:process'
import { createClient, createServiceClient } from '../../packages/db/src/client'

const dashboardURL = process.env['PANO_AUDIT_DASHBOARD_URL'] ?? 'http://127.0.0.1:3000'
const evidenceDir = process.env['PANO_AUDIT_EVIDENCE_DIR'] ?? '/private/tmp/pano-runtime-browser'
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
  const { data: link, error: linkError } = await service.auth.admin.generateLink({
    type: 'magiclink',
    email: owner.user.email,
  })
  if (linkError) throw linkError
  const { data: verified, error: verifyError } = await createClient().auth.verifyOtp({
    token_hash: link.properties.hashed_token,
    type: 'email',
  })
  if (verifyError || !verified.session) throw verifyError ?? new Error('Session unavailable')
  await context.addCookies(dashboardSessionCookies(verified.session))
}

async function main() {
  const service = createServiceClient()
  const { data: restaurant, error } = await service
    .from('restaurants')
    .select('id, owner_id')
    .eq('name', process.env['PANO_AUDIT_RESTAURANT_NAME'] ?? 'MAF Cafe Lounge')
    .is('deleted_at', null)
    .single()
  if (error || !restaurant) throw error ?? new Error('Restaurant unavailable')
  const [{ data: ownTable }, { data: foreignTable }] = await Promise.all([
    service.from('tables').select('id').eq('restaurant_id', restaurant.id).is('deleted_at', null).limit(1).maybeSingle(),
    service.from('tables').select('id').neq('restaurant_id', restaurant.id).is('deleted_at', null).limit(1).maybeSingle(),
  ])

  mkdirSync(evidenceDir, { recursive: true })
  const browser = await chromium.launch({ headless: true })
  const errors = { console: [] as string[], page: [] as string[], http: [] as string[] }
  const results: Array<Record<string, unknown>> = []

  try {
    for (const viewport of [
      { name: 'desktop', width: 1440, height: 1000 },
      { name: 'tablet', width: 820, height: 1000 },
      { name: 'mobile', width: 390, height: 844 },
    ]) {
      const context = await browser.newContext({ viewport })
      await authenticate(context, restaurant.owner_id)
      const page = await context.newPage()
      page.on('console', (message) => {
        if (message.type() === 'error') errors.console.push(`${viewport.name}:${message.text()}`)
      })
      page.on('pageerror', (pageError) => errors.page.push(`${viewport.name}:${pageError.message}`))
      page.on('response', (response) => {
        if (response.status() >= 400) {
          errors.http.push(`${viewport.name}:${response.status()}:${new URL(response.url()).pathname}`)
        }
      })

      const response = await page.goto(`${dashboardURL}/dashboard/${restaurant.id}`, { waitUntil: 'domcontentloaded', timeout: 60_000 })
      await page.getByRole('heading', { level: 1 }).waitFor({ state: 'visible' })
      await page.getByText(/Bağlı · son başarılı|Çevrimdışı · son başarılı/).first().waitFor({ state: 'visible', timeout: 10_000 }).catch(() => undefined)
      await page.screenshot({ path: `${evidenceDir}/${viewport.name}.png`, fullPage: false })
      const accessibilityLayout = await page.evaluate(() => {
        const candidates = Array.from(document.querySelectorAll(
          '.pano-shell button, .pano-shell a, .pano-shell summary, .page-topbar--pano button, .rail-link, .rail-btn, .rail-profile',
        ))
        const undersizedTargets: Array<{ name: string; width: number; height: number }> = []
        for (const element of candidates) {
          const style = getComputedStyle(element)
          const rect = element.getBoundingClientRect()
          if (style.display === 'none' || style.visibility === 'hidden' || rect.width <= 0 || rect.height <= 0) continue
          if (rect.width >= 44 && rect.height >= 44) continue
          undersizedTargets.push({
            name: element.getAttribute('aria-label') ?? element.textContent?.trim().slice(0, 50) ?? element.tagName,
            width: Math.round(rect.width),
            height: Math.round(rect.height),
          })
        }
        const topbarParts: DOMRect[] = []
        for (const selector of ['.page-topbar-context', '.page-topbar-tag', '.page-topbar-right']) {
          const rect = document.querySelector(selector)?.getBoundingClientRect()
          if (rect) topbarParts.push(rect)
        }
        let topbarOverlap = false
        for (let index = 0; index < topbarParts.length; index += 1) {
          const left = topbarParts[index]!
          for (let otherIndex = index + 1; otherIndex < topbarParts.length; otherIndex += 1) {
            const right = topbarParts[otherIndex]!
            if (left.left < right.right && left.right > right.left && left.top < right.bottom && left.bottom > right.top) topbarOverlap = true
          }
        }
        const attention = document.querySelector('#pano-attention')?.getBoundingClientRect()
        const firstKpi = document.querySelector('.pano-kpis > *')?.getBoundingClientRect()
        return {
          undersizedTargets,
          topbarOverlap,
          attentionInFirstViewport: Boolean(attention && attention.top < innerHeight),
          firstKpiInFirstViewport: Boolean(firstKpi && firstKpi.top < innerHeight),
          chartTabStops: document.querySelectorAll('.pano-chart-keyboard[tabindex="0"]').length,
          chartBarTabStops: document.querySelectorAll('.pano-chart-keyboard rect[tabindex="0"]').length,
        }
      })
      results.push({
        viewport: viewport.name,
        status: response?.status() ?? null,
        horizontalOverflow: await page.evaluate(() => (
          document.documentElement.scrollWidth > document.documentElement.clientWidth
        )),
        ...accessibilityLayout,
      })

      let chart = page.locator('.pano-chart-keyboard')
      if (await chart.count() === 0) {
        const monthRange = page.getByRole('button', { name: '30 gün' })
        if (await monthRange.count() > 0) {
          await monthRange.click()
          chart = page.locator('.pano-chart-keyboard')
          await chart.waitFor({ state: 'visible', timeout: 15_000 }).catch(() => undefined)
        }
      }
      if (await chart.count() > 0) {
        await chart.scrollIntoViewIfNeeded()
        await chart.focus()
        const activeBefore = await page.locator('#pano-chart-active-point').textContent()
        await chart.press('ArrowRight')
        const activeAfter = await page.locator('#pano-chart-active-point').textContent()
        const tableToggle = page.getByRole('button', { name: 'Veriyi tablo olarak göster' })
        if (await tableToggle.count() > 0) await tableToggle.click()
        Object.assign(results[results.length - 1]!, {
          chartTabStops: await page.locator('.pano-chart-keyboard[tabindex="0"]').count(),
          chartBarTabStops: await page.locator('.pano-chart-keyboard rect[tabindex="0"]').count(),
          chartArrowNavigation: activeBefore !== activeAfter,
          chartDataTableVisible: await page.locator('#pano-sales-data-table table').count() > 0,
        })
      }
      await page.emulateMedia({ reducedMotion: 'reduce' })
      Object.assign(results[results.length - 1]!, {
        reducedMotionHonored: await page.evaluate(() => {
          const animated = document.querySelector('.page-topbar--pano [style*="pulse-dot"]')
          return !animated || getComputedStyle(animated).animationName === 'none'
        }),
      })

      if (viewport.name === 'desktop' && ownTable) {
        await page.evaluate(() => window.dispatchEvent(new Event('offline')))
        await page.getByText(/Çevrimdışı · son başarılı/).first().waitFor({ state: 'visible' })
        const offlineStateVisible = await page.getByText('Pano çevrimdışı', { exact: true }).count() > 0
        await page.evaluate(() => window.dispatchEvent(new Event('online')))
        await page.getByText(/Bağlı · son başarılı/).first().waitFor({ state: 'visible', timeout: 15_000 })
        Object.assign(results[results.length - 1]!, {
          liveConnectionVisible: true,
          retryActionVisible: await page.getByRole('button', { name: 'Pano canlı verilerini yeniden dene' }).count() > 0,
          offlineStateVisible,
          reconnectRecovered: true,
          deferredAnalyticsVisible: await page.getByText('Tahsilat akışı', { exact: true }).count() > 0,
        })
        const attentionLink = page.locator('.pano-table-attention-row').first()
        const panoLinkExercised = await attentionLink.count() > 0
        if (panoLinkExercised) {
          await Promise.all([
            page.waitForURL((url) => url.pathname.endsWith('/tables') && Boolean(url.searchParams.get('tableId'))),
            attentionLink.click(),
          ])
        } else {
          await page.goto(`${dashboardURL}/dashboard/${restaurant.id}/tables?tableId=${ownTable.id}`, { waitUntil: 'domcontentloaded', timeout: 60_000 })
        }
        await page.locator('#table-detail-title').waitFor({ state: 'visible' })
        await page.screenshot({ path: `${evidenceDir}/deep-link-desktop.png`, fullPage: false })
        const validDeepLink = {
          panoLinkExercised,
          hasTableQuery: Boolean(new URL(page.url()).searchParams.get('tableId')),
          detailVisible: await page.locator('#table-detail-title').count() > 0,
          detailFocused: await page.evaluate(() => Boolean(document.activeElement?.closest('.tb-table-detail-surface'))),
        }
        const rejectedDeepLinks: boolean[] = []
        for (const candidate of ['not-a-table-id', foreignTable?.id].filter((value): value is string => Boolean(value))) {
          await page.goto(`${dashboardURL}/dashboard/${restaurant.id}/tables?tableId=${encodeURIComponent(candidate)}`, { waitUntil: 'domcontentloaded', timeout: 60_000 })
          rejectedDeepLinks.push(await page.locator('#table-detail-title').count() === 0)
        }
        Object.assign(results[results.length - 1]!, {
          validDeepLink,
          invalidDeepLinksRejected: rejectedDeepLinks.every(Boolean),
        })
      }
      if (viewport.name === 'mobile') {
        const sharedShellRegressions: Array<Record<string, unknown>> = []
        for (const segment of ['analytics', 'customers', 'menu', 'orders', 'settings']) {
          const routeResponse = await page.goto(`${dashboardURL}/dashboard/${restaurant.id}/${segment}`, { waitUntil: 'domcontentloaded', timeout: 60_000 })
          await page.locator('.page-topbar:visible').first().waitFor({ state: 'visible', timeout: 15_000 })
          sharedShellRegressions.push({
            segment,
            status: routeResponse?.status() ?? null,
            horizontalOverflow: await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth),
            undersizedRailTargets: await page.evaluate(() => {
              let count = 0
              for (const element of document.querySelectorAll('.rail-link, .rail-btn, .rail-profile')) {
                const rect = element.getBoundingClientRect()
                if (rect.width < 44 || rect.height < 44) count += 1
              }
              return count
            }),
          })
        }
        Object.assign(results[results.length - 1]!, { sharedShellRegressions })
      }
      await context.close()
    }
  } finally {
    await browser.close()
  }

  console.log(JSON.stringify({ results, errors }, null, 2))
  if (errors.console.length || errors.page.length || errors.http.length) process.exitCode = 1
}

void main()
