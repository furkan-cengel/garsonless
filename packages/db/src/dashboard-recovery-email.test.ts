import test from 'node:test'
import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import { recordDashboardRecoveryEmail } from '../supabase/functions/send-email-hook/recovery-intent'
const input = {actionType:'recovery',redirectTo:'https://app.masabu.co/auth/confirm?flow=recovery',userId:'owner',email:'OWNER@example.com',token:'001234',tokenHash:'pkce_test_recovery_hash',supabaseUrl:'http://127.0.0.1:55321',serviceKey:'isolated-test-key'}
test('only a dashboard recovery email creates token and code purpose evidence', async () => {
 let captured: Record<string,unknown> | undefined
 await recordDashboardRecoveryEmail(input, async (_url, init) => {captured=JSON.parse(String(init?.body));return new Response('',{status:201})})
 assert.equal(captured?.token_hash,input.tokenHash)
 assert.equal(captured?.user_id,'owner')
 assert.equal(captured?.email,'owner@example.com')
 assert.equal(captured?.otp_digest,createHmac('sha256',input.serviceKey).update('masabu-recovery-code:owner@example.com:001234').digest('hex'))
 assert.ok(Date.parse(String(captured?.expires_at))>Date.now())
})
test('magic links, menu, invites and untrusted redirects cannot mint recovery evidence', async () => {
 for (const change of [{actionType:'magiclink'},{actionType:'signup'},{actionType:'invite'},{redirectTo:'https://menu.masabu.co/auth/confirm?flow=recovery'},{redirectTo:'https://evil.example/auth/confirm?flow=recovery'}]) {
  await recordDashboardRecoveryEmail({...input,...change},async()=>{throw new Error('Must not write evidence')})
 }
})
test('recovery email delivery fails closed if trusted evidence cannot be stored', async () => {
 await assert.rejects(()=>recordDashboardRecoveryEmail({...input,serviceKey:''}))
 await assert.rejects(()=>recordDashboardRecoveryEmail(input,async()=>new Response('',{status:503})))
})
