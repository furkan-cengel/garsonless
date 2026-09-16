import assert from 'node:assert/strict'
import test from 'node:test'
import { createAccountingInvoicePort, type AccountingInvoiceJob } from './accounting-invoice-port'

const job: AccountingInvoiceJob = {
  id: '11111111-1111-4111-8111-111111111111', restaurantId: '22222222-2222-4222-8222-222222222222',
  subscriptionInvoiceId: '33333333-3333-4333-8333-333333333333', amountMinor: 119900,
  currency: 'TRY', attempts: 1, providerName: 'nilvera', providerContactRef: null, providerInvoiceRef: null,
  providerTaskRef: null, providerDocumentRef: null, fiscalDocumentType: null,
  profile: {
    legalName: 'Test İşletmesi', name: 'Test', surname: 'Sahibi', identityNumber: '11111111111',
    taxOffice: 'Kartal', email: 'test@example.com', billingAddress: { city: 'İstanbul', address: 'Test adresi' },
    periodStart: '2026-08-15T00:00:00.000Z', periodEnd: '2026-09-15T00:00:00.000Z',
    paidAt: '2026-08-15T12:00:00.000Z', plan: 'pro', addOns: [], billingInterval: 'monthly',
  },
}

test('accounting port parses the closed service-only claim projection', async () => {
  const calls: Array<{ name: string; args: Record<string, unknown> }> = []
  const port = createAccountingInvoicePort(async (name, args) => {
    calls.push({ name, args }); return { data: [job], error: null }
  })
  const result = await port.claim('worker-1', 'nilvera', 2)
  assert.equal(result.ok, true)
  assert.deepEqual(calls, [{
    name: 'claim_accounting_invoice_jobs',
    args: { p_worker_id: 'worker-1', p_provider_name: 'nilvera', p_limit: 2 },
  }])
})

test('accounting port rejects malformed money and hides database errors', async () => {
  const malformed = createAccountingInvoicePort(async () => ({ data: [{ ...job, amountMinor: 1.2 }], error: null }))
  assert.equal((await malformed.claim('worker', 'nilvera')).ok, false)
  const failed = createAccountingInvoicePort(async () => ({ data: null, error: { message: 'raw database details' } }))
  assert.deepEqual(await failed.claim('worker', 'nilvera'), { ok: false, error: 'Accounting jobs are unavailable' })
})

test('accounting port rejects unsupported providers and provider-less projections', async () => {
  let calls = 0
  const port = createAccountingInvoicePort(async () => {
    calls += 1
    return { data: [job], error: null }
  })
  assert.equal((await port.claim('worker', 'other' as 'nilvera')).ok, false)
  assert.equal((await port.claim('worker', 'parasut' as never)).ok, false)
  assert.equal(calls, 0)
  const providerLess = createAccountingInvoicePort(async () => ({
    data: [{ ...job, providerName: null }], error: null,
  }))
  assert.equal((await providerLess.claim('worker', 'nilvera')).ok, false)
  const retiredProvider = createAccountingInvoicePort(async () => ({
    data: [{ ...job, providerName: 'parasut' }], error: null,
  }))
  assert.equal((await retiredProvider.claim('worker', 'nilvera')).ok, false)
})

test('accounting fiscal e-mail stores the provider identity before completion', async () => {
  const calls: Array<{ name: string; args: Record<string, unknown> }> = []
  const port = createAccountingInvoicePort(async (name, args) => {
    calls.push({ name, args })
    return { data: true, error: null }
  })
  const result = await port.recordEmailDelivery({ jobId: job.id, providerMessageId: 'resend-message-1' })
  assert.deepEqual(result, { ok: true, value: true })
  assert.deepEqual(calls, [{
    name: 'record_accounting_invoice_email_delivery',
    args: { p_job_id: job.id, p_provider_message_id: 'resend-message-1' },
  }])
})

test('one-time invoice claim has a purchase source and no fabricated billing period', async () => {
  const { periodStart: _start, periodEnd: _end, plan: _plan, addOns: _addOns, billingInterval: _interval, ...profile } = job.profile as Extract<AccountingInvoiceJob['profile'], { plan: string }>
  const oneTime = { ...job, subscriptionInvoiceId: null, addOnPurchaseId: '44444444-4444-4444-8444-444444444444', amountMinor: 46800,
    profile: { ...profile, kind: 'add_on', addOn: 'storefront_video_hero', netAmountMinor: 39000, vatRate: 20 } }
  const port = createAccountingInvoicePort(async () => ({ data: [oneTime], error: null }))
  const result = await port.claim('worker','nilvera')
  assert.ok(result.ok)
  assert.equal(result.value[0]?.subscriptionInvoiceId,null)
  assert.equal(result.value[0]?.profile.kind,'add_on')
  assert.equal('periodStart' in result.value[0]!.profile,false)
})
