import assert from 'node:assert/strict'
import test from 'node:test'
import { DEFAULT_THEME, type CheckoutSurfaceTheme } from './schema'
import {
  resolveCheckoutErrorState,
  resolveCheckoutPaymentState,
  resolveCheckoutSuccessState,
  resolveCheckoutTablePaymentState,
} from './checkout-state-policy'

test('legacy checkout fields remain the payment and success fallbacks', () => {
  const checkout: CheckoutSurfaceTheme = {
    ...DEFAULT_THEME.surfaces!.checkout,
    title: 'Ödemeyi tamamla',
    subtitle: 'Güvenli yöntemi seç.',
    successTitle: 'Sipariş hazır',
  }

  assert.equal(resolveCheckoutPaymentState(checkout).title, 'Ödemeyi tamamla')
  assert.equal(resolveCheckoutPaymentState(checkout).description, 'Güvenli yöntemi seç.')
  assert.equal(resolveCheckoutSuccessState(checkout).title, 'Sipariş hazır')
  assert.equal(resolveCheckoutTablePaymentState(checkout).icon, 'bell')
  assert.equal(resolveCheckoutErrorState(checkout).primaryActionLabel, 'Tekrar dene')
})

test('checkout state overrides stay isolated and merge bounded layout fields', () => {
  const checkout: CheckoutSurfaceTheme = {
    ...DEFAULT_THEME.surfaces!.checkout,
    states: {
      payment: { amountLabel: 'Toplam', layout: { density: 'compact' } },
      success: { icon: 'sparkles', primaryActionLabel: 'Siparişe dön', layout: { contentGap: 24 } },
      tablePayment: { icon: 'clock' },
      error: { icon: 'refresh', secondaryActionLabel: 'Kapat' },
    },
  }

  assert.equal(resolveCheckoutPaymentState(checkout).amountLabel, 'Toplam')
  assert.equal(resolveCheckoutPaymentState(checkout).layout.density, 'compact')
  assert.equal(resolveCheckoutPaymentState(checkout).layout.paddingX, 16)
  assert.equal(resolveCheckoutSuccessState(checkout).layout.contentGap, 24)
  assert.equal(resolveCheckoutSuccessState(checkout).icon, 'sparkles')
  assert.equal(resolveCheckoutTablePaymentState(checkout).icon, 'clock')
  assert.equal(resolveCheckoutErrorState(checkout).icon, 'refresh')
})
