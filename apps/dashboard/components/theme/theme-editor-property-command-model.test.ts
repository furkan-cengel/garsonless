import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { GarsonlessTheme } from '@garsonless/design-engine'
import type { SettingsGroup } from '@garsonless/ui/themes'
import {
  buildSectionSettingsResetPatch,
  buildThemeGroupResetPatch,
  buildThemeSettingsClipboardPayload,
} from './theme-editor-property-command-model'
import { buildGalleryClearPatch } from './theme-section-initial-settings'

const group: SettingsGroup = {
  id: 'header',
  label: 'Header',
  fields: [
    {
      id: 'headerNameSize',
      label: 'Başlık boyutu',
      type: 'range',
      themeField: 'headerNameSize',
      default: 24,
    },
  ],
}

test('clipboard payload scopes section settings to the selected section', () => {
  const mergedTheme = {
    sectionSettings: {
      gallery: { title: 'Mekan' },
      reviews: { title: 'Yorumlar' },
    },
  } as unknown as GarsonlessTheme

  assert.deepEqual(buildThemeSettingsClipboardPayload({
    selectedSectionId: 'gallery',
    mergedTheme,
    previewTheme: mergedTheme,
    activeGroupData: group,
  }), {
    type: 'section',
    id: 'gallery',
    settings: { title: 'Mekan' },
  })
})

test('clipboard payload projects only active group fields from preview theme', () => {
  const previewTheme = { headerNameSize: 31 } as GarsonlessTheme
  assert.deepEqual(buildThemeSettingsClipboardPayload({
    selectedSectionId: null,
    mergedTheme: previewTheme,
    previewTheme,
    activeGroupData: group,
  }), {
    type: 'group',
    id: 'header',
    settings: { headerNameSize: 31 },
  })
})

test('gallery reset preserves content and returns design and layout to modern defaults', () => {
  const theme = {
    sectionSettings: {
      gallery: { title: 'Mekan' },
      reviews: { title: 'Yorumlar' },
    },
  } as unknown as GarsonlessTheme

  assert.deepEqual(buildSectionSettingsResetPatch(theme, 'gallery'), {
    sectionSettings: {
      gallery: {
        editorialVersion: '2', layout: 'mosaic', mosaicPattern: 'editorial', columns: '2', maxItems: '6', enableLightbox: 'true',
        rowHeight: '104', gap: '8', padding: '14', radius: '16', imageFit: 'cover', imagePosition: 'center', title: 'Mekan',
      },
      reviews: { title: 'Yorumlar' },
    },
  })
})

test('gallery clear patch removes only photos, labels and order in one patch', () => {
  const patch = buildGalleryClearPatch()
  assert.equal(Object.keys(patch).length, 13)
  assert.equal(patch.tile1Image, '')
  assert.equal(patch.tile6Label, '')
  assert.equal(patch.tileOrder, '')
  assert.equal('title' in patch, false)
  assert.equal('targetUrl' in patch, false)
})

test('Video Hero reset preserves media and content while restoring V2 design and layout', () => {
  const theme = {
    surfaces: { home: { blocks: [{ id: 'video-one', sectionId: 'storefront-video-hero', enabled: true }] } },
    sectionSettings: {
      'video-one': { videoUrl: 'video.webm', posterUrl: 'poster.webp', title: 'Başlık', height: '800', overlay: '10', contentPlacement: 'top-right' },
    },
  } as unknown as GarsonlessTheme

  const patch = buildSectionSettingsResetPatch(theme, 'video-one')
  assert.deepEqual(patch.sectionSettings?.['video-one'], {
    editorialVersion: '2', showStatus: 'true', showEyebrow: 'true', showTitle: 'true', showBody: 'true', showExplore: 'true', exploreLabel: 'Keşfet',
    imageFit: 'cover', imagePosition: 'center', overlay: '42', textColor: '#ffffff', animateExplore: 'true', contentPlacement: 'bottom-left',
    height: '640', contentWidth: '620', videoUrl: 'video.webm', posterUrl: 'poster.webp', title: 'Başlık',
  })
})

test('chef pick reset returns the instance to modern editorial defaults', () => {
  const theme = {
    pageBlocks: [{ type: 'section', id: 'chef-pick--2', sectionId: 'chef-pick' }],
    sectionSettings: {
      'chef-pick--2': { layout: 'grid', selectionMode: 'automatic', showQuote: 'true' },
      gallery: { title: 'Mekan' },
    },
  } as unknown as GarsonlessTheme

  assert.deepEqual(buildSectionSettingsResetPatch(theme, 'chef-pick--2'), {
    sectionSettings: {
      'chef-pick--2': {
        editorialVersion: '2', selectionMode: 'manual', itemCount: '3', chefIcon: 'sef-sapkasi', showQuote: 'false',
      },
      gallery: { title: 'Mekan' },
    },
  })
})

test('combo ribbon reset returns only that instance to modern safe defaults', () => {
  const theme = {
    pageBlocks: [{ type: 'section', id: 'combo-ribbon--2', sectionId: 'combo-ribbon' }],
    sectionSettings: {
      'combo-ribbon--2': { comboCount: '3', itemsPerCombo: '4', combo1Price: '999' },
      gallery: { title: 'Mekan' },
    },
  } as unknown as GarsonlessTheme
  assert.deepEqual(buildSectionSettingsResetPatch(theme, 'combo-ribbon--2'), {
    sectionSettings: {
      'combo-ribbon--2': {
        editorialVersion: '2', selectionMode: 'manual', comboCount: '1', itemsPerCombo: '2',
        showSavings: 'true', imageFit: 'cover', imagePosition: 'center',
      },
      gallery: { title: 'Mekan' },
    },
  })
})

test('group reset patch uses defaults only for fields owned by that group', () => {
  const defaults = { headerNameSize: 26, pagePadX: 18 } as unknown as GarsonlessTheme
  assert.deepEqual(buildThemeGroupResetPatch(group, defaults), { headerNameSize: 26 })
})
