import assert from 'node:assert/strict'
import test from 'node:test'
import type { MenuItem } from '@garsonless/ui/menu'
import { attachMenuAr, formatMenuArSize } from './menu-ar.ts'

const item = (id: string) => ({ id, name: id }) as MenuItem
const model = { menuItemId: 'a', versionId: 'v', glbUrl: 'https://x/a.glb', usdzUrl: null, posterUrl: null, widthMm: 260, depthMm: 260, heightMm: 45, portionNote: null }

test('published models attach to their items only', () => {
  const [a, b] = attachMenuAr([item('a'), item('b')], [model])
  assert.equal(a?.ar?.glbUrl, 'https://x/a.glb')
  assert.equal('menuItemId' in (a?.ar ?? {}), false)
  assert.equal(b?.ar, undefined)
  const items = [item('a')]
  assert.equal(attachMenuAr(items, []), items)
})

test('size reads in centimetres and skips unknown sides', () => {
  assert.equal(formatMenuArSize(model), '26 × 26 × 4,5 cm')
  assert.equal(formatMenuArSize(model, 'en'), '26 × 26 × 4.5 cm')
  assert.equal(formatMenuArSize({ widthMm: null, depthMm: null, heightMm: 80 }), '8 cm')
  assert.equal(formatMenuArSize({ widthMm: null, depthMm: null, heightMm: null }), null)
})
