import assert from 'node:assert/strict'
import test from 'node:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import type { MenuItem } from '../../../menu/types'
import { ChefPickSection } from './ChefPickSection'

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

test('chef pick renders live menu copy, images and prices instead of catalogue placeholders', () => {
  const html = renderToStaticMarkup(
    <ChefPickSection
      config={{ showProductDescription: 'true', ctaMode: 'custom', buttonStyle: 'pill', ctaText: 'Sepete ekle' }}
      items={[
        item({ id: 'latte', name: 'Buzlu Latte', price: 145, description: 'Çift shot espresso', images: ['https://images.example/latte.webp'] }),
        item({ id: 'brownie', name: 'Belçika Brownie', price: 175, position: 1 }),
      ]}
      onQuickAdd={() => undefined}
    />,
  )

  assert.match(html, /Buzlu Latte/)
  assert.match(html, /Belçika Brownie/)
  assert.match(html, /Çift shot espresso/)
  assert.match(html, /https:\/\/images\.example\/latte\.webp/)
  assert.match(html, /₺145,00/)
  assert.match(html, /Sepete ekle/)
  assert.doesNotMatch(html, /Hünkar Beğendi|Kuzu Tandır|Levrek Buğulama|👨‍🍳/)
})

test('chef pick exposes one accessible cart action for every rendered product', () => {
  const html = renderToStaticMarkup(
    <ChefPickSection
      config={{ itemCount: '2' }}
      items={[
        item({ id: 'one', name: 'Birinci Ürün', price: 100 }),
        item({ id: 'two', name: 'İkinci Ürün', price: 200, position: 1 }),
      ]}
      onQuickAdd={() => undefined}
    />,
  )

  assert.match(html, /aria-label="Birinci Ürün sepete ekle"/)
  assert.match(html, /aria-label="İkinci Ürün sepete ekle"/)
  assert.equal((html.match(/garsonless-chef-pick-add/g) ?? []).length >= 2, true)
  assert.doesNotMatch(html, /disabled=""/)
})

test('chef pick add action forwards the exact live menu product to the cart handler', () => {
  const latte = item({ id: 'latte', name: 'Buzlu Latte', price: 145 })
  const calls: MenuItem[] = []
  const tree = ChefPickSection({
    config: { itemCount: '1' },
    items: [latte],
    onQuickAdd: (selected) => calls.push(selected),
  })
  const addButton = findElementByClassName(tree, 'garsonless-chef-pick-add')

  assert.ok(addButton)
  const props = addButton.props as { onClick?: () => void }
  props.onClick?.()
  assert.equal(calls.length, 1)
  assert.equal(calls[0], latte)
})

test('chef pick hides unavailable products and does not leak an empty public section', () => {
  const html = renderToStaticMarkup(
    <ChefPickSection
      config={{ selectionMode: 'manual', item1Id: 'hidden' }}
      items={[item({ id: 'hidden', name: 'Satışta Değil', price: 100, is_available: false })]}
      onQuickAdd={() => undefined}
    />,
  )

  assert.equal(html, '')
})

test('chef pick inherits the global card CTA unless a section override is selected', () => {
  const html = renderToStaticMarkup(
    <ChefPickSection
      config={{ ctaText: 'Sepete ekle' }}
      theme={{ cardCtaStyle: 'pill', cardCtaIcon: 'cart', cta: '#2e7d52', ctaTextColor: '#ffffff' }}
      items={[item({ id: 'latte', name: 'Latte', price: 120 })]}
      onQuickAdd={() => undefined}
    />,
  )

  assert.match(html, /data-cta-source="inherit"/)
  assert.match(html, /data-cta-icon="cart"/)
  assert.match(html, /Sepete ekle/)
  assert.match(html, /var\(--p-cta\)/)
  assert.match(html, /var\(--p-cta-text\)/)
})

test('chef pick supports the kitchen icon set, stepped sizing and custom CTA artwork', () => {
  const html = renderToStaticMarkup(
    <ChefPickSection
      config={{
        chefIcon: 'sef-sapkasi',
        chefIconSize: 'large',
        ctaMode: 'custom',
        buttonIcon: 'custom',
        buttonIconUrl: 'https://images.example/custom-cta.webp',
        buttonSize: 'large',
      }}
      items={[item({ id: 'latte', name: 'Latte', price: 120 })]}
      onQuickAdd={() => undefined}
    />,
  )

  assert.match(html, /data-chef-icon="sef-sapkasi"/)
  assert.match(html, /width="30"/)
  assert.match(html, /data-cta-source="custom"/)
  assert.match(html, /data-cta-icon="custom"/)
  assert.match(html, /https:\/\/images\.example\/custom-cta\.webp/)
})

test('chef pick keeps product card surfaces independent from the section background', () => {
  const html = renderToStaticMarkup(
    <ChefPickSection
      config={{
        bgColor: '#111111',
        itemBgColor: '#f7f3ed',
        itemBorderColor: '#d4c8b8',
        itemTextColor: '#201d19',
        itemMutedColor: '#6b6258',
        priceColor: '#8a4b1f',
        imageBgColor: '#efe5d8',
        showProductDescription: 'true',
      }}
      items={[item({ id: 'latte', name: 'Latte', description: 'Çift shot', price: 120 })]}
      onQuickAdd={() => undefined}
    />,
  )

  assert.match(html, /background:#111111/)
  assert.match(html, /--chef-item-bg:#f7f3ed/)
  assert.match(html, /background:#f7f3ed/)
  assert.match(html, /border:1px solid #d4c8b8/)
  assert.match(html, /color:#201d19/)
  assert.match(html, /color:#6b6258/)
  assert.match(html, /color:#8a4b1f/)
  assert.match(html, /background:#efe5d8/)
})

function findElementByClassName(node: React.ReactNode, className: string): React.ReactElement | null {
  if (!React.isValidElement(node)) return null
  const props = node.props as { className?: string; children?: React.ReactNode }
  if (props.className?.split(/\s+/).includes(className)) return node
  for (const child of React.Children.toArray(props.children)) {
    const match = findElementByClassName(child, className)
    if (match) return match
  }
  return null
}
