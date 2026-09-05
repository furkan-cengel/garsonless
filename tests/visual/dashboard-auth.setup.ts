import { expect, test } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

const dashboardURL = process.env['SMOKE_DASHBOARD_URL'] ?? 'http://localhost:3005'
const email = process.env['DASHBOARD_VISUAL_EMAIL']
const password = process.env['DASHBOARD_VISUAL_PASSWORD']
const magicLinkEmail = process.env['DASHBOARD_VISUAL_MAGICLINK_EMAIL']
const supabaseUrl = process.env['NEXT_PUBLIC_SUPABASE_URL']
const anonKey = process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY']
const serviceRoleKey = process.env['SUPABASE_SERVICE_ROLE_KEY']
const storageStatePath = process.env['DASHBOARD_VISUAL_STORAGE_STATE'] ?? 'test-results/visual-auth/dashboard-storage-state.json'
const metadataPath = process.env['DASHBOARD_VISUAL_METADATA'] ?? 'test-results/visual-auth/dashboard-metadata.json'
const requestedRestaurantId = process.env['DASHBOARD_VISUAL_RESTAURANT_ID']
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

test('create dashboard authenticated storage state', async ({ page }) => {
  const canUsePassword = Boolean(email && password)
  const canUseMagicLink = Boolean(magicLinkEmail && supabaseUrl && serviceRoleKey)
  test.skip(!canUsePassword && !canUseMagicLink, 'Set Dashboard visual password credentials or a service-role magic-link fixture.')

  if (canUsePassword) {
    await page.goto(`${dashboardURL}/auth/login`, { waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('heading', { name: /Tekrar/i }).first()).toBeVisible()

    await page.locator('input[name="email"]').fill(email!)
    await page.locator('input[name="password"]').fill(password!)
    await page.getByRole('button', { name: /^Giriş yap/i }).click()
  } else {
    expect(new URL(supabaseUrl!).hostname, 'Magic-link fixtures are DEV-only.').toBe('yxsegwkzyiscrxiwdeuf.supabase.co')
    expect(['localhost', '127.0.0.1']).toContain(new URL(dashboardURL).hostname)
    const admin = createClient(supabaseUrl!, serviceRoleKey!, { auth: { persistSession: false, autoRefreshToken: false } })
    const generated = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email: magicLinkEmail!,
      options: { redirectTo: `${dashboardURL}/auth/callback` },
    })
    expect(generated.error).toBeNull()
    expect(generated.data.properties?.hashed_token).toBeTruthy()
    expect(anonKey, 'Visual magic-link fixtures require the DEV anon key.').toBeTruthy()
    // Establish the fixture session without navigating through the hosted
    // redirect allowlist or putting access/refresh tokens in browser URLs.
    const client = createClient(supabaseUrl!, anonKey!, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const verified = await client.auth.verifyOtp({
      token_hash: generated.data.properties!.hashed_token,
      type: 'email',
    })
    expect(verified.error).toBeNull()
    expect(verified.data.session).toBeTruthy()
    const projectRef = new URL(supabaseUrl!).hostname.split('.')[0]
    const cookieName = `sb-${projectRef}-auth-token`
    const value = `base64-${Buffer.from(JSON.stringify(verified.data.session)).toString('base64url')}`
    const chunks = value.match(/.{1,3180}/g) ?? [value]
    await page.context().addCookies(chunks.map((chunk, index) => ({
      name: chunks.length === 1 ? cookieName : `${cookieName}.${index}`,
      value: chunk,
      url: dashboardURL,
      sameSite: 'Lax' as const,
    })))
    await page.goto(`${dashboardURL}/dashboard`, { waitUntil: 'domcontentloaded' })
  }

  await page.waitForURL(/\/dashboard(\/|$)/, { timeout: 20_000 })

  if (requestedRestaurantId) {
    expect(requestedRestaurantId).toMatch(uuidPattern)
    await page.goto(`${dashboardURL}/dashboard/${requestedRestaurantId}`, { waitUntil: 'domcontentloaded' })
  }

  if (new URL(page.url()).pathname === '/dashboard') {
    await page.waitForURL(/\/dashboard\/[^/]+/, { timeout: 20_000 })
  }

  const current = new URL(page.url())
  const restaurantId = current.pathname.match(/^\/dashboard\/([^/]+)/)?.[1]
  expect(
    restaurantId,
    `Expected login to land on a restaurant dashboard, got ${current.pathname}`,
  ).toMatch(uuidPattern)

  mkdirSync(dirname(storageStatePath), { recursive: true })
  mkdirSync(dirname(metadataPath), { recursive: true })

  await page.context().storageState({ path: storageStatePath })
  writeFileSync(metadataPath, JSON.stringify({
    restaurantId,
    dashboardURL,
    createdAt: new Date().toISOString(),
    source: 'dashboard-auth.setup.ts',
  }, null, 2))
})
