import assert from 'node:assert/strict'
import test from 'node:test'
import { addFiles, formatWait, groupRows, moveFile, parsePrice, quotaLeft, selectionProblem, sameCategory } from './menu-import-dialog-model'

const photo = (name: string, size = 1000) => new File([new Uint8Array(size)], name, { type: 'image/jpeg' })
const pdf = (name: string, size = 1000) => new File([new Uint8Array(size)], name, { type: 'application/pdf' })

test('unsupported files are dropped with a notice', () => {
  const result = addFiles([], [photo('a.jpg'), new File(['x'], 'menu.docx', { type: 'application/msword' })])
  assert.equal(result.files.length, 1)
  assert.equal(result.notice?.tone, 'error')
})

test('more than ten photos keep the first ten and warn without blocking', () => {
  const result = addFiles([], Array.from({ length: 12 }, (_, i) => photo(`p${i}.jpg`)))
  assert.equal(result.files.length, 10)
  assert.equal(result.notice?.tone, 'warning')
  assert.equal(selectionProblem(result.files), null)
})

test('a PDF mixed with photos or over 3 MB blocks the read', () => {
  assert.match(selectionProblem([photo('a.jpg'), pdf('m.pdf')])!.title, /birlikte/)
  assert.match(selectionProblem([pdf('m.pdf', 4 * 1024 * 1024)])!.title, /büyük/)
  assert.equal(selectionProblem([pdf('m.pdf')]), null)
})

test('pages reorder within bounds', () => {
  const files = [photo('1.jpg'), photo('2.jpg'), photo('3.jpg')]
  assert.deepEqual(moveFile(files, 2, 0).map((file) => file.name), ['3.jpg', '1.jpg', '2.jpg'])
  assert.equal(moveFile(files, 0, -1), files)
})

test('turkish prices parse, empty or zero stays missing', () => {
  assert.equal(parsePrice('95'), 95)
  assert.equal(parsePrice('95,50'), 95.5)
  assert.equal(parsePrice('1.250'), 1250)
  assert.equal(parsePrice('₺ 85'), 85)
  assert.equal(parsePrice(''), null)
  assert.equal(parsePrice('0'), null)
})

test('wait time and remaining reads', () => {
  const now = Date.parse('2026-10-25T10:00:00Z')
  assert.equal(formatWait('2026-10-26T00:12:00Z', now), '14 sa 12 dk')
  assert.equal(formatWait('2026-10-25T10:00:20Z', now), '1 dk')
  assert.equal(quotaLeft({ limit: 5, used: 5 }), 0)
  assert.equal(quotaLeft(undefined), null)
})

test('rows group by category in first-seen order', () => {
  const groups = groupRows([
    { key: 0, category: 'Kahve', name: 'Latte', description: '', price: 95 },
    { key: 1, category: 'Tatlı', name: 'Brownie', description: '', price: 140 },
    { key: 2, category: 'Kahve', name: 'Americano', description: '', price: 85 },
  ])
  assert.deepEqual(groups.map((group) => [group.category, group.items.length]), [['Kahve', 2], ['Tatlı', 1]])
  assert.ok(sameCategory('İÇECEKLER', 'içecekler'))
})
