import assert from 'node:assert/strict'
import test from 'node:test'
import { err, ok, type CampaignSummary } from '@garsonless/domain'
import {
  previewCustomerCampaign,
  readCampaigns,
  sendCustomerCampaign,
  sendCustomerCampaignTest,
  type CampaignApplicationPort,
} from './campaigns'

const actor = {
  actor: 'dashboard-member' as const,
  userId: 'staff-a',
  restaurantId: 'restaurant-a',
  permissions: ['customers'],
  isOwner: true,
}

const summary: CampaignSummary = {
  id: 'campaign-a', restaurantId: 'restaurant-a', name: 'Test', messageBody: 'Merhaba',
  channel: 'email', subject: 'Duyuru',
  contentMode: 'template', templateId: 'announcement', emailDesign: null,
  segmentKind: 'all', builtinSegment: null, customSegmentId: null, status: 'sent',
  recipientCount: 1, sentCount: 1, failedCount: 0, skippedCount: 0,
  sentAt: 'now', createdAt: 'now',
}

function port(): CampaignApplicationPort {
  return {
    list: async () => ok([summary]),
    preview: async () => ok({ channel: 'email', totalCandidates: 1, eligibleRecipients: 1, skippedNoMarketingConsent: 0, skippedInvalidContact: 0, skippedDuplicateContact: 0, segmentLabel: 'Tümü' }),
    sendTest: async () => ok({ messageId: 'message-a' }),
    send: async () => ({ ok: true, campaign: summary, replayed: false, preview: { channel: 'email', totalCandidates: 1, eligibleRecipients: 1, skippedNoMarketingConsent: 0, skippedInvalidContact: 0, skippedDuplicateContact: 0, segmentLabel: 'Tümü' } }),
  }
}

test('campaign reads and writes reject cross-tenant and missing permission before ports', async () => {
  const adapter = port()
  let called = false
  adapter.list = async () => { called = true; return ok([]) }
  assert.deepEqual(await readCampaigns(actor, { restaurantId: 'restaurant-b' }, adapter), err('Not authorized'))
  assert.deepEqual(await previewCustomerCampaign({ ...actor, permissions: [], isOwner: false }, { restaurantId: 'restaurant-a', channel: 'email', audience: {} }, adapter), err('Not authorized'))
  assert.deepEqual(await sendCustomerCampaignTest({ ...actor, isOwner: false }, { restaurantId: 'restaurant-a', phone: '+905321234567', message: 'Merhaba' }, adapter), err('Not authorized'))
  assert.equal(called, false)
})

test('campaign commands derive audit identity and normalize transport input', async () => {
  const adapter = port()
  let testAudit = ''
  let campaignAudit = ''
  let requestId = ''
  let message = ''
  adapter.sendTest = async (input) => {
    testAudit = input.createdBy
    message = input.message
    return ok({})
  }
  adapter.send = async (input) => {
    campaignAudit = input.createdBy
    requestId = input.requestId
    return { ok: true, campaign: summary, replayed: false, preview: { channel: 'email', totalCandidates: 0, eligibleRecipients: 0, skippedNoMarketingConsent: 0, skippedInvalidContact: 0, skippedDuplicateContact: 0, segmentLabel: 'Tümü' } }
  }
  await sendCustomerCampaignTest(actor, { restaurantId: 'restaurant-a', phone: '+905321234567', message: '  Merhaba\n dünya  ' }, adapter)
  await sendCustomerCampaign(actor, { restaurantId: 'restaurant-a', requestId: 'b7e9d88d-5a25-4a66-951f-4ea3ded5b8fb', channel: 'email', name: ' Duyuru ', subject: ' Haber ', message: ' Merhaba ', audience: { segmentKind: 'builtin', builtinSegment: 'new' } }, adapter)
  assert.equal(testAudit, 'staff-a')
  assert.equal(campaignAudit, 'staff-a')
  assert.equal(requestId, 'b7e9d88d-5a25-4a66-951f-4ea3ded5b8fb')
  assert.equal(message, 'Merhaba dünya')
})

test('campaign send rejects a malformed request id before persistence', async () => {
  const adapter = port()
  let called = false
  adapter.send = async () => {
    called = true
    return { ok: false, error: 'unexpected' }
  }
  const result = await sendCustomerCampaign(actor, {
    restaurantId: 'restaurant-a', requestId: 'retry-me', channel: 'email', name: 'Duyuru', subject: 'Haber', message: 'Merhaba', audience: {},
  }, adapter)
  assert.deepEqual(result, { ok: false, error: 'Geçersiz istek kimliği' })
  assert.equal(called, false)
})
