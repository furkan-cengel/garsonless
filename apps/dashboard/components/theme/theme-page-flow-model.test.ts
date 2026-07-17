import assert from 'node:assert/strict'
import test from 'node:test'

import {
  addSectionToPageFlow,
  buildPageBlocks,
  getKeyboardMoveTarget,
  normalizePageBlocksForCategoryScope,
  pageBlockKey,
  removeSectionFromPageFlow,
  reorderPageBlocks,
  type MenuCategory,
  type PageBlock,
} from './theme-page-flow-model'

const categories: MenuCategory[] = [
  { id: 'coffee', name: 'Kahve' },
  { id: 'matcha', name: 'Matcha', parentId: 'coffee' },
  { id: 'filter', name: 'Filtre', parentId: 'coffee' },
  { id: 'dessert', name: 'Tatlı' },
]

test('stored flow is sanitized, deduplicated and completed', () => {
  const blocks = buildPageBlocks({
    pageBlocks: [
      { type: 'category', id: 'coffee' },
      { type: 'category', id: 'coffee' },
      { type: 'section', id: 'hero-banner' },
      { type: 'section', id: 'removed-section' },
    ],
  }, categories, ['hero-banner'])

  assert.deepEqual(blocks.map(pageBlockKey), [
    'nav:category-nav',
    'category:coffee',
    'section:hero-banner',
    'category:matcha',
    'category:filter',
    'category:dessert',
  ])
})

test('legacy sections are used when page blocks are absent', () => {
  const blocks = buildPageBlocks({ sections: ['hero-banner', 'unknown'] }, categories, ['hero-banner'])
  assert.deepEqual(blocks.slice(0, 2).map(pageBlockKey), [
    'nav:category-nav',
    'section:hero-banner',
  ])
})

test('child categories are normalized directly after their parent', () => {
  const blocks: PageBlock[] = [
    { type: 'nav', id: 'category-nav' },
    { type: 'category', id: 'matcha' },
    { type: 'category', id: 'dessert' },
    { type: 'category', id: 'coffee' },
    { type: 'category', id: 'filter' },
  ]
  assert.deepEqual(normalizePageBlocksForCategoryScope(blocks, categories).map(pageBlockKey), [
    'nav:category-nav',
    'category:dessert',
    'category:coffee',
    'category:matcha',
    'category:filter',
  ])
})

test('section commands insert after navigation and remove cleanly', () => {
  const initial: PageBlock[] = [
    { type: 'nav', id: 'category-nav' },
    { type: 'category', id: 'coffee' },
  ]
  const added = addSectionToPageFlow(initial, 'hero-banner')
  assert.deepEqual(added.map(pageBlockKey), [
    'nav:category-nav',
    'section:hero-banner',
    'category:coffee',
  ])
  assert.strictEqual(addSectionToPageFlow(added, 'hero-banner'), added)
  assert.deepEqual(removeSectionFromPageFlow(added, 'hero-banner'), initial)
})

test('child categories cannot escape their parent scope', () => {
  const blocks = normalizePageBlocksForCategoryScope(buildPageBlocks({}, categories, []), categories)
  assert.deepEqual(
    reorderPageBlocks(blocks, categories, 'category:matcha', 'category:dessert'),
    { ok: false, reason: 'child-scope' },
  )
})

test('top-level blocks cannot be moved into child scope', () => {
  const blocks = normalizePageBlocksForCategoryScope(buildPageBlocks({}, categories, []), categories)
  assert.deepEqual(
    reorderPageBlocks(blocks, categories, 'nav:category-nav', 'category:matcha'),
    { ok: false, reason: 'nested-target' },
  )
})

test('moving a parent carries its child categories as one group', () => {
  const blocks = normalizePageBlocksForCategoryScope(buildPageBlocks({}, categories, []), categories)
  const result = reorderPageBlocks(blocks, categories, 'category:coffee', 'category:dessert')
  assert.equal(result.ok, true)
  if (!result.ok) return
  assert.deepEqual(result.blocks.map(pageBlockKey), [
    'nav:category-nav',
    'category:dessert',
    'category:coffee',
    'category:matcha',
    'category:filter',
  ])
})

test('keyboard movement stays inside the correct category scope', () => {
  const blocks = normalizePageBlocksForCategoryScope(buildPageBlocks({}, categories, []), categories)
  assert.equal(getKeyboardMoveTarget(blocks, categories, 'category:matcha', 1), 'category:filter')
  assert.equal(getKeyboardMoveTarget(blocks, categories, 'category:matcha', -1), null)
  assert.equal(getKeyboardMoveTarget(blocks, categories, 'category:coffee', 1), 'category:dessert')
})
