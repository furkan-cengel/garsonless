import assert from 'node:assert/strict'
import { createClient } from '@supabase/supabase-js'
import {
  BILLING_INTERVALS,
  RESTAURANT_ADD_ONS,
  SELF_SERVE_PLANS,
} from '@garsonless/domain/entitlements'
import { readIyzicoSubscriptionProviderConfig } from '../lib/billing/iyzico-subscription-config'

const DEV_SUPABASE_HOST = 'yxsegwkzyiscrxiwdeuf.supabase.co'

function required(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`${name}_missing`)
  return value
}

function sameRow(left: Record<string, unknown>, right: Record<string, unknown>): boolean {
  return left.add_on === right.add_on
    && left.plan === right.plan
    && left.billing_interval === right.billing_interval
    && left.net_amount_minor === right.net_amount_minor
    && left.provider_gross_amount_minor === right.provider_gross_amount_minor
    && left.provider_plan_ref === right.provider_plan_ref
    && left.active === right.active
}

async function main() {
  assert.equal(process.argv.includes('--target=dev'), true, 'Only the explicit --target=dev target is supported')
  const supabaseUrl = required('NEXT_PUBLIC_SUPABASE_URL')
  assert.equal(new URL(supabaseUrl).host, DEV_SUPABASE_HOST, 'Catalog sync must target DEV Supabase')
  const config = readIyzicoSubscriptionProviderConfig()
  assert.equal(config.baseUrl, 'https://sandbox-api.iyzipay.com', 'Catalog sync must use iyzico sandbox')

  const rows = RESTAURANT_ADD_ONS.flatMap((addOn) => {
    const group = config.addOns[addOn]
    assert(group, `${addOn} provider contract is required for DEV catalog sync`)
    return SELF_SERVE_PLANS.flatMap((plan) => {
      const intervals = group[plan]
      return intervals ? BILLING_INTERVALS.map((billingInterval) => ({
        add_on: addOn,
        plan,
        billing_interval: billingInterval,
        net_amount_minor: intervals[billingInterval].addOnNetAmountMinor,
        provider_gross_amount_minor: intervals[billingInterval].amountMinor,
        provider_plan_ref: intervals[billingInterval].referenceCode,
        active: true,
      })) : []
    })
  })
  assert.equal(rows.length, 6, 'DEV add-on catalog must contain exactly six canonical bindings')

  const admin = createClient(supabaseUrl, required('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const existing = await admin.from('subscription_add_on_catalog')
    .select('add_on,plan,billing_interval,net_amount_minor,provider_gross_amount_minor,provider_plan_ref,active')
  assert.ifError(existing.error)
  const byKey = new Map((existing.data ?? []).map((row) => [
    `${row.add_on}:${row.plan}:${row.billing_interval}`,
    row as Record<string, unknown>,
  ]))
  const changed = rows.filter((row) => !sameRow(
    byKey.get(`${row.add_on}:${row.plan}:${row.billing_interval}`) ?? {},
    row,
  ))
  if (changed.length) {
    const synced = await admin.from('subscription_add_on_catalog').upsert(changed, {
      onConflict: 'add_on,plan,billing_interval',
    })
    assert.ifError(synced.error)
  }

  const verified = await admin.from('subscription_add_on_catalog')
    .select('add_on,plan,billing_interval,net_amount_minor,provider_gross_amount_minor,provider_plan_ref,active')
    .eq('active', true)
  assert.ifError(verified.error)
  for (const expected of rows) {
    const actual = verified.data?.find((row) => row.add_on === expected.add_on
      && row.plan === expected.plan && row.billing_interval === expected.billing_interval)
    assert(actual && sameRow(actual as Record<string, unknown>, expected),
      `Catalog binding mismatch: ${expected.add_on}/${expected.plan}/${expected.billing_interval}`)
  }
  console.log(`PASS DEV add-on catalog: ${rows.length}/6 bindings; ${changed.length} writes`)
}

void main().catch((cause: unknown) => {
  const message = cause instanceof Error ? cause.message : 'unknown_failure'
  console.error(`FAIL DEV add-on catalog sync: ${message}`)
  process.exitCode = 1
})
