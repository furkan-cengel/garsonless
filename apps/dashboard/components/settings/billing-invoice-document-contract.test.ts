import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const source = readFileSync(new URL('./BillingSection.tsx', import.meta.url), 'utf8')

test('billing history exposes every safe fiscal document state', () => {
  for (const label of [
    'Fatura hazırlanıyor',
    'Fatura profili gerekli',
    'PDF indir',
    'Fatura oluşturulamadı',
    'Henüz kullanılamıyor',
  ]) assert.match(source, new RegExp(label))
  assert.doesNotMatch(source, /providerDocumentRef|providerInvoiceRef|lastError/)
})

test('billing history polls preparing invoices for five seconds up to two minutes', () => {
  assert.match(source, /window\.setInterval\(\(\) => router\.refresh\(\), 5_000\)/)
  assert.match(source, /120_000/)
  assert.match(source, /Fatura işlemi arka planda devam ediyor/)
})
