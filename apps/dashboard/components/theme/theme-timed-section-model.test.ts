import assert from 'node:assert/strict'
import test from 'node:test'

import { addSectionToPageFlow } from './theme-page-flow-model'
import {
  getTimedSectionInstances,
  pruneExpiredTimedSections,
} from './theme-timed-section-model'

const deadline = Date.parse('2026-07-25T12:00:00.000Z')

test('timed discount instances expose their exact absolute deadline', () => {
  const blocks = [
    { type: 'nav' as const, id: 'category-nav' },
    { type: 'section' as const, id: 'discount-badge' },
  ]
  assert.deepEqual(getTimedSectionInstances(blocks, {
    'discount-badge': {
      countdownEnabled: 'true',
      campaignEndsAt: '2026-07-25T12:00:00.000Z',
    },
  }, deadline - 1_000), [{ id: 'discount-badge', endsAtMs: deadline }])
})

test('timed daily special is pruned from both page flow and settings at expiry', () => {
  const blocks = [
    { type: 'section' as const, id: 'daily-home', sectionId: 'daily-special' },
    { type: 'category' as const, id: 'coffee' },
  ]
  const result = pruneExpiredTimedSections(blocks, {
    'daily-home': {
      productId: 'coffee',
      countdownEnabled: 'true',
      campaignEndsAt: '2026-07-25T12:00:00.000Z',
    },
  }, deadline)

  assert.deepEqual(result.expiredIds, ['daily-home'])
  assert.deepEqual(result.pageBlocks, [blocks[1]])
  assert.equal(result.sectionSettings['daily-home'], undefined)
  assert.deepEqual(addSectionToPageFlow(result.pageBlocks, 'daily-special'), [
    { type: 'section', id: 'daily-special' },
    blocks[1],
  ])
})

test('expired campaign is removed from page flow and settings, then re-adds as a fresh first instance', () => {
  const blocks = [
    { type: 'nav' as const, id: 'category-nav' },
    { type: 'section' as const, id: 'discount-badge' },
    { type: 'category' as const, id: 'coffee' },
  ]
  const result = pruneExpiredTimedSections(blocks, {
    'discount-badge': {
      countdownEnabled: 'true',
      campaignEndsAt: '2026-07-25T12:00:00.000Z',
      productId: 'latte',
    },
    'promo-strip': { text: 'Açığız' },
  }, deadline)

  assert.deepEqual(result.expiredIds, ['discount-badge'])
  assert.deepEqual(result.pageBlocks, [blocks[0], blocks[2]])
  assert.equal(result.sectionSettings['discount-badge'], undefined)
  assert.deepEqual(result.sectionSettings['promo-strip'], { text: 'Açığız' })
  assert.deepEqual(addSectionToPageFlow(result.pageBlocks, 'discount-badge'), [
    blocks[0],
    blocks[1],
    blocks[2],
  ])
})

test('active, malformed and non-timed sections are not pruned', () => {
  const blocks = [
    { type: 'section' as const, id: 'discount-badge' },
    { type: 'section' as const, id: 'discount-badge--2', sectionId: 'discount-badge' },
    { type: 'section' as const, id: 'hero-banner' },
  ]
  const settings = {
    'discount-badge': {
      countdownEnabled: 'true',
      campaignEndsAt: '2026-07-25T12:00:01.000Z',
    },
    'discount-badge--2': {
      countdownEnabled: 'true',
      campaignEndsAt: 'not-a-date',
    },
  }
  const result = pruneExpiredTimedSections(blocks, settings, deadline)
  assert.deepEqual(result.expiredIds, [])
  assert.equal(result.pageBlocks, blocks)
  assert.equal(result.sectionSettings, settings)
})
