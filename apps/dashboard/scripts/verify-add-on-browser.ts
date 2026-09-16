import { mkdirSync, writeFileSync } from 'node:fs'
import { chromium, expect } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import { CANONICAL_THEME_ID } from '@garsonless/design-engine'
const base = 'http://localhost:3000',
  supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
if (new URL(supabaseUrl).hostname !== 'yxsegwkzyiscrxiwdeuf.supabase.co')
  throw new Error('Dev only')
const admin = createClient(
  supabaseUrl,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } },
)
const { data: restaurant, error } = await admin
  .from('restaurants')
  .select('id,owner_id,plan')
  .eq('slug', 'test-cafe-b')
  .single()
if (error || !restaurant) throw new Error('Test cafe missing')
const { data: owner } = await admin.auth.admin.getUserById(restaurant.owner_id)
const { data: link, error: linkError } = await admin.auth.admin.generateLink({
  type: 'magiclink',
  email: owner.user!.email!,
})
if (linkError) throw new Error('Test auth unavailable')
const { data: auth, error: authError } = await admin.auth.verifyOtp({
  token_hash: link.properties.hashed_token,
  type: 'email',
})
if (authError || !auth.session) throw new Error('Test auth failed')
const browser = await chromium.launch({ headless: true })
try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  })
  await context.addCookies([
    {
      name: 'sb-yxsegwkzyiscrxiwdeuf-auth-token',
      value: `base64-${Buffer.from(JSON.stringify(auth.session)).toString('base64url')}`,
      url: base,
      sameSite: 'Lax',
    },
  ])
  const page = await context.newPage(),
    errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  const out = '/private/tmp/masabu-add-ons-browser'
  mkdirSync(out, { recursive: true })
  await page.goto(
    `${base}/dashboard/${restaurant.id}/settings?section=billing`,
    { waitUntil: 'domcontentloaded', timeout: 60000 },
  )
  await page
    .locator('#addons')
    .getByText('₺390,00 + KDV', { exact: true })
    .waitFor({ timeout: 60000 })
  await page.screenshot({ path: `${out}/billing-desktop.png`, fullPage: true })
  const billing = await page.locator('#addons').innerText()
  await page.setViewportSize({ width: 390, height: 844 })
  await page.screenshot({ path: `${out}/billing-mobile.png`, fullPage: true })
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto(
    `${base}/dashboard/${restaurant.id}/theme/${CANONICAL_THEME_ID}/edit?addon=storefront_video_hero`,
    { waitUntil: 'domcontentloaded', timeout: 60000 },
  )
  await page.getByRole('dialog').waitFor({ timeout: 30000 })
  await page.screenshot({ path: `${out}/picker-desktop.png` })
  const picker = await page.getByRole('dialog').innerText()
  await page.setViewportSize({ width: 390, height: 844 })
  await expect
    .poll(async () =>
      Math.round((await page.getByRole('dialog').boundingBox())!.width),
    )
    .toBe(374)
  await page.evaluate(
    () =>
      new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      ),
  )
  console.log(
    await page
      .getByRole('dialog')
      .evaluate((el) => ({
        rect: el.getBoundingClientRect().toJSON(),
        width: getComputedStyle(el).width,
        minWidth: getComputedStyle(el).minWidth,
        maxWidth: getComputedStyle(el).maxWidth,
        left: getComputedStyle(el).left,
        transform: getComputedStyle(el).transform,
        translate: getComputedStyle(el).translate,
      })),
  )
  await page.screenshot({ path: `${out}/picker-mobile.png` })
  writeFileSync(
    `${out}/results.json`,
    JSON.stringify({ billing, picker, errors }, null, 2),
  )
  console.log(JSON.stringify({ billing, picker, errors }, null, 2))
} finally {
  await browser.close()
}
