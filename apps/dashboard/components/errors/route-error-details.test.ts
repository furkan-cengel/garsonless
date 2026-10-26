import assert from 'node:assert/strict'
import test from 'node:test'
import { routeErrorDetails } from './route-error-details'

const at = new Date('2026-10-26T16:45:19Z')

test('server errors show only their reference; client errors show their type and message', () => {
  const server = Object.assign(new Error('hidden in production'), { digest: '4211' })
  assert.deepEqual(routeErrorDetails(server, '/dashboard/r/tables/qr', at).map((item) => item.label), ['Ekran', 'Zaman', 'Referans'])
  const client = new DOMException("Failed to execute 'removeChild'", 'NotFoundError')
  const details = routeErrorDetails(client as unknown as Error, '/dashboard/r/tables/qr', at)
  assert.equal(details.find((item) => item.label === 'Hata')?.value, "NotFoundError: Failed to execute 'removeChild'")
})

test('long messages are capped for the screen and the copied report', () => {
  const details = routeErrorDetails(new Error('x'.repeat(500)), null, at)
  assert.equal(details[0]?.value, '-')
  assert.ok((details.find((item) => item.label === 'Hata')?.value.length ?? 0) <= 240)
})
