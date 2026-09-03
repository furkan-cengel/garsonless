import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import {
  createPaymentCallbackDocument,
  paymentCallbackCsp,
  paymentCallbackSecurityHeaders,
} from './payment-callback-document.ts'
import {
  parsePaymentCallbackMessage,
  readTrustedPaymentCallbackMessage,
  resolvePaymentCallbackOutcome,
} from './payment-callback-message.ts'

test('payment callback document is nonce-locked, same-origin frameable and posts to the exact origin', () => {
  const nonce = 'payment-callback-nonce-123'
  const parentOrigin = new URL('https://menu.masabu.co/api/payment/callback')
  const document = createPaymentCallbackDocument({
    message: { type: 'PAYMENT_SUCCESS', orderId: 'order-1' },
    nonce,
    parentOrigin,
    text: 'Ödeme tamamlandı.',
  })
  const headers = paymentCallbackSecurityHeaders(nonce)

  assert.match(document, new RegExp(`<script nonce="${nonce}">`))
  assert.match(document, new RegExp(`<style nonce="${nonce}">`))
  assert.match(document, /window\.parent\.postMessage/)
  assert.match(document, /,"https:\/\/menu\.masabu\.co"\)/)
  assert.doesNotMatch(document, /postMessage\([^)]*,\s*['"]\*['"]\)/)
  assert.doesNotMatch(document, /style="/)
  assert.equal(headers['X-Frame-Options'], 'SAMEORIGIN')
  assert.equal(headers['Cache-Control'], 'no-store')
  assert.equal(headers['Content-Security-Policy'], paymentCallbackCsp(nonce))
  assert.match(headers['Content-Security-Policy'] ?? '', /frame-ancestors 'self'/)
  assert.match(headers['Content-Security-Policy'] ?? '', new RegExp(`script-src 'nonce-${nonce}'`))
  assert.doesNotMatch(headers['Content-Security-Policy'] ?? '', /unsafe-inline|unsafe-eval/)
})

test('payment callback messages preserve normal and split flow separation', () => {
  const order = parsePaymentCallbackMessage({ type: 'PAYMENT_SUCCESS', orderId: 'order-1' })
  const share = parsePaymentCallbackMessage({ type: 'SHARE_PAYMENT_SUCCESS', shareId: 'share-1' })
  const failed = parsePaymentCallbackMessage({ type: 'PAYMENT_FAILED', reason: 'Doğrulanamadı' })

  assert.ok(order)
  assert.ok(share)
  assert.ok(failed)
  assert.deepEqual(resolvePaymentCallbackOutcome('order', order), { status: 'success' })
  assert.equal(resolvePaymentCallbackOutcome('share', order), null)
  assert.deepEqual(resolvePaymentCallbackOutcome('share', share), { status: 'success' })
  assert.equal(resolvePaymentCallbackOutcome('order', share), null)
  assert.deepEqual(resolvePaymentCallbackOutcome('order', failed), {
    status: 'failed',
    reason: 'Doğrulanamadı',
  })
  assert.equal(parsePaymentCallbackMessage({ type: 'PAYMENT_SUCCESS' }), null)
  assert.equal(parsePaymentCallbackMessage({ type: 'UNKNOWN', orderId: 'order-1' }), null)
})

test('payment callback reader requires both the exact parent origin and iframe source', () => {
  const expectedSource = {}
  const message = { type: 'SHARE_PAYMENT_SUCCESS', shareId: 'share-1' }
  const trusted = {
    data: message,
    origin: 'https://menu.masabu.co',
    source: expectedSource,
  }

  assert.deepEqual(readTrustedPaymentCallbackMessage(
    trusted as Pick<MessageEvent, 'data' | 'origin' | 'source'>,
    'https://menu.masabu.co',
    expectedSource as MessageEventSource,
  ), message)
  assert.equal(readTrustedPaymentCallbackMessage(
    { ...trusted, origin: 'https://attacker.example' } as Pick<MessageEvent, 'data' | 'origin' | 'source'>,
    'https://menu.masabu.co',
    expectedSource as MessageEventSource,
  ), null)
  assert.equal(readTrustedPaymentCallbackMessage(
    { ...trusted, source: {} } as Pick<MessageEvent, 'data' | 'origin' | 'source'>,
    'https://menu.masabu.co',
    expectedSource as MessageEventSource,
  ), null)
})

test('middleware delegates callback CSP and both payment surfaces bind the trusted reader to their iframe', () => {
  const middleware = readFileSync(new URL('../middleware.ts', import.meta.url), 'utf8')
  const route = readFileSync(new URL('../app/api/payment/callback/route.ts', import.meta.url), 'utf8')
  const paymentModal = readFileSync(new URL('../app/[slug]/components/PaymentModal.tsx', import.meta.url), 'utf8')
  const splitModal = readFileSync(new URL('../app/[slug]/components/SplitBillModal.tsx', import.meta.url), 'utf8')

  assert.match(middleware, /shouldApplyMenuFrameAncestors\(req\.nextUrl\.pathname\)/)
  assert.match(route, /paymentCallbackSecurityHeaders\(nonce\)/)
  for (const modal of [paymentModal, splitModal]) {
    assert.match(modal, /readTrustedPaymentCallbackMessage\(/)
    assert.match(modal, /window\.location\.origin/)
    assert.match(modal, /paymentFrameRef\.current\?\.contentWindow/)
    assert.match(modal, /<iframe ref=\{paymentFrameRef\}/)
  }
})
