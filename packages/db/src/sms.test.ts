import { test } from 'node:test'
import assert from 'node:assert/strict'
import { assertSmsConfig, getSmsProvider, __resetSmsProviderCacheForTests } from './sms'

// Env keys the SMS config guard reads. Snapshot → override → restore so tests
// never leak env into each other (or into the wider db suite).
const KEYS = [
  'NODE_ENV',
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

test('assertSmsConfig: dev + mock is allowed (local dev must keep working)', () => {
  withEnv({ NODE_ENV: 'development', SMS_PROVIDER: 'mock' }, () => {
    assert.doesNotThrow(() => assertSmsConfig())
  })
})

test('assertSmsConfig: PROD + mock THROWS (silent-outage killer)', () => {
  withEnv({ NODE_ENV: 'production', SMS_PROVIDER: 'mock' }, () => {
    assert.throws(() => assertSmsConfig(), /mock provider under NODE_ENV=production/)
  })
})

test('assertSmsConfig: PROD + SMS_PROVIDER unset THROWS (default must not silently apply)', () => {
  withEnv({ NODE_ENV: 'production', SMS_PROVIDER: undefined }, () => {
    assert.throws(() => assertSmsConfig(), /mock provider under NODE_ENV=production/)
  })
})

test('assertSmsConfig: PROD + netgsm + full creds does NOT throw', () => {
  withEnv({ NODE_ENV: 'production', SMS_PROVIDER: 'netgsm', ...NETGSM_CREDS }, () => {
    assert.doesNotThrow(() => assertSmsConfig())
  })
})

test('assertSmsConfig: PROD + netgsm missing NETGSM_MSGHEADER THROWS', () => {
  withEnv(
    { NODE_ENV: 'production', SMS_PROVIDER: 'netgsm', NETGSM_USERCODE: 'u', NETGSM_PASSWORD: 'p' },
    () => {
      assert.throws(() => assertSmsConfig(), /NETGSM_MSGHEADER is not set/)
    },
  )
})

test('assertSmsConfig: PROD + twilio missing creds THROWS', () => {
  withEnv({ NODE_ENV: 'production', SMS_PROVIDER: 'twilio' }, () => {
    assert.throws(() => assertSmsConfig(), /SMS_PROVIDER=twilio but TWILIO_ACCOUNT_SID is not set/)
  })
})

test('assertSmsConfig: PROD + twilio + full creds does NOT throw', () => {
  withEnv({ NODE_ENV: 'production', SMS_PROVIDER: 'twilio', ...TWILIO_CREDS }, () => {
    assert.doesNotThrow(() => assertSmsConfig())
  })
})

test('assertSmsConfig: customer session secret is retired from SMS validation', () => {
  withEnv({ NODE_ENV: 'development', SMS_PROVIDER: 'mock' }, () => {
    assert.doesNotThrow(() => assertSmsConfig())
  })
})

// ── getSmsProvider defense-in-depth ─────────────────────────────────────────

test('getSmsProvider: PROD + mock THROWS (before returning any provider)', () => {
  withEnv({ NODE_ENV: 'production', SMS_PROVIDER: 'mock' }, () => {
    assert.throws(() => getSmsProvider(), /mock provider under NODE_ENV=production/)
  })
})

test('getSmsProvider: PROD + netgsm returns the netgsm provider (no throw)', () => {
  withEnv({ NODE_ENV: 'production', SMS_PROVIDER: 'netgsm', ...NETGSM_CREDS }, () => {
    const provider = getSmsProvider()
    assert.equal(provider.name, 'netgsm')
  })
})

test('getSmsProvider: dev + mock returns the mock provider (happy path unchanged)', () => {
  withEnv({ NODE_ENV: 'development', SMS_PROVIDER: 'mock' }, () => {
    const provider = getSmsProvider()
    assert.equal(provider.name, 'mock')
  })
})
