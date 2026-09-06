import assert from 'node:assert/strict'
import test from 'node:test'
import { isCampaignAudienceReady, savedFilterLimitation } from './customer-save-policy'

test('unsupported saved filters cannot silently broaden the selected audience', () => {
  assert.ok(savedFilterLimitation('', 'new'))
  assert.ok(savedFilterLimitation('Ayşe', 'frequent'))
  assert.equal(savedFilterLimitation('  ', 'frequent'), null)
  assert.equal(savedFilterLimitation('', ''), null)
})

test('sending requires a completed preview for the exact selected target', () => {
  assert.equal(isCampaignAudienceReady('all', 'all', false, 3), true)
  assert.equal(isCampaignAudienceReady('custom:vip', 'all', false, 3), false)
  assert.equal(isCampaignAudienceReady('all', 'all', true, 3), false)
  assert.equal(isCampaignAudienceReady('all', null, false, 3), false)
  assert.equal(isCampaignAudienceReady('all', 'all', false, 0), false)
})
