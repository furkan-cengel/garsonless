import { chromium, type BrowserContext, type Page } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { loadEnvFile } from 'node:process'
import { createClient, createServiceClient } from '../../packages/db/src/client'

const dashboardURL = process.env['ANALYTICS_AUDIT_DASHBOARD_URL'] ?? 'http://127.0.0.1:3011'
const evidenceDir = process.env['ANALYTICS_AUDIT_EVIDENCE_DIR'] ?? '/private/tmp/analytics-responsive-runtime'
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

async function visibleTargetHeights(page: Page, selector: string) {
  return page.locator(selector).evaluateAll((elements) => elements
    .filter((element) => {
      const style = getComputedStyle(element)
      const rect = element.getBoundingClientRect()
      return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0
    })
    .map((element) => Math.round(element.getBoundingClientRect().height)))
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
  page.on('pageerror', (pageError) => pageErrors.push(pageError.message))

  try {
    await authenticate(context, restaurant.owner_id)
    await page.goto(`${dashboardURL}/dashboard/${restaurant.id}/analytics`, { waitUntil: 'domcontentloaded', timeout: 60_000 })
    await page.getByRole('heading', { name: 'Satış Raporu' }).waitFor({ timeout: 60_000 })
    await page.locator('.recharts-responsive-container').first().waitFor({ timeout: 60_000 })

    const results = []
    for (const width of [320, 390, 820, 1440]) {
      await page.setViewportSize({ width, height: width < 760 ? 844 : 1000 })
      await page.waitForTimeout(300)

      const mobile = width <= 760
      const measurements = await page.evaluate(() => {
        const main = document.querySelector('.analytics-main')
        const firstMainHeading = main?.querySelector('h1,h2,h3,h4,h5,h6')
        const mobileNav = document.querySelector('.analytics-mobile-navigation')
        const sidebar = document.querySelector('.analytics-sidebar')
        return {
          documentClientWidth: document.documentElement.clientWidth,
          documentScrollWidth: document.documentElement.scrollWidth,
          mainClientWidth: main?.clientWidth ?? 0,
          mainScrollWidth: main?.scrollWidth ?? 0,
          firstMainHeading: firstMainHeading?.tagName ?? null,
          mainH1Count: main?.querySelectorAll('h1').length ?? 0,
          mobileNavVisible: mobileNav ? getComputedStyle(mobileNav).display !== 'none' : false,
          sidebarVisible: sidebar ? getComputedStyle(sidebar).display !== 'none' : false,
          namedChartCount: document.querySelectorAll('[role="img"][aria-label]').length,
          dataTableToggleCount: Array.from(document.querySelectorAll('summary')).filter((node) => node.textContent?.includes('Veri tablosunu göster')).length,
        }
      })

      const rangeHeights = await visibleTargetHeights(page, '.analytics-range-select')
      const reportTabHeights = await visibleTargetHeights(page, '.analytics-report-tab')
      const actionHeights = await visibleTargetHeights(page, '.analytics-export-button, .page-topbar-notification')

      const gridCell = page.locator('[role="gridcell"][tabindex="0"]')
      await gridCell.focus()
      const before = await page.evaluate(() => document.activeElement?.getAttribute('aria-label'))
      await page.keyboard.press('ArrowRight')
      const after = await page.evaluate(() => document.activeElement?.getAttribute('aria-label'))
      const keyboardAdvanced = before !== after && Boolean(after)

      const result = {
        width,
        ...measurements,
        rangeHeights,
        reportTabHeights,
        actionHeights,
        keyboardAdvanced,
        reports: [] as Array<{ navigation: string; heading: string; clientWidth: number; scrollWidth: number }>,
      }

      const allTargets = [...rangeHeights, ...reportTabHeights, ...actionHeights]
      if (measurements.documentScrollWidth > measurements.documentClientWidth || measurements.mainScrollWidth > measurements.mainClientWidth) {
        throw new Error(`${width}px viewport has horizontal overflow`)
      }
      if (measurements.firstMainHeading !== 'H1' || measurements.mainH1Count !== 1) throw new Error(`${width}px heading order failed`)
      if (measurements.mobileNavVisible !== mobile || measurements.sidebarVisible === mobile) throw new Error(`${width}px navigation mode failed`)
      if (allTargets.some((height) => height < 44)) throw new Error(`${width}px has a touch target below 44px`)
      if (measurements.namedChartCount < 2 || measurements.dataTableToggleCount < 3 || !keyboardAdvanced) throw new Error(`${width}px chart accessibility failed`)

      for (const report of [
        { navigation: 'Satışlar', heading: 'Satış Raporu' },
        { navigation: 'Ürünler', heading: 'Ürün Performansı' },
        { navigation: 'Masalar', heading: 'Masa Performansı' },
        { navigation: 'Ödemeler', heading: 'Ödeme Raporu' },
        { navigation: 'Operasyon', heading: 'Operasyon' },
        { navigation: 'Sadakat', heading: 'Sadakat Raporu' },
      ]) {
        await page.locator('.analytics-report-tab:visible').filter({ hasText: report.navigation }).click()
        await page.getByRole('heading', { name: report.heading, exact: true }).waitFor({ timeout: 60_000 })
        const reportMeasurement = await page.locator('.analytics-main').evaluate((main, currentReport) => ({
          navigation: currentReport.navigation,
          heading: currentReport.heading,
          clientWidth: main.clientWidth,
          scrollWidth: main.scrollWidth,
          firstHeading: main.querySelector('h1,h2,h3,h4,h5,h6')?.tagName ?? null,
          h1Count: main.querySelectorAll('h1').length,
        }), report)
        if (reportMeasurement.scrollWidth > reportMeasurement.clientWidth || reportMeasurement.firstHeading !== 'H1' || reportMeasurement.h1Count !== 1) {
          throw new Error(`${width}px ${report.navigation} report layout failed`)
        }
        result.reports.push({
          navigation: report.navigation,
          heading: report.heading,
          clientWidth: reportMeasurement.clientWidth,
          scrollWidth: reportMeasurement.scrollWidth,
        })
      }

      await page.locator('.analytics-report-tab:visible').filter({ hasText: 'Satışlar' }).click()
      await page.getByRole('heading', { name: 'Satış Raporu', exact: true }).waitFor({ timeout: 60_000 })
      results.push(result)
      await page.screenshot({ path: `${evidenceDir}/analytics-${width}.png`, fullPage: false })
    }

    const output = { results, pageErrors }
    writeFileSync(`${evidenceDir}/result.json`, JSON.stringify(output, null, 2))
    process.stdout.write(`${JSON.stringify(output, null, 2)}\n`)
    if (pageErrors.length > 0) throw new Error('Page errors occurred during responsive verification')
  } finally {
    await context.close()
    await browser.close()
  }
}

void main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
