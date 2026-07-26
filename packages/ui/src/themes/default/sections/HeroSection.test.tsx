import assert from 'node:assert/strict'
import test from 'node:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { HeroSection } from './HeroSection'

const baseProps = {
  sectionId: 'hero-banner',
  restaurantName: 'Test Cafe',
}

test('hero does not render a dead CTA when no action is configured', () => {
  const html = renderToStaticMarkup(<HeroSection {...baseProps} config={{ cta: 'Sipariş ver' }} />)
  assert.doesNotMatch(html, /href="#"/)
  assert.doesNotMatch(html, /<button/)
})

test('hero cart action is a real button only when the cart capability exists', () => {
  const withoutHandler = renderToStaticMarkup(<HeroSection {...baseProps} config={{ targetType: 'cart' }} />)
  assert.doesNotMatch(withoutHandler, /<button/)

  const withHandler = renderToStaticMarkup(
    <HeroSection {...baseProps} config={{ targetType: 'cart', cta: 'Sepeti aç' }} onOpenCart={() => undefined} />,
  )
  assert.match(withHandler, /<button[^>]*>Sepeti aç<\/button>/)
})

test('hero external actions are hardened and side media keeps its own layout column', () => {
  const html = renderToStaticMarkup(
    <HeroSection
      {...baseProps}
      config={{
        targetType: 'link',
        targetUrl: 'https://masabu.co/demo',
        imageMode: 'side',
        imageFit: 'contain',
        imagePosition: 'top',
        imageUrl: 'https://images.example/hero.webp',
        align: 'right',
      }}
    />,
  )
  assert.match(html, /href="https:\/\/masabu.co\/demo"/)
  assert.match(html, /target="_blank"/)
  assert.match(html, /rel="noopener noreferrer"/)
  assert.match(html, /flex-direction:row-reverse/)
  assert.match(html, /src="https:\/\/images.example\/hero.webp"/)
  assert.match(html, /object-fit:contain/)
  assert.match(html, /object-position:top/)
})

test('hero uses the live restaurant name by default and respects explicit empty copy', () => {
  const dynamic = renderToStaticMarkup(<HeroSection {...baseProps} config={{}} />)
  assert.match(dynamic, />Test Cafe</)

  const hidden = renderToStaticMarkup(
    <HeroSection {...baseProps} config={{ eyebrow: '', title: '', body: '', cta: '', targetType: 'cart' }} onOpenCart={() => undefined} />,
  )
  assert.doesNotMatch(hidden, /Test Cafe|Gün özel|Favorilerinizi|<button/)
})

test('hero background media honors fit and focal point settings', () => {
  const html = renderToStaticMarkup(
    <HeroSection
      {...baseProps}
      config={{ imageUrl: 'https://images.example/hero.webp', imageFit: 'contain', imagePosition: 'bottom' }}
    />,
  )
  assert.match(html, /bottom\/contain no-repeat/)
})
