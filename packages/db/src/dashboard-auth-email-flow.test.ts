import assert from 'node:assert/strict'
import test from 'node:test'
import { authEmailSubject, buildVerificationUrl, renderAuthEmailHtml } from '../supabase/functions/send-email-hook/email-template'
const base={token:'012345',tokenHash:'a'.repeat(64),supabaseUrl:'https://isolated.supabase.co'}
test('dashboard confirmation links land on an interactive page without consuming the token',()=>{
 for(const actionType of ['signup','magiclink','recovery']){
  const url=new URL(buildVerificationUrl({...base,actionType,redirectTo:'https://app.masabu.co/auth/confirm?next=%2Fdashboard%2Fonboarding%3Fplan%3Dpro%26interval%3Dyearly&flow=untrusted'})!)
  assert.equal(url.origin,'https://app.masabu.co')
  assert.equal(url.pathname,'/auth/confirm')
  assert.equal(url.searchParams.get('flow'),actionType)
  assert.equal(url.searchParams.get('token_hash'),base.tokenHash)
  assert.match(url.searchParams.get('next')!,/interval=yearly/)
 }
})
test('customer login, invitations and email change keep their existing provider verification links',()=>{
 for(const actionType of ['magiclink','invite','email_change']){
  const url=new URL(buildVerificationUrl({...base,actionType,redirectTo:'https://menu.masabu.co/auth/callback'})!)
  assert.equal(url.origin,'https://isolated.supabase.co')
  assert.equal(url.pathname,'/auth/v1/verify')
  assert.equal(url.searchParams.get('type'),actionType)
 }
})
test('email includes the complete code including its leading zero',()=>{
 const html=renderAuthEmailHtml({...base,actionType:'signup',redirectTo:'https://app.masabu.co/auth/confirm'})
 assert.match(html,/012345/)
 assert.match(html,/token_hash=/)
})

test('isolated dashboard confirmation links work with a local HTTP auth provider', () => {
  const html = renderAuthEmailHtml({actionType:'recovery',token:'001234',tokenHash:'test-token-hash-for-local-email',redirectTo:'http://localhost:3002/auth/confirm?flow=recovery',supabaseUrl:'http://127.0.0.1:55321'})
  assert.match(html,/href="http:\/\/localhost:3002\/auth\/confirm/)
})

test('only dashboard confirmation emails receive the new link subjects', () => {
  assert.equal(authEmailSubject('magiclink', 'https://app.masabu.co/auth/confirm'), 'masabu - giriş bağlantın')
  assert.equal(authEmailSubject('recovery', 'https://app.masabu.co/auth/confirm'), 'masabu - şifre yenileme bağlantın')
  assert.equal(authEmailSubject('magiclink', 'https://menu.masabu.co/auth/callback'), 'masabu - giriş kodun')
  assert.equal(authEmailSubject('recovery', 'https://menu.masabu.co/auth/callback'), 'masabu - şifre sıfırlama kodun')
})
