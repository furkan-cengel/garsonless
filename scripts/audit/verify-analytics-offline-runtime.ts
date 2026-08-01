import { chromium, type BrowserContext } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { loadEnvFile } from 'node:process'
import { createClient, createServiceClient } from '../../packages/db/src/client'

const dashboardURL = process.env['ANALYTICS_AUDIT_DASHBOARD_URL'] ?? 'http://127.0.0.1:3011'
const evidenceDir = process.env['ANALYTICS_AUDIT_EVIDENCE_DIR'] ?? '/private/tmp/analytics-offline-runtime'
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
    .eq('name', process.env['ANALYTICS_AUDIT_RESTAURANT_NAME'] ?? 'MAF Cafe Lounge')
    .is('deleted_at', null)
    .single()
  if (error || !restaurant) throw error ?? new Error('Restaurant unavailable')

  mkdirSync(evidenceDir, { recursive: true })
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
  const page = await context.newPage()
  const pageErrors: string[] = []
  const consoleErrors: string[] = []
  page.on('pageerror', (pageError) => pageErrors.push(pageError.message))
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text())
  })

  try {
    await authenticate(context, restaurant.owner_id)
    await page.goto(`${dashboardURL}/dashboard/${restaurant.id}/analytics`, {
      waitUntil: 'domcontentloaded',
      timeout: 60_000,
    })
    await page.getByRole('heading', { name: 'Satış Raporu' }).waitFor({ timeout: 60_000 })

    const rangeSelect = page.getByRole('combobox', { name: 'Rapor dönemi' })
    const summary = page.getByText('Son 7 gün · önceki haftaya göre', { exact: true })
    await summary.waitFor()

    await context.setOffline(true)
    await page.waitForTimeout(3_000)
    if (!await page.getByRole('heading', { name: 'Satış Raporu' }).isVisible()) {
      throw new Error('Late chart chunk failure took down the report while offline')
    }
    await rangeSelect.selectOption('month')
    const alert = page.locator('[role="alert"]:not(#__next-route-announcer__)')
    await page.waitForTimeout(3_000)
    await alert.getByText(/Çevrimdışısınız/).waitFor({ timeout: 30_000 })
    await page.screenshot({ path: `${evidenceDir}/offline-inline-error.png`, fullPage: false })

    const offlineState = {
      routeAlive: await page.getByRole('heading', { name: 'Satış Raporu' }).isVisible(),
      selectedRange: await rangeSelect.inputValue(),
      oldSummaryVisible: await summary.isVisible(),
      alert: await alert.textContent(),
    }

    await context.setOffline(false)
    await page.waitForFunction(() => (document.querySelector('[aria-label="Rapor dönemi"]') as HTMLSelectElement | null)?.value === 'month', undefined, { timeout: 30_000 })
    await page.getByText('Son 30 gün · önceki 30 güne göre', { exact: true }).waitFor({ timeout: 30_000 })
    await alert.waitFor({ state: 'detached', timeout: 30_000 })

    const result = {
      offlineState,
      reconnectState: {
        selectedRange: await rangeSelect.inputValue(),
        alertCount: await page.locator('[role="alert"]:not(#__next-route-announcer__)').count(),
      },
      pageErrors,
      unexpectedPageErrors: pageErrors.filter((message) => message !== 'Failed to fetch'),
      unexpectedConsoleErrors: consoleErrors.filter((message) => !message.includes('ERR_INTERNET_DISCONNECTED')),
    }
    writeFileSync(`${evidenceDir}/result.json`, JSON.stringify(result, null, 2))
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)

    if (!offlineState.routeAlive || offlineState.selectedRange !== 'week') {
      throw new Error('Offline state did not preserve the last coherent report')
    }
    if (result.reconnectState.selectedRange !== 'month' || result.reconnectState.alertCount !== 0 || result.unexpectedPageErrors.length > 0 || result.unexpectedConsoleErrors.length > 0) {
      throw new Error('Reconnect did not recover cleanly')
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
