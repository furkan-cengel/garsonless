import assert from 'node:assert/strict'
import { test } from 'node:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { PromoStripSection } from './PromoStripSection'

test('a promo strip without an action is honest non-link content', () => {
  const markup = renderToStaticMarkup(<PromoStripSection config={{ targetType: 'none', animation: 'static' }} />)

  assert.doesNotMatch(markup, /<a\b/)
  assert.match(markup, /Promosyon duyurusu/)
  assert.match(markup, /İLK SİPARİŞE %20 İNDİRİM/)
})

test('legacy manual targets are ignored while the contextual home target remains actionable', () => {
  const legacyTarget = renderToStaticMarkup(<PromoStripSection config={{
    targetType: 'link',
    targetUrl: 'https://masabu.co/demo',
  }} />)
  const contextualTarget = renderToStaticMarkup(<PromoStripSection config={{}} forcedHref="/menu" />)

  assert.doesNotMatch(legacyTarget, /<a\b/)
  assert.match(contextualTarget, /href="\/menu"/)
})

test('static and fade modes render a single readable message instead of marquee copies', () => {
  const staticMarkup = renderToStaticMarkup(<PromoStripSection config={{ title: 'Kahvede %20', animation: 'static' }} />)
  const fadeMarkup = renderToStaticMarkup(<PromoStripSection config={{ title: 'Kahvede %20', animation: 'fade' }} />)

  assert.equal((staticMarkup.match(/Kahvede %20/g) ?? []).length, 2)
  assert.equal((fadeMarkup.match(/Kahvede %20/g) ?? []).length, 2)
  assert.doesNotMatch(staticMarkup, /class="garsonless-promo-sequence"/)
  assert.doesNotMatch(fadeMarkup, /class="garsonless-promo-sequence"/)
})

test('marquee output is duplicated for a seamless loop and respects reduced motion', () => {
  const markup = renderToStaticMarkup(<PromoStripSection config={{ title: 'Duyuru', animation: 'marquee' }} />)

  assert.equal((markup.match(/class="garsonless-promo-sequence"/g) ?? []).length, 2)
  assert.match(markup, /prefers-reduced-motion: reduce/)
  assert.match(markup, /animation-play-state:\s*paused/)
})

test('explicitly cleared or hidden copy does not revive placeholder content', () => {
  assert.equal(renderToStaticMarkup(<PromoStripSection config={{ title: '' }} />), '')
  assert.equal(renderToStaticMarkup(<PromoStripSection config={{ showTitle: 'false' }} />), '')
})

test('legacy secondary copy is ignored and cannot revive an empty strip', () => {
  assert.equal(renderToStaticMarkup(<PromoStripSection config={{ title: '', repeatText: 'Eski ikincil metin', showRepeatText: 'true' }} />), '')
})

test('stored layout values are clamped to the supported editor contract', () => {
  const markup = renderToStaticMarkup(<PromoStripSection config={{ height: '999', speed: '1' }} />)

  assert.match(markup, /min-height:64px/)
  assert.match(markup, /garsonless-promo-marquee 6s/)
})
