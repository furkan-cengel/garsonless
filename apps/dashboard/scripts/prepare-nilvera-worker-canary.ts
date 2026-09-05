import assert from 'node:assert/strict'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@garsonless/db/types'

const DEV_PROJECT_HOST = 'yxsegwkzyiscrxiwdeuf.supabase.co'
const CANARY_SLUG = 'nilvera-accounting-worker-canary'
const CANARY_TAX_NUMBER = '1234567802'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const configuredRecipient = process.env.NILVERA_CANARY_EMAIL?.trim()
assert(url && serviceRoleKey, 'DEV Supabase runtime environment is required')
assert.equal(new URL(url).host, DEV_PROJECT_HOST, 'Canary preparation must target DEV Supabase')
assert.equal(process.env.ACCOUNTING_PROVIDER?.trim(), 'nilvera', 'Canary preparation requires Nilvera')
assert.equal(process.env.ACCOUNTING_DISPATCH_ENABLED, 'false', 'Accounting dispatch must remain disabled')
assert.equal(new URL(process.env.NILVERA_API_BASE_URL ?? '').host, 'apitest.nilvera.com', 'Canary requires Nilvera sandbox')
assert(configuredRecipient && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(configuredRecipient), 'NILVERA_CANARY_EMAIL is required')
const recipient = configuredRecipient

const apply = process.argv.slice(2).includes('--apply')
assert.deepEqual(process.argv.slice(2).filter((arg) => arg !== '--apply'), [], 'Unknown canary arguments')
if (!apply) {
  console.log('DRY RUN Nilvera DEV worker canary; add --apply to create one isolated pending job')
  process.exit(0)
}

const options = { auth: { autoRefreshToken: false, persistSession: false } } as const
const admin = createClient<Database>(url, serviceRoleKey, options)

function monthBefore(date: Date): Date {
  const value = new Date(date)
  value.setUTCMonth(value.getUTCMonth() - 1)
  return value
}

async function existingCanary() {
  const restaurant = await admin.from('restaurants').select('id').eq('slug', CANARY_SLUG).maybeSingle()
  assert.ifError(restaurant.error)
  if (!restaurant.data) return false
  const jobs = await admin.from('accounting_invoice_jobs')
    .select('status,attempts,provider_name,provider_contact_ref,provider_invoice_ref,provider_task_ref,provider_document_ref')
    .eq('restaurant_id', restaurant.data.id)
  assert.ifError(jobs.error)
  assert.equal(jobs.data?.length, 1, 'Existing canary must contain exactly one accounting job')
  assert.deepEqual(jobs.data?.[0], {
    status: 'pending',
    attempts: 0,
    provider_name: 'nilvera',
    provider_contact_ref: null,
    provider_invoice_ref: null,
    provider_task_ref: null,
    provider_document_ref: null,
  }, 'Existing canary is not safe to reuse')
  return true
}

async function main() {
  if (await existingCanary()) {
    console.log('PASS Nilvera DEV worker canary already ready (one pending Nilvera job; no provider call)')
    return
  }

  const owner = await admin.from('restaurants').select('owner_id').eq('slug', 'test-cafe-b').single()
  assert.ifError(owner.error)
  const restaurant = await admin.from('restaurants').insert({
    owner_id: owner.data!.owner_id,
    name: 'Nilvera Accounting Worker Canary',
    slug: CANARY_SLUG,
    plan: 'starter',
  }).select('id').single()
  assert.ifError(restaurant.error)

  const marker = `nilvera-worker-canary:${restaurant.data!.id}`
  const customer = await admin.from('billing_customers').insert({
    restaurant_id: restaurant.data!.id,
    legal_name: 'Test Kurum 2',
    contact_name: 'Test',
    contact_surname: 'Kurum',
    identity_number: CANARY_TAX_NUMBER,
    contact_email: recipient,
    billing_address: {
      address: 'Test Caddesi No: 2',
      city: 'İstanbul',
      district: 'Maltepe',
      postalCode: '34840',
      country: 'Türkiye',
      taxOffice: 'Nilvera Test',
    },
    profile_completed_at: new Date().toISOString(),
    provider_customer_ref: `${marker}:customer`,
  }).select('id').single()
  assert.ifError(customer.error)

  const paidAt = new Date()
  const periodStart = monthBefore(paidAt)
  const subscription = await admin.from('billing_subscriptions').insert({
    restaurant_id: restaurant.data!.id,
    billing_customer_id: customer.data!.id,
    provider: 'iyzico',
    provider_subscription_ref: `${marker}:subscription`,
    plan: 'starter',
    billing_interval: 'monthly',
    status: 'active',
    current_period_start: periodStart.toISOString(),
    current_period_end: paidAt.toISOString(),
  }).select('id').single()
  assert.ifError(subscription.error)

  const invoice = await admin.from('subscription_invoices').insert({
    restaurant_id: restaurant.data!.id,
    subscription_id: subscription.data!.id,
    provider: 'iyzico',
    provider_invoice_ref: `${marker}:invoice`,
    idempotency_key: `${marker}:invoice`,
    plan: 'starter',
    billing_interval: 'monthly',
    amount_due_minor: 12_000,
    amount_paid_minor: 12_000,
    currency: 'TRY',
    status: 'paid',
    period_start: periodStart.toISOString(),
    period_end: paidAt.toISOString(),
    due_at: paidAt.toISOString(),
    finalized_at: paidAt.toISOString(),
    paid_at: paidAt.toISOString(),
  }).select('id').single()
  assert.ifError(invoice.error)

  const job = await admin.from('accounting_invoice_jobs').update({ provider_name: 'nilvera' })
    .eq('subscription_invoice_id', invoice.data!.id)
    .eq('status', 'pending')
    .eq('attempts', 0)
    .is('provider_name', null)
    .select('status,attempts,provider_name,billing_profile_snapshot')
    .single()
  assert.ifError(job.error)
  assert.equal(job.data?.status, 'pending')
  assert.equal(job.data?.attempts, 0)
  assert.equal(job.data?.provider_name, 'nilvera')
  const profile = job.data?.billing_profile_snapshot as Record<string, unknown>
  assert.equal(profile.identityNumber, CANARY_TAX_NUMBER)
  assert.equal(profile.email, recipient)

  console.log('PASS Nilvera DEV worker canary ready (one pending Nilvera job; no provider call)')
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Nilvera worker canary preparation failed')
  process.exitCode = 1
})
