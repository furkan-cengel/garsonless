import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const route = readFileSync(new URL('../../app/api/internal/accounting-invoices/route.ts', import.meta.url), 'utf8')
const email = readFileSync(new URL('./invoice-email.ts', import.meta.url), 'utf8')

test('accounting worker authenticates before claiming and checkpoints each external identity', () => {
  assert.match(route, /timingSafeEqual/)
  assert.ok(route.indexOf('if (!authorized(request))') < route.indexOf('port.claim(workerId, 5)'))
  assert.match(route, /ACCOUNTING_CONTACT_CHECKPOINT/)
  assert.match(route, /ACCOUNTING_INVOICE_CHECKPOINT/)
  assert.match(route, /providerTaskRef: taskRef/)
})

test('invoice email retries are provider-idempotent and complete only after delivery', () => {
  assert.match(email, /idempotencyKey: `masabu-invoice-email-\$\{job\.id\}`/)
  assert.ok(route.indexOf('await sendInvoiceEmail') < route.indexOf('await port.complete'))
})
