import assert from 'node:assert/strict'
import test from 'node:test'
import type { TableItem } from './tables-builder-types'
import {
  applyLayoutSnapshotToTables,
  buildTableLayoutDraft,
  buildTableLayoutOverviewDraft,
  clampTableLayoutEntry,
  collidingTableIds,
  patchTableLayoutEntry,
  tableLayoutDimensions,
  tableLayoutEntries,
} from './table-floor-layout-model'

function table(id: string, label: string, floorLabel: string | null = 'Zemin'): TableItem {
  return {
    id,
    label,
    floorLabel,
    areaLabel: null,
    qrToken: null,
    slug: id,
    layoutXBp: null,
    layoutYBp: null,
    layoutShape: 'rectangle',
    layoutRotation: 0,
    seatCount: 4,
    orders: 0,
    status: 'idle',
  }
}

test('unpositioned tables receive deterministic label-ordered normalized coordinates', () => {
  const draft = buildTableLayoutDraft([
    table('c', 'Masa 11'),
    table('b', 'Masa 2'),
    table('a', 'Masa 1'),
  ])
  assert.deepEqual(draft['a'], {
    tableId: 'a', xBp: 450, yBp: 650, shape: 'rectangle', rotation: 0, seatCount: 4,
  })
  assert.deepEqual(draft['b'], {
    tableId: 'b', xBp: 2400, yBp: 650, shape: 'rectangle', rotation: 0, seatCount: 4,
  })
  assert.deepEqual(draft['c'], {
    tableId: 'c', xBp: 4350, yBp: 650, shape: 'rectangle', rotation: 0, seatCount: 4,
  })
})

test('authoritative snapshot wins over stale table projection and preserves physical properties', () => {
  const source = { ...table('a', 'Masa 1'), layoutXBp: 10, layoutYBp: 20 }
  const draft = buildTableLayoutDraft([source], {
    revision: 3,
    initializedAt: '2026-07-29T10:00:00.000Z',
    entries: [{ tableId: 'a', xBp: 4200, yBp: 3600, shape: 'square', rotation: 90, seatCount: 6 }],
  })
  assert.deepEqual(draft['a'], {
    tableId: 'a', xBp: 4200, yBp: 3600, shape: 'square', rotation: 90, seatCount: 6,
  })
})

test('shape and rotation determine bounded card dimensions', () => {
  assert.deepEqual(tableLayoutDimensions({ shape: 'square', rotation: 90 }), { widthBp: 1500, heightBp: 1500 })
  assert.deepEqual(tableLayoutDimensions({ shape: 'rectangle', rotation: 0 }), { widthBp: 1850, heightBp: 1450 })
  assert.deepEqual(tableLayoutDimensions({ shape: 'rectangle', rotation: 90 }), { widthBp: 1450, heightBp: 1850 })
  assert.deepEqual(clampTableLayoutEntry({ tableId: 'a', xBp: 9800, yBp: -20, shape: 'rectangle', rotation: 0, seatCount: 30 }), {
    tableId: 'a', xBp: 8150, yBp: 0, shape: 'rectangle', rotation: 0, seatCount: 20,
  })
})

test('all-floors overview uses one coordinate space instead of overlapping floor-local positions', () => {
  const tables = [
    table('a', 'Masa 1', 'Zemin'),
    table('b', 'Masa 2', '1. Kat'),
    table('c', 'Masa 3', 'Teras'),
  ]
  const floorDraft = buildTableLayoutDraft(tables)
  assert.equal(new Set(Object.values(floorDraft).map((entry) => `${entry.xBp}:${entry.yBp}`)).size, 1)
  const overview = buildTableLayoutOverviewDraft(tables)
  assert.equal(new Set(Object.values(overview).map((entry) => `${entry.xBp}:${entry.yBp}`)).size, 3)
  assert.deepEqual([...collidingTableIds(tables.map((item) => ({ ...item, floorLabel: null })), overview)], [])
})

test('patching is immutable, bounded and serializes in stable table order', () => {
  const initial = buildTableLayoutDraft([table('b', 'B'), table('a', 'A')])
  const patched = patchTableLayoutEntry(initial, 'a', { xBp: 9999, shape: 'square', seatCount: 8 })
  assert.notEqual(patched, initial)
  assert.equal(patched['a']?.xBp, 8500)
  assert.equal(initial['a']?.xBp, 450)
  assert.deepEqual(tableLayoutEntries(patched).map((entry) => entry.tableId), ['a', 'b'])
})

test('collision detection is floor scoped', () => {
  const tables = [table('a', 'A'), table('b', 'B'), table('c', 'C', '1. Kat')]
  const draft = buildTableLayoutDraft(tables)
  const overlapped = {
    ...draft,
    b: { ...draft['b']!, xBp: draft['a']!.xBp, yBp: draft['a']!.yBp },
    c: { ...draft['c']!, xBp: draft['a']!.xBp, yBp: draft['a']!.yBp },
  }
  assert.deepEqual([...collidingTableIds(tables, overlapped)].sort(), ['a', 'b'])
})

test('saved snapshot updates only layout fields in the shared table projection', () => {
  const source = table('a', 'Masa 1')
  const [updated] = applyLayoutSnapshotToTables([source], {
    revision: 1,
    initializedAt: '2026-07-29T10:00:00.000Z',
    entries: [{ tableId: 'a', xBp: 100, yBp: 200, shape: 'square', rotation: 90, seatCount: 2 }],
  })
  assert.deepEqual(updated, {
    ...source,
    layoutXBp: 100,
    layoutYBp: 200,
    layoutShape: 'square',
    layoutRotation: 90,
    seatCount: 2,
  })
})
