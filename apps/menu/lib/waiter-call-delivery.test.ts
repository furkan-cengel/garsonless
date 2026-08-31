import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const source = readFileSync(new URL('./hooks/useWaiterCall.ts', import.meta.url), 'utf8')

test('a stale called state never reports success without contacting the server', () => {
  assert.doesNotMatch(source, /if \(callState === 'called'\) return true/)
  assert.match(source, /if \(callState === 'calling'\) return false/)
  assert.match(source, /fetch\('\/api\/service-request'/)
})
