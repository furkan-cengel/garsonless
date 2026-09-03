import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const migration = readFileSync(
  new URL('../supabase/migrations/20260903055000_unused_routine_record_targets.sql', import.meta.url),
  'utf8',
)

const loyaltySource = readFileSync(
  new URL('../supabase/migrations/20260802030000_customer_loyalty_privacy.sql', import.meta.url),
  'utf8',
)

const serviceStatusSource = readFileSync(
  new URL('../supabase/migrations/20260722130000_platform_tenant_service_controls.sql', import.meta.url),
  'utf8',
)

test('unused record targets are replaced exactly once in both active RPC signatures', () => {
  assert.match(
    migration,
    /public\.apply_order_loyalty_adjustment\(uuid,uuid,boolean\)'::regprocedure/,
  )
  assert.match(
    migration,
    /public\.set_platform_admin_tenant_service_status\(uuid,uuid,text,text,text,uuid\)'::regprocedure/,
  )
  assert.match(migration, /v_declaration_matches <> 1 or v_statement_matches <> 1/)
  assert.match(migration, /'select \* into v_refund'::text,[\s\S]*?'perform 1'::text/)
  assert.match(migration, /'select \* into v_restaurant'::text,[\s\S]*?'perform 1'::text/)
})

test('the FOUND checks, refund identity predicate and tenant row lock remain intact', () => {
  const adjustment = loyaltySource.match(
    /create or replace function public\.apply_order_loyalty_adjustment[\s\S]*?\n\$\$;/,
  )?.[0] ?? ''
  const serviceStatus = serviceStatusSource.match(
    /create or replace function public\.set_platform_admin_tenant_service_status[\s\S]*?\n\$\$;/,
  )?.[0] ?? ''

  assert.match(
    adjustment,
    /select \* into v_refund[\s\S]*?r\.id = p_refund_id[\s\S]*?r\.status = 'succeeded';\s+if not found then/,
  )
  assert.match(
    serviceStatus,
    /select \* into v_restaurant[\s\S]*?id = p_restaurant_id and deleted_at is null[\s\S]*?for update;\s+if not found then/,
  )
  assert.match(migration, /replace\(v_definition, v_patch\.declaration, ''\)/)
  assert.match(migration, /v_patch\.old_statement,[\s\S]*?v_patch\.new_statement/)
})

test('replacement fails closed around security-definer, search path and ACL metadata', () => {
  assert.match(migration, /routine\.proacl/)
  assert.match(migration, /routine\.proconfig/)
  assert.match(migration, /routine\.prosecdef/)
  assert.match(migration, /'search_path=public, pg_temp' = any\(v_before_config\)/)
  assert.match(migration, /v_after_acl is distinct from v_before_acl/)
  assert.doesNotMatch(migration, /\b(?:grant|revoke)\b/i)
  assert.doesNotMatch(migration, /\b(?:insert|update|delete)\s+(?:into|public\.)/i)
})
