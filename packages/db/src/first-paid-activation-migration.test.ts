import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const sql = readFileSync(new URL(
  '../supabase/migrations/20260904020000_first_paid_activation_welcome.sql',
  import.meta.url,
), 'utf8')

test('historical paid tenants are backfilled before first-activation events are enriched', () => {
  const backfill = sql.indexOf('insert into public.restaurant_first_paid_activations')
  const trigger = sql.indexOf('create trigger domain_outbox_enrich_invoice_paid')
  assert.ok(backfill >= 0 && trigger > backfill)
  assert.match(sql, /select distinct on \(invoice\.restaurant_id\)/)
  assert.match(sql, /invoice\.status = 'paid'/)
  assert.match(sql, /invoice\.amount_paid_minor = invoice\.amount_due_minor/)
})

test('one restaurant-lifetime milestone makes retries and renewals converge', () => {
  assert.match(sql, /restaurant_id uuid primary key/)
  assert.match(sql, /on conflict \(restaurant_id\) do nothing/)
  assert.match(sql, /'firstPaidActivation', v_first_invoice_id = v_invoice\.id/)
  assert.match(sql, /before insert on public\.domain_outbox/)
})

test('invoice.paid receives only safe welcome presentation context', () => {
  assert.match(sql, /new\.event_type <> 'invoice\.paid'/)
  assert.match(sql, /'plan', v_invoice\.plan/)
  assert.match(sql, /'billingInterval', v_invoice\.billing_interval/)
  assert.match(sql, /'addOns', v_invoice\.add_ons/)
  assert.match(sql, /'onboardingComplete', coalesce\(v_onboarding_complete, false\)/)
  assert.doesNotMatch(sql, /provider_invoice_ref|provider_payment_id|api_key|secret/i)
})

test('first-paid milestone is service-private and protected by forced RLS', () => {
  assert.match(sql, /enable row level security/)
  assert.match(sql, /force row level security/)
  assert.match(sql, /revoke all on public\.restaurant_first_paid_activations from public, anon, authenticated/i)
})
