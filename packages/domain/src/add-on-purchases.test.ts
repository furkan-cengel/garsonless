import test from 'node:test'
import assert from 'node:assert/strict'
import {
  canPurchaseAddOn,
  addOnReturnPath,
  ADD_ON_INITIAL_PRICES,
} from './add-on-purchases'
import { canUseFeature } from './entitlements'
test('one-time purchase eligibility differs from plan-included usage', () => {
  assert.equal(ADD_ON_INITIAL_PRICES.storefront_video_hero, 39000)
  assert.equal(ADD_ON_INITIAL_PRICES.iyzico_online_payments, 300000)
  assert.equal(canPurchaseAddOn('storefront_video_hero', 'starter'), true)
  assert.equal(canPurchaseAddOn('storefront_video_hero', 'plus'), true)
  assert.equal(canPurchaseAddOn('storefront_video_hero', 'pro'), false)
  assert.equal(canUseFeature('pro', 'theme_video_hero'), true)
  assert.equal(canPurchaseAddOn('iyzico_online_payments', 'pro'), true)
  for (const plan of ['starter', 'plus', 'business'] as const)
    assert.equal(canPurchaseAddOn('iyzico_online_payments', plan), false)
})
test('persistent ownership survives plan transitions while usage follows the current plan', () => {
  const ownership = ['iyzico_online_payments', 'storefront_video_hero'] as const
  for (const plan of ['pro', 'starter', 'plus', 'pro'] as const) {
    assert.equal(canUseFeature(plan, 'theme_video_hero', ownership), true)
    assert.equal(
      canUseFeature(plan, 'online_payments', ownership),
      plan === 'pro',
    )
  }
})
test('return context uses the same restaurant and theme without accepting an external redirect', () => {
  assert.equal(
    addOnReturnPath('r', 'storefront_video_hero', {
      templateId: 'canonical',
      sectionId: 'storefront-video-hero',
    }),
    '/dashboard/r/theme/canonical/edit?addon=storefront_video_hero',
  )
  assert.equal(
    addOnReturnPath('r', 'iyzico_online_payments', null),
    '/dashboard/r/settings?section=payments',
  )
})
