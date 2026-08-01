import { chromium, type BrowserContext } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { loadEnvFile } from 'node:process'
import { randomUUID } from 'node:crypto'
import { createClient, createServiceClient } from '../../packages/db/src/client'

const dashboardURL = process.env['ANALYTICS_AUDIT_DASHBOARD_URL'] ?? 'http://127.0.0.1:3011'
const evidenceDir = process.env['ANALYTICS_AUDIT_EVIDENCE_DIR'] ?? '/private/tmp/analytics-member-security-runtime'
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
async function authenticate(context: BrowserContext, email: string) {
  const service = createServiceClient()
  const { data: link, error: linkError } = await service.auth.admin.generateLink({ type: 'magiclink', email })
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
  const email = `analytics-audit-${randomUUID()}@example.invalid`
  let userId: string | null = null
  let membershipId: string | null = null
  let browser: Awaited<ReturnType<typeof chromium.launch>> | null = null

  try {
    const { data: restaurant, error: restaurantError } = await service
      .from('restaurants')
      .select('id, owner_id')
      .eq('name', process.env['ANALYTICS_AUDIT_RESTAURANT_NAME'] ?? 'MAF Cafe Lounge')
      .is('deleted_at', null)
      .single()
    if (restaurantError || !restaurant) throw restaurantError ?? new Error('Restaurant unavailable')

    const { data: created, error: createError } = await service.auth.admin.createUser({
      email,
      email_confirm: true,
    })
    if (createError || !created.user) throw createError ?? new Error('Fixture user unavailable')
    userId = created.user.id

    const { data: membership, error: membershipError } = await service.from('restaurant_members').insert({
      restaurant_id: restaurant.id,
      user_id: userId,
      email,
      permissions: ['analytics'],
      status: 'active',
      invited_by: restaurant.owner_id,
      accepted_at: new Date().toISOString(),
    }).select('id').single()
    if (membershipError || !membership) throw membershipError ?? new Error('Fixture membership unavailable')
    membershipId = membership.id

    browser = await chromium.launch({ headless: true })
    const memberContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
    await authenticate(memberContext, email)
    const page = await memberContext.newPage()
    const pageErrors: string[] = []
    page.on('pageerror', (error) => pageErrors.push(error.message))

    const authorizedResponse = await page.goto(
      `${dashboardURL}/dashboard/${restaurant.id}/analytics`,
      { waitUntil: 'domcontentloaded', timeout: 60_000 },
    )
    await page.getByRole('heading', { name: 'Satış Raporu' }).waitFor({ timeout: 60_000 })
    const visibleTabs = await page.locator('.analytics-report-tab:visible').allTextContents()
    const memberBusinessTabsVisible = ['Satışlar', 'Ürünler', 'Masalar', 'Ödemeler']
      .every((label) => visibleTabs.some((value) => value.includes(label)))
    const operationHidden = visibleTabs.every((value) => !value.includes('Operasyon'))

    const replay = await page.evaluate(async ({ restaurantId }) => {
      const response = await fetch('/api/analytics/report', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          restaurantId,
          report: 'operasyon',
          query: {
            range: 'week', from: null, to: null,
            filters: { source: 'all', paymentMethod: 'all', status: 'all' },
          },
        }),
      })
      const payload = await response.json()
      return {
        status: response.status,
        cancellationCount: payload.cancellations?.count ?? null,
        abnormalRows: payload.abnormalCloses?.rows?.length ?? null,
        staffRows: payload.staffSettlement?.rows?.length ?? null,
        hasError: typeof payload.error === 'string',
      }
    }, { restaurantId: restaurant.id })
    const operationReplaySafe = replay.hasError || (
      replay.status === 200
      && replay.cancellationCount === 0
      && replay.abnormalRows === 0
      && replay.staffRows === 0
    )

    const foreignResponse = await page.goto(
      `${dashboardURL}/dashboard/${randomUUID()}/analytics`,
      { waitUntil: 'domcontentloaded', timeout: 60_000 },
    )
    const foreignTenantDenied = foreignResponse?.status() === 404

    const { error: revokeError } = await service.from('restaurant_members')
      .update({ permissions: [] })
      .eq('id', membershipId)
    if (revokeError) throw revokeError
    const noPermissionReplay = await page.evaluate(async ({ restaurantId }) => {
      const response = await fetch('/api/analytics/report', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          restaurantId,
          report: 'sales',
          query: {
            range: 'week', from: null, to: null,
            filters: { source: 'all', paymentMethod: 'all', status: 'all' },
          },
        }),
      })
      const payload = await response.json()
      return response.status === 200 && payload.error === 'Not authorized'
    }, { restaurantId: restaurant.id })

    const anonymousContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
    const anonymousPage = await anonymousContext.newPage()
    await anonymousPage.goto(`${dashboardURL}/dashboard/${restaurant.id}/analytics`, {
      waitUntil: 'domcontentloaded', timeout: 60_000,
    })
    const anonymousRedirected = new URL(anonymousPage.url()).pathname === '/auth/login'
    await anonymousContext.close()
    await memberContext.close()

    const output = {
      memberRouteStatus: authorizedResponse?.status() ?? null,
      memberBusinessTabsVisible,
      operationHidden,
      operationReplaySafe,
      foreignTenantDenied,
      noPermissionReplayDenied: noPermissionReplay,
      anonymousRedirected,
      pageErrors,
    }
    mkdirSync(evidenceDir, { recursive: true })
    writeFileSync(`${evidenceDir}/result.json`, JSON.stringify(output, null, 2))
    process.stdout.write(`${JSON.stringify(output, null, 2)}\n`)

    if (
      output.memberRouteStatus !== 200
      || !memberBusinessTabsVisible
      || !operationHidden
      || !operationReplaySafe
      || !foreignTenantDenied
      || !noPermissionReplay
      || !anonymousRedirected
      || pageErrors.length > 0
    ) throw new Error('Analytics member security runtime contract failed')
  } finally {
    if (browser) await browser.close()
    if (membershipId) await service.from('restaurant_members').delete().eq('id', membershipId)
    if (userId) await service.auth.admin.deleteUser(userId)
  }
}

void main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
