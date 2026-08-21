import assert from 'node:assert/strict'
import test from 'node:test'
import type { HomeSurfaceBlock } from '@garsonless/design-engine'
import type { MenuItem } from '@garsonless/ui/menu'
import { deriveHomePromoSliderCampaigns } from './home-promo-slider'

function item(id: string, price: number): MenuItem {
  return {
    id,
    category_id: 'coffee',
    name: id,
    description: `${id} açıklaması`,
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
  }
}

test('home slider derives campaigns from every enabled home block', () => {
  const blocks: HomeSurfaceBlock[] = [
    { id: 'daily-home', sectionId: 'daily-special', enabled: true },
    { id: 'combo-home', sectionId: 'combo-ribbon', enabled: true },
    { id: 'slider-home', sectionId: 'promo-slider', enabled: true },
    { id: 'disabled-discount', sectionId: 'discount-badge', enabled: false },
  ]
  const campaigns = deriveHomePromoSliderCampaigns({
    blocks,
    items: [item('coffee', 200), item('cake', 300)],
    sectionSettings: {
      'daily-home': { productId: 'coffee', discountMode: 'fixed-price', campaignPrice: '150' },
      'combo-home': {
        selectionMode: 'manual',
        comboCount: '1',
        itemsPerCombo: '2',
        combo1Item1Id: 'coffee',
        combo1Item2Id: 'cake',
        combo1Price: '425',
      },
      'disabled-discount': { productId: 'coffee', discountPercent: '20' },
    },
  })

  assert.deepEqual(campaigns.map(({ id, price }) => ({ id, price })), [
    { id: 'daily-home', price: 150 },
    { id: 'combo-home:combo:1', price: 425 },
  ])
})
