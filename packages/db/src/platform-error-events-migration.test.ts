import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const sql = readFileSync(
  new URL('../supabase/migrations/20260722190000_platform_error_events.sql', import.meta.url),
  'utf8',
).toLowerCase()

test('platform error events contain fingerprints but no raw diagnostics or PII payload', () => {
  assert.match(sql, /create table public\.platform_error_events/)
  assert.match(sql, /fingerprint text not null/)
  assert.match(sql, /public_code text not null/)
  assert.doesNotMatch(
    sql,
    /\bstack(?:_trace)?\s+text|\berror_message\s+text|\bpayload\s+jsonb|\bemail\s+text|\bphone\s+text/,
  )
})

test('event writes and global reads remain service-role only', () => {
  assert.match(sql, /enable row level security/)
  assert.match(sql, /revoke all on table public\.platform_error_events from public, anon, authenticated/)
  assert.match(sql, /revoke all on function public\.record_platform_error_event/)
  assert.match(sql, /revoke all on function public\.read_platform_admin_error_overview/)
  assert.match(sql, /grant execute on function public\.record_platform_error_event[\s\S]*to service_role/)
  assert.match(sql, /grant execute on function public\.read_platform_admin_error_overview[\s\S]*to service_role/)
})

test('retention is bounded and installed as a named daily job', () => {
  assert.match(sql, /occurred_at < now\(\) - interval '30 days'/)
  assert.match(sql, /platform-error-event-retention-daily/)
  assert.match(sql, /cron\.schedule/)
})
