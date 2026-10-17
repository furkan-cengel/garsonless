import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const sql = readFileSync(new URL('../supabase/migrations/20261011100000_menu_item_ar.sql', import.meta.url), 'utf8')

test('AR tables and RPCs are service-role-only security definer with a pinned search path', () => {
  assert.match(sql, /revoke all on public\.restaurant_ar_access, public\.menu_item_ar_versions, public\.menu_item_ar from public, anon, authenticated/)
  for (const fn of ['save_menu_item_ar_draft', 'publish_menu_item_ar', 'unpublish_menu_item_ar', 'read_menu_item_ar', 'read_published_menu_ar']) {
    assert.match(sql, new RegExp(`revoke all on function public\\.${fn}\\([^)]*\\) from public, anon, authenticated`))
    assert.match(sql, new RegExp(`grant execute on function public\\.${fn}\\([^)]*\\) to service_role;`))
  }
  assert.doesNotMatch(sql, /to authenticated;/)
  assert.equal((sql.match(/security definer\s+set search_path = public, pg_temp/g) ?? []).length, 7)
})

test('writes are tenant-scoped and models must be ready assets of the same restaurant', () => {
  assert.match(sql, /where i\.id = p_item and c\.restaurant_id = p_restaurant and i\.deleted_at is null/)
  assert.match(sql, /a\.restaurant_id = p_restaurant and a\.status = 'ready' and a\.mime = p_mime/)
  assert.match(sql, /foreign key \(restaurant_id, glb_asset_id\) references public\.media_assets\(restaurant_id, id\)/)
  assert.match(sql, /restaurant-assets\/restaurants\/' \|\| p_restaurant::text/)
})

test('drafts never reach guests; publish, unpublish and access changes bump the menu revision', () => {
  assert.match(sql, /join public\.menu_item_ar_versions v on v\.id = a\.published_version_id/)
  assert.match(sql, /exists \(select 1 from public\.restaurant_ar_access x where x\.restaurant_id = p_restaurant and x\.enabled\)/)
  assert.match(sql, /create trigger menu_invalidate_after_change after insert or update or delete on public\.menu_item_ar\b/)
  assert.match(sql, /create trigger menu_invalidate_after_change after insert or update or delete on public\.restaurant_ar_access/)
})

test('model uploads reuse the media pipeline with a 10 MB cap and a shape-checked patch', () => {
  assert.match(sql, /set file_size_limit = 10485760/)
  assert.match(sql, /'model\/gltf-binary', 'model\/vnd\.usdz\+zip'/)
  assert.match(sql, /raise exception 'media_command_core upload limits have unexpected shape'/)
  assert.match(sql, /like \\'model\/%\\' then n else 15728640/)
})

test('versions in use keep their assets referenced; superseded ones release them', () => {
  assert.match(sql, /insert into public\.media_asset_references\(restaurant_id, asset_id, target_table, target_id, label\)/)
  assert.match(sql, /delete from public\.media_asset_references r\s+using public\.menu_item_ar_versions v/)
})
