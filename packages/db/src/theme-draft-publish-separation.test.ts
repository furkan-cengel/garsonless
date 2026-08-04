import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const migration = readFileSync(new URL(
  '../supabase/migrations/20260801050000_theme_draft_publish_separation.sql',
  import.meta.url,
), 'utf8')

test('theme drafts are tenant scoped, private and writable only through RPCs', () => {
  assert.match(migration, /create table public\.theme_drafts/i)
  assert.match(migration, /restaurant_id uuid primary key references public\.restaurants\(id\) on delete cascade/i)
  assert.match(migration, /alter table public\.theme_drafts enable row level security/i)
  assert.match(migration, /revoke all on table public\.theme_drafts from public, anon, authenticated/i)
  assert.match(migration, /revoke insert, update, delete, truncate, references, trigger on table public\.theme_drafts from service_role/i)
})

test('draft save is revisioned, idempotent and validates actor authority under lock', () => {
  assert.match(migration, /create function public\.save_theme_draft_atomic/i)
  assert.match(migration, /where id = p_restaurant_id and deleted_at is null\s+for update/i)
  assert.match(migration, /theme_draft_writer_not_authorized/i)
  assert.match(migration, /theme_draft_idempotency_conflict/i)
  assert.match(migration, /if v_current\.revision <> p_expected_revision/i)
  assert.match(migration, /hasUnpublishedChanges/i)
})

test('publish reads and locks the exact saved draft revision before changing live state', () => {
  assert.match(migration, /create function public\.publish_saved_theme_draft_atomic/i)
  const draftLock = migration.indexOf('from public.theme_drafts\n  where restaurant_id = p_restaurant_id for update')
  const liveWrite = migration.indexOf('insert into public.theme_configs', draftLock)
  assert.ok(draftLock > 0 && liveWrite > draftLock)
  assert.match(migration, /if v_draft\.revision <> p_expected_draft_revision/i)
  assert.match(migration, /v_current_revision <> p_expected_published_revision/i)
  assert.match(migration, /update public\.theme_drafts set based_on_published_revision = v_next_revision/i)
  assert.match(migration, /grant execute on function public\.publish_saved_theme_draft_atomic[^]*to service_role/i)
})
