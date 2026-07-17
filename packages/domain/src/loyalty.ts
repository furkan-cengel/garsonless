import type { PaymentMethod } from './orders'

export const NETWORK_SCOPE_KEY = '00000000-0000-0000-0000-000000000000'

export interface LoyaltyTier {
  name: string
  min: number
  color: string
  discountPct: number
  pointsMultiplier: number
  bonusStamps: number
  priorityService: boolean
}

export const MAX_TIERS = 6

export interface CatalogReward {
  itemId: string
  pointCost: number
  tag?: string
}

const TIER_PERK_DEFAULTS = {
  discountPct: 0,
  pointsMultiplier: 1,
  bonusStamps: 0,
  priorityService: false,
}

export const DEFAULT_TIERS: LoyaltyTier[] = [
  { name: 'Bronz', min: 0, color: '#b87333', ...TIER_PERK_DEFAULTS },
  { name: 'Gümüş', min: 500, color: '#8a9099', ...TIER_PERK_DEFAULTS },
  { name: 'Altın', min: 1000, color: '#c8922a', ...TIER_PERK_DEFAULTS },
  { name: 'Platin', min: 2500, color: '#5b7a86', ...TIER_PERK_DEFAULTS },
]

export interface LoyaltyConfig {
  stamp_enabled: boolean
  stamp_goal: number
  stamp_reward_text: string
  points_enabled: boolean
  points_per_lira: number
  points_redeem_rate: number
  member_discount_pct: number
  reward_item_id: string | null
  welcome_bonus_points: number
  tiers: LoyaltyTier[]
  reward_catalog: CatalogReward[]
  scope: 'restaurant' | 'network'
  earn_trigger: 'paid' | 'served'
}

export interface LoyaltyActivity {
  id: string
  type: 'stamp' | 'points' | 'visit'
  direction: 'earn' | 'redeem' | 'refund'
  delta: number
  reason: string
  createdAt: string
}

export interface MemberBalances {
  memberCode: string
  joinedAt: string
  stamps: number
  points: number
  lifetimePoints: number
  visits: number
  tier: LoyaltyTier
  tierIndex: number
  nextTier: LoyaltyTier | null
  tierProgress: number
  stampGoal: number
  stampRewardText: string
  stampUnlocked: boolean
  stampEnabled: boolean
  pointsEnabled: boolean
  consentGiven: boolean
  marketingConsentGiven: boolean
  recentActivity: LoyaltyActivity[]
}

export type RawLoyaltySettings = Record<string, unknown> | null

export function sanitizeTiers(arr: unknown[]): LoyaltyTier[] {
  if (!Array.isArray(arr) || arr.length === 0) return DEFAULT_TIERS
  const numberOr = (value: unknown, fallback: number) =>
    typeof value === 'number' && Number.isFinite(value) ? value : fallback
  const parsed = arr.slice(0, MAX_TIERS).map((entry, index): LoyaltyTier => {
    const value = (entry ?? {}) as Record<string, unknown>
    const fallback = DEFAULT_TIERS[index] ?? DEFAULT_TIERS[DEFAULT_TIERS.length - 1]!
    const name = typeof value['name'] === 'string' && value['name'].trim()
      ? value['name'].trim()
      : `Seviye ${index + 1}`
    return {
      name,
      min: typeof value['min'] === 'number' && value['min'] >= 0
        ? Math.floor(value['min'])
        : fallback.min,
      color: typeof value['color'] === 'string' ? value['color'] : fallback.color,
      discountPct: Math.max(0, Math.min(100, Math.floor(numberOr(value['discountPct'], 0)))),
      pointsMultiplier: Math.max(0.1, Math.min(10, numberOr(value['pointsMultiplier'], 1))),
      bonusStamps: Math.max(0, Math.min(20, Math.floor(numberOr(value['bonusStamps'], 0)))),
      priorityService: value['priorityService'] === true,
    }
  }).sort((a, b) => a.min - b.min)
  if (parsed[0]) parsed[0].min = 0

  const seen = new Set<string>()
  for (let index = 0; index < parsed.length; index += 1) {
    const key = parsed[index]!.name.toLowerCase()
    if (seen.has(key)) parsed[index]!.name = `${parsed[index]!.name} ${index + 1}`
    seen.add(parsed[index]!.name.toLowerCase())
  }
  return parsed
}

function readTiers(raw: Record<string, unknown>): LoyaltyTier[] {
  const tiers = Array.isArray(raw['tiers']) ? raw['tiers'] : null
  return tiers && tiers.length > 0 ? sanitizeTiers(tiers) : DEFAULT_TIERS
}

function readCatalog(raw: Record<string, unknown>): CatalogReward[] {
  const catalog = Array.isArray(raw['reward_catalog']) ? raw['reward_catalog'] : null
  if (!catalog) return []
  return catalog.flatMap((entry): CatalogReward[] => {
    const value = (entry ?? {}) as Record<string, unknown>
    const itemId = typeof value['itemId'] === 'string' ? value['itemId'] : null
    const pointCost = typeof value['pointCost'] === 'number' ? Math.floor(value['pointCost']) : null
    if (!itemId || pointCost === null || pointCost <= 0) return []
    return [{
      itemId,
      pointCost,
      ...(typeof value['tag'] === 'string' && value['tag'] ? { tag: value['tag'] } : {}),
    }]
  })
}

export function readLoyaltyConfig(settings: RawLoyaltySettings): LoyaltyConfig | null {
  const raw = (settings?.['loyalty'] ?? null) as Record<string, unknown> | null
  if (!raw) return null
  const bool = (key: string) => raw[key] === true
  const numberOr = (key: string, fallback: number) =>
    typeof raw[key] === 'number' ? raw[key] as number : fallback
  const stringOr = (key: string, fallback: string) =>
    typeof raw[key] === 'string' ? raw[key] as string : fallback
  return {
    stamp_enabled: bool('stamp_enabled'),
    stamp_goal: numberOr('stamp_goal', 10),
    stamp_reward_text: stringOr('stamp_reward_text', ''),
    points_enabled: bool('points_enabled'),
    points_per_lira: numberOr('points_per_lira', 1),
    points_redeem_rate: Math.max(1, numberOr('points_redeem_rate', 100)),
    member_discount_pct: Math.max(0, Math.min(100, numberOr('member_discount_pct', 0))),
    reward_item_id: typeof raw['reward_item_id'] === 'string' ? raw['reward_item_id'] : null,
    welcome_bonus_points: Math.max(0, Math.floor(numberOr('welcome_bonus_points', 0))),
    tiers: readTiers(raw),
    reward_catalog: readCatalog(raw),
    scope: stringOr('scope', 'restaurant') === 'network' ? 'network' : 'restaurant',
    earn_trigger: stringOr('earn_trigger', 'paid') === 'served' ? 'served' : 'paid',
  }
}

export function loyaltyScopeKey(config: LoyaltyConfig, restaurantId: string): string {
  return config.scope === 'network' ? NETWORK_SCOPE_KEY : restaurantId
}

export function computeTier(lifetimePoints: number, tiers: LoyaltyTier[]) {
  const list = tiers.length > 0 ? tiers : DEFAULT_TIERS
  const points = Math.max(0, lifetimePoints)
  let tierIndex = 0
  for (let index = 0; index < list.length; index += 1) {
    if (points >= list[index]!.min) tierIndex = index
  }
  const tier = list[tierIndex]!
  const nextTier = tierIndex < list.length - 1 ? list[tierIndex + 1]! : null
  const tierProgress = nextTier
    ? Math.max(0, Math.min(100, Math.floor(((points - tier.min) / Math.max(1, nextTier.min - tier.min)) * 100)))
    : 100
  return { tier, tierIndex, nextTier, tierProgress }
}

type OrderItemLine = { itemId?: unknown; quantity?: unknown }

export function computeStampDelta(items: unknown, flaggedItemIds: Set<string>): number {
  const lines = (Array.isArray(items) ? items : []) as OrderItemLine[]
  return lines.reduce((total, line) => {
    const itemId = typeof line.itemId === 'string' ? line.itemId : null
    const quantity = typeof line.quantity === 'number' ? line.quantity : 0
    return itemId && quantity > 0 && flaggedItemIds.has(itemId) ? total + quantity : total
  }, 0)
}

export function computePointsDelta(total: number, pointsPerLira: number, multiplier = 1): number {
  const value = Math.floor(Number(total) * Number(pointsPerLira) * Number(multiplier))
  return Number.isFinite(value) && value > 0 ? value : 0
}

export function shouldEarnOnSettlement(method: PaymentMethod, freshlySettled: boolean): boolean {
  return freshlySettled && method !== 'comp'
}

export function effectivePct(tierDiscountPct: number, memberDiscountPct: number): number {
  const tier = Number(tierDiscountPct) || 0
  return tier > 0 ? tier : Number(memberDiscountPct) || 0
}

export function applyBonusStamps(stampDelta: number, bonusStamps: number): number {
  return stampDelta >= 1 && bonusStamps > 0 ? stampDelta + bonusStamps : stampDelta
}

export function computeStampEarn(
  items: unknown,
  flaggedItemIds: Set<string>,
  rewardItemId: string | null,
  freeClaimed: boolean,
): number {
  const earned = computeStampDelta(items, flaggedItemIds)
  return freeClaimed && rewardItemId && flaggedItemIds.has(rewardItemId)
    ? Math.max(0, earned - 1)
    : earned
}

export function computePointsRedemption(
  requestedPoints: number,
  pointsBalance: number,
  remaining: number,
  rate: number,
): { pointsDiscountAmount: number; pointsConsumed: number } {
  if (!(rate >= 1) || requestedPoints <= 0 || pointsBalance <= 0 || remaining <= 0) {
    return { pointsDiscountAmount: 0, pointsConsumed: 0 }
  }
  const request = Math.min(Math.floor(requestedPoints), Math.floor(pointsBalance))
  const discount = Math.min(Math.floor(request / rate), Math.floor(remaining))
  return { pointsDiscountAmount: discount, pointsConsumed: discount * rate }
}

export function computeDiscountStack(input: {
  subtotal: number
  stampDiscountAmount: number
  catalogDiscountAmount?: number
  memberPct: number
  requestedPoints: number
  pointsBalance: number
  pointsRate: number
}) {
  const stampDiscountAmount = Math.max(0, input.stampDiscountAmount)
  const catalogDiscountAmount = Math.max(0, input.catalogDiscountAmount ?? 0)
  const afterFree = Math.max(0, input.subtotal - stampDiscountAmount - catalogDiscountAmount)
  const memberDiscountAmount = input.memberPct > 0
    ? Math.min(afterFree, Math.floor((afterFree * input.memberPct) / 100))
    : 0
  const points = computePointsRedemption(
    input.requestedPoints,
    input.pointsBalance,
    Math.max(0, afterFree - memberDiscountAmount),
    input.pointsRate,
  )
  return {
    stampDiscountAmount,
    catalogDiscountAmount,
    memberDiscountAmount,
    pointsDiscountAmount: points.pointsDiscountAmount,
    pointsRedeemed: points.pointsConsumed,
    finalTotal: Math.max(
      0,
      input.subtotal - stampDiscountAmount - catalogDiscountAmount - memberDiscountAmount - points.pointsDiscountAmount,
    ),
  }
}
