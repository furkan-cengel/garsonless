import assert from 'node:assert/strict'
import test from 'node:test'
import { DEFAULT_THEME, type GarsonlessTheme } from '@garsonless/design-engine'
import { createHomeBlock, ensureHomeV2, homeV2Patch, projectHomeV2ForEditor } from './home-theme-editor-model'

test('legacy ana sayfayı hazır mock bloklar olmadan boş V2 bölüm akışına yükseltir', () => {
  const legacy = {
    ...DEFAULT_THEME,
    surfaces: {
      ...DEFAULT_THEME.surfaces!,
      home: {
        ...DEFAULT_THEME.surfaces!.home,
        compositionVersion: undefined,
        blocks: undefined,
        sections: [
          { id: 'legacy-header', type: 'header', enabled: true },
          { id: 'legacy-hero', type: 'hero', enabled: true, title: 'Gerçek başlık', imageUrl: 'https://assets.example/hero.webp', showMenuCta: true },
          { id: 'legacy-about', type: 'about', enabled: true, title: 'Hikâyemiz' },
          { id: 'legacy-footer', type: 'footer', enabled: true },
        ],
      },
    },
  } as GarsonlessTheme
  const upgraded = ensureHomeV2(legacy)
  assert.equal(upgraded.upgraded, true)
  assert.deepEqual(upgraded.home.blocks, [])
  assert.equal(upgraded.home.sections[1]?.title, 'Gerçek başlık')
})

test('blok kimlikleri benzersizdir ve tek patch tüm yüzey revision belgesine girer', () => {
  const first = createHomeBlock('gallery', [])
  const second = createHomeBlock('gallery', [first])
  assert.notEqual(first.id, second.id)
  const state = ensureHomeV2(DEFAULT_THEME)
  const patch = homeV2Patch(DEFAULT_THEME, { ...state.home, blocks: [...state.home.blocks, first, second] }, state.sectionSettings)
  assert.equal(patch.experienceVersion, 2)
  assert.equal(patch.surfaces?.home.blocks?.at(-1)?.id, second.id)
  assert.equal(patch.surfaces?.auth, DEFAULT_THEME.surfaces?.auth)
})

test('editör legacy ana sayfayı kaynak belgeyi değiştirmeden V2 olarak önizler', () => {
  const legacyTheme = structuredClone(DEFAULT_THEME)
  if (!legacyTheme.surfaces) throw new Error('home surface is required')
  legacyTheme.surfaces.home = {
    ...legacyTheme.surfaces.home,
    compositionVersion: undefined,
    blocks: undefined,
  }

  const projected = projectHomeV2ForEditor(legacyTheme)

  assert.equal(legacyTheme.surfaces.home.compositionVersion, undefined)
  assert.equal(projected.surfaces?.home.compositionVersion, 2)
  assert.deepEqual(projected.surfaces?.home.blocks, [])
})

test('eski V2 video hero ayrı Pro Video Hero bölümüne yükseltilir ve izin verilmeyen bloklar temizlenir', () => {
  const theme = structuredClone(DEFAULT_THEME)
  if (!theme.surfaces) throw new Error('home surface is required')
  theme.surfaces.home.blocks = [
    { id: 'old-video', sectionId: 'storefront-hero' as never, enabled: true },
    { id: 'old-categories', sectionId: 'featured-categories' as never, enabled: true },
  ]
  theme.sectionSettings = { 'old-video': { mediaType: 'video', videoUrl: 'https://assets.example/hero.webm', posterUrl: 'https://assets.example/poster.webp' } }

  const upgraded = ensureHomeV2(theme)

  assert.equal(upgraded.upgraded, true)
  assert.deepEqual(upgraded.home.blocks.map((block) => block.sectionId), ['storefront-video-hero'])
})
