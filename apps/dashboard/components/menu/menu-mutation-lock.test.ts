import assert from 'node:assert/strict'
import test from 'node:test'
import { createMenuMutationLock } from './menu-mutation-lock'

test('overlapping price/bulk writes are excluded atomically while disjoint products can proceed', () => {
  const lock = createMenuMutationLock()
  const price = lock.acquire(['a'])!
  assert.equal(lock.acquire(['a', 'b']), null)
  const other = lock.acquire(['b'])!
  assert.equal(lock.acquire(null), null)
  price()
  const next = lock.acquire(['a'])!
  price() // A repeated cleanup cannot release a newer operation.
  assert.equal(lock.acquire(['a']), null)
  next(); other()
  const structure = lock.acquire(null)!
  assert.equal(lock.acquire(['c']), null)
  assert.equal(lock.acquire(null), null)
  structure()
  assert.deepEqual(lock.snapshot(), { itemIds: new Set(), structural: false })
})
