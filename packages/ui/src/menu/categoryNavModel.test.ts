import assert from 'node:assert/strict'
import test from 'node:test'

import {
  getActiveCategoryAtLine,
  getCategoryNavActiveTreatment,
  getCategoryScrollEdges,
  getCenteredCategoryScrollLeft,
} from './categoryNavModel'

test('active category is the last section that reached the sticky activation line', () => {
  const sections = [
    { id: 'breakfast', top: -220 },
    { id: 'drinks', top: 112 },
    { id: 'dessert', top: 640 },
  ]
  assert.equal(getActiveCategoryAtLine(sections, 120), 'drinks')
  assert.equal(getActiveCategoryAtLine(sections, 80), 'breakfast')
})

test('first category remains active before any section reaches the line', () => {
  assert.equal(getActiveCategoryAtLine([
    { id: 'breakfast', top: 180 },
    { id: 'drinks', top: 600 },
  ], 120), 'breakfast')
})

test('last category becomes active at page end even when its short section cannot reach the sticky line', () => {
  assert.equal(getActiveCategoryAtLine([
    { id: 'breakfast', top: -900 },
    { id: 'drinks', top: -200 },
    { id: 'dessert', top: 260 },
  ], 120, true), 'dessert')
})

test('centering stays horizontal and clamps at both strip edges', () => {
  assert.equal(getCenteredCategoryScrollLeft({
    containerLeft: 0,
    containerWidth: 320,
    currentScrollLeft: 0,
    itemLeft: 260,
    itemWidth: 80,
    scrollWidth: 800,
  }), 140)
  assert.equal(getCenteredCategoryScrollLeft({
    containerLeft: 0,
    containerWidth: 320,
    currentScrollLeft: 450,
    itemLeft: 280,
    itemWidth: 80,
    scrollWidth: 800,
  }), 480)
})

test('scroll edge hints reflect the actual horizontal viewport', () => {
  assert.deepEqual(getCategoryScrollEdges({ scrollLeft: 0, containerWidth: 320, scrollWidth: 800 }), { left: false, right: true })
  assert.deepEqual(getCategoryScrollEdges({ scrollLeft: 480, containerWidth: 320, scrollWidth: 800 }), { left: true, right: false })
})

test('active category styles map to distinct filled, soft and outline treatments', () => {
  const filled = getCategoryNavActiveTreatment('filled')
  const soft = getCategoryNavActiveTreatment('soft')
  const outline = getCategoryNavActiveTreatment('outline')

  assert.equal(filled.background, 'var(--p-accent)')
  assert.equal(filled.color, 'var(--p-cta-text)')
  assert.equal(soft.background, 'var(--p-accent-soft)')
  assert.equal(soft.color, 'var(--p-accent)')
  assert.equal(outline.background, 'transparent')
  assert.equal(outline.borderColor, 'var(--p-accent)')
})
