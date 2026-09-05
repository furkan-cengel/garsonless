import assert from 'node:assert/strict'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@garsonless/db/types'
import { billingProfileSchema } from '../lib/billing/subscription-billing-request'

const DEV_SUPABASE_HOST = 'yxsegwkzyiscrxiwdeuf.supabase.co'
const SANDBOX_APP_ORIGIN = 'https://sandbox.masabu.co'
const OWNER_ANCHOR_SLUG = 'maf-lounge'
const E2E_SLUG_BASE = 'billing-e2e-first-activation'
const NILVERA_TEST_RECEIVER = '1234567802'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
assert(supabaseUrl && serviceRoleKey, 'DEV Supabase runtime environment is required')
assert.equal(new URL(supabaseUrl).host, DEV_SUPABASE_HOST, 'E2E preparation must target DEV Supabase')
assert.equal(process.env.NEXT_PUBLIC_APP_URL, SANDBOX_APP_ORIGIN, 'E2E preparation requires sandbox.masabu.co')
assert.equal(process.env.IYZICO_BILLING_BASE_URL, 'https://sandbox-api.iyzipay.com', 'E2E preparation requires Iyzico Sandbox')
assert.equal(process.env.NILVERA_API_BASE_URL, 'https://apitest.nilvera.com', 'E2E preparation requires Nilvera Sandbox')
assert.equal(process.env.ACCOUNTING_PROVIDER, 'nilvera', 'E2E preparation requires Nilvera')
assert.equal(process.env.ACCOUNTING_DISPATCH_ENABLED, 'false', 'Persistent accounting dispatch must remain disabled during preparation')

const args = process.argv.slice(2)
const apply = args.includes('--apply')
const slotArguments = args.filter((argument) => argument.startsWith('--slot='))
assert(slotArguments.length <= 1, 'Only one E2E fixture slot may be selected')
const slot = slotArguments.length === 1
  ? Number(slotArguments[0]!.slice('--slot='.length))
  : 1
assert(Number.isSafeInteger(slot) && slot >= 1 && slot <= 99, 'E2E fixture slot must be an integer between 1 and 99')
const e2eSlug = slot === 1 ? E2E_SLUG_BASE : `${E2E_SLUG_BASE}-${slot}`
assert.deepEqual(
  args.filter((argument) => (
    argument !== '--apply'
    && argument !== '--confirm=sandbox-e2e'
    && !argument.startsWith('--slot=')
  )),
  [],
  'Unknown E2E preparation arguments',
)
if (apply) assert(args.includes('--confirm=sandbox-e2e'), 'Applying requires --confirm=sandbox-e2e')

const admin = createClient<Database>(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const address = {
  contactName: 'Test Kurum 2',
  city: 'İstanbul',
  district: 'Maltepe',
  country: 'Türkiye',
  address: 'Test Caddesi No: 2',
  zipCode: '34840',
}

function masked(email: string): string {
  const at = email.indexOf('@')
  return at > 1 ? `${email.slice(0, 2)}***${email.slice(at)}` : '***'
}

async function assertCleanFixture(restaurantId: string, ownerId: string): Promise<void> {
  const [restaurant, customers, subscriptions, invoices, operations, onboarding] = await Promise.all([
    admin.from('restaurants').select('owner_id').eq('id', restaurantId).single(),
    admin.from('billing_customers').select('legal_name,contact_name,contact_surname,identity_number,contact_email,gsm_number,billing_address,shipping_address,profile_completed_at').eq('restaurant_id', restaurantId),
    admin.from('billing_subscriptions').select('id', { count: 'exact', head: true }).eq('restaurant_id', restaurantId),
    admin.from('subscription_invoices').select('id', { count: 'exact', head: true }).eq('restaurant_id', restaurantId),
    admin.from('billing_provider_operations').select('id', { count: 'exact', head: true }).eq('restaurant_id', restaurantId),
    admin.from('restaurant_onboarding_states').select('status,current_step,completed_at').eq('restaurant_id', restaurantId).single(),
  ])
  assert.ifError(restaurant.error)
  assert.equal(restaurant.data?.owner_id, ownerId, 'Existing E2E fixture belongs to another owner')
  assert.ifError(customers.error)
  assert.equal(customers.data?.length, 1, 'Existing E2E fixture must contain exactly one billing customer')
  const customer = customers.data![0]!
  const billingAddress = customer.billing_address as Record<string, unknown>
  assert(billingProfileSchema.safeParse({
    legalName: customer.legal_name,
    taxOffice: billingAddress['taxOffice'],
    name: customer.contact_name,
    surname: customer.contact_surname,
    identityNumber: customer.identity_number,
    email: customer.contact_email,
    gsmNumber: customer.gsm_number,
    billingAddress: customer.billing_address,
    shippingAddress: customer.shipping_address,
  }).success, 'Existing E2E billing profile is invalid')
  assert(customer.profile_completed_at, 'Existing E2E billing profile is incomplete')
  for (const result of [subscriptions, invoices, operations]) assert.ifError(result.error)
  assert.deepEqual(
    { subscriptions: subscriptions.count, invoices: invoices.count, operations: operations.count },
    { subscriptions: 0, invoices: 0, operations: 0 },
    'Existing E2E fixture is not clean; refusing to reset payment evidence',
  )
  assert.ifError(onboarding.error)
  assert.equal(onboarding.data?.status, 'completed')
  assert.equal(onboarding.data?.current_step, 'complete')
  assert(onboarding.data?.completed_at)
}

async function main(): Promise<void> {
  const ownerAnchor = await admin.from('restaurants').select('owner_id').eq('slug', OWNER_ANCHOR_SLUG).single()
  assert.ifError(ownerAnchor.error)
  const ownerId = ownerAnchor.data!.owner_id
  const owner = await admin.auth.admin.getUserById(ownerId)
  assert.ifError(owner.error)
  const ownerEmail = owner.data.user?.email
  assert(ownerEmail, 'E2E owner login e-mail is unavailable')
  const invoiceRecipient = process.env.BILLING_E2E_INVOICE_EMAIL?.trim() || ownerEmail
  assert(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(invoiceRecipient), 'E2E invoice recipient is invalid')
  const profile = billingProfileSchema.parse({
    legalName: 'Nilvera Test Kurum 2',
    taxOffice: 'Nilvera Test',
    name: 'Test',
    surname: 'Kurum',
    identityNumber: NILVERA_TEST_RECEIVER,
    email: invoiceRecipient,
    gsmNumber: '+905555555555',
    billingAddress: address,
    shippingAddress: address,
  })

  const existing = await admin.from('restaurants').select('id').eq('slug', e2eSlug).maybeSingle()
  assert.ifError(existing.error)
  if (existing.data) {
    await assertCleanFixture(existing.data.id, ownerId)
    console.log(`PASS sandbox E2E fixture already ready (${SANDBOX_APP_ORIGIN}/dashboard/${existing.data.id}/settings)`)
    console.log(`Owner ${masked(ownerEmail)}; invoice recipient ${masked(invoiceRecipient)}`)
    return
  }

  if (!apply) {
    console.log(`DRY RUN clean sandbox E2E fixture will be created for owner ${masked(ownerEmail)}`)
    console.log(`Invoice recipient ${masked(invoiceRecipient)}; add --apply --confirm=sandbox-e2e to create it`)
    return
  }

  const createdAt = new Date().toISOString()
  let restaurantId: string | null = null
  try {
    const restaurant = await admin.from('restaurants').insert({
      owner_id: ownerId,
      name: slot === 1 ? 'Masabu İlk Aktivasyon E2E' : `Masabu İlk Aktivasyon E2E ${slot}`,
      slug: e2eSlug,
      plan: 'starter',
    }).select('id').single()
    assert.ifError(restaurant.error)
    restaurantId = restaurant.data!.id

    const onboarding = await admin.from('restaurant_onboarding_states').upsert({
      restaurant_id: restaurantId,
      owner_user_id: ownerId,
      status: 'completed',
      current_step: 'complete',
      completed_steps: ['business', 'branding', 'menu'],
      menu_entry_method: 'manual',
      target_plan: 'starter',
      completed_at: createdAt,
      checklist_dismissed_at: createdAt,
    }, { onConflict: 'restaurant_id' })
    assert.ifError(onboarding.error)

    const customer = await admin.from('billing_customers').upsert({
      restaurant_id: restaurantId,
      legal_name: profile.legalName,
      contact_name: profile.name,
      contact_surname: profile.surname,
      identity_number: profile.identityNumber,
      contact_email: profile.email,
      gsm_number: profile.gsmNumber,
      billing_address: { ...profile.billingAddress, taxOffice: profile.taxOffice },
      shipping_address: profile.shippingAddress,
      profile_completed_at: createdAt,
    }, { onConflict: 'restaurant_id' })
    assert.ifError(customer.error)

    await assertCleanFixture(restaurantId, ownerId)
    console.log(`PASS sandbox E2E fixture ready (${SANDBOX_APP_ORIGIN}/dashboard/${restaurantId}/settings)`)
    console.log(`Owner ${masked(ownerEmail)}; invoice recipient ${masked(invoiceRecipient)}`)
  } catch (cause) {
    if (restaurantId) await admin.from('restaurants').delete().eq('id', restaurantId)
    throw cause
  }
}

void main().catch((cause: unknown) => {
  console.error(cause instanceof Error ? cause.message : 'Sandbox E2E preparation failed')
  process.exitCode = 1
})
