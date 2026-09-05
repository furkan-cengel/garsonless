import assert from 'node:assert/strict'
import test from 'node:test'
import { createSubscriptionInvoiceDocumentReadPort } from './subscription-invoice-document-port'

test('subscription invoice document port parses only supported Nilvera document identities', async () => {
  const port = createSubscriptionInvoiceDocumentReadPort(async (name, args) => {
    assert.equal(name, 'read_subscription_invoice_document')
    assert.deepEqual(args, { p_restaurant_id: 'restaurant-1', p_invoice_id: 'invoice-1' })
    return {
      data: { status: 'ready', providerDocumentRef: 'document-1', fiscalDocumentType: 'e_arsiv' },
      error: null,
    }
  })
  assert.deepEqual(await port.read({ restaurantId: 'restaurant-1', invoiceId: 'invoice-1' }), {
    ok: true,
    value: { status: 'ready', providerDocumentRef: 'document-1', fiscalDocumentType: 'e_arsiv' },
  })

  const malformed = createSubscriptionInvoiceDocumentReadPort(async () => ({
    data: { status: 'ready', providerDocumentRef: 'document-1', fiscalDocumentType: 'unknown' },
    error: null,
  }))
  assert.deepEqual(await malformed.read({ restaurantId: 'restaurant-1', invoiceId: 'invoice-1' }), {
    ok: false, error: 'Invoice document response is invalid',
  })
})

test('subscription invoice document port keeps database failures private', async () => {
  const port = createSubscriptionInvoiceDocumentReadPort(async () => ({
    data: null, error: { message: 'provider_document_ref leaked' },
  }))
  assert.deepEqual(await port.read({ restaurantId: 'restaurant-1', invoiceId: 'invoice-1' }), {
    ok: false, error: 'Invoice document could not be loaded',
  })
})
