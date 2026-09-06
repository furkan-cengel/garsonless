'use client'

import type { Tables } from '@garsonless/db/types'
import LoyaltySection from './LoyaltySection'
import { DEFAULT_TIERS, type CatalogReward, type LoyaltyTier } from './loyalty-config'

export default function LoyaltySettingsSection({ restaurant, featureAllowed }: {
  restaurant: Tables<'restaurants'>
  featureAllowed: boolean
}) {
  const settings = restaurant.settings as Record<string, unknown>
  const raw = (settings['loyalty'] ?? {}) as Record<string, unknown>
  const stringValue = (key: string, fallback: string) => typeof raw[key] === 'string' ? raw[key] as string : fallback
  const numberValue = (key: string, fallback: number) => typeof raw[key] === 'number' ? raw[key] as number : fallback
  const booleanValue = (key: string, fallback: boolean) => typeof raw[key] === 'boolean' ? raw[key] as boolean : fallback
  const tiers = Array.isArray(raw['tiers']) && raw['tiers'].length > 0
    ? raw['tiers'] as LoyaltyTier[]
    : DEFAULT_TIERS
  const rewardCatalog = Array.isArray(raw['reward_catalog']) ? raw['reward_catalog'] as CatalogReward[] : []

  return (
    <LoyaltySection
      restaurantId={restaurant.id}
      timeZone={restaurant.timezone || 'Europe/Istanbul'}
      featureAllowed={featureAllowed}
      initialSettings={settings}
      initial={{
        stamp_enabled: booleanValue('stamp_enabled', false),
        stamp_goal: numberValue('stamp_goal', 10),
        stamp_reward_text: stringValue('stamp_reward_text', ''),
        reward_item_id: typeof raw['reward_item_id'] === 'string' ? raw['reward_item_id'] : null,
        points_enabled: booleanValue('points_enabled', false),
        points_per_lira: numberValue('points_per_lira', 1),
        points_redeem_rate: numberValue('points_redeem_rate', 100),
        scope: stringValue('scope', 'restaurant') === 'network' ? 'network' : 'restaurant',
        earn_trigger: stringValue('earn_trigger', 'paid') === 'served' ? 'served' : 'paid',
        member_discount_pct: numberValue('member_discount_pct', 0),
        welcome_bonus_points: numberValue('welcome_bonus_points', 0),
        tiers,
        reward_catalog: rewardCatalog,
      }}
    />
  )
}
