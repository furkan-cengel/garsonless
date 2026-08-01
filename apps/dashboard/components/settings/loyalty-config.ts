export interface LoyaltyTier {
  name: string
  min: number
  color: string
  // Perks (Sprint 17). Applied to money/earning in 17b; config + display in 17a.
  discountPct: number
  pointsMultiplier: number
  bonusStamps: number
  priorityService: boolean
}

/** Max configurable tiers (mirrors @garsonless/db MAX_TIERS). */
export const MAX_TIERS = 6
export const TIER_PERK_DEFAULTS = { discountPct: 0, pointsMultiplier: 1, bonusStamps: 0, priorityService: false }

export interface CatalogReward {
  itemId: string
  pointCost: number
  tag?: string
}

export interface LoyaltyConfig {
  stamp_enabled: boolean
  stamp_goal: number
  stamp_reward_text: string
  reward_item_id: string | null
  points_enabled: boolean
  points_per_lira: number
  points_redeem_rate: number
  scope: 'restaurant' | 'network'
  earn_trigger: 'paid' | 'served'
  member_discount_pct: number
  welcome_bonus_points: number
  tiers: LoyaltyTier[]
  /** 15c: point-priced free-item rewards. */
  reward_catalog: CatalogReward[]
}

export const DEFAULT_TIERS: LoyaltyTier[] = [
  { name: 'Bronz', min: 0, color: '#b87333', ...TIER_PERK_DEFAULTS },
  { name: 'Gümüş', min: 500, color: '#8a9099', ...TIER_PERK_DEFAULTS },
  { name: 'Altın', min: 1000, color: '#c8922a', ...TIER_PERK_DEFAULTS },
  { name: 'Platin', min: 2500, color: '#5b7a86', ...TIER_PERK_DEFAULTS },
]
