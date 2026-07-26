import assert from 'node:assert/strict'
import test from 'node:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import type { MenuItem } from '../../../menu/types'
import { ComboRibbonSection } from './ComboRibbonSection'

const item = (id: string, name: string, price: number, position: number, overrides: Partial<MenuItem> = {}): MenuItem => ({
  id,
  category_id: 'category-1',
  name,
  description: null,
  price,
  images: overrides.images ?? [],
  ingredients: overrides.ingredients ?? [],
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
  modifier_groups: [],
  is_available: true,
  position,
})

test('combo ribbon renders real names, images and a truthful live total', () => {
  const html = renderToStaticMarkup(
    <ComboRibbonSection
      sectionInstanceId="combo-ribbon-instance"
      config={{ comboCount: '1', itemsPerCombo: '2', ctaMode: 'custom', buttonStyle: 'pill' }}
      items={[
        item('latte', 'Buzlu Latte', 145, 1, { images: ['https://images.example/latte.webp'] }),
        item('brownie', 'Belçika Brownie', 175, 2),
      ]}
      onAddCombo={() => undefined}
    />,
  )

  assert.match(html, /Buzlu Latte/)
  assert.match(html, /Belçika Brownie/)
  assert.match(html, /https:\/\/images\.example\/latte\.webp/)
  assert.match(html, /₺320,00/)
  assert.match(html, /Komboyu ekle/)
  assert.doesNotMatch(html, /-30%|₺189|Burger \+ Patates/)
})

test('combo action sends one complete bundle request with its authoritative identity', () => {
  const latte = item('latte', 'Latte', 120, 1)
  const brownie = item('brownie', 'Brownie', 150, 2)
  const calls: Array<{ sectionInstanceId: string; comboIndex: number; itemIds: string[]; total: number }> = []
  const tree = ComboRibbonSection({
    sectionInstanceId: 'combo-ribbon-instance',
    config: { comboCount: '1', itemsPerCombo: '2' },
    items: [latte, brownie],
    onAddCombo: (combo) => calls.push({
      sectionInstanceId: combo.sectionInstanceId,
      comboIndex: combo.comboIndex,
      itemIds: combo.items.map((selected) => selected.id),
      total: combo.total,
    }),
  })
  const button = findElementByClassName(tree, 'garsonless-combo-add')

  assert.ok(button)
  const props = button.props as { onClick?: () => void; disabled?: boolean }
  assert.equal(props.disabled, false)
  props.onClick?.()
  assert.deepEqual(calls, [{
    sectionInstanceId: 'combo-ribbon-instance',
    comboIndex: 1,
    itemIds: ['latte', 'brownie'],
    total: 270,
  }])
})

test('combo action remains available when a product requires configuration', () => {
  const html = renderToStaticMarkup(
    <ComboRibbonSection
      sectionInstanceId="combo-ribbon-instance"
      config={{ comboCount: '1' }}
      items={[
        item('plain', 'Sade Ürün', 100, 1),
        item('configurable', 'Seçenekli Ürün', 140, 2, {
          ingredients: [{ id: 'sauce', name: 'Sos', removable: true, allergen_codes: [] }],
        }),
      ]}
      onAddCombo={() => undefined}
    />,
  )

  assert.doesNotMatch(html, /disabled=""/)
  assert.match(html, /Seçenekleri sonraki adımda tamamlayabilirsiniz/)
})

test('combo ribbon renders the special price and preserves the catalog reference price', () => {
  const html = renderToStaticMarkup(
    <ComboRibbonSection
      sectionInstanceId="combo-ribbon-instance"
      config={{ comboCount: '1', combo1Price: '200' }}
      items={[item('coffee', 'Kahve', 120, 1), item('cake', 'Pasta', 180, 2)]}
      onAddCombo={() => undefined}
    />,
  )

  assert.match(html, /₺300,00/)
  assert.match(html, /₺200,00/)
})

test('combo ribbon hides an invalid public bundle instead of leaking placeholders', () => {
  const html = renderToStaticMarkup(
    <ComboRibbonSection sectionInstanceId="combo-ribbon-instance" config={{ comboCount: '1' }} items={[item('only', 'Tek Ürün', 100, 1)]} onAddCombo={() => undefined} />,
  )

  assert.equal(html, '')
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
