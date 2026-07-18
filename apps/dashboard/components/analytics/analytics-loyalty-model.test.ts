import assert from 'node:assert/strict'
import test from 'node:test'
import type { LoyaltyReport } from '../../lib/queries'
import { projectLoyaltyReport, resolveLoyaltyReasonLabel } from './analytics-loyalty-model'

function loyalty(overrides: Partial<LoyaltyReport> = {}): LoyaltyReport {
  return {
    pointsIssued: 0,
    pointsRedeemed: 0,
    redeemRate: 0,
    pointsRefunded: 0,
    stampsIssued: 0,
    stampsRedeemed: 0,
    stampsRefunded: 0,
    visits: 0,
    welcomeCount: 0,
    welcomePoints: 0,
    redemptionsByReason: [],
    comp: { amount: 0, count: 0 },
    ...overrides,
  }
}

test('empty loyalty projection fails closed with stable zero-value stat rows', () => {
  const report = projectLoyaltyReport(loyalty())

  assert.equal(report.hasActivity, false)
  assert.equal(report.compDelta, 'tahsilat dışı')
  assert.deepEqual(report.stampRows, [
    { label: 'Kazanılan', value: 0 },
    { label: 'Kullanılan', value: 0 },
    { label: 'İade', value: 0 },
  ])
})

test('comp activity remains visible but explicitly outside collected revenue', () => {
  const report = projectLoyaltyReport(loyalty({ comp: { amount: 90, count: 2 } }))

  assert.equal(report.hasActivity, true)
  assert.equal(report.compDelta, '2 adet · tahsilat dışı')
})

test('loyalty projection keeps welcome and refund facts in separate cards', () => {
  const report = projectLoyaltyReport(loyalty({
    welcomeCount: 3,
    welcomePoints: 150,
    pointsRefunded: 40,
    stampsRefunded: 2,
  }))

  assert.equal(report.hasActivity, true)
  assert.deepEqual(report.welcomeRows, [
    { label: 'Üye', value: 3 },
    { label: 'Puan', value: 150 },
  ])
  assert.deepEqual(report.refundRows, [
    { label: 'Puan iadesi', value: 40 },
    { label: 'Damga iadesi', value: 2 },
  ])
})

test('known redemption reason is localized while unknown ledger reasons stay raw', () => {
  assert.equal(resolveLoyaltyReasonLabel('redeem'), 'Puan / damga kullanımı')
  assert.equal(resolveLoyaltyReasonLabel('campaign-special'), 'campaign-special')
})
