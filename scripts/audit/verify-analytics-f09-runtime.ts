import { chromium, type BrowserContext } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { loadEnvFile } from 'node:process'
import { createClient, createServiceClient } from '../../packages/db/src/client'

const dashboardURL = process.env['ANALYTICS_AUDIT_DASHBOARD_URL'] ?? 'http://127.0.0.1:3011'
const evidenceDir = process.env['ANALYTICS_AUDIT_EVIDENCE_DIR'] ?? '/private/tmp/analytics-f09-runtime'
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

async function main() {
  const service = createServiceClient()
  const { data: restaurant, error } = await service
    .from('restaurants')
    .select('id, owner_id')
    .eq('name', process.env['ANALYTICS_AUDIT_RESTAURANT_NAME'] ?? 'MAF Cafe Lounge')
    .is('deleted_at', null)
    .single()
  if (error || !restaurant) throw error ?? new Error('Restaurant unavailable')

  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
  const page = await context.newPage()
  const pageErrors: string[] = []
  page.on('pageerror', (pageError) => pageErrors.push(pageError.message))

  try {
    await authenticate(context, restaurant.owner_id)
    await page.goto(`${dashboardURL}/dashboard/${restaurant.id}/analytics`, {
      waitUntil: 'domcontentloaded', timeout: 60_000,
    })
    await page.getByRole('heading', { name: 'Satış Raporu' }).waitFor({ timeout: 60_000 })

    const read = async (report: 'sales' | 'items' | 'operasyon') => {
      const started = performance.now()
      const response = await context.request.post(`${dashboardURL}/api/analytics/report`, {
        timeout: 120_000,
        headers: { 'Content-Type': 'application/json', Origin: dashboardURL },
        data: {
          restaurantId: restaurant.id,
          report,
          query: {
            range: 'year', from: null, to: null,
            filters: { source: 'all', paymentMethod: 'all', status: 'all' },
          },
        },
      })
      const body = await response.body()
      const payload = JSON.parse(body.toString('utf8')) as Record<string, unknown>
      const payment = payload['paymentBreakdown'] as Record<string, unknown> | undefined
      const financials = payment?.['financials'] as Record<string, unknown> | undefined
      const coverage = payment?.['coverage'] as Record<string, unknown> | undefined
      const cancellations = payload['cancellations'] as Record<string, unknown> | undefined
      return {
        status: response.status(),
        elapsedMs: Math.round(performance.now() - started),
        bytes: body.byteLength,
        hasError: typeof payload['error'] === 'string',
        salesBuckets: Array.isArray(payload['salesOverTime']) ? payload['salesOverTime'].length : null,
        heatmapCells: Array.isArray(payload['heatmapData']) ? payload['heatmapData'].length : null,
        productRows: Array.isArray(payload['productReport']) ? payload['productReport'].length : null,
        financialContractComplete: payment ? [
          'grossSales', 'discountTotal', 'netSales', 'vatTotal', 'netOfVatTotal',
          'unknownVatGross', 'unattributedAmount',
        ].every((key) => typeof financials?.[key] === 'number') : null,
        refundLedgerCovered: payment ? coverage?.['monetaryRefunds'] === true : null,
        cancellationContractComplete: cancellations ? [
          'count', 'lostAmount', 'collectedCancelledCount', 'collectedCancelledAmount',
          'compCancelledCount', 'compCancelledAmount', 'allOrders', 'rate',
        ].every((key) => typeof cancellations[key] === 'number') : null,
      }
    }
    const measurements = {
      sales: await read('sales'),
      items: await read('items'),
      operation: await read('operasyon'),
    }

    const output = { measurements, pageErrors }
    mkdirSync(evidenceDir, { recursive: true })
    writeFileSync(`${evidenceDir}/result.json`, JSON.stringify(output, null, 2))
    process.stdout.write(`${JSON.stringify(output, null, 2)}\n`)

    if (
      measurements.sales.status !== 200
      || measurements.items.status !== 200
      || measurements.operation.status !== 200
      || measurements.sales.hasError
      || measurements.items.hasError
      || measurements.operation.hasError
      || measurements.sales.bytes > 1_500_000
      || measurements.items.bytes > 1_500_000
      || measurements.operation.bytes > 1_500_000
      || measurements.sales.heatmapCells !== 105
      || measurements.sales.financialContractComplete !== true
      || measurements.sales.refundLedgerCovered !== true
      || measurements.operation.cancellationContractComplete !== true
      || pageErrors.length > 0
    ) throw new Error('Analytics F-09 runtime contract failed')
  } finally {
    await context.close()
    await browser.close()
  }
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.name : 'RuntimeError')
  process.exitCode = 1
})
