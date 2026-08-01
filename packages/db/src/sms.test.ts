import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  assertSmsConfig,
  getSmsDeliveryAvailability,
  getSmsProvider,
  __resetSmsProviderCacheForTests,
} from './sms'

// Env keys the SMS config guard reads. Snapshot → override → restore so tests
// never leak env into each other (or into the wider db suite).
const KEYS = [
  'NODE_ENV',
  'SMS_DELIVERY_ENABLED',
  'SMS_ALLOW_MOCK',
  'SMS_PROVIDER',
  'NETGSM_USERCODE',
  'NETGSM_PASSWORD',
  'NETGSM_MSGHEADER',
  'TWILIO_ACCOUNT_SID',
  'TWILIO_AUTH_TOKEN',
  'TWILIO_FROM',
] as const

function withEnv(overrides: Record<string, string | undefined>, fn: () => void): void {
  const snapshot: Record<string, string | undefined> = {}
  for (const k of KEYS) snapshot[k] = process.env[k]
  // Start from a clean slate for the keys under test.
  for (const k of KEYS) delete process.env[k]
  for (const [k, v] of Object.entries(overrides)) {
    if (v === undefined) delete process.env[k]
    else process.env[k] = v
  }
  __resetSmsProviderCacheForTests()
  try {
    fn()
  } finally {
    for (const k of KEYS) {
      if (snapshot[k] === undefined) delete process.env[k]
      else process.env[k] = snapshot[k]
    }
    __resetSmsProviderCacheForTests()
  }
}

const NETGSM_CREDS = { NETGSM_USERCODE: 'u', NETGSM_PASSWORD: 'p', NETGSM_MSGHEADER: 'GARSONLESS' }
const TWILIO_CREDS = { TWILIO_ACCOUNT_SID: 'AC', TWILIO_AUTH_TOKEN: 't', TWILIO_FROM: '+1' }

// ── assertSmsConfig ─────────────────────────────────────────────────────────

test('SMS delivery defaults to disabled and never resolves a provider', () => {
  withEnv({ NODE_ENV: 'development' }, () => {
    assert.deepEqual(getSmsDeliveryAvailability(), { enabled: false, provider: null, reason: 'disabled' })
    assert.doesNotThrow(() => assertSmsConfig())
    assert.throws(() => getSmsProvider(), /SMS gönderimi henüz etkin değil/)
  })
})

test('enabled production delivery rejects mock even when the test escape hatch is set', () => {
  withEnv({ NODE_ENV: 'production', SMS_DELIVERY_ENABLED: 'true', SMS_PROVIDER: 'mock', SMS_ALLOW_MOCK: 'true' }, () => {
    assert.throws(() => assertSmsConfig(), /real provider is not configured/)
    assert.throws(() => getSmsProvider(), /SMS gönderimi henüz etkin değil/)
  })
})

test('enabled delivery with an unset provider fails closed', () => {
  withEnv({ NODE_ENV: 'production', SMS_DELIVERY_ENABLED: 'true' }, () => {
    assert.deepEqual(getSmsDeliveryAvailability(), { enabled: false, provider: null, reason: 'provider_missing' })
    assert.throws(() => assertSmsConfig(), /real provider is not configured/)
  })
})

test('enabled production netgsm with complete credentials is ready', () => {
  withEnv({ NODE_ENV: 'production', SMS_DELIVERY_ENABLED: 'true', SMS_PROVIDER: 'netgsm', ...NETGSM_CREDS }, () => {
    assert.deepEqual(getSmsDeliveryAvailability(), { enabled: true, provider: 'netgsm', reason: 'ready' })
    assert.doesNotThrow(() => assertSmsConfig())
  })
})

test('enabled netgsm with a missing credential fails closed', () => {
  withEnv(
    { NODE_ENV: 'production', SMS_DELIVERY_ENABLED: 'true', SMS_PROVIDER: 'netgsm', NETGSM_USERCODE: 'u', NETGSM_PASSWORD: 'p' },
    () => {
      assert.throws(() => assertSmsConfig(), /NETGSM_MSGHEADER is not set/)
    },
  )
})

test('enabled twilio with missing credentials fails closed', () => {
  withEnv({ NODE_ENV: 'production', SMS_DELIVERY_ENABLED: 'true', SMS_PROVIDER: 'twilio' }, () => {
    assert.throws(() => assertSmsConfig(), /SMS_PROVIDER=twilio but TWILIO_ACCOUNT_SID is not set/)
  })
})

test('enabled production twilio with complete credentials is ready', () => {
  withEnv({ NODE_ENV: 'production', SMS_DELIVERY_ENABLED: 'true', SMS_PROVIDER: 'twilio', ...TWILIO_CREDS }, () => {
    assert.doesNotThrow(() => assertSmsConfig())
  })
})

test('getSmsProvider returns a configured real provider only after activation', () => {
  withEnv({ NODE_ENV: 'production', SMS_DELIVERY_ENABLED: 'true', SMS_PROVIDER: 'netgsm', ...NETGSM_CREDS }, () => {
    const provider = getSmsProvider()
    assert.equal(provider.name, 'netgsm')
  })
})

test('hermetic mock requires both explicit activation and the non-production escape hatch', () => {
  withEnv({ NODE_ENV: 'test', SMS_DELIVERY_ENABLED: 'true', SMS_PROVIDER: 'mock', SMS_ALLOW_MOCK: 'true' }, () => {
    const provider = getSmsProvider()
    assert.equal(provider.name, 'mock')
  })
})
