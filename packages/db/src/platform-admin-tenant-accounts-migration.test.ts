import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
const sql = readFileSync(new URL('../supabase/migrations/20260913120000_platform_tenant_accounts.sql', import.meta.url), 'utf8')
test('account RPCs are service-only, reverify a current superadmin and keep a private unlock ledger', () => {
  assert.match(sql, /status = 'active' and role = 'superadmin' and role = p_actor_role/)
  assert.match(sql, /platform_account_unlocks enable row level security/)
  for (const name of ['reveal_platform_admin_tenant_accounts', 'reactivate_platform_admin_tenant_member', 'prepare_platform_admin_user_unban', 'finish_platform_admin_user_unban']) {
    assert.match(sql, new RegExp(`revoke all on function public\\.${name}\\([^;]+from public, anon, authenticated`))
    assert.match(sql, new RegExp(`grant execute on function public\\.${name}\\([^;]+to service_role`))
  }
})
test('contact reveal is explicitly scoped and excludes Auth secrets and provider credentials', () => {
  assert.match(sql, /m\.restaurant_id = p_restaurant_id/)
  assert.match(sql, /b\.restaurant_id = p_restaurant_id/)
  assert.match(sql, /'tenant\.accounts\.reveal'/)
  assert.doesNotMatch(sql, /encrypted_password|refresh_token|confirmation_token|provider_customer_ref|select\s+u\.\*/i)
})
test('activation preserves billing, passwords and grants; unknown Auth results cannot be retried blindly', () => {
  assert.doesNotMatch(sql, /update\s+(?:public\.)?(billing_subscriptions|billing_customers|subscription_invoices)|update\s+auth\.users|set\s+permissions\s*=/i)
  assert.match(sql, /v_member\.accepted_at is null/)
  assert.match(sql, /id = p_member_id and restaurant_id = p_restaurant_id/)
  assert.match(sql, /platform_account_unlocks_pending_user/)
  assert.match(sql, /platform_admin_account_protected/)
  assert.match(sql, /'execute', false/)
  assert.match(sql, /'tenant\.account\.unban_requested'/)
  assert.match(sql, /'tenant\.account\.unban_resolved'/)
})
