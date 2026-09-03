import assert from 'node:assert/strict'
import test from 'node:test'
import { createParasutOAuthPort } from './parasut-oauth-port'

test('Paraşüt OAuth port initializes, leases and rotates only opaque refresh tokens', async () => {
  const calls: Array<{ name: string; args: Record<string, unknown> }> = []
  const port = createParasutOAuthPort(async (name, args) => {
    calls.push({ name, args })
    if (name === 'initialize_parasut_refresh_token') return { data: true, error: null }
    if (name === 'claim_parasut_refresh_token') return {
      data: { refreshToken: 'refresh-token-at-least-twenty-characters', version: 2 }, error: null,
    }
    return { data: true, error: null }
  })
  assert.deepEqual(await port.initialize('refresh-token-at-least-twenty-characters'), { ok: true, value: true })
  assert.deepEqual(await port.claim('worker-1'), {
    ok: true,
    value: { refreshToken: 'refresh-token-at-least-twenty-characters', version: 2 },
  })
  assert.deepEqual(await port.rotate({
    workerId: 'worker-1', expectedVersion: 2,
    refreshToken: 'next-refresh-token-at-least-twenty-characters',
  }), { ok: true, value: true })
  assert.deepEqual(await port.release('worker-1', 3), { ok: true, value: true })
  assert.deepEqual(calls.map((call) => call.name), [
    'initialize_parasut_refresh_token',
    'claim_parasut_refresh_token',
    'rotate_parasut_refresh_token',
    'release_parasut_refresh_token',
  ])
})

test('Paraşüt OAuth port does not leak database errors or accept malformed leases', async () => {
  const failed = createParasutOAuthPort(async () => ({ data: null, error: { message: 'vault detail' } }))
  assert.deepEqual(await failed.claim('worker-1'), { ok: false, error: 'Paraşüt refresh token is unavailable' })
  const malformed = createParasutOAuthPort(async () => ({ data: { refreshToken: 'short', version: -1 }, error: null }))
  assert.deepEqual(await malformed.claim('worker-1'), { ok: false, error: 'Paraşüt token lease response is invalid' })
})
