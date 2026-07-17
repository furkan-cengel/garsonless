import assert from 'node:assert/strict'
import test from 'node:test'
import {
  normalizeCampaignAudience,
  sanitizeCampaignMessage,
  sanitizeCampaignName,
} from './campaigns'

test('campaign copy is whitespace-normalized and transport bounded', () => {
  assert.equal(sanitizeCampaignMessage('  Merhaba\n\nMasabu  '), 'Merhaba Masabu')
  assert.equal(sanitizeCampaignMessage('x'.repeat(500)).length, 459)
  assert.equal(sanitizeCampaignName('', new Date('2026-07-16T12:00:00Z')), 'SMS 16.07')
})

test('campaign audiences fall back safely and keep the closed builtin vocabulary', () => {
  assert.deepEqual(normalizeCampaignAudience({ segmentKind: 'builtin', builtinSegment: 'frequent' }), {
    segmentKind: 'builtin', builtinSegment: 'frequent', customSegmentId: null,
  })
  assert.deepEqual(normalizeCampaignAudience({ segmentKind: 'custom', customSegmentId: 'segment-id' }), {
    segmentKind: 'custom', builtinSegment: null, customSegmentId: 'segment-id',
  })
  assert.deepEqual(normalizeCampaignAudience({ segmentKind: 'builtin', builtinSegment: null }), {
    segmentKind: 'all', builtinSegment: null, customSegmentId: null,
  })
})
