import assert from 'node:assert/strict'
import test from 'node:test'
import type { TableStatusData } from '../../lib/queries/pano'
import { buildPanoTasks, countTableStates } from './pano-shift-model'

const now = new Date('2026-10-26T14:45:00Z').getTime()
const table = (id: string, label: string, status: TableStatusData['status'], extra: Partial<TableStatusData> = {}): TableStatusData => ({
  id, label, status, time: 62, total: 0, sessionId: 's', openedAt: null, unpaidTotal: 760, splitSettledTotal: 0,
  splitDeclaredCashTotal: 0, orderCount: 1, hasUnfinished: false, ...extra,
})
const input = {
  restaurantId: 'r',
  now,
  tables: [table('t3', 'Masa 3', 'late'), table('b1', 'Bahçe 1', 'stale'), table('t8', 'Masa 8', 'active'), table('t5', 'Masa 5', 'empty')],
  serviceRequests: [{ id: 'sr', tableId: 't8', createdAt: '2026-10-26T14:45:00Z', requestType: 'waiter' as const }],
  orders: [
    { id: 'o1', status: 'ready' as const, tableId: 't6', tableLabel: 'Masa 6', createdAt: '2026-10-26T14:30:00Z', readyAt: '2026-10-26T14:39:00Z', summary: '2× Cappuccino, Tiramisu' },
    { id: 'o2', status: 'pending_approval' as const, tableId: null, tableLabel: null, createdAt: '2026-10-26T14:38:00Z', readyAt: null, summary: '3× Ice latte' },
  ],
  notices: [],
  showMoney: true,
  can: { orders: true, tables: true },
}

test('now holds what a guest waits on; soon holds approvals and stale tables', () => {
  const tasks = buildPanoTasks(input)
  assert.deepEqual(tasks.map((task) => [task.group, task.tone, task.actionLabel]), [
    ['now', 'late', 'Tahsilata geç'],
    ['now', 'serve', 'Servis edildi'],
    ['now', 'call', 'Tamamla'],
    ['soon', 'approve', 'Onayla'],
    ['soon', 'stale', 'İncele'],
  ])
  assert.equal(tasks[1]?.sub, '2× Cappuccino, Tiramisu · 6 dk’dır serviste bekliyor')
  assert.equal(tasks[3]?.title, 'Paket / kasa · onay bekliyor')
  assert.deepEqual(tasks[0]?.action, { kind: 'open', href: '/dashboard/r/tables?tableId=t3' })
})

test('the service view never shows money and missing sections hide actions', () => {
  const tasks = buildPanoTasks({ ...input, showMoney: false, can: { orders: false, tables: true } })
  assert.doesNotMatch(tasks.map((task) => `${task.title} ${task.sub}`).join(' '), /₺/)
  assert.equal(tasks.find((task) => task.tone === 'serve')?.action, null)
  assert.match(buildPanoTasks(input)[0]?.sub ?? '', /₺760/)
})

test('table states are counted in scan order and empty is always shown', () => {
  assert.deepEqual(countTableStates(input.tables).map((state) => `${state.label} ${state.count}`), ['Gecikiyor 1', 'Dünden açık 1', 'Açık 1', 'Boş 1'])
})
