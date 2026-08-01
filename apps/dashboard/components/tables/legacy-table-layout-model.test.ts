import assert from 'node:assert/strict'
import test from 'node:test'
import type { TableItem } from './tables-builder-types'
import { legacyTableLayoutStorageKey, parseLegacyTableLayout } from './legacy-table-layout-model'

function table(id: string, seatCount = 4): TableItem {
  return {
    id, label: id, floorLabel: 'Zemin', areaLabel: null, qrToken: null, slug: id,
    layoutXBp: null, layoutYBp: null, layoutShape: 'rectangle', layoutRotation: 0,
    seatCount, orders: 0, status: 'idle',
  }
}

test('legacy plan imports only known tables and converts percentages to bounded basis points', () => {
  const candidate = parseLegacyTableLayout(JSON.stringify({
    a: { x: 8.25, y: 14, zone: 'İç salon', seats: 6 },
    b: { x: 99, y: 99, seats: 80 },
    deleted: { x: 20, y: 20, seats: 2 },
  }), [table('a'), table('b', 3)])

  assert.deepEqual(candidate, {
    entries: [
      { tableId: 'a', xBp: 825, yBp: 1400, shape: 'rectangle', rotation: 0, seatCount: 6 },
      { tableId: 'b', xBp: 8150, yBp: 8550, shape: 'rectangle', rotation: 0, seatCount: 3 },
    ],
    sourceCount: 3,
    skippedCount: 1,
  })
})

test('malformed, empty and coordinate-invalid legacy plans fail closed', () => {
  assert.equal(parseLegacyTableLayout('{', [table('a')]), null)
  assert.equal(parseLegacyTableLayout('[]', [table('a')]), null)
  assert.equal(parseLegacyTableLayout(JSON.stringify({ a: { x: -1, y: 20 } }), [table('a')]), null)
  assert.equal(parseLegacyTableLayout(JSON.stringify({ unknown: { x: 10, y: 10 } }), [table('a')]), null)
})

test('legacy storage key remains restaurant scoped', () => {
  assert.equal(legacyTableLayoutStorageKey('restaurant-a'), 'garsonless-floor:restaurant-a')
})
