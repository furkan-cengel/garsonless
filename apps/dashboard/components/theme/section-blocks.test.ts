import assert from 'node:assert/strict'
import test from 'node:test'

import {
  getSectionDefinitionId,
  getUniqueSectionDefinitionIds,
  isSectionBlockVisibleInContext,
  sanitizeThemeTokens,
  type ThemePageBlock,
} from '@garsonless/design-engine'

const categories = [
  { id: 'coffee' },
  { id: 'hot-coffee', parentId: 'coffee' },
  { id: 'espresso', parentId: 'hot-coffee' },
  { id: 'dessert' },
]

test('legacy section blocks remain visible everywhere', () => {
  const block: ThemePageBlock = { type: 'section', id: 'hero-banner' }
  assert.equal(getSectionDefinitionId(block), 'hero-banner')
  assert.equal(isSectionBlockVisibleInContext(block, { view: 'home' }, categories), true)
  assert.equal(isSectionBlockVisibleInContext(block, { view: 'category', categoryId: 'dessert' }, categories), true)
})

test('home-only and exact category visibility remain isolated', () => {
  const home: ThemePageBlock = {
    type: 'section',
    id: 'promo-strip',
    visibility: { mode: 'home' },
  }
  const coffee: ThemePageBlock = {
    type: 'section',
    id: 'promo-strip--2',
    sectionId: 'promo-strip',
    visibility: { mode: 'categories', categoryIds: ['coffee'] },
  }

  assert.equal(isSectionBlockVisibleInContext(home, { view: 'home' }, categories), true)
  assert.equal(isSectionBlockVisibleInContext(home, { view: 'category', categoryId: 'coffee' }, categories), false)
  assert.equal(isSectionBlockVisibleInContext(coffee, { view: 'home' }, categories), false)
  assert.equal(isSectionBlockVisibleInContext(coffee, { view: 'category', categoryId: 'coffee' }, categories), true)
  assert.equal(isSectionBlockVisibleInContext(coffee, { view: 'category', categoryId: 'hot-coffee' }, categories), false)
})

test('includeChildren follows the full category ancestry without crossing roots', () => {
  const block: ThemePageBlock = {
    type: 'section',
    id: 'chef-pick--2',
    sectionId: 'chef-pick',
    visibility: { mode: 'categories', categoryIds: ['coffee'], includeChildren: true },
  }

  assert.equal(isSectionBlockVisibleInContext(block, { view: 'category', categoryId: 'coffee' }, categories), true)
  assert.equal(isSectionBlockVisibleInContext(block, { view: 'category', categoryId: 'hot-coffee' }, categories), true)
  assert.equal(isSectionBlockVisibleInContext(block, { view: 'category', categoryId: 'espresso' }, categories), true)
  assert.equal(isSectionBlockVisibleInContext(block, { view: 'category', categoryId: 'dessert' }, categories), false)
})

test('definition list deduplicates multiple configured instances', () => {
  assert.deepEqual(getUniqueSectionDefinitionIds([
    { type: 'section', id: 'hero-banner' },
    { type: 'section', id: 'hero-banner--2', sectionId: 'hero-banner' },
    { type: 'section', id: 'promo-strip' },
  ]), ['hero-banner', 'promo-strip'])
})

test('theme policy preserves safe instance definitions and category scope', () => {
  const theme = sanitizeThemeTokens({
    pageBlocks: [
      {
        type: 'section',
        id: 'promo-strip--2',
        sectionId: 'promo-strip',
        visibility: {
          mode: 'categories',
          categoryIds: ['coffee', 'coffee', 'hot-coffee'],
          includeChildren: true,
        },
      },
    ],
  }, 'default')

  assert.deepEqual(theme?.pageBlocks, [
    {
      type: 'section',
      id: 'promo-strip--2',
      sectionId: 'promo-strip',
      visibility: {
        mode: 'categories',
        categoryIds: ['coffee', 'hot-coffee'],
        includeChildren: true,
      },
    },
  ])
})

test('theme policy preserves valid drawer placement and drops invalid placement', () => {
  const theme = sanitizeThemeTokens({
    pageBlocks: [
      { type: 'section', id: 'wifi-info', placement: 'drawer' },
      { type: 'section', id: 'hours', placement: 'sidebar' },
      { type: 'section', id: 'legacy' },
    ],
    drawerPreset: 'editorial',
    drawerSide: 'right',
    drawerWidth: 410,
  }, 'default')

  assert.deepEqual(theme?.pageBlocks, [
    { type: 'section', id: 'wifi-info', placement: 'drawer' },
    { type: 'section', id: 'hours' },
    { type: 'section', id: 'legacy' },
  ])
  assert.equal(theme?.drawerPreset, 'editorial')
  assert.equal(theme?.drawerSide, 'right')
  assert.equal(theme?.drawerWidth, 410)
})

test('theme policy replaces retired page footer blocks with the global footer contract', () => {
  const theme = sanitizeThemeTokens({
    sections: ['social-block', 'hero-banner', 'footer'],
    pageBlocks: [
      { type: 'section', id: 'social-block' },
      { type: 'section', id: 'footer--2', sectionId: 'footer' },
      { type: 'section', id: 'hero-banner' },
    ],
    sectionSettings: {
      'social-block': { title: 'Takip edin' },
      'footer--2': { title: 'Eski footer' },
      'hero-banner': { title: 'Merhaba' },
    },
    announcementEnabled: true,
    announcementText: 'Eski duyuru',
    footerTone: 'brand',
  }, 'default')

  assert.deepEqual(theme?.sections, ['hero-banner'])
  assert.deepEqual(theme?.pageBlocks, [{ type: 'section', id: 'hero-banner' }])
  assert.deepEqual(theme?.sectionSettings, { 'hero-banner': { title: 'Merhaba' } })
  assert.equal(theme?.footerEnabled, true)
  assert.equal(theme?.footerTone, 'brand')
  assert.equal(Object.hasOwn(theme ?? {}, 'announcementEnabled'), false)
  assert.equal(Object.hasOwn(theme ?? {}, 'announcementText'), false)
})

test('theme policy sanitizes global footer controls', () => {
  const sanitized = sanitizeThemeTokens({
    footerEnabled: false,
    footerTone: 'neon',
    footerShowLogo: false,
    footerShowAddress: 'yes',
    footerShowContact: false,
    footerShowSocial: false,
    footerShowCopyright: false,
  }, 'default')

  assert.equal(sanitized?.footerEnabled, false)
  assert.equal(sanitized?.footerTone, 'surface')
  assert.equal(sanitized?.footerShowLogo, false)
  assert.equal(sanitized?.footerShowAddress, true)
  assert.equal(sanitized?.footerShowContact, false)
  assert.equal(sanitized?.footerShowSocial, false)
  assert.equal(sanitized?.footerShowCopyright, false)
})
