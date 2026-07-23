import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const sql = readFileSync(
  new URL('../supabase/migrations/20260722180000_platform_admin_read_only_impersonation.sql', import.meta.url),
  'utf8',
)

test('impersonation sessions are service-only, bounded and never tenant memberships', () => {
  assert.match(sql, /enable row level security/i)
  assert.match(sql, /revoke all on table public\.platform_admin_impersonation_sessions from public, anon, authenticated/i)
  assert.match(sql, /actor_role in \('support', 'ops', 'superadmin'\)/i)
  assert.match(sql, /p_duration_minutes not in \(15, 30, 60\)/i)
  assert.match(sql, /interval '60 minutes 5 seconds'/i)
  assert.doesNotMatch(sql, /restaurant_members|restaurant_owners/i)
})

test('start and end recheck identity, bind ownership and audit in the same transaction', () => {
  assert.match(sql, /v_identity\.role <> p_actor_role/i)
  assert.match(sql, /actor_user_id = p_actor_user_id/i)
  assert.match(sql, /tenant\.impersonation\.start/i)
  assert.match(sql, /tenant\.impersonation\.end/i)
  assert.match(sql, /insert into public\.platform_admin_audit_log/i)
  assert.match(sql, /request_id = p_request_id/i)
})

test('all session RPCs remain service-role-only', () => {
  assert.equal((sql.match(/revoke all on function public\./g) ?? []).length, 3)
  assert.equal((sql.match(/grant execute on function public\./g) ?? []).length, 3)
  assert.match(sql, /from public, anon, authenticated/g)
})
