import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const script = readFileSync(
  new URL('../../scripts/prepare-nilvera-worker-canary.ts', import.meta.url),
  'utf8',
)
const runner = readFileSync(
  new URL('../../scripts/run-nilvera-worker-canary.ts', import.meta.url),
  'utf8',
)

test('Nilvera canary is DEV-only, sandbox-only and mutation gated', () => {
  assert.match(script, /yxsegwkzyiscrxiwdeuf\.supabase\.co/)
  assert.match(script, /apitest\.nilvera\.com/)
  assert.match(script, /ACCOUNTING_DISPATCH_ENABLED, 'false'/)
  assert.match(script, /if \(!apply\)/)
})

test('Nilvera canary creates one explicitly provider-bound pending job without provider calls', () => {
  assert.match(script, /eq\('slug', CANARY_SLUG\)\.maybeSingle/)
  assert.match(script, /provider_name: 'nilvera'/)
  assert.match(script, /eq\('attempts', 0\)/)
  assert.doesNotMatch(script, /createNilveraInvoiceProvider|fetch\(/)
})

test('Nilvera canary runner admits one exact job and keeps persistent dispatch disabled', () => {
  assert.match(runner, /Persistent accounting dispatch must remain disabled/)
  assert.match(runner, /Canary must be the only Nilvera-eligible job/)
  assert.match(runner, /randomBytes\(48\)/)
  assert.match(runner, /claimed: 1, succeeded: 1/)
  assert.match(runner, /claimed: 0, succeeded: 0/)
})
