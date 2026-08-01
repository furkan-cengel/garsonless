import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('public order tracking scopes the guest session directly to the verified table', async () => {
  const source = await readFile(new URL('./table-qr-tokens.ts', import.meta.url), 'utf8')
  const statusReader = source.slice(source.indexOf('async readOrderStatus(input)'))

  assert.match(statusReader, /\.from\('orders'\)/)
  assert.match(statusReader, /\.eq\('session_id', input\.sessionId\)/)
  assert.match(statusReader, /\.eq\('restaurant_id', resolved\.restaurantId\)/)
  assert.match(statusReader, /\.eq\('table_id', resolved\.tableId\)/)
  assert.doesNotMatch(statusReader, /\.from\('table_sessions'\)/)
})

