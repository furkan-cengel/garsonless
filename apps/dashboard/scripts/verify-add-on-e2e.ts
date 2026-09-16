import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { chromium, expect } from '@playwright/test'
import { CANONICAL_THEME_ID } from '@garsonless/design-engine'
import type { AccountingInvoiceJob } from '@garsonless/db/server'
import {
  createNilveraInvoiceProvider,
  readNilveraConfig,
} from '../lib/accounting/nilvera-invoice-provider'

assert.equal(
  new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname,
  'yxsegwkzyiscrxiwdeuf.supabase.co',
)
assert.equal(
  process.env.IYZICO_BILLING_BASE_URL,
  'https://sandbox-api.iyzipay.com',
)
const invoiceConfig = readNilveraConfig()
assert.equal(new URL(invoiceConfig.apiBaseUrl).hostname, 'apitest.nilvera.com')
const out = '/private/tmp/masabu-addon-e2e'
mkdirSync(out, { recursive: true })
const statePath = `${out}/fixture.json`
const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } },
)
let fixture: { restaurantId: string; ownerId: string; email: string }
if (existsSync(statePath)) fixture = JSON.parse(readFileSync(statePath, 'utf8'))
else {
  const id = randomUUID(),
    email = `addon-e2e-${id}@example.invalid`
  const owner = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    password: randomUUID() + randomUUID(),
  })
  assert.ifError(owner.error)
  assert(owner.data.user)
  fixture = { restaurantId: id, ownerId: owner.data.user.id, email }
  writeFileSync(statePath, JSON.stringify(fixture), { mode: 0o600 })
  const restaurant = await admin
    .from('restaurants')
    .insert({
      id,
      owner_id: fixture.ownerId,
      name: 'Sandbox — one-time add-on E2E',
      slug: `addon-e2e-${id}`,
      plan: 'starter',
    })
  assert.ifError(restaurant.error)
  const address = {
    contactName: 'Test Kurum',
    address: 'Test Caddesi No: 2',
    city: 'Istanbul',
    district: 'Maltepe',
    country: 'Turkey',
    taxOffice: 'Nilvera Test',
    postalCode: '34840',
  }
  const customer = await admin
    .from('billing_customers')
    .upsert(
      {
        restaurant_id: id,
        legal_name: 'Test Kurum 2',
        contact_email: email,
        contact_name: 'Test',
        contact_surname: 'Kurum',
        identity_number: '1234567802',
        gsm_number: '+905350000000',
        billing_address: address,
        shipping_address: address,
      },
      { onConflict: 'restaurant_id' },
    )
    .select('id')
    .single()
  assert.ifError(customer.error)
  assert(customer.data)
  const start = new Date(Date.now() - 10 * 86400000).toISOString(),
    end = new Date(Date.now() + 20 * 86400000).toISOString()
  const subscription = await admin
    .from('billing_subscriptions')
    .select('id')
    .eq('restaurant_id', id)
    .maybeSingle()
  assert.ifError(subscription.error)
  const record = {
    restaurant_id: id,
    billing_customer_id: customer.data.id,
    plan: 'starter',
    status: 'active',
    billing_interval: 'monthly',
    current_period_start: start,
    current_period_end: end,
  }
  const setup = subscription.data
    ? await admin
        .from('billing_subscriptions')
        .update(record)
        .eq('id', subscription.data.id)
    : await admin.from('billing_subscriptions').insert(record)
  assert.ifError(setup.error)
}
const billingAddress = {
  contactName: 'Test Kurum',
  address: 'Test Caddesi No: 2',
  city: 'Istanbul',
  district: 'Maltepe',
  country: 'Turkey',
  taxOffice: 'Nilvera Test',
  zipCode: '34840',
}
const savedProfile = await admin.rpc('upsert_subscription_billing_profile', {
  p_restaurant_id: fixture.restaurantId,
  p_legal_name: 'Test Kurum 2',
  p_contact_name: 'Test',
  p_contact_surname: 'Kurum',
  p_identity_number: '1234567802',
  p_contact_email: 'sandbox-addon@example.com',
  p_gsm_number: '+905350000000',
  p_billing_address: billingAddress,
  p_shipping_address: billingAddress,
})
assert.ifError(savedProfile.error)
const { data: link, error: linkError } = await admin.auth.admin.generateLink({
  type: 'magiclink',
  email: fixture.email,
})
assert.ifError(linkError)
assert(link)
const loginClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } },
)
const { data: auth, error: authError } = await loginClient.auth.verifyOtp({
  token_hash: link.properties.hashed_token,
  type: 'email',
})
assert.ifError(authError)
assert(auth.session)
const before = await admin
  .from('billing_subscriptions')
  .select('*')
  .eq('restaurant_id', fixture.restaurantId)
  .single()
assert.ifError(before.error)
const browser = await chromium.launch({ headless: true })
try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  })
  await context.addCookies([
    {
      name: 'sb-yxsegwkzyiscrxiwdeuf-auth-token',
      value: `base64-${Buffer.from(JSON.stringify(auth.session)).toString('base64url')}`,
      url: 'http://localhost:3000',
      sameSite: 'Lax',
    },
  ])
  const page = await context.newPage()
  const base = `http://localhost:3000/dashboard/${fixture.restaurantId}`
  const owned = await admin
    .from('restaurant_add_on_ownership')
    .select('add_on')
    .eq('restaurant_id', fixture.restaurantId)
    .is('revoked_at', null)
  assert.ifError(owned.error)
  if (!owned.data?.length) {
    await page.goto(
      `${base}/theme/${CANONICAL_THEME_ID}/edit?addon=storefront_video_hero`,
      { waitUntil: 'domcontentloaded', timeout: 60000 },
    )
    await page
      .getByRole('dialog')
      .getByRole('button', { name: 'Satın al', exact: true })
      .click({ timeout: 60000 })
    await page
      .getByRole('dialog')
      .getByRole('checkbox')
      .check({ timeout: 60000 })
    await page
      .getByRole('button', { name: 'Güvenli ödemeye geç', exact: true })
      .click()
    await page
      .waitForURL((url) => url.hostname === 'sandbox-cpp.iyzipay.com', {
        timeout: 30000,
        waitUntil: 'domcontentloaded',
      })
      .catch(async (error) => {
        await page.screenshot({ path: `${out}/failed.png` })
        console.log((await page.locator('body').innerText()).slice(-6000))
        throw error
      })
    await page.locator('#ccname').fill('Test Kurum')
    await page.locator('#ccnumber').fill('5528790000000008')
    await page.locator('#ccexp').fill('12/30')
    await page.locator('#cccvc').fill('123')
    await page.getByRole('button', { name: /468,00 TL ÖDE/ }).click()
    await page.waitForURL(
      (url) => url.hostname === 'localhost' && url.pathname.includes('/theme/'),
      { timeout: 90000 },
    )
  }
  await page.goto(
    `${base}/theme/${CANONICAL_THEME_ID}/edit?addon=storefront_video_hero`,
    { waitUntil: 'domcontentloaded', timeout: 60000 },
  )
  await expect(
    page
      .getByRole('dialog')
      .getByRole('button', { name: 'Bölümü ekle', exact: true }),
  ).toBeEnabled({ timeout: 60000 })
  await expect(
    page.getByRole('dialog').getByText('Satın alındı', { exact: true }).first(),
  ).toBeVisible()
  await page.screenshot({ path: `${out}/unlocked.png` })
  const after = await admin
    .from('billing_subscriptions')
    .select('*')
    .eq('restaurant_id', fixture.restaurantId)
    .single()
  assert.ifError(after.error)
  assert.deepEqual(
    after.data,
    before.data,
    'Day-10 purchase changed subscription',
  )
  const sale = await admin
    .from('add_on_purchases')
    .select('id,status')
    .eq('restaurant_id', fixture.restaurantId)
    .eq('status', 'paid')
    .single()
  assert.ifError(sale.error)
  assert(sale.data)
  const fiscal = await admin
    .from('accounting_invoice_jobs')
    .select('*')
    .eq('add_on_purchase_id', sale.data.id)
    .single()
  assert.ifError(fiscal.error)
  assert(fiscal.data)
  if (fiscal.data.status !== 'succeeded') {
    const row = fiscal.data
    const job: AccountingInvoiceJob = {
      id: row.id,
      restaurantId: row.restaurant_id,
      subscriptionInvoiceId: null,
      addOnPurchaseId: sale.data.id,
      amountMinor: row.amount_minor,
      currency: 'TRY',
      profile: row.billing_profile_snapshot as AccountingInvoiceJob['profile'],
      attempts: 1,
      providerName: 'nilvera',
      providerContactRef: null,
      providerInvoiceRef: row.provider_invoice_ref,
      providerTaskRef: null,
      providerDocumentRef: null,
      fiscalDocumentType: null,
    }
    const provider = createNilveraInvoiceProvider(invoiceConfig),
      contact = await provider.ensureContact(job),
      type = await provider.resolveDocumentType(job)
    const invoice = await provider.createSalesInvoice(job, contact, type),
      task = await provider.formalize(job, invoice, type)
    for (let attempt = 0; attempt < 30; attempt++) {
      if ((await provider.readTask(task)) === 'succeeded') break
      await new Promise((resolve) => setTimeout(resolve, 2000))
    }
    const document = await provider.resolveFormalizedDocument(invoice, type)
    assert(document)
    const lock = await admin
      .from('accounting_invoice_jobs')
      .update({
        status: 'processing',
        locked_by: 'sandbox-addon-e2e',
        locked_at: new Date().toISOString(),
      })
      .eq('id', row.id)
    assert.ifError(lock.error)
    const completed = await admin.rpc('complete_accounting_invoice_job', {
      p_job_id: row.id,
      p_worker_id: 'sandbox-addon-e2e',
      p_provider_contact_ref: contact,
      p_provider_invoice_ref: invoice,
      p_provider_document_ref: document.ref,
      p_fiscal_document_type: type,
    })
    assert.ifError(completed.error)
    assert.equal(completed.data, true)
  }
  const download = await context.request.get(
    `http://localhost:3000/api/restaurants/${fixture.restaurantId}/billing/add-ons/${sale.data.id}/document`,
  )
  assert.equal(download.status(), 200)
  const pdf = await download.body()
  assert.equal(pdf.subarray(0, 4).toString(), '%PDF')
  writeFileSync(`${out}/invoice.pdf`, pdf, { mode: 0o600 })
  console.log(
    JSON.stringify({
      verified: true,
      restaurantId: fixture.restaurantId,
      returnedToEditor: true,
      owned: true,
      subscriptionUnchanged: true,
      pdfBytes: pdf.length,
      emailWorkerInvoked: false,
    }),
  )
} finally {
  await browser.close()
}
