import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const migration = readFileSync(
  new URL('../supabase/migrations/20260904030000_subscription_invoice_document_projection.sql', import.meta.url),
  'utf8',
)

test('fiscal document projection is tenant-scoped and reveals no provider identity', () => {
  const projection = migration.slice(
    migration.indexOf('create function public.read_subscription_billing_settings'),
    migration.indexOf('create function public.read_subscription_invoice_document'),
  )
  assert.match(migration, /job\.restaurant_id = p_restaurant_id/i)
  assert.match(migration, /job\.subscription_invoice_id = \(invoice\.value->>'id'\)::uuid/i)
  assert.match(migration, /'fiscalDocumentStatus'/)
  assert.match(migration, /'canDownload'/)
  assert.doesNotMatch(projection, /'providerDocumentRef'/)
})

test('document identity lookup is service-only and requires a paid tenant invoice', () => {
  assert.match(migration, /invoice\.restaurant_id = p_restaurant_id[\s\S]*invoice\.id = p_invoice_id/i)
  assert.match(migration, /v_invoice_status <> 'paid'/i)
  assert.match(migration, /v_job\.provider_name = 'nilvera'/i)
  assert.match(migration, /revoke all on function public\.read_subscription_invoice_document\(uuid,uuid\)[\s\S]*from public, anon, authenticated/i)
  assert.match(migration, /grant execute on function public\.read_subscription_invoice_document\(uuid,uuid\) to service_role/i)
})
