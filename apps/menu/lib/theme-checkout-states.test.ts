import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const paymentModal = readFileSync(new URL('../app/[slug]/components/PaymentModal.tsx', import.meta.url), 'utf8')

test('production PaymentModal resolves all checkout state themes', () => {
  assert.match(paymentModal, /resolveCheckoutPaymentState\(checkoutTheme\)/)
  assert.match(paymentModal, /resolveCheckoutSuccessState\(checkoutTheme\)/)
  assert.match(paymentModal, /resolveCheckoutTablePaymentState\(checkoutTheme\)/)
  assert.match(paymentModal, /resolveCheckoutErrorState\(checkoutTheme\)/)
  assert.match(paymentModal, /paymentTheme\.amountLabel/)
  assert.match(paymentModal, /successTheme\.primaryActionLabel/)
  assert.match(paymentModal, /tablePaymentTheme\.primaryActionLabel/)
  assert.match(paymentModal, /errorTheme\.secondaryActionLabel/)
})

test('checkout layout and semantic palette are applied as bounded CSS variables', () => {
  assert.match(paymentModal, /--pay-form-padding-x/)
  assert.match(paymentModal, /--pay-section-gap/)
  assert.match(paymentModal, /--pay-result-padding-x/)
  assert.match(paymentModal, /--pay-result-icon-size/)
  assert.match(paymentModal, /--pay-field-border/)
  assert.match(paymentModal, /--pay-cta/)
})

test('result announcements are accessible while runtime payment facts stay authoritative', () => {
  assert.match(paymentModal, /role="status" aria-live="polite"/)
  assert.match(paymentModal, /role="alert" aria-live="assertive"/)
  assert.match(paymentModal, /<p>\{errorMsg\}<\/p>/)
  assert.match(paymentModal, /formatTRY\(total\)/)
  assert.match(paymentModal, /İyzico güvenli ödeme altyapısı/)
  assert.match(paymentModal, /iframe src=\{paymentPageUrl\}/)
})
