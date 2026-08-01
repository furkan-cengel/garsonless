import { loadEnvFile } from 'node:process'
import { fileURLToPath } from 'node:url'
import { createClient, createServiceClient } from '../src/client'
import { getSmsDeliveryAvailability } from '../src/sms'

const root = fileURLToPath(new URL('../../../', import.meta.url))
if (!process.env['NEXT_PUBLIC_SUPABASE_URL']) loadEnvFile(`${root}apps/dashboard/.env.local`)

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

async function main() {
  const service = createServiceClient()

  const availability = getSmsDeliveryAvailability()
  assert(!availability.enabled, 'SMS delivery unexpectedly became active')

  const [campaignShape, recipientShape] = await Promise.all([
    service
      .from('campaigns')
      .select('request_id, request_fingerprint, skipped_consent_count, skipped_phone_count, skipped_duplicate_count')
      .limit(0),
    service
      .from('campaign_recipients')
      .select('normalized_phone')
      .limit(0),
  ])
  if (campaignShape.error) throw campaignShape.error
  if (recipientShape.error) throw recipientShape.error

  const syntheticCases = [
    ['0532 123 45 67', '+905321234567'],
    ['+90 532 123 45 67', '+905321234567'],
    ['0090 532 123 45 67', '+905321234567'],
    ['0312 123 45 67', null],
    ['not-a-phone', null],
  ] as const
  for (const [input, expected] of syntheticCases) {
    const result = await service.rpc('normalize_sms_phone', { p_value: input })
    if (result.error) throw result.error
    assert(result.data === expected, 'DEV SMS phone normalization diverged from the canonical contract')
  }

  const anonymous = createClient()
  const [anonymousNormalize, anonymousQueue] = await Promise.all([
    anonymous.rpc('normalize_sms_phone', { p_value: '0532 123 45 67' }),
    anonymous.rpc('queue_campaign_delivery_atomic', {
      p_request_id: '00000000-0000-4000-8000-000000000001',
      p_request_fingerprint: '0'.repeat(64),
      p_restaurant_id: '00000000-0000-4000-8000-000000000002',
      p_name: 'permission-check',
      p_message_body: 'permission-check',
      p_segment_kind: 'all',
      p_builtin_segment: null,
      p_custom_segment_id: null,
      p_segment_definition: {},
      p_created_by: '00000000-0000-4000-8000-000000000003',
      p_contacts: [],
      p_segment_label: 'permission-check',
    }),
  ])
  assert(
    anonymousNormalize.error?.message.toLowerCase().includes('permission denied'),
    'Anonymous role unexpectedly executed normalize_sms_phone',
  )
  assert(
    anonymousQueue.error?.message.toLowerCase().includes('permission denied'),
    'Anonymous role unexpectedly reached the campaign queue function',
  )

  console.log(JSON.stringify({
    mutationPerformed: false,
    smsSent: false,
    productionTouched: false,
    delivery: {
      enabled: false,
      failClosedReason: availability.reason,
    },
    schema: {
      campaignSafetyColumnsReadable: true,
      normalizedRecipientPhoneColumnReadable: true,
      normalizationCasesPassed: syntheticCases.length,
    },
    security: {
      anonymousNormalizeRejected: true,
      anonymousQueueRejectedBeforeExecution: true,
      serviceQueueCalled: false,
    },
  }, null, 2))
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Slice 4 runtime verification failed')
  process.exitCode = 1
})
