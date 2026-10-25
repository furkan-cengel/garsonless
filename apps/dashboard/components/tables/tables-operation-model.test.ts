import assert from 'node:assert/strict'
import test from 'node:test'
import type { OpenTableSessionView, TableItem } from './tables-builder-types'
import {
  activeOperationalFilterCount,
  resolveLayoutEditAccess,
  filterOperationalTables,
  normalizeTableLocation,
  operationalStateCounts,
  resolveTableDeepLink,
  sessionDuration,
  sortTablesByAttention,
  TABLE_LATE_AFTER_MINUTES,
  tableLocationOptions,
  tableOperationalState,
  UNASSIGNED_LOCATION_FILTER,
} from './tables-operation-model'

const now = Date.parse('2026-07-28T12:00:00.000Z')
const table = (input: Partial<TableItem> & Pick<TableItem, 'id' | 'label'>): TableItem => ({
  qrToken: input.id,
  slug: input.id,
  orders: 0,
  status: 'idle',
  floorLabel: null,
  areaLabel: null,
  layoutXBp: null,
  layoutYBp: null,
  layoutShape: 'rectangle',
  layoutRotation: 0,
  seatCount: 4,
  ...input,
})
const session = (input: Partial<OpenTableSessionView> & Pick<OpenTableSessionView, 'tableId'>): OpenTableSessionView => ({
  sessionId: `session-${input.tableId}`,
  openedAt: new Date(now - 10 * 60_000).toISOString(),
  total: 0,
  unpaidTotal: 100,
  splitSettledTotal: 0,
  splitDeclaredCashTotal: 0,
  orderCount: 0,
  hasUnfinished: false,
  ...input,
})

test('operasyon durumu boş, yeni, açık ve geciken adisyonu tek eşikle ayırır', () => {
  assert.equal(tableOperationalState(undefined, now), 'empty')
  assert.equal(tableOperationalState(session({ tableId: 'new' }), now), 'new')
  assert.equal(tableOperationalState(session({ tableId: 'open', orderCount: 2 }), now), 'open')
  assert.equal(tableOperationalState(session({
    tableId: 'late',
    openedAt: new Date(now - TABLE_LATE_AFTER_MINUTES * 60_000).toISOString(),
  }), now), 'late')
})

test('gecikme sipariş sayısından önce gelir ve geçersiz tarih güvenli biçimde yeni kalır', () => {
  assert.equal(tableOperationalState(session({
    tableId: 'late-empty',
    orderCount: 0,
    openedAt: new Date(now - 90 * 60_000).toISOString(),
  }), now), 'late')
  assert.equal(tableOperationalState(session({ tableId: 'invalid', openedAt: 'invalid' }), now), 'new')
})

test('arama, durum, kat, alan ve atanmamış filtreleri aynı projection üzerinde birleşir', () => {
  const tables = [
    table({ id: 'garden', label: 'İç Bahçe 1', floorLabel: 'Zemin', areaLabel: 'Bahçe' }),
    table({ id: 'terrace', label: 'Masa 2', floorLabel: '1. Kat', areaLabel: 'Teras' }),
    table({ id: 'unknown', label: 'Bar 1' }),
  ]
  const sessions = {
    garden: session({ tableId: 'garden', orderCount: 1 }),
    terrace: session({ tableId: 'terrace', orderCount: 2, openedAt: new Date(now - 50 * 60_000).toISOString() }),
  }

  assert.deepEqual(filterOperationalTables(tables, sessions, {
    query: 'teras', state: 'late', floorLabel: '1. Kat', areaLabel: 'Teras',
  }, now).map((item) => item.id), ['terrace'])
  assert.deepEqual(filterOperationalTables(tables, sessions, {
    query: '', state: 'empty', floorLabel: UNASSIGNED_LOCATION_FILTER, areaLabel: UNASSIGNED_LOCATION_FILTER,
  }, now).map((item) => item.id), ['unknown'])
})

test('mobil filtre rozeti yalnız etkin arama ve seçimleri sayar', () => {
  assert.equal(activeOperationalFilterCount({
    query: '  masa ', state: 'late', floorLabel: 'Zemin', areaLabel: '',
  }), 3)
  assert.equal(activeOperationalFilterCount({
    query: '   ', state: 'all', floorLabel: '', areaLabel: '',
  }), 0)
})

test('durum sayıları birbirini dışlar, konum seçenekleri Türkçe sıralanır', () => {
  const tables = [
    table({ id: 'a', label: 'A', floorLabel: 'Zemin', areaLabel: 'Salon' }),
    table({ id: 'b', label: 'B', floorLabel: '1. Kat', areaLabel: 'Bahçe' }),
    table({ id: 'c', label: 'C' }),
  ]
  assert.deepEqual(operationalStateCounts(tables, {
    a: session({ tableId: 'a' }),
    b: session({ tableId: 'b', orderCount: 2 }),
  }, now), { empty: 1, new: 1, open: 1, late: 0, stale: 0, paid: 0 })
  assert.deepEqual(tableLocationOptions(tables, 'floorLabel'), {
    values: ['1. Kat', 'Zemin'], hasUnassigned: true,
  })
})

test('konum ve süre sunumu whitespace, uzunluk ve saat sınırlarını normalize eder', () => {
  assert.equal(normalizeTableLocation('  Zemin  '), 'Zemin')
  assert.equal(normalizeTableLocation('   '), null)
  assert.equal(normalizeTableLocation('a'.repeat(50))?.length, 40)
  assert.equal(sessionDuration(new Date(now - 75 * 60_000).toISOString(), now), '1 sa 15 dk')
})

test('masa deep-link yalnız görünür tenant tablosundaki tam kimliği kabul eder', () => {
  const visibleTables = [{ id: 'table-owned' }, { id: 'table-other-owned' }]
  assert.equal(resolveTableDeepLink('table-owned', visibleTables), 'table-owned')
  assert.equal(resolveTableDeepLink('table-foreign', visibleTables), null)
  assert.equal(resolveTableDeepLink(['table-owned'], visibleTables), null)
  assert.equal(resolveTableDeepLink('table-owned '.repeat(20), visibleTables), null)
})

test('önceki işletme günü ve tahsilat durumları servis gecikmesinden ayrılır', () => {
  const restaurantDayStart = Date.parse('2026-07-28T03:00:00Z')
  assert.equal(tableOperationalState(session({ tableId: 'old', restaurantDayStart, openedAt: '2026-07-28T02:59:59Z' }), now), 'stale')
  assert.equal(tableOperationalState(session({ tableId: 'paid', orderCount: 1, unpaidTotal: 0, restaurantDayStart }), now), 'paid')
  assert.equal(sessionDuration(new Date(now - 334 * 3_600_000).toISOString(), now), '13 gün 22 sa')
})

test('layout editor explains the missing floor and offers the unassigned bucket', () => {
  const unnamed = [{ floorLabel: null }, { floorLabel: '  ' }]
  assert.equal(resolveLayoutEditAccess(unnamed, '', null).canEditUnassigned, true)
  assert.match(resolveLayoutEditAccess(unnamed, '', null).disabledReason ?? '', /kat adı yok/)
  assert.deepEqual(resolveLayoutEditAccess([{ floorLabel: 'Teras' }], '', null), { disabledReason: 'Düzeni düzenlemek için yukarıdaki sekmelerden bir kat seç.', canEditUnassigned: false })
  assert.deepEqual(resolveLayoutEditAccess(unnamed, 'Teras', null), { disabledReason: null, canEditUnassigned: false })
  assert.deepEqual(resolveLayoutEditAccess(unnamed, '', 'Yüklenemedi'), { disabledReason: 'Yüklenemedi', canEditUnassigned: false })
  assert.equal(resolveLayoutEditAccess([], '', null).canEditUnassigned, false)
})

test('liste geciken masayı en üste alır, aynı durumdaki masaların sırasını korur', () => {
  const tables = ['a', 'b', 'c', 'd', 'e'].map((id) => table({ id, label: id }))
  const sessions = {
    b: session({ tableId: 'b', orderCount: 1 }),
    c: session({ tableId: 'c', orderCount: 1, openedAt: new Date(now - 60 * 60_000).toISOString() }),
    e: session({ tableId: 'e', orderCount: 1 }),
  }
  assert.deepEqual(sortTablesByAttention(tables, sessions, now).map((item) => item.id), ['c', 'b', 'e', 'a', 'd'])
})
