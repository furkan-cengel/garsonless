import assert from 'node:assert/strict'
import test from 'node:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import type { MenuItem } from '../../../menu/types'
import { FeaturedScrollSection } from './FeaturedScrollSection'

const item = (overrides: Partial<MenuItem> & Pick<MenuItem, 'id' | 'name' | 'price'>): MenuItem => ({
  id: overrides.id,
  category_id: 'category-1',
  name: overrides.name,
  description: overrides.description ?? null,
  price: overrides.price,
  images: overrides.images ?? [],
  ingredients: [],
  energy_kcal: null,
  contains_allergens: [],
  may_contain_allergens: [],
  allergen_note: null,
  cross_contact_note: null,
  contains_alcohol: false,
  contains_pork: false,
  is_vegetarian: false,
  is_vegan: false,
  is_halal: false,
  food_info_reviewed_at: null,
  modifier_groups: overrides.modifier_groups ?? [],
  is_available: overrides.is_available ?? true,
  position: overrides.position ?? 0,
})

test('featured section renders real products, images, prices and no fabricated ratings', () => {
  const html = renderToStaticMarkup(
    <FeaturedScrollSection
      config={{ itemCount: '2', showProductDescription: 'true' }}
      items={[
        item({ id: 'burger', name: 'Trüf Burger', description: 'Dana köfte ve trüf mayo', price: 240, images: ['https://images.example/burger.webp'] }),
        item({ id: 'lemonade', name: 'Ev Limonatası', description: 'Taze nane ve limon', price: 70, position: 1 }),
      ]}
      onQuickAdd={() => undefined}
    />,
  )

  assert.match(html, /Trüf Burger/)
  assert.match(html, /Ev Limonatası/)
  assert.match(html, /Dana köfte ve trüf mayo/)
  assert.match(html, /https:\/\/images\.example\/burger\.webp/)
  assert.match(html, /₺240,00/)
  assert.match(html, /font-family:var\(--p-body\)[^>]*>Öne Çıkanlar/)
  assert.doesNotMatch(html, /4\.9|214|Favori/)
})

test('featured tags join the shared shimmer scope only when the global theme switch is enabled', () => {
  const html = renderToStaticMarkup(
    <FeaturedScrollSection
      config={{ showBadge: 'true' }}
      items={[item({ id: 'one', name: 'Birinci', price: 100 })]}
      theme={{
        cardCtaStyle: 'pill',
        cardCtaIcon: 'plus',
        cta: '#2e7d52',
        ctaTextColor: '#ffffff',
        motion: 'full',
        tagShimmer: true,
      }}
    />,
  )

  assert.match(html, /garsonless-tag-shimmer-enabled/)
  assert.match(html, /garsonless-tag-shimmer-target/)
  assert.match(html, /Öne çıkan/)
})

test('featured section exposes one accessible cart action per rendered product', () => {
  const html = renderToStaticMarkup(
    <FeaturedScrollSection
      config={{ itemCount: '2' }}
      items={[
        item({ id: 'one', name: 'Birinci', price: 100 }),
        item({ id: 'two', name: 'İkinci', price: 200, position: 1 }),
      ]}
      onQuickAdd={() => undefined}
    />,
  )

  assert.match(html, /aria-label="Birinci sepete ekle"/)
  assert.match(html, /aria-label="İkinci sepete ekle"/)
  assert.doesNotMatch(html, /disabled=""/)
})

test('featured section honors custom button form and icon on the home surface', () => {
  const renderButton = (buttonStyle: 'icon' | 'pill' | 'full', buttonIcon: 'plus' | 'cart' | 'bag') => renderToStaticMarkup(
    <FeaturedScrollSection
      actionMode="discover"
      config={{ ctaMode: 'custom', buttonStyle, buttonIcon }}
      items={[item({ id: 'one', name: 'Birinci', price: 100 })]}
      onQuickAdd={() => undefined}
    />,
  )

  const iconOnly = renderButton('icon', 'cart')
  assert.match(iconOnly, /data-cta-icon="cart" data-button-style="icon"/)
  assert.doesNotMatch(iconOnly, />İncele</)

  const pill = renderButton('pill', 'plus')
  assert.match(pill, /data-cta-icon="plus" data-button-style="pill"/)
  assert.match(pill, />İncele</)

  const full = renderButton('full', 'bag')
  assert.match(full, /data-cta-icon="bag" data-button-style="full"/)
  assert.match(full, /width:100%/)
})

test('featured section preserves the default discover CTA when it inherits global settings', () => {
  const html = renderToStaticMarkup(
    <FeaturedScrollSection
      actionMode="discover"
      config={{ ctaMode: 'inherit', buttonStyle: 'icon', buttonIcon: 'cart' }}
      items={[item({ id: 'one', name: 'Birinci', price: 100 })]}
      onQuickAdd={() => undefined}
    />,
  )

  assert.match(html, /data-cta-source="inherit" data-cta-icon="arrow" data-button-style="pill"/)
})

test('featured section hides unavailable public selections instead of leaking an empty shell', () => {
  const html = renderToStaticMarkup(
    <FeaturedScrollSection
      config={{ selectionMode: 'manual', itemCount: '2', item1Id: 'hidden' }}
      items={[item({ id: 'hidden', name: 'Satışta Değil', price: 100, is_available: false })]}
      onQuickAdd={() => undefined}
    />,
  )

  assert.equal(html, '')
})

test('featured section ignores legacy view-all settings', () => {
  const products = [item({ id: 'one', name: 'Birinci', price: 100 }), item({ id: 'two', name: 'İkinci', price: 200, position: 1 })]
  const html = renderToStaticMarkup(<FeaturedScrollSection config={{ showViewAll: 'true', viewAllText: 'Tümü', targetType: 'category', targetId: 'coffee' }} items={products} />)

  assert.doesNotMatch(html, /href="#section-coffee"/)
  assert.doesNotMatch(html, />Tümü</)
})

test('featured section explains when automatic ranking fell back to the previous day', () => {
  const previousWinner = item({ id: 'winner', name: 'Dünün Kazananı', price: 120 })
  previousWinner.featuredRank = 0
  previousWinner.featuredSalesSource = 'previous-day'
  const html = renderToStaticMarkup(
    <FeaturedScrollSection
      config={{
        selectionMode: 'automatic',
        // Older section rows may have persisted the former default copy. It must
        // still become truthful when the ranking falls back to yesterday.
        subtitle: 'Bugün en çok tercih edilenler',
      }}
      items={[previousWinner]}
    />,
  )

  assert.match(html, /data-featured-source="previous-day"/)
  assert.match(html, /Dünün en çok tercih edilenleri/)
})
