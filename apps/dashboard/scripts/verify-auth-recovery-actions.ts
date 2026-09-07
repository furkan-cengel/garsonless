import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { signFlowGrant, sessionIdFromToken } from '../lib/auth/flow-grant'
const api = process.env['NEXT_PUBLIC_SUPABASE_URL']!
assert.equal(api,'http://127.0.0.1:55321','Only the isolated local auth audit stack is allowed')
const app='http://localhost:3002'
const secret=process.env['SUPABASE_SERVICE_ROLE_KEY']!
const anon=process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY']!
const admin=createClient(api,secret,{auth:{persistSession:false,autoRefreshToken:false}})
const manifest=JSON.parse(readFileSync('.next-auth-audit/server/server-reference-manifest.json','utf8'))
const action=Object.keys(manifest.node).find(id=>manifest.node[id].exportedName==='setPasswordFromRecovery')
assert.ok(action,'Start the isolated dashboard and open its reset-password route first')
const email='recovery-action-'+randomUUID()+'@example.test'
const oldPassword='original isolated action password'
const newPassword='Aa1!bc'
const created=await admin.auth.admin.createUser({email,password:oldPassword,email_confirm:true})
assert.ifError(created.error)
const userId=created.data.user!.id
async function session() {
 const jar=new Map<string,string>()
 const client=createServerClient(api,anon,{cookies:{getAll:()=>[...jar].map(([name,value])=>({name,value})),setAll:(values:Array<{name:string;value:string}>)=>{for(const item of values)jar.set(item.name,item.value)}}})
 const result=await client.auth.signInWithPassword({email,password:oldPassword})
 assert.ifError(result.error)
 return {jar,sessionId:sessionIdFromToken(result.data.session!.access_token)!}
}
async function submit(jar:Map<string,string>,grant:string|undefined,password=newPassword) {
 const cookies=new Map(jar);if(grant)cookies.set('dashboard_auth_recovery',grant)
 const response=await fetch(app+'/auth/reset-password',{method:'POST',headers:{Origin:app,'Next-Action':action!,'Content-Type':'text/plain;charset=UTF-8',Cookie:[...cookies].map(([name,value])=>name+'='+value).join('; ')},body:JSON.stringify([{newPassword:password}])})
 assert.equal(response.status,200)
 const body=await response.text();const line=body.split('\n').find(value=>value.startsWith('1:'))
 assert.ok(line,'Expected a server action result')
 return JSON.parse(line.slice(2)) as {error?:string;success?:boolean;fieldErrors?:Record<string,string>}
}
try {
 const first=await session();const second=await session()
 const grant=signFlowGrant({purpose:'recovery',userId,sessionId:first.sessionId},secret)
 assert.ok((await submit(first.jar,undefined)).error)
 assert.ok((await submit(first.jar,signFlowGrant({purpose:'complete',userId,sessionId:first.sessionId},secret))).error)
 assert.ok((await submit(second.jar,grant)).error)
 assert.ok((await submit(first.jar,signFlowGrant({purpose:'recovery',userId,sessionId:first.sessionId},secret,Date.now()-601000))).error)
 assert.ok((await submit(first.jar,grant,'A1!ab')).fieldErrors?.newPassword)
 for (const invalid of ['aa1!bc','Aaa!bc','Aaa1bc']) assert.ok((await submit(first.jar,grant,invalid)).fieldErrors?.newPassword)
 assert.equal((await submit(first.jar,grant)).success,true)
 assert.ok((await submit(first.jar,grant)).error)
 const fresh=createClient(api,anon,{auth:{persistSession:false,autoRefreshToken:false}})
 assert.ok((await fresh.auth.signInWithPassword({email,password:oldPassword})).error)
 assert.ifError((await fresh.auth.signInWithPassword({email,password:newPassword})).error)
 console.log('PASS: real recovery server action rejects normal/wrong-purpose/changed-session/expired/reused grants; validates six characters and composition; updates password and new login succeeds')
} finally {
 await admin.auth.admin.deleteUser(userId)
}
