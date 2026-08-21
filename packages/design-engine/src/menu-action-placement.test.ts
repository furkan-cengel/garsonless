import assert from 'node:assert/strict'
import test from 'node:test'

import { resolveFooterCartClearance } from './menu-action-placement'
import { DEFAULT_THEME } from './schema'

test('footer cart clearance follows each trigger metric contract', () => {
  assert.deepEqual(resolveFooterCartClearance({ ...DEFAULT_THEME, cartPlacement: 'footer', cartFooterTriggerStyle: 'fab' }), { style: 'fab', pixels: 96 })
  assert.deepEqual(resolveFooterCartClearance({ ...DEFAULT_THEME, cartPlacement: 'footer', cartFooterTriggerStyle: 'thumbs' }), { style: 'thumbs', pixels: 88 })
  assert.deepEqual(resolveFooterCartClearance({ ...DEFAULT_THEME, cartPlacement: 'footer', cartFooterTriggerStyle: 'bar' }), { style: 'bar', pixels: 96 })
  assert.deepEqual(resolveFooterCartClearance({ ...DEFAULT_THEME, cartPlacement: 'footer', cartFooterTriggerStyle: 'pill', cartPillPosition: 'floating' }), { style: 'pill', pixels: 98 })
  assert.deepEqual(resolveFooterCartClearance({ ...DEFAULT_THEME, cartPlacement: 'footer', cartFooterTriggerStyle: 'pill', cartPillPosition: 'edge' }), { style: 'pill', pixels: 84 })
})

test('footer cart clearance disappears for empty styles and non-footer placement', () => {
  assert.deepEqual(resolveFooterCartClearance({ ...DEFAULT_THEME, cartPlacement: 'header' }), { style: 'none', pixels: 0 })
  assert.deepEqual(resolveFooterCartClearance({ ...DEFAULT_THEME, cartPlacement: 'footer', cartFooterTriggerStyle: 'none' }), { style: 'none', pixels: 0 })
})

test('legacy footer trigger values normalize without migration', () => {
  assert.deepEqual(resolveFooterCartClearance({ ...DEFAULT_THEME, cartPlacement: 'footer', cartFooterTriggerStyle: 'tabbar' }), { style: 'pill', pixels: 98 })
  const { cartFooterTriggerStyle: _legacyTrigger, ...themeWithoutTrigger } = DEFAULT_THEME
  assert.deepEqual(resolveFooterCartClearance({ ...themeWithoutTrigger, cartPlacement: 'footer', cartStyle: 'banner' }), { style: 'bar', pixels: 96 })
})
