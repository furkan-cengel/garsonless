import assert from 'node:assert/strict'
import test from 'node:test'
import type { ThemePageBlock } from '@garsonless/design-engine'
import type { MenuItem } from '../../../menu/types'
import {
  deriveActivePromoSliderCampaigns,
  selectPromoSliderCampaigns,
} from './promoSliderCampaignModel'

function item(id: string, name: string, price: number, position: number): MenuItem {
  return {
    id,
    category_id: 'category-1',
    name,
    description: `${name} açıklaması`,
    price,
    images: [`https://example.com/${id}.jpg`],
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
    position,
  }
}

const pageBlocks: ThemePageBlock[] = [
  { type: 'section', id: 'discount-instance', sectionId: 'discount-badge' },
  { type: 'section', id: 'daily-instance', sectionId: 'daily-special' },
  { type: 'section', id: 'combo-instance', sectionId: 'combo-ribbon' },
  { type: 'section', id: 'slider-instance', sectionId: 'promo-slider' },
]

test('slider campaigns are derived from live promotion sections and their canonical prices', () => {
  const campaigns = deriveActivePromoSliderCampaigns({
    pageBlocks,
    items: [
      item('coffee', 'Türk Kahvesi', 200, 1),
      item('cake', 'Pasta', 300, 2),
      item('tea', 'Çay', 100, 3),
    ],
    sectionSettings: {
      'discount-instance': {
        productId: 'coffee',
        discountMode: 'percentage',
        discountPercent: '25',
      },
      'daily-instance': {
        productId: 'cake',
        discountMode: 'fixed',
        campaignPrice: '240',
      },
      'combo-instance': {
        selectionMode: 'manual',
        comboCount: '1',
        itemsPerCombo: '2',
        combo1Item1Id: 'coffee',
        combo1Item2Id: 'tea',
        combo1Price: '250',
      },
    },
  })

  assert.deepEqual(campaigns.map(({ kind }) => kind), ['discount-badge', 'daily-special', 'combo-ribbon'])
  assert.deepEqual(campaigns.map(({ price }) => price), [150, 240, 250])
  assert.deepEqual(campaigns.map(({ oldPrice }) => oldPrice), [200, 300, 300])
})

test('expired, unavailable and unconfigured promotions never leak into the slider', () => {
  const campaigns = deriveActivePromoSliderCampaigns({
    pageBlocks,
    now: Date.parse('2026-07-25T12:00:00.000Z'),
    items: [item('coffee', 'Türk Kahvesi', 200, 1)],
    sectionSettings: {
      'discount-instance': {
        productId: 'coffee',
        countdownEnabled: 'true',
        campaignEndsAt: '2026-07-25T11:00:00.000Z',
      },
      'daily-instance': { productId: 'missing' },
      'combo-instance': { comboCount: '1' },
    },
  })

  assert.deepEqual(campaigns, [])
})

test('daily special and discount campaigns carry their configured countdown deadline into slider cards', () => {
  const endsAt = '2026-07-25T13:02:46.000Z'
  const campaigns = deriveActivePromoSliderCampaigns({
    pageBlocks: pageBlocks.slice(0, 2),
    now: Date.parse('2026-07-25T12:00:00.000Z'),
    items: [
      item('coffee', 'Türk Kahvesi', 200, 1),
      item('cake', 'Pasta', 300, 2),
    ],
    sectionSettings: {
      'discount-instance': {
        productId: 'coffee',
        countdownEnabled: 'true',
        campaignEndsAt: endsAt,
        countdownLabel: 'Kahve fırsatı bitiyor',
      },
      'daily-instance': {
        productId: 'cake',
        countdownEnabled: 'true',
        campaignEndsAt: endsAt,
        countdownLabel: 'Bugün sona eriyor',
      },
    },
  })

  assert.deepEqual(campaigns.map(({ expiresAtMs }) => expiresAtMs), [Date.parse(endsAt), Date.parse(endsAt)])
  assert.deepEqual(campaigns.map(({ countdownLabel }) => countdownLabel), ['Kahve fırsatı bitiyor', 'Bugün sona eriyor'])
})

test('an empty selection follows every active campaign while explicit ids filter the source', () => {
  const campaigns = deriveActivePromoSliderCampaigns({
    pageBlocks: pageBlocks.slice(0, 2),
    items: [
      item('coffee', 'Türk Kahvesi', 200, 1),
      item('cake', 'Pasta', 300, 2),
    ],
    sectionSettings: {
      'discount-instance': { productId: 'coffee' },
      'daily-instance': { productId: 'cake' },
    },
  })

  assert.equal(selectPromoSliderCampaigns(campaigns, '').length, 2)
  assert.deepEqual(
    selectPromoSliderCampaigns(campaigns, 'daily-instance').map(({ id }) => id),
    ['daily-instance'],
  )
})
