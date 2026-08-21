import assert from 'node:assert/strict'
import test from 'node:test'
import { createAccountingInvoicePort, type AccountingInvoiceJob } from './accounting-invoice-port'

const job: AccountingInvoiceJob = {
  id: '11111111-1111-4111-8111-111111111111', restaurantId: '22222222-2222-4222-8222-222222222222',
  subscriptionInvoiceId: '33333333-3333-4333-8333-333333333333', amountMinor: 119900,
  currency: 'TRY', attempts: 1, providerContactRef: null, providerInvoiceRef: null,
  providerTaskRef: null, fiscalDocumentType: null,
  profile: {
    legalName: 'Test İşletmesi', name: 'Test', surname: 'Sahibi', identityNumber: '11111111111',
    taxOffice: 'Kartal', email: 'test@example.com', billingAddress: { city: 'İstanbul', address: 'Test adresi' },
    periodStart: '2026-08-15T00:00:00.000Z', periodEnd: '2026-09-15T00:00:00.000Z',
    plan: 'pro', billingInterval: 'monthly',
  },
}

test('accounting port parses the closed service-only claim projection', async () => {
  const calls: Array<{ name: string; args: Record<string, unknown> }> = []
  const port = createAccountingInvoicePort(async (name, args) => {
    calls.push({ name, args }); return { data: [job], error: null }
  })
  const result = await port.claim('worker-1', 2)
  assert.equal(result.ok, true)
  assert.deepEqual(calls, [{ name: 'claim_accounting_invoice_jobs', args: { p_worker_id: 'worker-1', p_limit: 2 } }])
})

test('accounting port rejects malformed money and hides database errors', async () => {
  const malformed = createAccountingInvoicePort(async () => ({ data: [{ ...job, amountMinor: 1.2 }], error: null }))
  assert.equal((await malformed.claim('worker')).ok, false)
  const failed = createAccountingInvoicePort(async () => ({ data: null, error: { message: 'raw database details' } }))
  assert.deepEqual(await failed.claim('worker'), { ok: false, error: 'Accounting jobs are unavailable' })
})
