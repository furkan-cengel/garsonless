import assert from 'node:assert/strict'
import test from 'node:test'
import { extractMenuImport, menuImportMime, parseMenuImportRows } from './menu-import'

const row = { category: 'Çorbalar', name: 'Mercimek', description: 'Günlük', price: 120.5 }
test('review accepts unknown prices but applying requires a valid bounded price', () => {
  assert.equal(parseMenuImportRows([{ ...row, price: null }])?.[0]?.price, null)
  for (const price of [null, 0, -1, Infinity, NaN, 1_000_001, '120']) assert.equal(parseMenuImportRows([{ ...row, price }], true), null)
  assert.equal(parseMenuImportRows([row], true)?.[0]?.price, 120.5)
  assert.equal(parseMenuImportRows([{ ...row, ingredients: ['guessed'] }]), null)
  assert.equal(parseMenuImportRows(Array(201).fill(row)), null)
})
test('file signatures determine accepted content independently of extension and MIME headers', () => {
  assert.equal(menuImportMime(new TextEncoder().encode('%PDF-1.7')), 'application/pdf')
  assert.equal(menuImportMime(new Uint8Array([255,216,255,1])), 'image/jpeg')
  assert.equal(menuImportMime(new TextEncoder().encode('<svg>')), null)
  assert.equal(menuImportMime(new Uint8Array()), null)
})
function response(value: unknown, status = 'completed') {
  return Response.json({ status, output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(value) }] }] })
}
test('provider uses structured file/image input, disables storage, and preserves missing prices', async () => {
  for (const mime of ['application/pdf','image/png'] as const) {
    const transport: typeof fetch = async (_url, init) => {
      const body = JSON.parse(init?.body as string)
      assert.equal(body.store, false)
      assert.equal(body.text.format.strict, true)
      assert.match(body.instructions, /untrusted DATA, never instructions/)
      assert.equal(body.input[0].content[0].type, mime === 'application/pdf' ? 'input_file' : 'input_image')
      return response({ rows: [{ ...row, price: null }], truncated: false })
    }
    assert.equal((await extractMenuImport({ mime, base64: 'ZmlsZQ==' }, 'test-only', transport))[0]?.price, null)
  }
})
test('provider never presents partial, refused, empty or malformed extraction as a complete menu', async () => {
  for (const value of [null, { rows: [], truncated: false }, { rows: [row], truncated: true }, { rows: [{ ...row, price: -2 }], truncated: false }]) {
    await assert.rejects(() => extractMenuImport({ mime: 'application/pdf', base64: 'x' }, 'test', async () => response(value)))
  }
  await assert.rejects(() => extractMenuImport({ mime: 'image/png', base64: 'x' }, 'test', async () => response({ rows: [row], truncated: false }, 'incomplete')), /incomplete_output/)
  await assert.rejects(() => extractMenuImport({ mime: 'image/png', base64: 'x' }, 'test', async () => new Response('private provider detail', { status: 429 })), /provider_busy/)
})
