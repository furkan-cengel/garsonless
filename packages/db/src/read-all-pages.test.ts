import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readAllPages } from './read-all-pages'

test('reads 1001 rows without losing the last page', async () => {
  const rows = Array.from({ length: 1001 }, (_, id) => ({ id }))
  const result = await readAllPages(async (from, to) => ({ data: rows.slice(from, to + 1), error: null }))
  assert.deepEqual(result.data, rows)
})
test('does not expose a partial catalog when a later page fails', async () => {
  const result = await readAllPages(async (from) => from === 0
    ? { data: [1, 2], error: null }
    : { data: null, error: 'offline' }, 2)
  assert.deepEqual(result, { data: null, error: 'offline' })
})
