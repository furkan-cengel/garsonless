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

test('eski V2 standart bölümlerin görünümünü snapshot ile koruyup renk mirasını açar', () => {
  const theme = structuredClone(DEFAULT_THEME)
  if (!theme.surfaces) throw new Error('home surface is required')
  theme.surfaces.home.colorInheritanceVersion = undefined
  theme.surfaces.home.blocks = [
    { id: 'featured', sectionId: 'featured-scroll', enabled: true },
    { id: 'gallery', sectionId: 'gallery', enabled: true },
    { id: 'campaign', sectionId: 'promo-slider', enabled: true },
  ]
  theme.sectionSettings = { featured: { title: 'Mevcut vitrin' } }

  const upgraded = ensureHomeV2(theme)

  assert.equal(upgraded.home.colorInheritanceVersion, 2)
  assert.equal(upgraded.sectionSettings.featured?.title, 'Mevcut vitrin')
  assert.equal(upgraded.sectionSettings.featured?.sectionBgColor, 'transparent')
  assert.equal(upgraded.sectionSettings.gallery?.labelBgColor, '#ffffff')
  assert.equal(upgraded.sectionSettings.campaign, undefined)
})

test('yeni renk mirası belgesi tekrar normalize edildiğinde değişmez', () => {
  const state = ensureHomeV2(DEFAULT_THEME)
  assert.equal(state.home.colorInheritanceVersion, 2)
  assert.equal(state.upgraded, false)
})

test('existing chef pick keeps its legacy palette while joining the editorial renderer', () => {
  const theme = structuredClone(DEFAULT_THEME)
  if (!theme.surfaces) throw new Error('home surface is required')
  theme.surfaces.home.colorInheritanceVersion = 2
  theme.surfaces.home.blocks = [{ id: 'existing-chef', sectionId: 'chef-pick', enabled: true }]
  theme.sectionSettings = { 'existing-chef': { selectionMode: 'automatic', title: 'İmza tabaklar' } }

  const upgraded = ensureHomeV2(theme)
  const settings = upgraded.sectionSettings['existing-chef']

  assert.equal(upgraded.upgraded, true)
  assert.equal(settings?.editorialVersion, '2')
  assert.equal(settings?.selectionMode, 'automatic')
  assert.equal(settings?.bgColor, '#1a1612')
  assert.equal(settings?.itemBgColor, '#241f1a')
  assert.equal(ensureHomeV2({ ...theme, sectionSettings: upgraded.sectionSettings }).upgraded, false)
})
