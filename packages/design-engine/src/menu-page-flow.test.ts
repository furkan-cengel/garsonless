import assert from 'node:assert/strict'
import test from 'node:test'

import { resolveMenuPageFlow } from './menu-page-flow'

const categories = [
  { id: 'coffee', parentId: null },
  { id: 'matcha', parentId: 'coffee' },
  { id: 'dessert', parentId: null },
]

test('shared menu flow completes missing blocks and keeps children with their parent', () => {
  const flow = resolveMenuPageFlow({
    pageBlocks: [
      { type: 'category', id: 'dessert' },
      { type: 'category', id: 'coffee' },
      { type: 'category', id: 'coffee' },
    ],
    categories,
  })
  assert.deepEqual(flow.map((block) => `${block.type}:${block.id}`), [
    'nav:category-nav',
    'category:dessert',
    'category:coffee',
    'category:matcha',
  ])
})

test('shared menu flow keeps drawer sections in a separate trailing scope', () => {
  const flow = resolveMenuPageFlow({
    pageBlocks: [
      { type: 'section', id: 'hours', placement: 'drawer' },
      { type: 'category', id: 'coffee' },
      { type: 'section', id: 'hero-banner' },
    ],
    categories,
  })
  assert.deepEqual(flow.map((block) => `${block.type}:${block.id}`), [
    'nav:category-nav',
    'category:coffee',
    'category:matcha',
    'section:hero-banner',
    'category:dessert',
    'section:hours',
  ])
})
