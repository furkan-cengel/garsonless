import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { GarsonlessTheme } from '@garsonless/design-engine'
import { createThemeEditorPreviewDeriver } from './theme-editor-preview-theme-model'

const defaults = {
  sections: ['reviews'],
  pageBlocks: [],
} as unknown as GarsonlessTheme

test('preview derivation migrates legacy sections and keeps categories complete', () => {
  const derive = createThemeEditorPreviewDeriver(defaults, [
    { id: 'coffee', name: 'Kahve' },
    { id: 'matcha', name: 'Matcha', parentId: 'coffee' },
    { id: 'dessert', name: 'Tatlı' },
  ])

  const preview = derive({})
  assert.deepEqual(preview.pageBlocks, [
    { type: 'nav', id: 'category-nav' },
    { type: 'section', id: 'reviews' },
    { type: 'category', id: 'coffee' },
    { type: 'category', id: 'matcha' },
    { type: 'category', id: 'dessert' },
  ])
  assert.deepEqual(preview.sections, ['reviews'])
})

test('preview derivation removes invalid sections and normalizes child scope', () => {
  const derive = createThemeEditorPreviewDeriver(defaults, [
    { id: 'coffee', name: 'Kahve' },
    { id: 'matcha', name: 'Matcha', parentId: 'coffee' },
    { id: 'dessert', name: 'Tatlı' },
  ])

  const preview = derive({
    pageBlocks: [
      { type: 'category', id: 'matcha' },
      { type: 'category', id: 'dessert' },
      { type: 'section', id: 'not-a-section' },
      { type: 'category', id: 'coffee' },
      { type: 'section', id: 'gallery' },
    ],
  })

  assert.deepEqual(preview.pageBlocks, [
    { type: 'nav', id: 'category-nav' },
    { type: 'category', id: 'dessert' },
    { type: 'category', id: 'coffee' },
    { type: 'category', id: 'matcha' },
    { type: 'section', id: 'gallery' },
  ])
  assert.deepEqual(preview.sections, ['gallery'])
})
