import assert from 'node:assert/strict'
import test from 'node:test'
import { buildTableQuickActions, nextMenuIndex } from './table-quick-actions-model'

test('empty tables expose safe management actions and hide unauthorized order creation', () => {
  const actions = buildTableQuickActions({
    hasSession: false,
    canCreateOrders: false,
    canEditLayout: false,
    pendingRequestCount: 0,
    unpaidTotal: 0,
    declaredCashTotal: 0,
    hasUnfinished: false,
  })
  assert.deepEqual(actions.map((item) => item.id), ['details', 'rename', 'edit_layout', 'delete'])
  assert.match(actions.find((item) => item.id === 'edit_layout')?.disabledReason ?? '', /kat seçin/)
})

test('occupied tables expose canonical operations and explain unsafe close', () => {
  const actions = buildTableQuickActions({
    hasSession: true,
    canCreateOrders: true,
    canEditLayout: true,
    pendingRequestCount: 2,
    unpaidTotal: 120,
    declaredCashTotal: 0,
    hasUnfinished: false,
  })
  assert.deepEqual(actions.map((item) => item.id), [
    'details', 'add_order', 'table_move', 'order_transfer', 'account_transfer',
    'settlement', 'close_session', 'resolve_request', 'rename',
  ])
  assert.equal(actions.find((item) => item.id === 'close_session')?.disabledReason, 'Önce kalan tutarı tahsil edin.')
  assert.equal(actions.find((item) => item.id === 'resolve_request')?.label, 'Servis isteğini çöz (2)')
})

test('menu navigation wraps and supports first/last movement', () => {
  assert.equal(nextMenuIndex(2, 'ArrowDown', 3), 0)
  assert.equal(nextMenuIndex(0, 'ArrowUp', 3), 2)
  assert.equal(nextMenuIndex(1, 'Home', 3), 0)
  assert.equal(nextMenuIndex(1, 'End', 3), 2)
})
