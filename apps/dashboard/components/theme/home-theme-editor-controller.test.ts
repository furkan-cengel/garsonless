import assert from 'node:assert/strict'
import test from 'node:test'
import { DEFAULT_THEME, type GarsonlessTheme } from '@garsonless/design-engine'
import { createHomeThemeEditorController } from './home-theme-editor-controller'

test('menü bileşeni ana sayfa akışının sonuna eklenir', () => {
  let patch: Partial<GarsonlessTheme> | undefined
  const controller = createHomeThemeEditorController({
    theme: DEFAULT_THEME,
    query: '',
    group: 'Tümü',
    setQuery: () => undefined,
    setGroup: () => undefined,
    openPicker: () => undefined,
    closePicker: () => undefined,
    updateTheme: (next) => { patch = next },
    selectBlock: () => undefined,
    showDesignSurface: () => undefined,
  })

  controller.add('hero-banner')

  assert.deepEqual(patch?.surfaces?.home.blocks?.map((block) => block.sectionId), ['hero-banner'])
})

test('new home chef pick is seeded as a manual three-product editorial section', () => {
  let patch: Partial<GarsonlessTheme> | undefined
  const controller = createHomeThemeEditorController({
    theme: DEFAULT_THEME,
    query: '',
    group: 'Tümü',
    setQuery: () => undefined,
    setGroup: () => undefined,
    openPicker: () => undefined,
    closePicker: () => undefined,
    updateTheme: (next) => { patch = next },
    selectBlock: () => undefined,
    showDesignSurface: () => undefined,
  })

  controller.add('chef-pick')

  const block = patch?.surfaces?.home.blocks?.[0]
  assert.equal(block?.sectionId, 'chef-pick')
  assert.deepEqual(block ? patch?.sectionSettings?.[block.id] : undefined, {
    editorialVersion: '2', selectionMode: 'manual', itemCount: '3', chefIcon: 'sef-sapkasi', showQuote: 'false',
  })
})

test('ana sayfa araması aynı Hero Banner ile ek Video Hero bileşenini bulur', () => {
  const controller = createHomeThemeEditorController({
    theme: DEFAULT_THEME,
    query: 'hero',
    group: 'Tümü',
    setQuery: () => undefined,
    setGroup: () => undefined,
    openPicker: () => undefined,
    closePicker: () => undefined,
    updateTheme: () => undefined,
    selectBlock: () => undefined,
    showDesignSurface: () => undefined,
  })

  assert.deepEqual(controller.filteredSections.map((section) => section.id), ['hero-banner', 'storefront-video-hero'])
})

test('new Video Hero is seeded as V2 at the start and singleton reopens existing block', () => {
  let patch: Partial<GarsonlessTheme> | undefined
  let selected = ''
  const base = {
    ...DEFAULT_THEME,
    surfaces: { ...DEFAULT_THEME.surfaces!, home: { ...DEFAULT_THEME.surfaces!.home, blocks: [{ id: 'existing', sectionId: 'hero-banner', enabled: true }] } },
  } as GarsonlessTheme
  const build = (theme: GarsonlessTheme) => createHomeThemeEditorController({
    theme, query: '', group: 'Tümü', setQuery: () => undefined, setGroup: () => undefined,
    openPicker: () => undefined, closePicker: () => undefined,
    updateTheme: (next) => { patch = next }, selectBlock: (id) => { selected = id }, showDesignSurface: () => undefined,
  })

  build(base).add('storefront-video-hero')
  const hero = patch?.surfaces?.home.blocks?.[0]
  assert.equal(hero?.sectionId, 'storefront-video-hero')
  assert.equal(hero ? patch?.sectionSettings?.[hero.id]?.editorialVersion : undefined, '2')

  const withHero = { ...base, ...patch } as GarsonlessTheme
  patch = undefined
  build(withHero).add('storefront-video-hero')
  assert.equal(patch, undefined)
  assert.equal(selected, hero?.id)
})
