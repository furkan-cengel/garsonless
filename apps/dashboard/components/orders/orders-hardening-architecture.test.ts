import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const directory = fileURLToPath(new URL('.', import.meta.url))
const board = readFileSync(`${directory}/OrderBoard.tsx`, 'utf8')
const card = readFileSync(`${directory}/OrderCard.tsx`, 'utf8')
const dnd = readFileSync(`${directory}/OrderBoardDnd.tsx`, 'utf8')
const realtime = readFileSync(`${directory}/useOrdersRealtime.ts`, 'utf8')
const skeleton = readFileSync(`${directory}/../layout/DashboardRouteSkeleton.tsx`, 'utf8')

test('mobile orders expose counted tabs and only the selected stage', () => {
  assert.match(board, /orders-mobile-stage-tabs/)
  assert.match(board, /aria-controls=\{`orders-stage-\$\{column\.id\}`\}/)
  assert.match(dnd, /data-mobile-active/)
  assert.match(board, /data-mobile-active="false"\]\s*\{ display: none;/)
})

test('orders route skeleton mirrors tablet and phone workspaces', () => {
  assert.match(skeleton, /@media \(max-width: 1180px\)[\s\S]*dashboard-route-skeleton-topbar--orders[\s\S]*height: 104px/)
  assert.match(skeleton, /dashboard-route-skeleton-orders-toolbar/)
  assert.match(skeleton, /dashboard-route-skeleton-orders-tabs/)
  assert.match(skeleton, /dashboard-route-skeleton-orders-column:not\(:first-child\)/)
})

test('elapsed projection uses one board clock instead of a timer per card', () => {
  assert.doesNotMatch(card, /setInterval|setTimeout/)
  assert.match(board, /60_000 - \(Date\.now\(\) % 60_000\)/)
})

test('orders realtime listens to narrow tenant invalidations only', () => {
  assert.match(realtime, /table: 'pano_invalidations'/)
  assert.match(realtime, /payload\.new\['source'\] === 'orders'/)
  assert.doesNotMatch(realtime, /table: 'orders'/)
})

test('routine order reconciliation does not insert a layout-shifting warning strip', () => {
  assert.match(realtime, /reconcileLive\(false\)/)
  assert.match(board, /connectionStatus === 'offline' \|\| connectionStatus === 'stale'/)
  assert.doesNotMatch(board, /connectionStatus !== 'live'/)
  assert.match(board, /\.orders-connection-notice\s*\{[\s\S]*?position: fixed;/)
})

test('keyboard drag and drop exposes Turkish instructions and announcements', () => {
  assert.match(dnd, /KeyboardSensor/)
  assert.match(dnd, /sortableKeyboardCoordinates/)
  assert.match(dnd, /Siparişi taşımak için boşluk tuşuna basın/)
  assert.match(dnd, /onDragEnd/)
})
