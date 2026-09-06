import { test } from 'node:test'
import assert from 'node:assert/strict'
import { MenuDraftRegistry } from './menu-draft-registry'

test('all open drafts participate and discard only occurs after writes settle', () => {
  const registry = new MenuDraftRegistry()
  const discarded: string[] = []
  registry.set('category', { dirty: true, pending: false, discard: () => discarded.push('category') })
  registry.set('product', { dirty: true, pending: true, discard: () => discarded.push('product') })
  assert.equal(registry.dirty, true)
  assert.equal(registry.discard(), false)
  assert.equal(discarded.length, 0)
  registry.set('product', { dirty: true, pending: false, discard: () => discarded.push('product') })
  assert.equal(registry.discard(), true)
  assert.deepEqual(discarded, ['category', 'product'])
  assert.equal(registry.dirty, false)
})
test('unmounting one draft does not remove another draft guard', () => {
  const registry = new MenuDraftRegistry()
  registry.set('one', { dirty: true, pending: false, discard() {} })
  registry.set('two', { dirty: true, pending: false, discard() {} })
  registry.remove('one')
  assert.equal(registry.dirty, true)
  registry.remove('two')
  assert.equal(registry.dirty, false)
})
