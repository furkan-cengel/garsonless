import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { buildVideoHeroModernSettings, buildVideoHeroResetSettings, createInitialSectionSettings } from './theme-section-initial-settings'

const panels = readFileSync(new URL('./ThemeExperiencePanels.tsx', import.meta.url), 'utf8')
const actions = readFileSync(new URL('../../lib/actions/theme.ts', import.meta.url), 'utf8')

test('new Video Hero has complete V2 layout defaults without fake media', () => {
  assert.deepEqual(createInitialSectionSettings('storefront-video-hero'), {
    editorialVersion: '2', showStatus: 'true', showEyebrow: 'true', showTitle: 'true', showBody: 'true', showExplore: 'true', exploreLabel: 'Keşfet',
    imageFit: 'cover', imagePosition: 'center', overlay: '42', textColor: '#ffffff', animateExplore: 'true', contentPlacement: 'bottom-left',
    height: '640', contentWidth: '620',
  })
})

test('legacy Video Hero migration preserves media and maps percentage position', () => {
  assert.deepEqual(buildVideoHeroModernSettings({
    videoUrl: 'video.webm', posterUrl: 'poster.webp', title: 'Başlık',
    contentPositionX: '80', contentPositionY: '10', align: 'right', imageFit: 'contain',
  }), {
    editorialVersion: '2', showStatus: 'true', showEyebrow: 'true', showTitle: 'true', showBody: 'true', showExplore: 'true', exploreLabel: 'Keşfet',
    imageFit: 'contain', imagePosition: 'center', overlay: '42', textColor: '#ffffff', animateExplore: 'true', contentPlacement: 'top-right',
    height: '640', contentWidth: '620', videoUrl: 'video.webm', posterUrl: 'poster.webp', title: 'Başlık',
  })
})

test('Video Hero reset retains content, discovery settings and both media URLs', () => {
  const reset = buildVideoHeroResetSettings({ videoUrl: 'video.webm', posterUrl: 'poster.webp', body: 'Metin', showExplore: 'false', exploreLabel: 'Aşağı kaydır', overlay: '5' })
  assert.equal(reset.videoUrl, 'video.webm')
  assert.equal(reset.posterUrl, 'poster.webp')
  assert.equal(reset.showExplore, 'false')
  assert.equal(reset.exploreLabel, 'Aşağı kaydır')
  assert.equal(reset.body, 'Metin')
  assert.equal(reset.overlay, '42')
})

test('editor retires replaced and removed Video Hero media through one patch boundary', () => {
  assert.match(panels, /if \(videoUrl && videoUrl !== result\.url\) onRetireMedia\?\.\(videoUrl\)/)
  assert.match(panels, /if \(posterUrl && posterUrl !== result\.url\) onRetireMedia\?\.\(posterUrl\)/)
  assert.match(panels, /onChange\(\{ videoUrl: '', posterUrl: '' \}\)/)
})

test('poster is previewed in the editor and its runtime purpose is explained', () => {
  assert.match(panels, /alt="Video Hero poster önizlemesi"/)
  assert.match(panels, /video duraklatıldığında/)
  assert.match(panels, /hareket\/veri tasarrufu tercihinde/)
})

test('server accepts incomplete drafts but requires a complete owned pair for publish', () => {
  assert.match(actions, /validateOwnedHomeVideoPairs\(draftTokens, restaurantId, true\)/)
  assert.match(actions, /validateOwnedHomeVideoPairs\(parsed\.data\.theme, restaurantId, false\)/)
  assert.match(actions, /home-hero-video/)
  assert.match(actions, /home-hero-poster/)
})
