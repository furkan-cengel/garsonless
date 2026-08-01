import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import type { MenuItem } from './types'
import { AllergenIconList, ProductAllergenSummary, getDefiniteAllergens } from './FoodInfoBadges'

function item(overrides: Partial<MenuItem> = {}): MenuItem {
  return {
    id: 'item', category_id: 'category', name: 'Ürün', description: null, price: 100,
    images: [], ingredients: [], energy_kcal: null, contains_allergens: [], may_contain_allergens: [],
    allergen_note: null, cross_contact_note: null, contains_alcohol: false, contains_pork: false,
    is_vegetarian: false, is_vegan: false, is_halal: false, food_info_reviewed_at: null,
    modifier_groups: [], is_available: true, position: 0, ...overrides,
  }
}

test('definite allergens merge item and ingredient declarations in canonical EU order', () => {
  const result = getDefiniteAllergens(item({
    contains_allergens: ['milk', 'gluten'],
    ingredients: [{ id: 'sesame', name: 'Susam', removable: false, allergen_codes: ['sesame', 'milk'] }],
  }))
  assert.deepEqual(result, ['gluten', 'milk', 'sesame'])
})

test('compact allergen list renders three icons and an accessible overflow count', () => {
  const html = renderToStaticMarkup(React.createElement(AllergenIconList, {
    codes: ['gluten', 'eggs', 'fish', 'milk', 'sesame'],
    maxVisible: 3,
  }))
  assert.equal((html.match(/data-allergen-icon=/g) ?? []).length, 3)
  assert.match(html, />\+2</)
  assert.match(html, /Diğer alerjenler: Süt, Susam/)
})

test('trace-only products render a textual cross-contact warning without definite icons', () => {
  const html = renderToStaticMarkup(React.createElement(ProductAllergenSummary, {
    item: item({ may_contain_allergens: ['peanuts'] }),
  }))
  assert.match(html, /data-component="cross-contact-summary"/)
  assert.match(html, /Çapraz temas/)
  assert.doesNotMatch(html, /data-allergen-icon=/)
})

test('all fourteen allergen codes have a dedicated accessible SVG glyph', () => {
  const codes = ['gluten','crustaceans','eggs','fish','peanuts','soy','milk','tree_nuts','celery','mustard','sesame','sulphites','lupin','molluscs'] as const
  const html = renderToStaticMarkup(React.createElement(AllergenIconList, { codes, showLabels: true }))
  for (const code of codes) assert.match(html, new RegExp(`data-allergen-icon="${code}"`))
})

test('every canonical product-carrying section uses the shared allergen summary', () => {
  const sectionRoot = new URL('../themes/default/sections/', import.meta.url)
  for (const file of ['FeaturedScrollSection.tsx','ChefPickSection.tsx','ComboRibbonSection.tsx','DailySpecialSection.tsx','DiscountBadgeSection.tsx']) {
    const source = readFileSync(new URL(file, sectionRoot), 'utf8')
    assert.match(source, /ProductAllergenSummary/, `${file} must render product allergen metadata`)
  }
  assert.match(readFileSync(new URL('PromoSliderSection.tsx', sectionRoot), 'utf8'), /AllergenSummary/)
})
