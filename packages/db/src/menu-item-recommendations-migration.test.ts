import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const sql = readFileSync(join(process.cwd(), 'supabase/migrations/20260727030000_menu_item_recommendations.sql'), 'utf8')

test('product recommendations are tenant scoped, ordered and limited', () => {
  assert.match(sql, /create table public\.menu_item_recommendations/)
  assert.match(sql, /id uuid primary key default gen_random_uuid\(\)/)
  assert.match(sql, /source_item_id <> recommended_item_id/)
  assert.match(sql, /position between 0 and 9/)
  assert.match(sql, /unique \(source_item_id, recommended_item_id\)/)
  assert.match(sql, /a product can have at most 10 recommendations/)
  assert.match(sql, /recommendation items must belong to the same restaurant/)
})

test('recommendation replacement is atomic and public reads exclude unavailable products', () => {
  assert.match(sql, /create or replace function public\.replace_menu_item_recommendations/)
  assert.match(sql, /public\.has_restaurant_section\(p_restaurant_id, 'menu'\)/)
  assert.match(sql, /delete from public\.menu_item_recommendations[\s\S]+insert into public\.menu_item_recommendations/)
  assert.match(sql, /source_item\.is_available = true/)
  assert.match(sql, /target_item\.is_available = true/)
  assert.match(sql, /grant select \(source_item_id, recommended_item_id, position\)[\s\S]+to anon, authenticated/)
})
