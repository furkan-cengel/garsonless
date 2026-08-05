import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { ORDER_BOARD_COLUMNS } from './order-board-contract'

const directory = fileURLToPath(new URL('.', import.meta.url))
const boardSource = readFileSync(`${directory}/OrderBoard.tsx`, 'utf8')
const cardSource = readFileSync(`${directory}/OrderCard.tsx`, 'utf8')
const historySource = readFileSync(`${directory}/HistoryModal.tsx`, 'utf8')

test('order board columns map drop destinations to canonical lifecycle targets', () => {
  assert.deepEqual(
    Object.fromEntries(ORDER_BOARD_COLUMNS.map((column) => [column.id, column.targetStatus])),
    { new: null, prep: 'sent_to_kitchen', ready: 'ready', done: 'served' },
  )
})

test('order board never exposes legacy payment status as an operational column', () => {
  assert.equal(ORDER_BOARD_COLUMNS.some((column) => column.statuses.includes('paid' as never)), false)
})

test('desktop order controls stay compact while touch and narrow layouts keep safe targets', () => {
  assert.match(boardSource, /className="orders-search-field"[\s\S]*height: 36/)
  assert.match(boardSource, /minHeight: 38, transition: 'background 120ms ease'/)
  assert.match(boardSource, /className="orders-touch-target"[\s\S]*height: 32/)
  assert.match(boardSource, /@media \(pointer: coarse\) \{[\s\S]*\.orders-touch-target,[\s\S]*min-height: 44px !important;/)
  assert.match(boardSource, /@media \(max-width: 1180px\) \{[\s\S]*\.orders-filter-option \{ min-width: 44px !important; min-height: 44px !important; \}/)
  assert.doesNotMatch(boardSource, /\.orders-filter-option \{ min-width: 44px !important; min-height: 44px !important; \}\n\.orders-search-field/)
})

test('order actions expose contextual hover feedback without animating disabled controls', () => {
  assert.match(boardSource, /orders-topbar-action orders-action-secondary/)
  assert.match(boardSource, /orders-topbar-action orders-action-primary/)
  assert.match(boardSource, /order-detail-action--critical/)
  assert.match(boardSource, /order-detail-action--positive/)
  assert.match(boardSource, /order-detail-action--secondary/)
  assert.match(boardSource, /\.orders-action-primary:not\(:disabled\):hover/)
  assert.match(boardSource, /\.order-detail-action--critical:not\(:disabled\):hover/)
  assert.match(boardSource, /\.order-detail-action--positive:not\(:disabled\):hover/)
  assert.match(boardSource, /\.orders-topbar-action:not\(:disabled\):active/)
  assert.match(cardSource, /data-order-action-tone=\{group\}/)
  assert.match(boardSource, /\.order-card-action\[data-order-action-tone="prep"\]:not\(:disabled\):hover/)
  assert.match(boardSource, /@media \(prefers-reduced-motion: reduce\)/)
})

test('density, closed-order, source and history controls expose hover feedback', () => {
  assert.match(boardSource, /orders-touch-target orders-density-option/)
  assert.match(boardSource, /orders-touch-target orders-action-secondary[\s\S]{0,300}Kapananı/)
  assert.match(boardSource, /orders-touch-target orders-action-secondary[\s\S]{0,300}Geçmiş siparişler/)
  assert.match(boardSource, /\.orders-density-option:not\(:disabled\):hover/)
  assert.match(boardSource, /\.orders-filter-option:not\(:disabled\):hover/)
  assert.match(boardSource, /\.orders-filter-option\[aria-pressed="true"\]:not\(:disabled\):hover/)
})

test('history dialog tabs, receipts and close control expose hover feedback', () => {
  assert.match(historySource, /className="order-history-action order-history-tab" aria-pressed=/)
  assert.match(historySource, /className="order-history-action order-history-receipt"/)
  assert.match(historySource, /className="order-history-action order-history-close"/)
  assert.match(historySource, /\.order-history-tab:not\(:disabled\):hover/)
  assert.match(historySource, /\.order-history-tab\[aria-pressed="true"\]:not\(:disabled\):hover/)
  assert.match(historySource, /\.order-history-receipt:not\(:disabled\):hover/)
  assert.match(historySource, /\.order-history-close:not\(:disabled\):hover/)
  assert.match(historySource, /@media \(prefers-reduced-motion: reduce\)/)
})
