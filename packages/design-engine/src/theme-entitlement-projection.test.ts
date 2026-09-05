import assert from 'node:assert/strict'
import test from 'node:test'
import { DEFAULT_THEME } from './schema'
import type { GarsonlessTheme } from './schema'
import {
  gatedThemeSectionIds,
  hasSameGatedThemeSections,
  projectThemeForSectionAccess,
  VIDEO_HERO_SECTION_ID,
} from './theme-entitlement-projection'

function persistedTheme(): GarsonlessTheme {
  const home = DEFAULT_THEME.surfaces!.home
  return {
    ...DEFAULT_THEME,
    pageBlocks: [
      { type: 'section', id: 'product-grid' },
      { type: 'section', id: 'request-buttons' },
      { type: 'section', id: 'video-menu', sectionId: VIDEO_HERO_SECTION_ID },
    ],
    sectionSettings: {
      'product-grid': { title: 'Menü' },
      'request-buttons': { title: 'Garson çağır' },
      'video-menu': { videoUrl: 'https://cdn.example.com/menu.mp4' },
      'video-home': { videoUrl: 'https://cdn.example.com/home.mp4' },
      'gallery-home': { title: 'Galeri' },
      'legacy-video': { title: 'Eski video' },
    },
    surfaces: {
      ...DEFAULT_THEME.surfaces!,
      home: {
        ...home,
        compositionVersion: 2,
        blocks: [
          { id: 'hero-home', sectionId: 'hero-banner', enabled: true },
          { id: 'video-home', sectionId: VIDEO_HERO_SECTION_ID, enabled: true },
          { id: 'gallery-home', sectionId: 'gallery', enabled: true },
        ],
        sections: [
          ...home.sections,
          { id: 'legacy-video', type: 'hero-video', enabled: true },
          { id: 'legacy-gallery', type: 'gallery', enabled: true },
        ],
      },
    },
  }
}

test('full entitlement returns the persisted theme untouched', () => {
  const persisted = persistedTheme()
  const projected = projectThemeForSectionAccess(persisted, { advancedSections: true, videoHero: true })
  assert.equal(projected, persisted)
})

test('no entitlement hides every paid section without deleting the persisted document', () => {
  const persisted = persistedTheme()
  const projected = projectThemeForSectionAccess(persisted, { advancedSections: false, videoHero: false })

  assert.deepEqual(projected.pageBlocks?.map((block) => block.id), ['product-grid'])
  assert.deepEqual(projected.surfaces?.home.blocks?.map((block) => block.id), ['hero-home'])
  assert.equal(projected.surfaces?.home.sections.some((section) => section.type === 'hero-video'), false)
  assert.equal(projected.surfaces?.home.sections.some((section) => section.type === 'gallery'), false)
  assert.deepEqual(Object.keys(projected.sectionSettings ?? {}), ['product-grid'])

  assert.equal(persisted.pageBlocks?.length, 3)
  assert.equal(persisted.surfaces?.home.blocks?.length, 3)
  assert.equal(Object.keys(persisted.sectionSettings ?? {}).length, 6)
})

test('the Video Hero add-on keeps hero video while the bundled catalogue stays hidden', () => {
  const projected = projectThemeForSectionAccess(persistedTheme(), { advancedSections: false, videoHero: true })

  assert.deepEqual(projected.pageBlocks?.map((block) => block.id), ['product-grid', 'video-menu'])
  assert.deepEqual(projected.surfaces?.home.blocks?.map((block) => block.id), ['hero-home', 'video-home'])
  assert.equal(projected.surfaces?.home.sections.some((section) => section.id === 'legacy-video'), true)
  assert.equal(projected.surfaces?.home.sections.some((section) => section.id === 'legacy-gallery'), false)
  assert.deepEqual(
    Object.keys(projected.sectionSettings ?? {}).sort(),
    ['legacy-video', 'product-grid', 'video-home', 'video-menu'],
  )
})

test('Pro without the add-on hides only Video Hero', () => {
  const projected = projectThemeForSectionAccess(persistedTheme(), { advancedSections: true, videoHero: false })

  assert.deepEqual(projected.pageBlocks?.map((block) => block.id), ['product-grid', 'request-buttons'])
  assert.deepEqual(projected.surfaces?.home.blocks?.map((block) => block.id), ['hero-home', 'gallery-home'])
  assert.equal(projected.surfaces?.home.sections.some((section) => section.id === 'legacy-video'), false)
  assert.equal(projected.surfaces?.home.sections.some((section) => section.id === 'legacy-gallery'), true)
  assert.equal(Object.keys(projected.sectionSettings ?? {}).includes('video-home'), false)
  assert.equal(Object.keys(projected.sectionSettings ?? {}).includes('gallery-home'), true)
})

test('a theme without surfaces is projected without inventing one', () => {
  const { surfaces: _surfaces, ...withoutSurfaces } = persistedTheme()
  const projected = projectThemeForSectionAccess(withoutSurfaces as GarsonlessTheme, {
    advancedSections: false,
    videoHero: false,
  })
  assert.equal(projected.surfaces, undefined)
  assert.deepEqual(projected.pageBlocks?.map((block) => block.id), ['product-grid'])
})

test('gated ids follow each entitlement independently', () => {
  assert.equal(gatedThemeSectionIds({ advancedSections: true, videoHero: true }).size, 0)
  assert.deepEqual(
    [...gatedThemeSectionIds({ advancedSections: true, videoHero: false })],
    [VIDEO_HERO_SECTION_ID],
  )
  const noneGranted = gatedThemeSectionIds({ advancedSections: false, videoHero: false })
  assert.equal(noneGranted.size, 8)
  assert.equal(noneGranted.has(VIDEO_HERO_SECTION_ID), true)
  assert.equal(noneGranted.has('gallery'), true)
})

test('the freeze comparison only watches sections the tenant may not change', () => {
  const current = persistedTheme()
  const editedVideo: GarsonlessTheme = {
    ...current,
    sectionSettings: { ...current.sectionSettings, 'video-home': { videoUrl: 'https://cdn.example.com/new.mp4' } },
  }
  const removedGallery: GarsonlessTheme = {
    ...current,
    surfaces: {
      ...current.surfaces!,
      home: {
        ...current.surfaces!.home,
        blocks: current.surfaces!.home.blocks!.filter((block) => block.sectionId !== 'gallery'),
      },
    },
  }

  const addOnHolder = gatedThemeSectionIds({ advancedSections: false, videoHero: true })
  assert.equal(hasSameGatedThemeSections(editedVideo, current, addOnHolder), true)
  assert.equal(hasSameGatedThemeSections(removedGallery, current, addOnHolder), false)

  const noneGranted = gatedThemeSectionIds({ advancedSections: false, videoHero: false })
  assert.equal(hasSameGatedThemeSections(editedVideo, current, noneGranted), false)

  const everythingGranted = gatedThemeSectionIds({ advancedSections: true, videoHero: true })
  assert.equal(hasSameGatedThemeSections(removedGallery, current, everythingGranted), true)
})
