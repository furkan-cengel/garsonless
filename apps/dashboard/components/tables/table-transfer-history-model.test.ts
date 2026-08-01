import assert from 'node:assert/strict'
import test from 'node:test'
import {
  EMPTY_TRANSFER_HISTORY_FILTERS,
  filterTransferHistory,
  transferSessionOutcome,
  transferKindLabel,
  type TransferHistoryViewItem,
} from './table-transfer-history-model'

function historyItem(overrides: Partial<TransferHistoryViewItem> = {}): TransferHistoryViewItem {
  return {
    id: 'operation-a',
    kind: 'table_move',
    sourceTableId: 'table-a',
    targetTableId: 'table-b',
    sourceSessionId: 'session-a',
    targetSessionId: 'session-a',
    status: 'active',
    requestId: 'request-a',
    sourceSessionClosed: false,
    targetSessionCreated: false,
    createdBy: 'actor-a',
    actorLabel: 'Siz',
    createdAt: '2026-07-28T10:00:00.000Z',
    undoneBy: null,
    undoActorLabel: null,
    undoneAt: null,
    lockReason: null,
    orderCount: 2,
    ...overrides,
  }
}

test('history filters combine kind, status and Turkish query projection', () => {
  const history = [
    historyItem(),
    historyItem({
      id: 'operation-b',
      requestId: 'request-b',
      kind: 'account_transfer',
      status: 'undone',
      sourceTableId: 'table-c',
      actorLabel: 'Başka bir yetkili',
    }),
  ]
  const filtered = filterTransferHistory(history, {
    query: 'YETKİLİ',
    kind: 'account_transfer',
    status: 'undone',
  }, {
    'table-a': 'Bahçe 1',
    'table-b': 'Salon 2',
    'table-c': 'Teras 3',
  })
  assert.deepEqual(filtered.map((item) => item.id), ['operation-b'])
  assert.equal(filterTransferHistory(history, { ...EMPTY_TRANSFER_HISTORY_FILTERS, query: 'bahçe' }, { 'table-a': 'Bahçe 1' }).length, 1)
})

test('session outcome distinguishes move, new target and occupied-target merge', () => {
  assert.equal(transferSessionOutcome(historyItem()), 'Açık adisyon hedef masaya taşındı.')
  assert.equal(
    transferSessionOutcome(historyItem({ kind: 'account_transfer', targetSessionCreated: true, sourceSessionClosed: false })),
    'Hedefte yeni adisyon oluşturuldu. Kaynak adisyon açık kaldı.',
  )
  assert.equal(
    transferSessionOutcome(historyItem({ kind: 'account_transfer', targetSessionCreated: false, sourceSessionClosed: true })),
    'Siparişler hedefteki açık adisyonla birleştirildi. Kaynak adisyon kapatıldı.',
  )
  assert.equal(transferKindLabel('item_transfer'), 'Ürün taşıma')
  assert.equal(
    transferSessionOutcome(historyItem({ kind: 'item_transfer', targetSessionCreated: false, sourceSessionClosed: false })),
    'Ürünler hedefteki açık adisyona eklendi. Kaynak adisyon açık kaldı.',
  )
})
