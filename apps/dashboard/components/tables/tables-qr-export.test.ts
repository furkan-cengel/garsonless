import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { PDFDocument } from 'pdf-lib'
import { A4_PDF_SIZE, createA4TableCardPDF, fitInsideA4, tableExportBaseName } from './tables-qr-pdf'
import { mapWithConcurrency, MAX_QR_EXPORT_CONCURRENCY } from './tables-qr-export'

const directory = fileURLToPath(new URL('.', import.meta.url))
const canvasSource = readFileSync(`${directory}/TablesQRCanvas.tsx`, 'utf8')
const exportSource = readFileSync(`${directory}/tables-qr-export.ts`, 'utf8')

test('A4 PDF has a real signature, exact page size and deterministic metadata', async () => {
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64')
  const table = { id: '12345678-abcd-4000-8000-123456789abc', label: 'İç Bahçe 2' }
  const bytes = await createA4TableCardPDF(png, table)
  assert.equal(Buffer.from(bytes.subarray(0, 5)).toString('ascii'), '%PDF-')
  const document = await PDFDocument.load(bytes)
  const [page] = document.getPages()
  assert.ok(page)
  assert.equal(page.getWidth(), A4_PDF_SIZE.width)
  assert.equal(page.getHeight(), A4_PDF_SIZE.height)
  assert.equal(document.getTitle(), 'Masabu · İç Bahçe 2 QR')
  assert.equal(document.getCreator(), 'Masabu QR Studio')
  assert.equal(document.getCreationDate()?.toISOString(), '2000-01-01T00:00:00.000Z')
  assert.equal(tableExportBaseName(table), 'masabu-ic-bahce-2-12345678')
})

test('A4 placement preserves aspect ratio and centers the card inside printable bounds', () => {
  const placement = fitInsideA4(1200, 1800)
  assert.ok(placement.width <= A4_PDF_SIZE.width - 72)
  assert.ok(placement.height <= A4_PDF_SIZE.height - 72)
  assert.equal(placement.x, (A4_PDF_SIZE.width - placement.width) / 2)
  assert.equal(placement.y, (A4_PDF_SIZE.height - placement.height) / 2)
})

test('bulk render keeps source order and never exceeds four concurrent jobs', async () => {
  let active = 0
  let maximum = 0
  const output = await mapWithConcurrency([1, 2, 3, 4, 5, 6, 7], MAX_QR_EXPORT_CONCURRENCY, async value => {
    active += 1
    maximum = Math.max(maximum, active)
    await new Promise<void>(resolve => setImmediate(resolve))
    active -= 1
    return value * 10
  })
  assert.equal(maximum, 4)
  assert.deepEqual(output, [10, 20, 30, 40, 50, 60, 70])
})

test('exports are lazy, readability-gated and expose PDF without the retired ZIP action', () => {
  assert.match(canvasSource, /await import\('\.\/tables-qr-export'\)/)
  assert.match(canvasSource, /format: TableCardExportFormat/)
  assert.match(canvasSource, /fmt: 'pdf'/)
  assert.doesNotMatch(canvasSource, /Tümünü indir|\.zip/)
  assert.match(exportSource, /await assertReadable\(qr, table\)/)
  assert.match(exportSource, /format === 'pdf'/)
  assert.match(exportSource, /createA4TableCardPDF/)
  assert.match(exportSource, /MAX_QR_EXPORT_CONCURRENCY/)
})
