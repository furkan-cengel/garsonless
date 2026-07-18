import assert from 'node:assert/strict'
import test from 'node:test'
import {
  applySessionsToTables,
  beginQRHistoryChange,
  buildUrl,
  createQRHistory,
  defaultQR,
  filterTables,
  normalizeQRStyle,
  pushQRHistory,
  qrContrast,
  removePendingRequest,
  removeTableFromList,
  replaceTableQrToken,
  renameTableInList,
  requestsByTable,
  sessionRequiresSettlement,
  redoQRHistory,
  replaceQRHistory,
  undoQRHistory,
} from './tables-builder-model'
import type { OpenSessionInfo } from '../../lib/actions/tables'

test('persisted custom domaini canlandırmaz ve geçersiz enumları varsayılana çeker', () => {
  const normalized = normalizeQRStyle({
    baseUrl: 'https://attacker.example/menu',
    ecl: 'X',
    colorType: 'anything',
    gradType: 'anything',
    frameTitle: 'Masanız',
  }, 'https://menu.masabu.co/test-cafe-b')

  assert.equal(normalized.baseUrl, 'https://menu.masabu.co/test-cafe-b')
  assert.equal(normalized.ecl, 'H')
  assert.equal(normalized.colorType, 'single')
  assert.equal(normalized.gradType, 'linear')
  assert.equal(normalized.frameTitle, 'Masanız')
})

test('masa araması Türkçe etiketi ve kısa slug değerini normalize eder', () => {
  const tables = [
    { id: 'a', qrToken: 'a', label: 'İç Bahçe', slug: 'b01', orders: 0, status: 'idle' as const },
    { id: 'b', qrToken: 'b', label: 'Bar', slug: 'ba', orders: 0, status: 'idle' as const },
  ]

  assert.deepEqual(filterTables(tables, '  İÇ  ').map((table) => table.id), ['a'])
  assert.deepEqual(filterTables(tables, 'ba').map((table) => table.id), ['a', 'b'])
  assert.equal(filterTables(tables, ''), tables)
})

test('rename sıra tabanlı slugı yeniler ve aktif masa silinince ilk kalan masayı seçer', () => {
  const tables = [
    { id: 'a', qrToken: 'a', label: 'Masa 1', slug: '01', orders: 0, status: 'idle' as const },
    { id: 'b', qrToken: 'b', label: 'Masa 2', slug: '02', orders: 0, status: 'idle' as const },
  ]
  const renamed = renameTableInList(tables, 'b', 'Bahçe')
  assert.equal(renamed[1]?.slug, 'b02')

  assert.deepEqual(removeTableFromList(renamed, 'a', 'a'), {
    tables: [renamed[1]],
    activeId: 'b',
  })
  assert.equal(removeTableFromList(renamed, 'a', 'b').activeId, 'b')
})

test('QR token rotasyonu yalnız hedef masanın public credential değerini değiştirir', () => {
  const tables = [
    { id: 'a', qrToken: 'old-a', label: 'Masa 1', slug: '01', orders: 0, status: 'idle' as const },
    { id: 'b', qrToken: 'old-b', label: 'Masa 2', slug: '02', orders: 0, status: 'idle' as const },
  ]

  const rotated = replaceTableQrToken(tables, 'a', 'new-a')

  assert.deepEqual(rotated.map(({ id, qrToken }) => ({ id, qrToken })), [
    { id: 'a', qrToken: 'new-a' },
    { id: 'b', qrToken: 'old-b' },
  ])
  assert.notEqual(rotated, tables)
  assert.equal(rotated[1], tables[1])
})

test('QR URL revocable token kullanır ve UTM özel karakterlerini encode eder', () => {
  const qr = {
    ...defaultQR('https://menu.masabu.co/test-cafe-b'),
    utmCampaign: 'Yaz & Kış?',
  }
  const url = new URL(buildUrl(qr, {
    id: 'internal-table-id',
    qrToken: 'revocable-token',
    label: 'Masa 1',
    slug: '01',
    orders: 0,
    status: 'idle',
  }))

  assert.equal(url.pathname, '/test-cafe-b/table/revocable-token')
  assert.equal(url.searchParams.get('utm_campaign'), 'Yaz & Kış?')
  assert.equal(url.href.includes('internal-table-id'), false)
})

test('history undo sonrası yeni değişiklikte redo kuyruğunu keser', () => {
  const first = defaultQR('https://menu.masabu.co/test')
  const second = { ...first, margin: 20 }
  const third = { ...first, margin: 30 }
  let history = createQRHistory(first)
  history = pushQRHistory(history, second)
  history = pushQRHistory(history, third)
  history = undoQRHistory(history)
  history = pushQRHistory(history, { ...second, margin: 24 })

  assert.deepEqual(history.stack.map((item) => item.margin), [10, 20, 24])
  assert.equal(redoQRHistory(history), history)
})

test('slider begin + replace tek undo adımı olarak davranır', () => {
  const first = defaultQR('https://menu.masabu.co/test')
  let history = createQRHistory(first)
  history = beginQRHistoryChange(history)
  history = replaceQRHistory(history, { ...first, size: 720 })

  assert.equal(history.stack.length, 2)
  assert.equal(history.stack[history.index]?.size, 720)
  assert.equal(undoQRHistory(history).stack[0]?.size, 600)
})

test('history son 60 snapshot ile sınırlıdır ve gradient kontrastında zayıf rengi esas alır', () => {
  const first = defaultQR('https://menu.masabu.co/test')
  let history = createQRHistory(first)
  for (let margin = 11; margin <= 80; margin += 1) {
    history = pushQRHistory(history, { ...first, margin })
  }

  assert.equal(history.stack.length, 60)
  assert.equal(history.stack[0]?.margin, 21)
  assert.equal(qrContrast({ ...first, colorType: 'gradient', fg: '#000000', fg2: '#ffffff' }), 1)
})

test('session aggregate masa görünümünü authoritative active/idle durumuna katlar', () => {
  const tables = [
    { id: 'table-a', qrToken: 'a', label: 'Masa A', slug: 'a', orders: 9, status: 'active' as const },
    { id: 'table-b', qrToken: 'b', label: 'Masa B', slug: 'b', orders: 2, status: 'active' as const },
  ]
  const session = {
    sessionId: 'session-a',
    tableId: 'table-a',
    openedAt: '2026-07-16T08:00:00.000Z',
    total: 125,
    unpaidTotal: 25,
    splitSettledTotal: 0,
    splitDeclaredCashTotal: 0,
    orderCount: 3,
    hasUnfinished: true,
  } satisfies OpenSessionInfo

  const projected = applySessionsToTables(tables, { 'table-a': session })

  assert.deepEqual(projected.map(({ id, status, orders }) => ({ id, status, orders })), [
    { id: 'table-a', status: 'active', orders: 3 },
    { id: 'table-b', status: 'idle', orders: 0 },
  ])
})

test('pending servis isteklerini masa bazında gruplar ve son istek silinince boş grubu düşürür', () => {
  const grouped = requestsByTable([
    { id: 'req-1', tableId: 'table-a', label: 'Garson' },
    { id: 'req-2', tableId: 'table-a', label: 'Hesap' },
    { id: 'req-3', tableId: 'table-b', label: 'Su' },
  ])

  assert.deepEqual(grouped, {
    'table-a': [{ id: 'req-1', label: 'Garson' }, { id: 'req-2', label: 'Hesap' }],
    'table-b': [{ id: 'req-3', label: 'Su' }],
  })
  assert.deepEqual(removePendingRequest(grouped, 'req-3'), {
    'table-a': [{ id: 'req-1', label: 'Garson' }, { id: 'req-2', label: 'Hesap' }],
  })
})

test('ödenmemiş veya nakit onayı bekleyen session doğrudan kapatılamaz', () => {
  const paidSession = {
    sessionId: 'session-a', tableId: 'table-a', openedAt: '2026-07-16T08:00:00.000Z',
    total: 100, unpaidTotal: 0, splitSettledTotal: 100, splitDeclaredCashTotal: 0,
    orderCount: 1, hasUnfinished: false,
  } satisfies OpenSessionInfo

  assert.equal(sessionRequiresSettlement(paidSession), false)
  assert.equal(sessionRequiresSettlement({ ...paidSession, unpaidTotal: 1 }), true)
  assert.equal(sessionRequiresSettlement({ ...paidSession, splitDeclaredCashTotal: 1 }), true)
})
