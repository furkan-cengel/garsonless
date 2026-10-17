import test from 'node:test'
import assert from 'node:assert/strict'
import { ok } from '@garsonless/domain'
import { publishMenuItemAr, readPublishedMenuAr, saveMenuItemArDraft, unpublishMenuItemAr, validateMenuArDraft, type MenuArPort } from './menu-ar'

const R = '11111111-1111-4111-8111-111111111111'
const ITEM = '22222222-2222-4222-8222-222222222222'
const GLB = '33333333-3333-4333-8333-333333333333'
const VERSION = '44444444-4444-4444-8444-444444444444'
const member = { actor: 'dashboard-member' as const, restaurantId: R, userId: 'staff', permissions: ['menu'] }
const draft = { restaurantId: R, menuItemId: ITEM, glbAssetId: GLB, usdzAssetId: null, posterUrl: null, widthMm: 260, depthMm: 260, heightMm: 70, portionNote: ' 1 dilim ' }

function port(enabled = true) {
  const calls: string[] = []
  const value: MenuArPort = {
    readAccess: async () => ok(enabled),
    readItem: async () => ok({ accessEnabled: enabled, draft: null, publishedVersionId: null }),
    saveDraft: async (input) => { calls.push(`save:${input.actorId}:${input.portionNote}`); return ok({ versionId: VERSION }) },
    publish: async () => { calls.push('publish'); return ok(null) },
    unpublish: async () => { calls.push('unpublish'); return ok(null) },
  }
  return { value, calls }
}

test('a menu member saves a trimmed draft as themselves', async () => {
  const p = port()
  const result = await saveMenuItemArDraft(member, draft, p.value)
  assert.equal(result.ok, true)
  assert.deepEqual(p.calls, ['save:staff:1 dilim'])
})

test('other restaurants, missing menu permission and closed AR access are refused before the port', async () => {
  const p = port()
  assert.equal((await saveMenuItemArDraft({ ...member, restaurantId: '99999999-9999-4999-8999-999999999999' }, draft, p.value)).ok, false)
  assert.equal((await saveMenuItemArDraft({ ...member, permissions: ['orders'] }, draft, p.value)).ok, false)
  const closed = port(false)
  assert.equal((await saveMenuItemArDraft(member, draft, closed.value)).ok, false)
  assert.equal((await publishMenuItemAr(member, { restaurantId: R, menuItemId: ITEM, versionId: VERSION }, closed.value)).ok, false)
  assert.deepEqual([...p.calls, ...closed.calls], [])
})

test('unpublishing still works after AR access is switched off', async () => {
  const closed = port(false)
  assert.equal((await unpublishMenuItemAr(member, { restaurantId: R, menuItemId: ITEM }, closed.value)).ok, true)
  assert.deepEqual(closed.calls, ['unpublish'])
})

test('sizes, ids, poster and portion note are bounded', () => {
  assert.equal(validateMenuArDraft({ ...draft, widthMm: 5 }).ok, false)
  assert.equal(validateMenuArDraft({ ...draft, heightMm: 1001 }).ok, false)
  assert.equal(validateMenuArDraft({ ...draft, glbAssetId: 'not-a-uuid' }).ok, false)
  assert.equal(validateMenuArDraft({ ...draft, posterUrl: 'http://example.com/a.png' }).ok, false)
  assert.equal(validateMenuArDraft({ ...draft, portionNote: 'x'.repeat(121) }).ok, false)
  assert.equal(validateMenuArDraft({ ...draft, widthMm: null, depthMm: null, heightMm: null }).ok, true)
})

test('public read ignores malformed restaurant ids', async () => {
  let called = false
  const result = await readPublishedMenuAr('not-a-uuid', { readPublished: async () => { called = true; return ok([]) } })
  assert.equal(result.ok, true)
  assert.equal(called, false)
})
