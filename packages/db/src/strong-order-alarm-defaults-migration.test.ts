import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const sql = readFileSync(
  new URL('../supabase/migrations/20260831030000_strong_order_alarm_defaults.sql', import.meta.url),
  'utf8',
)

test('both restaurant creation RPCs receive strong alarm defaults', () => {
  assert.match(sql, /create or replace function public\.create_restaurant_with_pro_trial\(/)
  assert.match(sql, /create or replace function public\.create_restaurant_with_pro_trial_v2\(/)
  assert.equal((sql.match(/'newOrderSoundPreset', 'masabu-alert'/g) ?? []).length, 2)
  assert.equal((sql.match(/'newOrderSoundVolume', 70/g) ?? []).length, 2)
  assert.equal((sql.match(/'newOrderRepeatSeconds', 10/g) ?? []).length, 2)
  assert.equal((sql.match(/'newOrderRepeatMaxMinutes', 5/g) ?? []).length, 2)
  assert.match(sql, /insert into public\.restaurants \(name, slug, owner_id, plan, settings\)/)
  assert.match(sql, /insert into public\.restaurants \(name, slug, owner_id, plan, timezone, settings\)/)
})

test('migration does not backfill existing restaurant settings', () => {
  assert.doesNotMatch(sql, /update\s+public\.restaurants/i)
  assert.doesNotMatch(sql, /alter\s+table\s+public\.restaurants/i)
})

test('RPC security grants remain owner-authenticated', () => {
  assert.match(sql, /revoke all on function public\.create_restaurant_with_pro_trial\(text,text,text\)[\s\S]*to authenticated/)
  assert.match(sql, /revoke all on function public\.create_restaurant_with_pro_trial_v2\(text,text,text,text,uuid\)[\s\S]*to authenticated/)
  assert.equal((sql.match(/security definer/g) ?? []).length, 2)
  assert.equal((sql.match(/v_owner uuid := auth\.uid\(\)/g) ?? []).length, 2)
})
