import { expect, test } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

const dashboardURL = process.env['SMOKE_DASHBOARD_URL'] ?? 'http://localhost:3005'
const email = process.env['DASHBOARD_VISUAL_EMAIL']
const password = process.env['DASHBOARD_VISUAL_PASSWORD']
const magicLinkEmail = process.env['DASHBOARD_VISUAL_MAGICLINK_EMAIL']
const supabaseUrl = process.env['NEXT_PUBLIC_SUPABASE_URL']
const serviceRoleKey = process.env['SUPABASE_SERVICE_ROLE_KEY']
const storageStatePath = process.env['DASHBOARD_VISUAL_STORAGE_STATE'] ?? 'test-results/visual-auth/dashboard-storage-state.json'
const metadataPath = process.env['DASHBOARD_VISUAL_METADATA'] ?? 'test-results/visual-auth/dashboard-metadata.json'
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
    const admin = createClient(supabaseUrl!, serviceRoleKey!, { auth: { persistSession: false, autoRefreshToken: false } })
    const generated = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email: magicLinkEmail!,
      options: { redirectTo: `${dashboardURL}/auth/callback` },
    })
    expect(generated.error).toBeNull()
    expect(generated.data.properties?.action_link).toBeTruthy()
    await page.goto(generated.data.properties!.action_link, { waitUntil: 'domcontentloaded' })
  }

  await page.waitForURL(/\/dashboard(\/|$)/, { timeout: 20_000 })

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
