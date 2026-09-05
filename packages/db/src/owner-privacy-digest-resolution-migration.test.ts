import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const migration = readFileSync(
  new URL('../supabase/migrations/20260903052000_owner_privacy_digest_resolution.sql', import.meta.url),
  'utf8',
)

const definition = migration.match(
  /create or replace function public\.export_owner_tenant_privacy_data[\s\S]*?\n\$\$;/,
)?.[0] ?? ''

test('owner privacy digest resolves the pgcrypto bytea/text overload explicitly', () => {
  assert.match(
    definition,
    /extensions\.digest\(convert_to\(v_document::text, 'utf8'\), 'sha256'::text\)/,
  )
  assert.doesNotMatch(definition, /encode\(\s*digest\(/)
})

test('forward replacement preserves the privacy export security boundary', () => {
  assert.match(definition, /security definer\s+set search_path = public, pg_temp/)
  assert.match(definition, /result_digest,\s+result_summary, request_id/)
  assert.match(migration, /revoke all on function public\.export_owner_tenant_privacy_data[\s\S]*from public, anon, authenticated/)
  assert.match(migration, /grant execute on function public\.export_owner_tenant_privacy_data[\s\S]*to service_role/)
})

test('export document remains transient while audit evidence stores digest and summary only', () => {
  const insert = definition.match(
    /insert into public\.tenant_privacy_operations[\s\S]*?returning \* into v_created;/,
  )?.[0] ?? ''
  assert.match(insert, /v_digest, v_summary, p_request_id/)
  assert.doesNotMatch(insert, /v_document/)
  assert.match(definition, /'document', v_document/)
})
