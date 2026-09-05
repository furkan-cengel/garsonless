import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import {
  handleSubscriptionInvoiceDocument,
  type SubscriptionInvoiceDocumentHandlerDependencies,
} from './subscription-invoice-document-handler'

const RESTAURANT_ID = '11111111-1111-4111-8111-111111111111'
const INVOICE_ID = '22222222-2222-4222-8222-222222222222'

function harness(overrides: Partial<SubscriptionInvoiceDocumentHandlerDependencies> = {}) {
  const calls: string[] = []
  const dependencies: SubscriptionInvoiceDocumentHandlerDependencies = {
    resolveAccess: async (restaurantId) => {
      calls.push(`access:${restaurantId}`)
      return { isOwner: true }
    },
    readDocument: async ({ restaurantId, invoiceId }) => {
      calls.push(`read:${restaurantId}:${invoiceId}`)
      return {
        ok: true,
        value: {
          status: 'ready',
          providerDocumentRef: '33333333-3333-4333-8333-333333333333',
          fiscalDocumentType: 'e_arsiv',
        },
      }
    },
    downloadPdf: async ({ ref, type }) => {
      calls.push(`pdf:${type}:${ref}`)
      return new TextEncoder().encode('%PDF-1.7\nMasabu')
    },
    ...overrides,
  }
  return { calls, dependencies }
}

test('malformed identities fail before authentication or service-role reads', async () => {
  const { calls, dependencies } = harness()
  const response = await handleSubscriptionInvoiceDocument({
    restaurantId: 'not-a-uuid', invoiceId: INVOICE_ID,
  }, dependencies)
  assert.equal(response.status, 404)
  assert.deepEqual(calls, [])
})

test('anonymous users and members cannot reach the service-role document lookup', async (context) => {
  for (const access of [null, { isOwner: false }]) {
    await context.test(access ? 'member' : 'anonymous', async () => {
      const { calls, dependencies } = harness({
        resolveAccess: async (restaurantId) => {
          calls.push(`access:${restaurantId}`)
          return access
        },
      })
      const response = await handleSubscriptionInvoiceDocument({
        restaurantId: RESTAURANT_ID, invoiceId: INVOICE_ID,
      }, dependencies)
      assert.equal(response.status, 404)
      assert.deepEqual(calls, [`access:${RESTAURANT_ID}`])
    })
  }
})

test('a cross-tenant invoice guess is indistinguishable from a missing invoice', async () => {
  const { calls, dependencies } = harness({
    readDocument: async ({ restaurantId, invoiceId }) => {
      calls.push(`read:${restaurantId}:${invoiceId}`)
      return { ok: true, value: { status: 'not_found' } }
    },
  })
  const response = await handleSubscriptionInvoiceDocument({
    restaurantId: RESTAURANT_ID, invoiceId: INVOICE_ID,
  }, dependencies)
  assert.equal(response.status, 404)
  assert.deepEqual(await response.json(), { error: 'Fatura bulunamadı.' })
  assert.deepEqual(calls, [
    `access:${RESTAURANT_ID}`,
    `read:${RESTAURANT_ID}:${INVOICE_ID}`,
  ])
})

test('a paid invoice without a formalized document returns a retryable client state', async () => {
  const { calls, dependencies } = harness({
    readDocument: async (input) => {
      calls.push(`read:${input.restaurantId}:${input.invoiceId}`)
      return { ok: true, value: { status: 'not_ready' } }
    },
  })
  const response = await handleSubscriptionInvoiceDocument({
    restaurantId: RESTAURANT_ID, invoiceId: INVOICE_ID,
  }, dependencies)
  assert.equal(response.status, 409)
  assert.doesNotMatch(calls.join('|'), /pdf:/)
})

test('ready documents return the exact PDF as a private attachment', async () => {
  const { calls, dependencies } = harness()
  const response = await handleSubscriptionInvoiceDocument({
    restaurantId: RESTAURANT_ID, invoiceId: INVOICE_ID,
  }, dependencies)
  assert.equal(response.status, 200)
  assert.equal(response.headers.get('content-type'), 'application/pdf')
  assert.equal(response.headers.get('cache-control'), 'no-store, private, max-age=0')
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff')
  assert.equal(response.headers.get('x-frame-options'), 'DENY')
  assert.match(response.headers.get('content-disposition') ?? '', new RegExp(INVOICE_ID))
  assert.equal(new TextDecoder().decode(await response.arrayBuffer()), '%PDF-1.7\nMasabu')
  assert.deepEqual(calls, [
    `access:${RESTAURANT_ID}`,
    `read:${RESTAURANT_ID}:${INVOICE_ID}`,
    'pdf:e_arsiv:33333333-3333-4333-8333-333333333333',
  ])
})

test('database and provider failures return sanitized responses', async (context) => {
  await context.test('database failure', async () => {
    const { dependencies } = harness({
      readDocument: async () => ({ ok: false, error: 'provider_document_ref=secret' }),
    })
    const response = await handleSubscriptionInvoiceDocument({
      restaurantId: RESTAURANT_ID, invoiceId: INVOICE_ID,
    }, dependencies)
    assert.equal(response.status, 503)
    assert.doesNotMatch(await response.text(), /provider_document_ref|secret/i)
  })

  await context.test('provider failure', async () => {
    const { dependencies } = harness({
      downloadPdf: async () => { throw new Error('NILVERA_API_KEY=secret') },
    })
    const response = await handleSubscriptionInvoiceDocument({
      restaurantId: RESTAURANT_ID, invoiceId: INVOICE_ID,
    }, dependencies)
    assert.equal(response.status, 503)
    assert.doesNotMatch(await response.text(), /nilvera|api_key|secret/i)
  })
})

test('route wiring defers service and provider construction to the tested handler', () => {
  const route = readFileSync(
    new URL('../../app/api/restaurants/[restaurantId]/billing/invoices/[invoiceId]/document/route.ts', import.meta.url),
    'utf8',
  )
  assert.match(route, /handleSubscriptionInvoiceDocument\(await params/)
  assert.match(route, /resolveAccess: getUserRestaurantAccess/)
  assert.match(route, /readDocument: \(input\) => createSubscriptionInvoiceDocumentReadPort\(\)\.read\(input\)/)
  assert.match(route, /downloadPdf: \(document\) => createNilveraInvoiceProvider\(readNilveraConfig\(\)\)\.downloadPdf\(document\)/)
})
