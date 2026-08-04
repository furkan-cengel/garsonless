import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const migration = readFileSync(
  new URL('../supabase/migrations/20260801020000_theme_publish_concurrency.sql', import.meta.url),
  'utf8',
)
const rpcOnlyMigration = readFileSync(
  new URL('../supabase/migrations/20260801030000_theme_publish_rpc_only.sql', import.meta.url),
  'utf8',
)
const adapter = readFileSync(new URL('./theme-application-port.ts', import.meta.url), 'utf8')
const seed = readFileSync(new URL('./seed-maf.ts', import.meta.url), 'utf8')

test('theme publish owns a durable tenant-scoped idempotency ledger and immutable history', () => {
  assert.match(migration, /primary key \(restaurant_id, request_id\)/i)
  assert.match(migration, /request_fingerprint text not null check \(request_fingerprint ~ '\^\[a-f0-9\]\{64\}\$'\)/i)
  assert.match(migration, /unique \(restaurant_id, revision\)/i)
  assert.match(migration, /unique \(restaurant_id, request_id\)/i)
  assert.match(migration, /alter table public\.theme_publish_operations enable row level security/i)
  assert.match(migration, /alter table public\.theme_config_history enable row level security/i)
  assert.match(migration, /revoke all on table public\.theme_publish_operations from public, anon, authenticated/i)
  assert.match(migration, /grant select on table public\.theme_config_history to service_role/i)
})

test('theme publish locks the restaurant, rejects reused ids with changed intent and replays exact success', () => {
  const restaurantLock = migration.indexOf('for update;')
  const idempotencyCheck = migration.indexOf("raise exception 'theme_publish_idempotency_conflict'")
  const themeLock = migration.indexOf('select revision, tokens, published_at')
  assert.ok(restaurantLock > 0 && idempotencyCheck > restaurantLock && themeLock > idempotencyCheck)
  assert.match(migration, /v_operation\.tokens <> p_tokens/i)
  assert.match(migration, /v_operation\.expected_revision <> p_expected_revision/i)
  assert.match(migration, /v_operation\.published_by <> p_published_by/i)
  assert.match(migration, /jsonb_set\(v_operation\.result, '\{status\}', to_jsonb\('replayed'::text\)/i)
})

test('theme publish revalidates canonical template, payload and actor authority inside the RPC', () => {
  assert.match(migration, /if p_template_id <> 'default' then/i)
  assert.match(migration, /octet_length\(p_tokens::text\) > 262144/i)
  assert.match(migration, /member\.restaurant_id = p_restaurant_id/i)
  assert.match(migration, /member\.user_id = p_published_by/i)
  assert.match(migration, /member\.status = 'active'/i)
  assert.match(migration, /member\.permissions \? 'theme'/i)
  assert.match(migration, /theme_publisher_not_authorized/i)
})

test('stale theme publishes return canonical conflict snapshots without writing live state', () => {
  const conflict = migration.indexOf("'status', 'conflict'")
  const configWrite = migration.indexOf('insert into public.theme_configs')
  assert.ok(conflict > 0 && configWrite > conflict)
  assert.match(migration, /if v_current_revision <> p_expected_revision then/i)
  assert.match(migration, /'tokens', v_current_tokens/i)
  assert.match(migration, /'publishedAt', v_current_published_at/i)
  assert.match(migration, /return v_result;[\s\S]*end if;[\s\S]*v_next_revision := v_current_revision \+ 1/i)
})

test('successful theme publish updates config, active template, history and request result atomically', () => {
  assert.match(migration, /revision = excluded\.revision/i)
  assert.match(migration, /jsonb_build_object\('active_template_id', p_template_id\)/i)
  assert.match(migration, /insert into public\.theme_config_history/i)
  assert.match(migration, /insert into public\.theme_publish_operations/i)
  assert.match(migration, /drop function if exists public\.publish_theme_config_atomic\(uuid, text, jsonb, uuid\)/i)
  assert.match(migration, /grant execute on function public\.publish_theme_config_atomic\(uuid, text, jsonb, uuid, bigint, uuid, text\)\s+to service_role/i)
})

test('database adapter sends the full CAS contract and computes the server-side fingerprint', () => {
  assert.match(adapter, /fingerprintThemePublish/)
  assert.match(adapter, /p_expected_revision: input\.expectedRevision/)
  assert.match(adapter, /p_request_id: input\.requestId/)
  assert.match(adapter, /p_request_fingerprint: requestFingerprint/)
  assert.match(adapter, /theme_publish_idempotency_conflict/)
  assert.doesNotMatch(adapter, /return err\(error\.message\)/)
})

test('service tooling cannot bypass the canonical theme publish RPC', () => {
  for (const table of ['theme_configs', 'theme_publish_operations', 'theme_config_history']) {
    assert.match(
      rpcOnlyMigration,
      new RegExp(`revoke insert, update, delete, truncate, references, trigger\\s+on table public\\.${table}\\s+from service_role`, 'i'),
    )
  }
  assert.doesNotMatch(seed, /\.from\('theme_configs'\)[\s\S]{0,160}\.upsert\(/)
  assert.match(seed, /rpc\(\s*'publish_theme_config_atomic'/)
  assert.match(seed, /fingerprintThemePublish/)
  assert.match(seed, /p_expected_revision: expectedRevision/)
  assert.match(seed, /p_request_id: requestId/)
})
