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
  const duplicated = addSectionToPageFlow(added, 'hero-banner')
  assert.deepEqual(duplicated.slice(0, 3), [
    { type: 'nav', id: 'category-nav' },
    { type: 'section', id: 'hero-banner--2', sectionId: 'hero-banner' },
    { type: 'section', id: 'hero-banner' },
  ])
  assert.deepEqual(removeSectionFromPageFlow(added, 'hero-banner'), initial)
})

test('global request buttons remain a singleton in page flow', () => {
  const initial: PageBlock[] = [
    { type: 'nav', id: 'category-nav' },
    { type: 'category', id: 'coffee' },
  ]

  const once = addSectionToPageFlow(initial, 'request-buttons')
  const twice = addSectionToPageFlow(once, 'request-buttons')

  assert.deepEqual(twice, once)
  assert.equal(
    once.filter((block) => block.type === 'section' && block.id === 'request-buttons').length,
    1,
  )
})

test('new information sections default to drawer while legacy sections stay on page', () => {
  const initial: PageBlock[] = [{ type: 'nav', id: 'category-nav' }]
  assert.equal(addSectionToPageFlow(initial, 'wifi-info')[1]?.placement, 'drawer')
  assert.equal(addSectionToPageFlow(initial, 'hours')[1]?.placement, 'drawer')
  assert.equal(addSectionToPageFlow(initial, 'hero-banner')[1]?.placement, undefined)

  const legacy = buildPageBlocks({ pageBlocks: [{ type: 'section', id: 'wifi-info' }] }, categories, ['wifi-info'])
  assert.equal(legacy.find((block) => block.type === 'section')?.placement, undefined)
})

test('stored duplicate section instances preserve their definition and visibility scope', () => {
  const blocks = buildPageBlocks({
    pageBlocks: [
      { type: 'nav', id: 'category-nav' },
      { type: 'section', id: 'hero-banner', visibility: { mode: 'home' } },
      {
        type: 'section',
        id: 'hero-banner--2',
        sectionId: 'hero-banner',
        visibility: { mode: 'categories', categoryIds: ['coffee'], includeChildren: true },
      },
    ],
  }, categories, ['hero-banner'])

  assert.deepEqual(blocks.slice(0, 3), [
    { type: 'nav', id: 'category-nav' },
    { type: 'section', id: 'hero-banner', visibility: { mode: 'home' } },
    {
      type: 'section',
      id: 'hero-banner--2',
      sectionId: 'hero-banner',
      visibility: { mode: 'categories', categoryIds: ['coffee'], includeChildren: true },
    },
  ])
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
