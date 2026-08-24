import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const source = readFileSync(new URL('./dashboard-read-model-port.ts', import.meta.url), 'utf8')

test('orders board starts independent snapshots in one parallel boundary', () => {
  assert.match(source, /Promise\.all\(\[\s*appendPages\(OPEN_ORDER_STATUSES\),\s*appendPages\(\['served', 'cancelled'\], since\),[\s\S]*from\('tables'\)[\s\S]*from\('kitchen_credentials'\)/)
})

test('orders board only continues pagination while a full page was returned', () => {
  assert.match(source, /if \(page\.length < pageSize\) break/)
})
