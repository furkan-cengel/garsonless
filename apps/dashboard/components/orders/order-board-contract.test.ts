import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { ORDER_BOARD_COLUMNS } from './order-board-contract'

const directory = fileURLToPath(new URL('.', import.meta.url))
const boardSource = readFileSync(`${directory}/OrderBoard.tsx`, 'utf8')

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
