import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@garsonless/db/types'

const DEV_PROJECT_HOST = 'yxsegwkzyiscrxiwdeuf.supabase.co'
const CANARY_SLUG = 'nilvera-accounting-worker-canary'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const recipient = process.env.NILVERA_CANARY_EMAIL?.trim()
assert(url && serviceRoleKey, 'DEV Supabase runtime environment is required')
assert.equal(new URL(url).host, DEV_PROJECT_HOST, 'Canary worker must target DEV Supabase')
assert.equal(process.env.ACCOUNTING_PROVIDER?.trim(), 'nilvera', 'Canary worker requires Nilvera')
assert.equal(process.env.ACCOUNTING_DISPATCH_ENABLED, 'false', 'Persistent accounting dispatch must remain disabled')
assert.equal(new URL(process.env.NILVERA_API_BASE_URL ?? '').host, 'apitest.nilvera.com', 'Canary worker requires Nilvera sandbox')
assert(recipient && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient), 'NILVERA_CANARY_EMAIL is required')

const args = process.argv.slice(2)
assert.deepEqual(args.filter((arg) => arg !== '--apply'), [], 'Unknown canary worker arguments')
if (!args.includes('--apply')) {
  console.log('DRY RUN Nilvera DEV worker canary; add --apply to create one sandbox e-Invoice and send its PDF')
  process.exit(0)
}

const options = { auth: { autoRefreshToken: false, persistSession: false } } as const
const admin = createClient<Database>(url, serviceRoleKey, options)

function object(value: unknown): Record<string, unknown> {
  assert(value && typeof value === 'object' && !Array.isArray(value), 'Worker response is invalid')
  return value as Record<string, unknown>
}

async function callWorker(secret: string): Promise<Record<string, unknown>> {
  const { POST } = await import('../app/api/internal/accounting-invoices/route')
  const response = await POST(new Request('http://localhost/api/internal/accounting-invoices', {
    method: 'POST',
    headers: { authorization: `Bearer ${secret}` },
  }))
  const result = object(await response.json())
  assert.equal(response.status, 200, `Accounting worker returned HTTP ${response.status}`)
  return result
}

const sleep = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds))

async function main() {
  const restaurant = await admin.from('restaurants').select('id').eq('slug', CANARY_SLUG).single()
  assert.ifError(restaurant.error)
  const jobs = await admin.from('accounting_invoice_jobs')
    .select('id,subscription_invoice_id,status,attempts,provider_name,provider_contact_ref,provider_invoice_ref,provider_task_ref,provider_document_ref,fiscal_document_type,last_error_code')
    .eq('restaurant_id', restaurant.data!.id)
  assert.ifError(jobs.error)
  assert.equal(jobs.data?.length, 1, 'Canary must contain exactly one accounting job')
  const canary = jobs.data![0]!
  assert(['pending', 'retry'].includes(canary.status), 'Canary job must be pending or awaiting its Nilvera task')
  assert.equal(canary.provider_name, 'nilvera', 'Canary job must be bound to Nilvera')
  assert.equal(canary.provider_document_ref, null)
  if (canary.status === 'pending') {
    assert.equal(canary.attempts, 0, 'Pending canary job must never have been attempted')
    assert.equal(canary.provider_contact_ref, null)
    assert.equal(canary.provider_invoice_ref, null)
    assert.equal(canary.provider_task_ref, null)
  } else {
    assert(canary.attempts > 0 && canary.attempts < 10, 'Canary retry count is outside its safe bound')
    assert.equal(canary.last_error_code, 'ACCOUNTING_TASK_PENDING', 'Canary may resume only a pending Nilvera task')
    assert(canary.provider_contact_ref && canary.provider_invoice_ref && canary.provider_task_ref,
      'Resumed canary must retain all provider identities')
  }

  const eligible = await admin.from('accounting_invoice_jobs')
    .select('id')
    .in('status', ['pending', 'retry'])
    .or('provider_name.eq.nilvera,provider_name.is.null')
  assert.ifError(eligible.error)
  assert.deepEqual(eligible.data?.map((job) => job.id), [canary.id], 'Canary must be the only Nilvera-eligible job')

  const secret = randomBytes(48).toString('base64url')
  process.env.ACCOUNTING_WORKER_SECRET = secret
  process.env.ACCOUNTING_DISPATCH_ENABLED = 'true'
  let succeeded = false
  for (let poll = 0; poll < 10; poll += 1) {
    const current = await admin.from('accounting_invoice_jobs')
      .select('status,last_error_code')
      .eq('id', canary.id)
      .single()
    assert.ifError(current.error)
    if (current.data?.status === 'succeeded') {
      succeeded = true
      break
    }
    assert(['pending', 'retry'].includes(current.data?.status ?? ''), 'Canary entered an unexpected state')
    if (current.data?.status === 'retry') {
      assert.equal(current.data.last_error_code, 'ACCOUNTING_TASK_PENDING',
        'Canary may retry only while Nilvera formalization is pending')
      const rearmed = await admin.from('accounting_invoice_jobs')
        .update({ available_at: new Date().toISOString() })
        .eq('id', canary.id)
        .eq('status', 'retry')
        .eq('provider_name', 'nilvera')
        .select('id')
        .single()
      assert.ifError(rearmed.error)
    }
    const result = await callWorker(secret)
    assert.equal(result.claimed, 1, 'Canary worker did not claim exactly one job')
    if (result.succeeded === 1) {
      assert.deepEqual(result, { claimed: 1, succeeded: 1 }, 'Canary worker returned an unexpected result')
      succeeded = true
      break
    }
    assert.deepEqual(result, { claimed: 1, succeeded: 0 }, 'Canary worker returned an unexpected retry result')
    await sleep(2_000)
  }
  assert(succeeded, 'Nilvera task did not complete inside the bounded canary polling window')

  const completed = await admin.from('accounting_invoice_jobs')
    .select('status,attempts,provider_name,provider_contact_ref,provider_invoice_ref,provider_document_ref,fiscal_document_type,completed_at,last_error_code')
    .eq('id', canary.id)
    .single()
  assert.ifError(completed.error)
  assert.equal(completed.data?.status, 'succeeded')
  assert((completed.data?.attempts ?? 0) >= 1 && (completed.data?.attempts ?? 0) <= 10,
    'Canary attempt count is outside its safe bound')
  assert.equal(completed.data?.provider_name, 'nilvera')
  assert.equal(completed.data?.fiscal_document_type, 'e_fatura')
  assert(completed.data?.provider_contact_ref)
  assert(completed.data?.provider_invoice_ref)
  assert.equal(completed.data?.provider_document_ref, completed.data?.provider_invoice_ref)
  assert(completed.data?.completed_at)
  assert.equal(completed.data?.last_error_code, null)

  const delivery = await admin.from('notification_deliveries')
    .select('status,provider_message_id,provider_delivery_status')
    .eq('restaurant_id', restaurant.data!.id)
    .eq('dedupe_key', `fiscal_document.ready:${canary.subscription_invoice_id}`)
    .single()
  assert.ifError(delivery.error)
  assert.equal(delivery.data?.status, 'sent')
  assert(delivery.data?.provider_message_id)
  assert.equal(delivery.data?.provider_delivery_status, 'sent')

  const readyEvent = await admin.from('domain_outbox')
    .select('id', { count: 'exact', head: true })
    .eq('restaurant_id', restaurant.data!.id)
    .eq('aggregate_id', canary.subscription_invoice_id)
    .eq('event_type', 'fiscal_document.ready')
  assert.ifError(readyEvent.error)
  assert.equal(readyEvent.count, 1)

  const replay = await callWorker(secret)
  assert.deepEqual(replay, { claimed: 0, succeeded: 0 }, 'Canary replay unexpectedly claimed another job')
  console.log('PASS Nilvera DEV worker canary (one e-Invoice, PDF fetched, e-mail accepted, replay claimed zero)')
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Nilvera worker canary failed')
  process.exitCode = 1
})
