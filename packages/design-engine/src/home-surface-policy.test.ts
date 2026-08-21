import assert from 'node:assert/strict'
import test from 'node:test'

import { DEFAULT_THEME } from './schema'
import {
  inspectHomeSurfaceContrast,
  resolveHomeChromeTheme,
  resolveHomeSectionColorConfig,
  resolveHomeSurfacePalette,
  snapshotLegacyHomeSectionColors,
} from './home-surface-policy'

test('home palette resolves common theme then home overrides and derives accent soft', () => {
  const theme = structuredClone(DEFAULT_THEME)
  if (!theme.surfaces) throw new Error('surfaces are required')
  theme.surfaces.home.override = { background: '#ffffff', accent: '#000000', text: '#111111' }

  const palette = resolveHomeSurfacePalette(theme)

  assert.equal(palette.background, '#ffffff')
  assert.equal(palette.text, '#111111')
  assert.equal(palette.surface, theme.cardColor)
  assert.equal(palette.accentSoft, '#dbdbdb')
})

test('home header inherits shared appearance with a flush default gap until its own override exists', () => {
  const theme = structuredClone(DEFAULT_THEME)
  theme.headerLogoSize = 40
  theme.headerBottomGap = 24
  theme.footerTone = 'surface'
  assert.equal(resolveHomeChromeTheme(theme, 'header').headerLogoSize, 40)
  assert.equal(resolveHomeChromeTheme(theme, 'header').headerBottomGap, 0)
  assert.equal(resolveHomeChromeTheme(theme, 'footer'), theme)

  theme.surfaces!.home.chrome = {
    header: { headerLogoSize: 64, headerPadX: 28, headerBottomGap: 12 },
    footer: { footerTone: 'dark' },
  }
  const header = resolveHomeChromeTheme(theme, 'header')
  const footer = resolveHomeChromeTheme(theme, 'footer')
  assert.equal(header.headerLogoSize, 64)
  assert.equal(header.headerPadX, 28)
  assert.equal(header.headerBottomGap, 12)
  assert.equal(header.footerTone, 'surface')
  assert.equal(footer.footerTone, 'dark')
  assert.equal(footer.headerLogoSize, 40)
})

test('home contrast reports every unsafe semantic pairing', () => {
  const theme = structuredClone(DEFAULT_THEME)
  if (!theme.surfaces) throw new Error('surfaces are required')
  theme.surfaces.home.override = {
    background: '#ffffff',
    surface: '#ffffff',
    text: '#ffffff',
    mutedText: '#ffffff',
    accent: '#ffffff',
    cta: '#ffffff',
    ctaText: '#ffffff',
  }

  assert.deepEqual(inspectHomeSurfaceContrast(theme).map((issue) => issue.id), [
    'background-text',
    'surface-text',
    'background-muted',
    'cta',
    'background-accent',
    'surface-accent',
  ])
})

test('legacy standard sections are snapshotted before inheritance is enabled', () => {
  const palette = resolveHomeSurfacePalette(DEFAULT_THEME)
  const featured = snapshotLegacyHomeSectionColors('featured-scroll', { title: 'Öne çıkanlar' }, palette)
  const gallery = snapshotLegacyHomeSectionColors('gallery', {}, palette)
  const chefPick = snapshotLegacyHomeSectionColors('chef-pick', {}, palette)
  const comboRibbon = snapshotLegacyHomeSectionColors('combo-ribbon', {}, palette)

  assert.equal(featured.title, 'Öne çıkanlar')
  assert.equal(featured.sectionBgColor, 'transparent')
  assert.equal(featured.cardBgColor, palette.surface)
  assert.equal(gallery.labelBgColor, '#ffffff')
  assert.equal(gallery.titleColor, palette.accent)
  assert.equal(chefPick.bgColor, '#1a1612')
  assert.equal(chefPick.buttonTextColor, '#1a1612')
  assert.equal(comboRibbon.bgColor, '#fff7dc')
  assert.equal(comboRibbon.combo1Color, '#26a69a')
})

test('only inheritance-v2 standard sections receive semantic runtime defaults', () => {
  const legacy = resolveHomeSectionColorConfig('gallery', {}, undefined)
  const inherited = resolveHomeSectionColorConfig('gallery', {}, 2)
  const modernGallery = resolveHomeSectionColorConfig('gallery', { editorialVersion: '2' }, 2)
  const creative = resolveHomeSectionColorConfig('promo-slider', {}, 2)
  const chefPick = resolveHomeSectionColorConfig('chef-pick', { editorialVersion: '2' }, 2)
  const comboRibbon = resolveHomeSectionColorConfig('combo-ribbon', { editorialVersion: '2' }, 2)

  assert.deepEqual(legacy, {})
  assert.equal(inherited.sectionBgColor, 'var(--p-card)')
  assert.equal(inherited.bodyColor, 'var(--p-text-2)')
  assert.equal(inherited.titleColor, 'var(--p-accent)')
  assert.equal(modernGallery.titleColor, 'var(--p-text)')
  assert.deepEqual(creative, {})
  assert.equal(chefPick.bgColor, 'var(--p-card)')
  assert.equal(chefPick.itemMutedColor, 'var(--p-text-2)')
  assert.equal(chefPick.buttonBgColor, 'var(--p-cta)')
  assert.equal(resolveHomeSectionColorConfig('chef-pick', {}, 2).bgColor, '#1a1612')
  assert.equal(comboRibbon.bgColor, 'var(--p-bg)')
  assert.equal(comboRibbon.combo1Color, 'var(--p-card)')
  assert.equal(comboRibbon.buttonBgColor, 'var(--p-cta)')
  assert.equal(resolveHomeSectionColorConfig('combo-ribbon', {}, 2).combo1Color, '#26a69a')
})

test('explicit section colors win over inherited defaults', () => {
  const resolved = resolveHomeSectionColorConfig('featured-scroll', { cardBgColor: '#123456' }, 2)
  assert.equal(resolved.cardBgColor, '#123456')
  assert.equal(resolved.cardTextColor, 'var(--p-text)')
})
