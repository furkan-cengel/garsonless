import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const pricing = readFileSync(new URL('./PricingSection.tsx', import.meta.url), 'utf8')
const form = readFileSync(new URL('./BusinessContactForm.tsx', import.meta.url), 'utf8')
const endpoint = readFileSync(new URL('../app/api/contact/business/route.ts', import.meta.url), 'utf8')
const company = readFileSync(new URL('../app/company/page.tsx', import.meta.url), 'utf8')
const home = readFileSync(new URL('../app/page.tsx', import.meta.url), 'utf8')

test('pricing defaults monthly and exposes four responsive commercial cards', () => {
  assert.match(pricing, /useState<BillingInterval>\('monthly'\)/)
  for (const plan of ['starter', 'plus', 'pro', 'business']) assert.match(pricing, new RegExp(`id: '${plan}'`))
  assert.match(pricing, /grid-template-columns: repeat\(4/)
  assert.match(pricing, /max-width: 1024px[\s\S]+repeat\(2/)
  assert.match(pricing, /max-width: 640px[\s\S]+grid-template-columns: 1fr/)
  assert.match(home, /<PricingSection \/>/)
})

test('pricing preserves exact CTA intent and honest commercial copy', () => {
  assert.match(pricing, /En çok tercih edilen/)
  assert.match(pricing, /<h2 className="font-display">Fiyatlandırma<\/h2>/)
  assert.doesNotMatch(pricing, /Patron sizsiniz/)
  assert.match(pricing, /14 gün ücretsiz dene/)
  assert.match(pricing, /auth\/signup\?plan=\$\{plan\.id\}/)
  assert.match(pricing, /company\?subject=business#iletişim/)
  assert.match(pricing, /Bizimle konuş/)
  assert.match(pricing, /Şube sayınıza göre özel fiyatlandırma/)
  assert.match(pricing, /KDV dâhil · Sipariş komisyonu yok/)
  assert.match(pricing, /Starter, Plus ve Pro’da taahhüt yok/)
  assert.doesNotMatch(pricing, /İhtiyacınıza göre sözleşme ve fiyat/)
  assert.doesNotMatch(pricing, /Aylık faturalandırılır/)
  assert.doesNotMatch(pricing, /\b(?:API|webhook|SSO|white-label)\b/i)
})

test('pricing keeps package details in cards and expands long feature lists', () => {
  assert.match(pricing, /FEATURE_PREVIEW_COUNT = 4/)
  assert.match(pricing, /Paket kapsamında/)
  assert.match(pricing, /Daha fazla göster/)
  assert.match(pricing, /aria-expanded=\{expanded\}/)
  assert.match(pricing, /aria-controls=\{featureListId\}/)
  assert.doesNotMatch(pricing, /pricing-comparison/)
  assert.doesNotMatch(pricing, /const COMPARISON/)
})

test('Business form has the required fields, accessible status and guarded Resend delivery', () => {
  for (const name of ['name', 'email', 'phone', 'businessName', 'branchCount', 'message', 'website']) {
    assert.match(form, new RegExp(`name=["{]?["']?${name}`))
  }
  assert.match(form, /role=\{state\.kind === 'error' \? 'alert' : 'status'\}/)
  assert.match(endpoint, /api\.resend\.com\/emails/)
  assert.match(endpoint, /if \(lead\.website\)/)
  assert.match(endpoint, /current\.count > 3/)
  assert.match(endpoint, /AbortSignal\.timeout\(10_000\)/)
  assert.match(company, /<BusinessContactForm \/>/)
})
