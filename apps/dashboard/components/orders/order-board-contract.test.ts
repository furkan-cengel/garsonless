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

test('desktop order controls use shadcn primitives while touch and narrow layouts keep safe targets', () => {
  assert.match(boardSource, /<InputGroup className="orders-search-field h-9 bg-muted\/50">/)
  assert.match(boardSource, /<InputGroupInput[\s\S]*aria-label="Siparişlerde ara"/)
  assert.match(boardSource, /minHeight: 36, padding: '6px 8px', borderRadius: 7[^\n]*transition: 'background 120ms ease'/)
  assert.match(boardSource, /<Tabs value=\{density\}/)
  assert.match(boardSource, /<SheetContent side="right"/)
  assert.match(boardSource, /<SheetContent side="left"/)
  assert.match(boardSource, /@media \(pointer: coarse\) \{[\s\S]*\.orders-touch-target,[\s\S]*min-height: 44px !important;/)
  assert.match(boardSource, /@media \(max-width: 1180px\) \{[\s\S]*\.orders-filter-option \{ min-width: 44px !important; min-height: 44px !important; \}/)
})

test('order actions use shadcn button variants and retain status context', () => {
  assert.match(boardSource, /<Button type="button" variant="outline" className="orders-topbar-action"/)
  assert.match(boardSource, /orders-topbar-action orders-action-primary/)
  assert.match(boardSource, /variant="destructive"[\s\S]{0,220}Parasal iade kaydet/)
  assert.match(boardSource, /variant="positive"[\s\S]{0,520}Masayı tahsil et/)
  assert.match(boardSource, /data-order-detail-cancel/)
  assert.match(boardSource, /data-order-detail-advance/)
  assert.match(cardSource, /data-order-action-tone=\{group\}/)
  assert.match(cardSource, /variant=\{group === 'ready' \? 'positive' : group === 'new' \? 'default' : 'outline'\}/)
})

test('density, view, source and history controls use the shared shadcn system', () => {
  assert.match(boardSource, /<TabsList>[\s\S]*<TabsTrigger key=\{value\}/)
  assert.match(boardSource, /<OrdersViewChips filter=\{filter\}/)
  assert.match(boardSource, /<Button variant="outline" className="w-full" onClick=\{onHistory\}>/)
  assert.match(boardSource, /<Button[\s\S]*className="orders-filter-option"/)
  assert.match(boardSource, /<ScrollArea className="min-h-0 flex-1">/)
})

test('history dialog uses shadcn dialog, search, tabs, feedback and receipt actions', () => {
  assert.match(historySource, /<Dialog open=\{open\} onOpenChange=/)
  assert.match(historySource, /<InputGroup className="h-9 flex-1 bg-muted\/50">/)
  assert.match(historySource, /<Tabs value=\{tab\}/)
  assert.match(historySource, /<Alert className="my-2/)
  assert.match(historySource, /<Empty className="min-h-52">/)
  assert.match(historySource, /<Button type="button" size="sm" variant="outline"/)
})

test('the board keeps three active columns; terminal orders live only in history', () => {
  assert.match(boardSource, /const BOARD_COLUMNS = ORDER_BOARD_COLUMNS\.filter\(column => column\.id !== 'done'\)/)
  assert.doesNotMatch(boardSource, /Kapananı göster/)
  assert.doesNotMatch(boardSource, /columns=\{ORDER_BOARD_COLUMNS\}|columns=\{COLUMNS\}/)
  assert.match(boardSource, /useState<FilterId>\('active'\)/)
})
