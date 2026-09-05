import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readBoundedRequestBody } from './request-body'

test('preserves exact signed bytes across UTF-8 chunk boundaries at the limit', async () => {
  const bytes = new TextEncoder().encode('{"ad":"çay"}\r\n')
  const body = new ReadableStream<Uint8Array>({ start(c) {
    c.enqueue(bytes.slice(0, 8)); c.enqueue(bytes.slice(8)); c.close()
  } })
  assert.deepEqual(await readBoundedRequestBody({ headers: new Headers(), body }, bytes.length), { ok: true, bytes })
})

test('cancels an undeclared or underdeclared stream as soon as it exceeds the limit', async () => {
  for (const declared of [null, '1']) {
    let cancelled = false
    let reads = 0
    const body = new ReadableStream<Uint8Array>({
      pull(c) { reads++; c.enqueue(new Uint8Array(4)) },
      cancel() { cancelled = true },
    }, { highWaterMark: 0 })
    const headers = new Headers(declared === null ? {} : { 'content-length': declared })
    assert.deepEqual(await readBoundedRequestBody({ headers, body }, 7), { ok: false, status: 413 })
    assert.equal(cancelled, true)
    assert.equal(reads, 2)
  }
})

test('rejects invalid lengths and broken streams without a successful body', async () => {
  for (const value of ['-1', '1.5', 'NaN', '9007199254740992']) {
    assert.deepEqual(await readBoundedRequestBody({ headers: new Headers({ 'content-length': value }), body: null }, 10), { ok: false, status: 400 })
  }
  const body = new ReadableStream<Uint8Array>({ pull(c) { c.error(new Error('connection lost')) } })
  assert.deepEqual(await readBoundedRequestBody({ headers: new Headers(), body }, 10), { ok: false, status: 400 })
})
