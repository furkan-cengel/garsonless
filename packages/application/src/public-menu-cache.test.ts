import assert from 'node:assert/strict'
import test from 'node:test'
import { readPublicMenuRevision } from './public-menu-cache'

const restaurantId = '11111111-1111-4111-8111-111111111111'

test('public menu revision validates the tenant-scoped snapshot', async () => {
  const result = await readPublicMenuRevision(restaurantId, {
    async readRevision(id) {
      return { restaurantId: id, revision: 4, updatedAt: '2026-08-25T00:00:00.000Z' }
    },
  })
  assert.equal(result.revision, 4)
})

test('public menu revision rejects invalid identities and revisions', async () => {
  await assert.rejects(() => readPublicMenuRevision('invalid', {
    async readRevision(id) { return { restaurantId: id, revision: 0, updatedAt: null } },
  }))
  await assert.rejects(() => readPublicMenuRevision(restaurantId, {
    async readRevision(id) { return { restaurantId: id, revision: -1, updatedAt: null } },
  }))
})
