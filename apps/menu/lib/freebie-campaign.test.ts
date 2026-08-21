import test from 'node:test'
import assert from 'node:assert/strict'
import type { GarsonlessTheme } from '@garsonless/design-engine'
import type { MenuItem } from '@garsonless/ui/menu'
import { getNextFreebieCampaignTransition, resolveAutomaticFreebieForItem, resolveFreebieCampaign } from './freebie-campaign.ts'

const item = (id: string, category_id: string, available = true) => ({ id, category_id, name: id, price: 100, images: [], modifier_groups: [], ingredients: [], is_available: available }) as unknown as MenuItem
const theme = (settings: Record<string, string>) => ({
  pageBlocks: [{ type: 'section', id: 'slider-home', sectionId: 'promo-slider' }],
  sectionSettings: { 'slider-home': settings },
}) as unknown as GarsonlessTheme

test('functional freebie resolves category qualifiers and live reward choices', () => {
  const campaign = resolveFreebieCampaign({
    theme: theme({ sourceMode: 'manual', freebieEnabled: 'true', freebieOfferType: 'gift-with-purchase', freebieQualifierMode: 'category', freebieQualifierCategoryId: 'coffee', freebieRewardItem1Id: 'cake', freebieRewardItem2Id: 'cookie' }),
    items: [item('latte', 'coffee'), item('tea', 'tea'), item('cake', 'dessert'), item('cookie', 'dessert')],
    sectionInstanceId: 'slider-home',
  })
  assert.deepEqual(campaign?.qualifierItems.map((candidate) => candidate.id), ['latte'])
  assert.deepEqual(campaign?.rewardItems.map((candidate) => candidate.id), ['cake', 'cookie'])
  assert.equal(campaign?.qualifierCategoryId, 'coffee')
  assert.equal(resolveAutomaticFreebieForItem(theme({ sourceMode: 'manual', freebieEnabled: 'true', freebieOfferType: 'gift-with-purchase', freebieQualifierMode: 'category', freebieQualifierCategoryId: 'coffee', freebieRewardItem1Id: 'cake' }), [item('latte', 'coffee'), item('cake', 'dessert')], 'latte')?.sectionInstanceId, 'slider-home')
})

test('preview handoff resolves an unsaved functional freebie configuration', () => {
  const campaign = resolveFreebieCampaign({
    theme: theme({ sourceMode: 'manual', freebieEnabled: 'false' }),
    fallbackSettings: { sourceMode: 'manual', freebieEnabled: 'true', freebieOfferType: 'gift-with-purchase', freebieQualifierMode: 'category', freebieQualifierCategoryId: 'coffee', freebieRewardItem1Id: 'cake' },
    items: [item('latte', 'coffee'), item('cake', 'dessert')],
    sectionInstanceId: 'slider-home',
  })
  assert.equal(campaign?.qualifierCategoryId, 'coffee')
  assert.deepEqual(campaign?.rewardItems.map((candidate) => candidate.id), ['cake'])
})

test('functional freebie disappears when timing, availability or membership is invalid', () => {
  const settings = { sourceMode: 'manual', freebieEnabled: 'true', freebieOfferType: 'gift-with-purchase', freebieQualifierMode: 'products', freebieQualifierItem1Id: 'latte', freebieRewardItem1Id: 'cake', freebieTimingEnabled: 'true', freebieStartsAt: '2030-01-01T10:00:00.000Z', freebieEndsAt: '2030-01-01T12:00:00.000Z' }
  assert.equal(resolveFreebieCampaign({ theme: theme(settings), items: [item('latte', 'coffee'), item('cake', 'dessert')], sectionInstanceId: 'slider-home', now: Date.parse('2030-01-01T09:00:00.000Z') }), null)
  assert.equal(resolveFreebieCampaign({ theme: theme(settings), items: [item('latte', 'coffee'), item('cake', 'dessert', false)], sectionInstanceId: 'slider-home', now: Date.parse('2030-01-01T11:00:00.000Z') }), null)
  assert.equal(getNextFreebieCampaignTransition(theme(settings), Date.parse('2030-01-01T09:00:00.000Z')), Date.parse('2030-01-01T10:00:00.000Z'))
  assert.equal(getNextFreebieCampaignTransition(theme(settings), Date.parse('2030-01-01T11:00:00.000Z')), Date.parse('2030-01-01T12:00:00.000Z'))
})
