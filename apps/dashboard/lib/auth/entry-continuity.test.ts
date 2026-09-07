import { finishEmailVerification } from './verification-completion'
import assert from 'node:assert/strict'
import test from 'node:test'
import { readEntryContext, authEntryHref, callbackMessage } from './entry-context'
import { newPasswordSchema, emailSchema, emailCodeSchema } from './password-policy'
import { signFlowGrant, readFlowGrant, sessionIdFromToken } from './flow-grant'

test('annual acquisition intent survives signup, login, callback and resume links', () => {
  const initial = readEntryContext({ plan: 'pro', interval: 'yearly' }, true)
  const link = new URL(authEntryHref('/auth/login', initial, 'owner@example.com'), 'https://app.masabu.co')
  assert.equal(link.searchParams.get('email'), 'owner@example.com')
  const restored = readEntryContext(Object.fromEntries(link.searchParams))
  assert.deepEqual(restored, initial)
  assert.deepEqual(readEntryContext({next:initial.next}),initial)
  assert.equal(new URL(initial.next,'https://app.masabu.co').searchParams.get('interval'),'yearly')
})
test('invalid plans, periods and external or auth-loop redirects cannot become entry authority', () => {
  const context = readEntryContext({plan:'business',interval:'free',next:'//evil.example'})
  assert.deepEqual(context,{plan:null,interval:'monthly',next:'/dashboard'})
  assert.equal(readEntryContext({next:'/auth/confirm?token_hash=secret'}).next,'/dashboard')
  assert.equal(readEntryContext({next:'/\\evil.example'}).next,'/dashboard')
})
test('existing user destination including invite query survives method changes', () => {
  const context = readEntryContext({next:'/dashboard/invite?token=example'})
  assert.equal(context.next,'/dashboard/invite?token=example')
})
test('new passwords require six characters, an uppercase letter, digit and special character', () => {
  for (const password of ['A1!ab', 'aa1!bc', 'Aaa!bc', 'Aaa1bc', 'Aaa1 b']) {
    assert.equal(newPasswordSchema.safeParse(password).success, false, password)
  }
  for (const password of ['A1!abc', 'AAA1!A', 'İğ1!ab', 'A1!' + 'a'.repeat(126)]) {
    assert.equal(newPasswordSchema.parse(password), password)
  }
  assert.equal(newPasswordSchema.parse('  A1!abc  '), '  A1!abc  ')
})
test('email normalization is consistent before rate limiting and authentication', () => {
  assert.equal(emailSchema.parse('  OWNER@Example.com  '),'owner@example.com')
  assert.equal(emailSchema.safeParse('invalid').success,false)
})
test('recovery grants reject tampering, wrong purpose, expiry and a different signing key', () => {
  const token=signFlowGrant({purpose:'recovery',userId:'owner',sessionId:'session-one'},'isolated-test-secret',1000)
  const read=readFlowGrant(token,'isolated-test-secret','recovery',2000)
  assert.equal(read?.sessionId,'session-one')
  assert.equal(read?.userId,'owner')
  assert.equal(readFlowGrant(token,'isolated-test-secret','complete',2000),null)
  assert.equal(readFlowGrant(token,'wrong-key','recovery',2000),null)
  assert.equal(readFlowGrant(token,'isolated-test-secret','recovery',601000),null)
  assert.equal(readFlowGrant(token+'x','isolated-test-secret','recovery',2000),null)
  assert.equal(readFlowGrant('bad-token','isolated-test-secret','recovery',2000),null)
})
test('flow grants use unique nonces and never accept a missing secret', () => {
  const input={purpose:'recovery' as const,userId:'owner',sessionId:'session'}
  assert.notEqual(signFlowGrant(input,'secret'),signFlowGrant(input,'secret'))
  assert.throws(()=>signFlowGrant(input,''))
})
test('session identity parsing refuses malformed tokens and missing session identifiers', () => {
  assert.equal(sessionIdFromToken(undefined),null)
  assert.equal(sessionIdFromToken('invalid'),null)
  assert.equal(sessionIdFromToken('x.'+Buffer.from(JSON.stringify({sub:'owner'})).toString('base64url')+'.x'),null)
  assert.equal(sessionIdFromToken('x.'+Buffer.from(JSON.stringify({session_id:'session-two'})).toString('base64url')+'.x'),'session-two')
})
test('callback errors explain a recovery action without exposing provider errors', () => {
  assert.match(callbackMessage('auth_callback_failed') ?? '',/Yeni bir bağlantı/)
  assert.equal(callbackMessage('untrusted provider text'),undefined)
})

test('six-digit email codes preserve leading zeros and reject malformed input', () => {
  assert.equal(emailCodeSchema.parse('001234'), '001234')
  assert.equal(emailCodeSchema.safeParse('466383').success, true)
  for (const value of ['12345', '1234567', 'abcdef', '', null, ' 123456']) assert.equal(emailCodeSchema.safeParse(value).success, false)
})

test('verification completion survives a transient failure without consuming a second token', async () => {
  let attempts = 0
  const operations = {clearMetadata: async () => true, refreshSession: async () => { if (++attempts === 1) throw new Error('network unavailable'); return true }}
  assert.equal(await finishEmailVerification(true, operations),false)
  assert.equal(await finishEmailVerification(true, operations),true)
  assert.equal(attempts,2)
})
test('failed verification metadata cannot be hidden by a successful refresh', async () => {
  let refreshed = false
  assert.equal(await finishEmailVerification(true,{clearMetadata:async()=>false,refreshSession:async()=>{refreshed=true;return true}}),false)
  assert.equal(refreshed,false)
  assert.equal(await finishEmailVerification(false,{clearMetadata:async()=>{throw new Error('unused')},refreshSession:async()=>true}),true)
})
