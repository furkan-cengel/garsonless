import assert from 'node:assert/strict'
import test from 'node:test'
import { additionalFeatures, FEATURE_LABELS, selectablePlans } from '../plan-lock/plan-selection'

test('reports offer both Plus and Pro while Pro-only locks exclude Plus', () => {
  assert.deepEqual(selectablePlans('starter', 'analytics_basic', false), ['plus', 'pro'])
  assert.deepEqual(selectablePlans('starter', 'customer_accounts', false), ['pro'])
  assert.deepEqual(selectablePlans('plus', 'analytics_advanced', false), ['pro'])
})

test('expired access can renew the current plan, never suggests a downgrade or an add-on as a plan', () => {
  assert.deepEqual(selectablePlans('plus', 'analytics_basic', true), ['plus', 'pro'])
  assert.deepEqual(selectablePlans('pro', 'analytics_basic', true), ['pro'])
  assert.deepEqual(selectablePlans('business', 'analytics_basic', true), [])
  assert.deepEqual(selectablePlans('starter', 'online_payments', false), [])
})

test('comparison marks only newly included features, without bundling the paid payment add-on', () => {
  const plus = additionalFeatures('starter', 'plus')
  assert(plus.includes('analytics_basic'))
  assert(!plus.includes('qr_menu'))
  assert(!plus.includes('customer_accounts'))
  const pro = additionalFeatures('plus', 'pro')
  assert(pro.includes('analytics_advanced'))
  assert(pro.includes('customer_accounts'))
  assert(!pro.includes('analytics_basic'))
  assert(!pro.includes('online_payments'))
  assert.deepEqual(additionalFeatures('pro', 'pro'), [])
  for (const feature of [...plus, ...pro]) assert(FEATURE_LABELS[feature])
})
