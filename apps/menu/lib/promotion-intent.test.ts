import assert from 'node:assert/strict'
import test from 'node:test'
import type { GarsonlessTheme } from '@garsonless/design-engine'
import type { MenuItem } from '@garsonless/ui/menu'
import { resolveAutomaticPromotionForItem, resolvePromotionIntent } from './promotion-intent.ts'

const item = (id: string, price: number): MenuItem => ({
  id,
  category_id: 'dessert',
  name: id,
  description: '',
  price,
  images: [],
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
  modifier_groups: [],
  is_available: true,
  position: 1,
})

const baseTheme = {
  pageBlocks: [{ type: 'section', id: 'slider-home', sectionId: 'promo-slider' }],
  sectionSettings: {
    'slider-home': {
      sourceMode: 'manual',
      flashOfferType: 'buy-2-pay-1',
      flashItem1Id: 'cake',
    },
  },
} as unknown as GarsonlessTheme

test('Home promotion handoff rebuilds the selected pair price from theme and catalogue', () => {
  const resolved = resolvePromotionIntent({
    theme: baseTheme,
    items: [item('cake', 195), item('burger', 240)],
    itemId: 'cake',
    sectionInstanceId: 'slider-home',
    kind: 'promo-slider',
  })
  assert.equal(resolved?.item.price, 97.5)
  assert.equal(resolved?.originalPrice, 195)
  assert.deepEqual(resolved?.promotion, { sectionInstanceId: 'slider-home', kind: 'promo-slider', quantityStep: 2 })
})

test('Home promotion handoff rejects an unselected product and invented section', () => {
  const input = { theme: baseTheme, items: [item('cake', 195), item('burger', 240)], kind: 'promo-slider' }
  assert.equal(resolvePromotionIntent({ ...input, itemId: 'burger', sectionInstanceId: 'slider-home' }), null)
  assert.equal(resolvePromotionIntent({ ...input, itemId: 'cake', sectionInstanceId: 'invented' }), null)
})

test('ordinary product-card additions automatically inherit an active selected Flash campaign', () => {
  const selected = resolveAutomaticPromotionForItem({ theme: baseTheme, item: item('cake', 195) })
  assert.equal(selected?.item.price, 97.5)
  assert.equal(selected?.promotion.quantityStep, 2)
  assert.equal(resolveAutomaticPromotionForItem({ theme: baseTheme, item: item('burger', 240) }), null)
})

test('an enabled Home campaign remains valid on Menu when the Home landing page is disabled', () => {
  const menuOnlyTheme = {
    pageBlocks: [],
    surfaces: {
      home: {
        enabled: false,
        blocks: [{ id: 'slider-home', sectionId: 'promo-slider', enabled: true }],
      },
    },
    sectionSettings: baseTheme.sectionSettings,
  } as unknown as GarsonlessTheme

  const resolved = resolveAutomaticPromotionForItem({
    theme: menuOnlyTheme,
    item: item('cake', 195),
  })

  assert.equal(resolved?.item.price, 97.5)
  assert.equal(resolved?.promotion.quantityStep, 2)
})

test('disabled or removed campaigns stop decorating ordinary product cards', () => {
  const disabledTheme = {
    ...baseTheme,
    sectionSettings: {
      'slider-home': {
        ...baseTheme.sectionSettings?.['slider-home'],
        flashEnabled: 'false',
      },
    },
  } as unknown as GarsonlessTheme
  const removedTheme = {
    ...baseTheme,
    pageBlocks: [],
  } as unknown as GarsonlessTheme

  assert.equal(resolveAutomaticPromotionForItem({ theme: disabledTheme, item: item('cake', 195) }), null)
  assert.equal(resolveAutomaticPromotionForItem({ theme: removedTheme, item: item('cake', 195) }), null)
})
