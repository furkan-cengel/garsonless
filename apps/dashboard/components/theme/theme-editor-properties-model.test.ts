import assert from 'node:assert/strict'
import test from 'node:test'

import type { GarsonlessTheme } from '@garsonless/design-engine'
import type { SettingField } from '@garsonless/ui/themes'
import {
  getAvailableEditorTabs,
  getFieldEditorTab,
  getVisibleThemeFields,
  resolveEffectiveEditorTab,
} from './theme-editor-properties-model'

function field(id: string, themeField: string, type: SettingField['type'] = 'select') {
  return { id, label: id, themeField, type } as SettingField
}

test('property fields are assigned to stable editor tabs', () => {
  assert.equal(getFieldEditorTab(field('headerHeight', 'headerPadY')), 'layout')
  assert.equal(getFieldEditorTab(field('headerPadX', 'headerPadX')), 'layout')
  assert.equal(getFieldEditorTab(field('headerShowMenu', 'headerShowMenu')), 'content')
  assert.equal(getFieldEditorTab(field('accent', 'accent', 'color')), 'design')
  assert.equal(getFieldEditorTab(field('headerTextColor', 'headerTextColor', 'color')), 'design')
  assert.deepEqual(
    getAvailableEditorTabs([
      field('headerHeight', 'headerPadY'),
      field('headerShowMenu', 'headerShowMenu'),
      field('accent', 'accent', 'color'),
    ], 'header').map((tab) => tab.id),
    ['design', 'layout', 'content'],
  )
})

test('requested tab falls back to the first available tab', () => {
  assert.equal(resolveEffectiveEditorTab([{ id: 'content' }], 'layout'), 'content')
  assert.equal(resolveEffectiveEditorTab([], 'content'), 'design')
})

test('minimal cards expose only controls that affect their single-row layout', () => {
  const fields = [
    { ...field('price', 'cardPriceAlign'), editorTab: 'layout' as const },
    { ...field('image', 'cardShowImage'), editorTab: 'content' as const },
    { ...field('showDescription', 'cardShowDesc'), editorTab: 'content' as const },
    { ...field('titleLines', 'cardTitleLines'), editorTab: 'content' as const },
    { ...field('descriptionLines', 'cardDescriptionLines'), editorTab: 'content' as const },
    { ...field('ctaStyle', 'cardCtaStyle'), editorTab: 'design' as const },
    { ...field('ctaIcon', 'cardCtaIcon'), editorTab: 'design' as const },
    { ...field('optionTag', 'cardShowTag'), editorTab: 'content' as const },
  ]
  const theme = {
    cardLayout: 'minimal',
    cardCtaStyle: 'icon',
    cardShowDesc: true,
    cardShowImage: true,
  } as unknown as GarsonlessTheme
  const visible = (['design', 'layout', 'content'] as const).flatMap((tab) =>
    getVisibleThemeFields(fields, 'cards', theme, tab).map((item) => item.themeField),
  )
  assert.deepEqual(visible, ['cardCtaIcon', 'cardShowTag'])
})

test('horizontal cards own their line limits and crop focus follows image visibility', () => {
  const fields = [
    { ...field('titleLines', 'cardTitleLines'), editorTab: 'content' as const },
    { ...field('descriptionLines', 'cardDescriptionLines'), editorTab: 'content' as const },
    { ...field('crop', 'cardImagePosition'), editorTab: 'layout' as const },
    { ...field('imageWidth', 'cardHorizontalImageWidth'), editorTab: 'layout' as const },
  ]
  const horizontal = { cardLayout: 'horizontal', cardShowDesc: true, cardShowImage: true } as unknown as GarsonlessTheme
  assert.deepEqual(
    getVisibleThemeFields(fields, 'cards', horizontal, 'content').map((item) => item.themeField),
    [],
  )
  assert.deepEqual(
    getVisibleThemeFields(fields, 'cards', horizontal, 'layout').map((item) => item.themeField),
    ['cardImagePosition', 'cardHorizontalImageWidth'],
  )
  assert.deepEqual(
    getVisibleThemeFields(fields, 'cards', { ...horizontal, cardShowImage: false }, 'layout').map((item) => item.themeField),
    [],
  )
})

test('global card CTA icon stays editable for icon and icon-plus-text buttons', () => {
  const fields = [{ ...field('cta', 'cardCtaIcon'), editorTab: 'design' as const }]
  const pill = { cardLayout: 'vertical', cardCtaStyle: 'pill', cardShowDesc: true } as unknown as GarsonlessTheme
  const icon = { cardLayout: 'vertical', cardCtaStyle: 'icon', cardShowDesc: true } as unknown as GarsonlessTheme
  assert.deepEqual(getVisibleThemeFields(fields, 'cards', pill, 'design').map((item) => item.themeField), ['cardCtaIcon'])
  assert.deepEqual(getVisibleThemeFields(fields, 'cards', icon, 'design').map((item) => item.themeField), ['cardCtaIcon'])
})

test('footer hides dependent fields while disabled', () => {
  const fields = [
    field('footerEnabled', 'footerEnabled'),
    field('footerShowLogo', 'footerShowLogo'),
    field('footerTone', 'footerTone'),
  ]
  const theme = { footerEnabled: false, footerTone: 'surface' } as unknown as GarsonlessTheme
  assert.deepEqual(
    getVisibleThemeFields(fields, 'footer', theme, 'content').map((item) => item.themeField),
    ['footerEnabled'],
  )
})

test('visual navigation hides pill-only controls and reveals overlay controls only for overlay cards', () => {
  const fields = [
    { ...field('active', 'catnavActiveStyle'), editorTab: 'design' as const },
    { ...field('density', 'catnavDensity'), editorTab: 'layout' as const },
    { ...field('visual', 'catnavVisualRadius'), editorTab: 'design' as const },
    { ...field('overlay', 'catnavOverlayOpacity'), editorTab: 'design' as const },
  ]
  const cardsTheme = { catnavStyle: 'visual', catnavVisualStyle: 'compact' } as unknown as GarsonlessTheme
  const overlayTheme = { catnavStyle: 'visual', catnavVisualStyle: 'overlay' } as unknown as GarsonlessTheme
  const pillsTheme = { catnavStyle: 'pills', catnavVisualStyle: 'compact' } as unknown as GarsonlessTheme
  assert.deepEqual(
    getVisibleThemeFields(fields, 'nav', cardsTheme, 'design').map((item) => item.themeField),
    ['catnavVisualRadius'],
  )
  assert.deepEqual(
    getVisibleThemeFields(fields, 'nav', overlayTheme, 'design').map((item) => item.themeField),
    ['catnavVisualRadius', 'catnavOverlayOpacity'],
  )
  assert.deepEqual(
    getVisibleThemeFields(fields, 'nav', pillsTheme, 'design').map((item) => item.themeField),
    ['catnavActiveStyle'],
  )
  assert.deepEqual(getVisibleThemeFields(fields, 'nav', cardsTheme, 'layout').map((item) => item.themeField), ['catnavDensity'])
})

test('underline and dot navigation own their active treatment', () => {
  const fields = [{ ...field('active', 'catnavActiveStyle'), editorTab: 'design' as const }]
  for (const catnavStyle of ['underline', 'dots', 'visual'] as const) {
    const theme = { catnavStyle, catnavVisualStyle: 'compact' } as unknown as GarsonlessTheme
    assert.deepEqual(getVisibleThemeFields(fields, 'nav', theme, 'design'), [])
  }
  for (const catnavStyle of ['pills', 'segmented', 'outlined'] as const) {
    const theme = { catnavStyle, catnavVisualStyle: 'compact' } as unknown as GarsonlessTheme
    assert.equal(getVisibleThemeFields(fields, 'nav', theme, 'design').length, 1)
  }
})

test('cart fields are shown only when the selected trigger consumes them', () => {
  const fields = [
    field('headerStyle', 'cartHeaderTriggerStyle'),
    field('footerStyle', 'cartFooterTriggerStyle'),
    field('icon', 'cartIcon'),
    field('badge', 'cartShowBadge'),
    { ...field('tone', 'cartPillTone'), editorTab: 'design' as const },
    { ...field('position', 'cartPillPosition'), editorTab: 'layout' as const },
    { ...field('button', 'cartButtonText', 'text'), editorTab: 'content' as const },
  ]
  const thumbs = { cartPlacement: 'footer', cartFooterTriggerStyle: 'thumbs' } as unknown as GarsonlessTheme
  assert.deepEqual(getVisibleThemeFields(fields, 'cart', thumbs, 'design').map((item) => item.themeField), ['cartFooterTriggerStyle'])
  assert.deepEqual(getVisibleThemeFields(fields, 'cart', thumbs, 'content'), [])

  const pill = { cartPlacement: 'footer', cartFooterTriggerStyle: 'pill' } as unknown as GarsonlessTheme
  assert.deepEqual(getVisibleThemeFields(fields, 'cart', pill, 'design').map((item) => item.themeField), ['cartFooterTriggerStyle', 'cartIcon', 'cartPillTone'])
  assert.deepEqual(getVisibleThemeFields(fields, 'cart', pill, 'layout').map((item) => item.themeField), ['cartPillPosition'])
  assert.deepEqual(getVisibleThemeFields(fields, 'cart', pill, 'content').map((item) => item.themeField), ['cartShowBadge', 'cartButtonText'])
})
