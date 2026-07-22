import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const migration = readFileSync(
  new URL('../supabase/migrations/20260722010000_saas_billing_foundation.sql', import.meta.url),
  'utf8',
)

const billingTables = [
  'billing_platform_policies',
  'billing_customers',
  'billing_subscriptions',
  'subscription_invoices',
  'subscription_payment_attempts',
  'billing_provider_events',
  'billing_reconciliation_jobs',
  'dunning_runs',
  'tenant_lifecycle_events',
] as const

test('billing foundation creates every ADR table behind a service-role boundary', () => {
  for (const table of billingTables) {
    assert.match(migration, new RegExp(`create table public\\.${table}`))
    assert.match(migration, new RegExp(`alter table public\\.${table} enable row level security`))
    assert.match(migration, new RegExp(`revoke all on public\\.${table} from public, anon, authenticated`))
    if (table === 'tenant_lifecycle_events') {
      assert.match(migration, /grant select, insert on public\.tenant_lifecycle_events to service_role/)
    } else {
      assert.match(migration, new RegExp(`grant select, insert, update, delete on public\\.${table} to service_role`))
    }
  }
  assert.doesNotMatch(migration, /create policy .*billing/i)
})

test('billing persistence keeps money integral, provider events idempotent and dunning single-run', () => {
  assert.match(migration, /amount_due_minor bigint not null/)
  assert.match(migration, /amount_minor bigint not null/)
  assert.doesNotMatch(migration, /amount_(?:due_)?minor (?:numeric|double precision|real)/)
  assert.match(migration, /unique \(provider, provider_event_id\)/)
  assert.match(migration, /invoice_id uuid not null unique/)
  assert.match(migration, /unique \(subscription_id, period_start, period_end\)/)
})

test('billing records survive tenant hard-delete attempts and raw provider payload is absent', () => {
  assert.match(migration, /references public\.restaurants\(id\) on delete restrict/)
  assert.doesNotMatch(migration, /payload_raw|raw_payload|webhook_body|provider_snapshot jsonb/)
  assert.match(migration, /payload_sanitized jsonb/)
  assert.match(migration, /provider_snapshot_sanitized jsonb/)
  assert.match(migration, /payload_hash text/)
  assert.match(migration, /pg_column_size\(payload_sanitized\) <= 65536/)
  assert.doesNotMatch(migration, /grant select, insert, update, delete on public\.tenant_lifecycle_events/)
})

test('billing foreign keys reject cross-tenant aggregate composition', () => {
  assert.match(migration, /foreign key \(restaurant_id, billing_customer_id\)/)
  assert.match(migration, /foreign key \(restaurant_id, subscription_id\)/)
  assert.match(migration, /foreign key \(restaurant_id, invoice_id\)/)
  assert.match(migration, /foreign key \(restaurant_id, subscription_id, invoice_id\)/)
})

test('default dunning policy is persisted and billing outbox vocabulary is reserved', () => {
  assert.match(migration, /values \('default', 14, 3, 1, 3, 7, 14, 90\)/)
  assert.match(migration, /'billing_subscription', 'billing_invoice'/)
  assert.match(migration, /'invoice\.payment_failed'/)
  assert.match(migration, /'tenant\.reactivated'/)
})
