import assert from 'node:assert/strict'
import test from 'node:test'
import { legacyVideoHeroPlacement, resolveVideoHero } from '../themes/default/sections/videoHeroModel'

test('modern Video Hero resolver normalizes media, placement and bounded values', () => {
  const hero = resolveVideoHero({
    editorialVersion: '2',
    videoUrl: ' video.webm ',
    posterUrl: ' poster.webp ',
    contentPlacement: 'top-right',
    height: '9999',
    contentWidth: '1',
    overlay: '-4',
    showExplore: 'false',
    animateExplore: 'false',
    exploreLabel: ` ${'y'.repeat(50)} `,
    title: 'x'.repeat(200),
  })

  assert.equal(hero.mediaState, 'ready')
  assert.equal(hero.placement, 'top-right')
  assert.equal(hero.height, 820)
  assert.equal(hero.contentWidth, 320)
  assert.equal(hero.overlay, 0)
  assert.equal(hero.showExplore, false)
  assert.equal(hero.animateExplore, false)
  assert.equal(hero.exploreLabel.length, 40)
  assert.equal(hero.title.length, 140)
})

test('Video Hero keşfet yönlendirmesi eski temalarda güvenli varsayılanlarla açık kalır', () => {
  const hero = resolveVideoHero({ editorialVersion: '2' })
  assert.equal(hero.showExplore, true)
  assert.equal(hero.exploreLabel, 'Keşfet')
  assert.equal(hero.animateExplore, true)
})

test('Video Hero media readiness distinguishes every incomplete draft state', () => {
  assert.equal(resolveVideoHero({ editorialVersion: '2' }).mediaState, 'empty')
  assert.equal(resolveVideoHero({ editorialVersion: '2', videoUrl: 'video.webm' }).mediaState, 'poster-missing')
  assert.equal(resolveVideoHero({ editorialVersion: '2', posterUrl: 'poster.webp' }).mediaState, 'video-missing')
  assert.equal(resolveVideoHero({}, { previewMode: 'catalog' }).mediaState, 'catalog')
})

test('legacy percentage positions migrate deterministically to nearest 3x3 preset', () => {
  assert.equal(legacyVideoHeroPlacement({ contentPositionX: '75', contentPositionY: '20' }), 'top-right')
  assert.equal(legacyVideoHeroPlacement({ align: 'center', contentPositionY: '50' }), 'center')
  assert.equal(legacyVideoHeroPlacement({}), 'bottom-left')
})
