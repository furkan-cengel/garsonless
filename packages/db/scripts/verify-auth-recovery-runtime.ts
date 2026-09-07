import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { createServiceClient } from '../src/service-client'
import { findDashboardRecoveryEmail } from '../src/dashboard-recovery-intent'
import { recordDashboardRecoveryEmail } from '../supabase/functions/send-email-hook/recovery-intent'
import { consumeDashboardAuthRateLimit } from '../src/dashboard-settings-security-port'
const url = new URL(process.env['NEXT_PUBLIC_SUPABASE_URL'] ?? '')
assert.ok(['127.0.0.1','localhost'].includes(url.hostname), 'This test may only use an isolated local database')
const service = createServiceClient()
const email = 'recovery-runtime-' + randomUUID() + '@example.test'
const created = await service.auth.admin.createUser({email,password:'local integration password only',email_confirm:true})
assert.ifError(created.error)
const userId = created.data.user!.id
try {
 const base={userId,email,redirectTo:'http://localhost:3002/auth/confirm?flow=recovery',supabaseUrl:url.origin,serviceKey:process.env['SUPABASE_SERVICE_ROLE_KEY']!}
 const magic=await service.auth.admin.generateLink({type:'magiclink',email})
 assert.ifError(magic.error)
 const mp=magic.data.properties!
 await recordDashboardRecoveryEmail({...base,actionType:'magiclink',token:mp.email_otp,tokenHash:mp.hashed_token})
 assert.equal(await findDashboardRecoveryEmail({tokenHash:mp.hashed_token}),null)
 assert.equal(await findDashboardRecoveryEmail({email,code:mp.email_otp}),null)
 const recovery=await service.auth.admin.generateLink({type:'recovery',email})
 assert.ifError(recovery.error)
 const rp=recovery.data.properties!
 await recordDashboardRecoveryEmail({...base,actionType:'recovery',token:rp.email_otp,tokenHash:rp.hashed_token})
 assert.deepEqual(await findDashboardRecoveryEmail({tokenHash:rp.hashed_token}),{userId})
 assert.deepEqual(await findDashboardRecoveryEmail({email,code:rp.email_otp}),{userId})
 assert.equal(await findDashboardRecoveryEmail({email:'different@example.test',code:rp.email_otp}),null)
 const nonce=randomUUID()
 const attempts=await Promise.all(Array.from({length:5},()=>consumeDashboardAuthRateLimit({action:'recovery-consume',subject:nonce,limit:1,windowSeconds:3600})))
 assert.equal(attempts.filter(result=>result.ok && result.allowed).length,1)
 const expired=await service.from('dashboard_recovery_email_intents').update({expires_at:new Date(Date.now()-1000).toISOString()}).eq('token_hash',rp.hashed_token)
 assert.ifError(expired.error)
 assert.equal(await findDashboardRecoveryEmail({tokenHash:rp.hashed_token}),null)
 const denied=await fetch(url.origin+'/rest/v1/dashboard_recovery_email_intents?select=*',{headers:{apikey:process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY']!,Authorization:'Bearer '+process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY']!}})
 assert.equal(denied.ok,false)
 console.log('PASS: real recovery intent by hash/code, wrong purpose/email, expiry, anonymous denial and five concurrent single-use attempts')
} finally {
 await service.auth.admin.deleteUser(userId)
}
