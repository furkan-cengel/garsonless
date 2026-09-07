import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
const require=createRequire(import.meta.url)
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
const {encodeReply}=require('next/dist/compiled/react-server-dom-webpack/client.node') as {encodeReply:(value:unknown)=>Promise<FormData|string>}
const env={API_URL:process.env['NEXT_PUBLIC_SUPABASE_URL'],ANON_KEY:process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY'],SERVICE_ROLE_KEY:process.env['SUPABASE_SERVICE_ROLE_KEY']}
assert.ok(env.ANON_KEY&&env.SERVICE_ROLE_KEY,'Isolated test credentials required')
assert.equal(env.API_URL,'http://127.0.0.1:55321')
const app='http://localhost:3002', ua='Masabu security runtime'
const admin=createClient(env.API_URL,env.SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}})
const email='device-'+randomUUID()+'@example.test'
const made=await admin.auth.admin.createUser({email,password:'Aa1!test-password',email_confirm:true});assert.ifError(made.error)
const user=made.data.user!
const jar=new Map<string,string>()
const client=createServerClient(env.API_URL,env.ANON_KEY,{cookies:{getAll:()=>[...jar].map(([name,value])=>({name,value})),setAll:(values:Array<{name:string;value:string}>)=>{for(const v of values)jar.set(v.name,v.value)}}})
function absorb(response:Response){for(const c of response.headers.getSetCookie()){const pair=c.split(';')[0]!;const equals=pair.indexOf('=');jar.set(pair.slice(0,equals),pair.slice(equals+1))}}
async function request(path:string,options:RequestInit={},agent=ua){const result=await fetch(app+path,{...options,redirect:'manual',headers:{Cookie:[...jar].map(([k,v])=>k+'='+v).join('; '),'User-Agent':agent,...options.headers}});absorb(result);return result}
function actionId(name:string){const manifest=JSON.parse(readFileSync('.next-auth-audit/server/server-reference-manifest.json','utf8'));const id=Object.keys(manifest.node).find(k=>manifest.node[k].exportedName===name);assert.ok(id,'Action compiled: '+name);return id}
async function action(name:string,fields:Record<string,string>){const data=new FormData();for(const [k,v] of Object.entries(fields))data.set(k,v);const body=await encodeReply([null,data]);const response=await request('/auth/device-verification',{method:'POST',headers:{Origin:app,'Next-Action':actionId(name)},body});const text=await response.text();return {response,text}}
try{
 const login=await client.auth.signInWithPassword({email,password:'Aa1!test-password'});assert.ifError(login.error)
 const sessionId=JSON.parse(Buffer.from(login.data.session!.access_token.split('.')[1]!,'base64url').toString()).session_id
 const initial=await request('/auth/device-verification?next=%2Fdashboard');assert.equal(initial.status,200);assert.match(await initial.text(),/Girişini doğrula/)
 const blocked=await client.from('restaurants').select('id').limit(1);assert.equal(blocked.error?.code,'PT403','Direct PostgREST rejects unverified session')
 const send=await action('sendDeviceCode',{});assert.match(send.text,/"success":true/,'Actual email action succeeds: '+send.text.slice(0,200))
 let code=''
 for(let i=0;i<10&&!code;i++){
  const list=await (await fetch('http://127.0.0.1:55324/api/v1/messages')).json()
  const mail=list.messages?.find((m:{To?:Array<{Address:string}>;ID:string})=>m.To?.some(to=>to.Address===email))
  if(mail){const message=await (await fetch('http://127.0.0.1:55324/api/v1/message/'+mail.ID)).json();code=message.Text?.match(/kodun: (\d{6})/)?.[1]??message.HTML?.match(/font-weight:bold">(\d{6})/)?.[1]??''}
  if(!code)await new Promise(r=>setTimeout(r,100))
 }
 assert.match(code,/^\d{6}$/,'Email contains usable code')
 const resend=await action('sendDeviceCode',{});assert.match(resend.text,/RATE_LIMITED/)
 const wrong=await action('verifyDeviceCode',{code:code==='000000'?'999999':'000000',trustDevice:'on'});assert.match(wrong.text,/INVALID/)
 const attempts=await admin.from('dashboard_device_challenges').select('attempts').eq('user_id',user.id).single();assert.equal(attempts.data?.attempts,1,wrong.text)
 const results=await Promise.all([action('verifyDeviceCode',{code,trustDevice:'on',next:'/dashboard'}),action('verifyDeviceCode',{code,trustDevice:'on',next:'/dashboard'})])
 assert.equal(results.filter(r=>r.response.headers.get('x-action-redirect')).length,1,'Concurrent verification consumes once')
 assert.equal(results.filter(r=>r.text.includes('EXPIRED')).length,1)
 const allowed=await client.from('restaurants').select('id').limit(1);assert.ifError(allowed.error)
 const evidence=await admin.from('dashboard_verified_sessions').select('*').eq('session_id',sessionId).single();assert.ifError(evidence.error)
 const expiry=Date.parse(evidence.data!.expires_at);assert.ok(expiry-Date.now()>14.99*86400000&&expiry-Date.now()<=15*86400000)
 const trusted=await request('/auth/device-verification');assert.equal(trusted.status,307)
 const renewedLogin=await client.auth.signInWithPassword({email,password:'Aa1!test-password'});assert.ifError(renewedLogin.error)
 const rememberedLogin=await request('/auth/device-verification');assert.equal(rememberedLogin.status,307,'Remembered device survives a new password login without another OTP')
 const renewedRead=await client.from('restaurants').select('id').limit(1);assert.ifError(renewedRead.error)
 const staleCookie=jar.get('masabu_trusted_device')!
 jar.delete('masabu_trusted_device')
 const newBrowser=await request('/auth/device-verification');assert.equal(newBrowser.status,200)
 const invalidated=await client.from('restaurants').select('id').limit(1);assert.equal(invalidated.error?.code,'PT403')
 jar.set('masabu_trusted_device',staleCookie)
 const original=await request('/auth/device-verification');assert.equal(original.status,307,'Trusted original browser restores session access')
 await admin.from('dashboard_verified_sessions').update({expires_at:new Date(Date.now()-1000).toISOString()}).eq('user_id',user.id)
 await admin.from('dashboard_trusted_devices').update({expires_at:new Date(Date.now()-1000).toISOString()}).eq('user_id',user.id)
 const expired=await request('/auth/device-verification');assert.equal(expired.status,200);assert.match(await expired.text(),/güven süresi doldu/)
 const expiredRest=await client.from('restaurants').select('id').limit(1);assert.equal(expiredRest.error?.code,'PT403')
 const link=await admin.auth.admin.generateLink({type:'magiclink',email});assert.ifError(link.error)
 await request('/auth/confirm?flow=magiclink')
 const native=await action('verifyEmailToken',{token_hash:link.data.properties!.hashed_token,flow:'magiclink',next:'/dashboard'})
 assert.ok(native.response.headers.get('x-action-redirect'),'Native email verification completes without a second code')
 const nativeEvidence=await admin.from('dashboard_verified_sessions').select('expires_at').eq('user_id',user.id).is('revoked_at',null).gt('expires_at',new Date().toISOString())
 assert.ok(nativeEvidence.data?.some(row=>Date.parse(row.expires_at)-Date.now()>23.9*3600000),'Actual native OTP establishes session evidence')
 console.log('PASS: actual device email delivery, rate limit, wrong code, concurrent one-time verification, 15-day expiry, new browser and direct REST enforcement')
}finally{await admin.auth.admin.deleteUser(user.id)}
