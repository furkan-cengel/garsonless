import assert from 'node:assert/strict'
import test from 'node:test'
import { draftPatches, toBulkDraft } from './menu-bulk-editor-model'
import type { MenuBulkItem } from '@garsonless/domain/menu-bulk'
test('all selected products beyond the first render are included; only actual edits become patches', () => {
  const items: MenuBulkItem[] = Array.from({ length: 150 }, (_, index) => ({ id: String(index), name: `Ürün ${index}`, description: null, price: 10, category_id: 'one', is_available: true, updated_at: '2026-09-17T00:00:00Z' }))
  const draft = items.map(item => ({ ...toBulkDraft(item), price: '12,50' }))
  assert.equal(draftPatches(items, draft).length, 150)
  assert.equal(draftPatches(items, draft).at(-1)?.changes.price, 12.5)
  assert.deepEqual(draftPatches(items, items.map(toBulkDraft)), [])
  assert.equal('updated_at' in toBulkDraft(items[0]!), false)
})
