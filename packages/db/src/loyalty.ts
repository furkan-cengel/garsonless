// Loyalty: phone OTP request/verify (Phase 1) + earning ledger & balances
// (Phase 2). All service-role only. Earning is computed from the order's OWN
// DB data (never client input), so points/stamps can't be inflated.

import { createHash, randomInt } from 'node:crypto'
import { createServiceClient } from './client'
import { normalizePhone } from './phone'
import { getSmsProvider } from './sms'
import type { PaymentMethod } from './enums'
import {
  snapshotOrderCustomerTier,
  type OrderCustomerTierSnapshot,
} from './order-client'

export {
  snapshotOrderCustomerTier,
  readOrderCustomerTierSnapshot,
  orderHasPriorityService,
  compareOrdersByPriorityThenCreatedAt,
  sortOrdersByPriorityThenCreatedAt,
} from './order-client'
export type { OrderCustomerTierSnapshot } from './order-client'

// Network-scope balance bucket sentinel (used when a restaurant's loyalty
// scope is 'network' instead of per-restaurant).
export const NETWORK_SCOPE_KEY = '00000000-0000-0000-0000-000000000000'

// ─── Tunables (locked) ─────────────────────────────────────────────────────────
const OTP_TTL_MS = 5 * 60_000          // code lives 5 minutes
const PHONE_WINDOW_MS = 15 * 60_000    // per-phone rate window
const PHONE_MAX = 3                     // max 3 requests / 15 min per phone
const PHONE_COOLDOWN_MS = 60_000        // min 60s between sends to one phone
const IP_WINDOW_MS = 15 * 60_000        // per-IP rate window
const IP_MAX = 10                       // max 10 requests / 15 min per IP
const MAX_VERIFY_ATTEMPTS = 5           // verify attempts before a code is burned

function hashCode(code: string): string {
  return createHash('sha256').update(code).digest('hex')
}

function sinceIso(ms: number): string {
  return new Date(Date.now() - ms).toISOString()
}

export type RequestOtpResult =
  | { ok: true; phone: string; devCode: string }
  | { ok: false; reason: 'invalid_phone' }
  | { ok: false; reason: 'throttled' }
  | { ok: false; reason: 'sms_failed' }

export async function requestOtp(input: { rawPhone: string; ip: string | null }): Promise<RequestOtpResult> {
  const phone = normalizePhone(input.rawPhone)
  if (!phone) return { ok: false, reason: 'invalid_phone' }

  const supabase = createServiceClient()

  // Per-phone window cap.
  const { count: phoneCount } = await supabase
    .from('otp_codes')
    .select('id', { count: 'exact', head: true })
    .eq('phone', phone)
    .gte('created_at', sinceIso(PHONE_WINDOW_MS))
  if ((phoneCount ?? 0) >= PHONE_MAX) return { ok: false, reason: 'throttled' }

  // Per-phone cooldown between sends.
  const { count: cooldownCount } = await supabase
    .from('otp_codes')
    .select('id', { count: 'exact', head: true })
    .eq('phone', phone)
    .gte('created_at', sinceIso(PHONE_COOLDOWN_MS))
  if ((cooldownCount ?? 0) >= 1) return { ok: false, reason: 'throttled' }

  // Per-IP window cap.
  if (input.ip) {
    const { count: ipCount } = await supabase
      .from('otp_codes')
      .select('id', { count: 'exact', head: true })
      .eq('ip', input.ip)
      .gte('created_at', sinceIso(IP_WINDOW_MS))
    if ((ipCount ?? 0) >= IP_MAX) return { ok: false, reason: 'throttled' }
  }

  const code = String(randomInt(100_000, 1_000_000)) // 6 digits, no leading zero

  // Send FIRST, persist ONLY on success (P1.3). A provider failure returns typed
  // 'sms_failed' WITHOUT inserting a row → the caller's rate-limit budget (counted
  // from otp_codes rows) is never burned for an undelivered code, and no
  // unverifiable challenge is stored. The rate-limit checks above already ran, so
  // this ordering cannot be abused to spam send attempts (a legit code that WAS
  // sent still counts; a failed one costs nothing and the user may retry).
  try {
    await getSmsProvider().send(phone, `Garsonless doğrulama kodunuz: ${code}`, { purpose: 'otp' })
  } catch {
    return { ok: false, reason: 'sms_failed' }
  }

  const insert = supabase.from('otp_codes') as unknown as {
    insert: (row: Record<string, unknown>) => Promise<{ error: unknown }>
  }
  const { error } = await insert.insert({
    phone,
    code_hash: hashCode(code),
    ip: input.ip,
    expires_at: new Date(Date.now() + OTP_TTL_MS).toISOString(),
  })
  // SMS already went out but the challenge couldn't be stored (rare DB failure) →
  // the customer can't verify it, so surface a retryable error rather than a
  // silent success. Rate budget stays untouched (no row persisted).
  if (error) return { ok: false, reason: 'sms_failed' }

  return { ok: true, phone, devCode: code }
}

export type VerifyOtpResult =
  | { ok: true; customer: { id: string; phone: string; name: string | null } }
  | { ok: false; reason: 'invalid_phone' | 'invalid_or_expired' | 'too_many_attempts' }

export async function verifyOtp(input: { rawPhone: string; code: string; name?: string | null }): Promise<VerifyOtpResult> {
  const phone = normalizePhone(input.rawPhone)
  if (!phone) return { ok: false, reason: 'invalid_phone' }

  const supabase = createServiceClient()

  const { data: rows } = await supabase
    .from('otp_codes')
    .select('id, code_hash, attempts, expires_at, consumed_at')
    .eq('phone', phone)
    .is('consumed_at', null)
    .order('created_at', { ascending: false })
    .limit(1)

  const row = (rows as Array<{ id: string; code_hash: string; attempts: number; expires_at: string }> | null)?.[0]
  if (!row) return { ok: false, reason: 'invalid_or_expired' }
  if (new Date(row.expires_at).getTime() < Date.now()) return { ok: false, reason: 'invalid_or_expired' }
  if (row.attempts >= MAX_VERIFY_ATTEMPTS) return { ok: false, reason: 'too_many_attempts' }

  const mut = supabase.from('otp_codes') as unknown as {
    update: (row: Record<string, unknown>) => { eq: (c: string, v: string) => Promise<{ error: unknown }> }
  }

  if (hashCode(input.code) !== row.code_hash) {
    await mut.update({ attempts: row.attempts + 1 }).eq('id', row.id)
    return { ok: false, reason: 'invalid_or_expired' }
  }

  // Correct code → burn it, then upsert the global customer.
  await mut.update({ consumed_at: new Date().toISOString() }).eq('id', row.id)

  const name = input.name?.trim() || null
  // Only write name when provided, so a returning member who re-verifies without
  // typing a name keeps their existing one (upsert only touches columns present).
  const payload: Record<string, unknown> = { phone, verified_at: new Date().toISOString() }
  if (name) payload['name'] = name

  const upsert = supabase.from('customers') as unknown as {
    upsert: (row: Record<string, unknown>, opts: { onConflict: string }) => {
      select: (cols: string) => { single: () => Promise<{ data: { id: string; phone: string; name: string | null } | null; error: unknown }> }
    }
  }
  const { data: customer, error } = await upsert
    .upsert(payload, { onConflict: 'phone' })
    .select('id, phone, name')
    .single()

  if (error || !customer) return { ok: false, reason: 'invalid_or_expired' }
  return { ok: true, customer }
}

// ─── Phase 2: earning ledger + balances ─────────────────────────────────────────

export interface LoyaltyTier {
  name: string
  min: number // minimum LIFETIME points to reach this tier (tiers[0] forced 0)
  color: string
  // ─── perks (Sprint 17). readTiers fills concrete defaults so every resolved
  // tier carries all four; the JSONB may omit them. Applied to money/earning in
  // 17b — in 17a they are config + display only (economics unchanged). ───
  discountPct: number      // % off (member discount) — default 0
  pointsMultiplier: number // earn multiplier — default 1
  bonusStamps: number      // extra stamps when an order earns ≥1 — default 0
  priorityService: boolean // visual kitchen/Kanban priority — default false
}

/** Max configurable tiers per restaurant (Sprint 17). */
export const MAX_TIERS = 6

export interface CatalogReward {
  itemId: string
  pointCost: number
  tag?: string
}

/** Default 4 tiers (matches the reference design). Names are fixed; thresholds
 *  + colors are configurable per restaurant. Tier[0] is always min 0. */
const TIER_PERK_DEFAULTS = { discountPct: 0, pointsMultiplier: 1, bonusStamps: 0, priorityService: false }

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
  /** Points needed for ₺1 of discount (e.g. 10 → 10 puan = ₺1). */
  points_redeem_rate: number
  member_discount_pct: number
  reward_item_id: string | null
  /** Points credited once on first verify (0 = off). */
  welcome_bonus_points: number
  tiers: LoyaltyTier[]
  reward_catalog: CatalogReward[]
  scope: 'restaurant' | 'network'
  earn_trigger: 'paid' | 'served'
}

type RawSettings = Record<string, unknown> | null

/** Read + sanitize the tier list: normalize to 4 fixed-name tiers, ascending
 *  by min, with Tier[0] forced to min 0. Invalid/missing → DEFAULT_TIERS. */
/** Sanitize the tier ladder for ANY count 1..MAX_TIERS: fill concrete perk
 *  defaults, clamp values, sort by min, force tiers[0].min=0, and guarantee
 *  unique non-empty names (so N>4 never collides on the old default names).
 *  Pure + exported so the dashboard save path validates with the SAME rules. */
export function sanitizeTiers(arr: unknown[]): LoyaltyTier[] {
  if (!Array.isArray(arr) || arr.length === 0) return DEFAULT_TIERS
  const numv = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) ? (v as number) : d)
  const parsed: LoyaltyTier[] = arr.slice(0, MAX_TIERS).map((t, i): LoyaltyTier => {
    const o = (t ?? {}) as Record<string, unknown>
    const def = DEFAULT_TIERS[i] ?? DEFAULT_TIERS[DEFAULT_TIERS.length - 1]!
    const name = typeof o['name'] === 'string' && (o['name'] as string).trim() ? (o['name'] as string).trim() : `Seviye ${i + 1}`
    return {
      name,
      min: typeof o['min'] === 'number' && (o['min'] as number) >= 0 ? Math.floor(o['min'] as number) : def.min,
      color: typeof o['color'] === 'string' ? (o['color'] as string) : def.color,
      discountPct: Math.max(0, Math.min(100, Math.floor(numv(o['discountPct'], 0)))),
      pointsMultiplier: Math.max(0.1, Math.min(10, numv(o['pointsMultiplier'], 1))),
      bonusStamps: Math.max(0, Math.min(20, Math.floor(numv(o['bonusStamps'], 0)))),
      priorityService: o['priorityService'] === true,
    }
  }).sort((a, b) => a.min - b.min)
  if (parsed[0]) parsed[0].min = 0
  // Unique names: suffix any duplicate so members can't be ambiguously ranked.
  const seen = new Set<string>()
  for (let i = 0; i < parsed.length; i++) {
    const key = parsed[i]!.name.toLowerCase()
    if (seen.has(key)) parsed[i]!.name = `${parsed[i]!.name} ${i + 1}`
    seen.add(parsed[i]!.name.toLowerCase())
  }
  return parsed
}

function readTiers(raw: Record<string, unknown>): LoyaltyTier[] {
  const arr = Array.isArray(raw['tiers']) ? (raw['tiers'] as unknown[]) : null
  if (!arr || arr.length === 0) return DEFAULT_TIERS
  return sanitizeTiers(arr)
}

function readCatalog(raw: Record<string, unknown>): CatalogReward[] {
  const arr = Array.isArray(raw['reward_catalog']) ? (raw['reward_catalog'] as unknown[]) : null
  if (!arr) return []
  const out: CatalogReward[] = []
  for (const r of arr) {
    const o = (r ?? {}) as Record<string, unknown>
    const itemId = typeof o['itemId'] === 'string' ? (o['itemId'] as string) : null
    const pointCost = typeof o['pointCost'] === 'number' ? Math.floor(o['pointCost'] as number) : null
    if (itemId && pointCost !== null && pointCost > 0) {
      out.push({ itemId, pointCost, ...(typeof o['tag'] === 'string' && o['tag'] ? { tag: o['tag'] as string } : {}) })
    }
  }
  return out
}

function readLoyaltyConfig(settings: RawSettings): LoyaltyConfig | null {
  const raw = (settings?.['loyalty'] ?? null) as Record<string, unknown> | null
  if (!raw) return null
  const bool = (k: string) => raw[k] === true
  const numv = (k: string, d: number) => (typeof raw[k] === 'number' ? (raw[k] as number) : d)
  const str = (k: string, d: string) => (typeof raw[k] === 'string' ? (raw[k] as string) : d)
  return {
    stamp_enabled: bool('stamp_enabled'),
    stamp_goal: numv('stamp_goal', 10),
    stamp_reward_text: str('stamp_reward_text', ''),
    points_enabled: bool('points_enabled'),
    points_per_lira: numv('points_per_lira', 1),
    points_redeem_rate: Math.max(1, numv('points_redeem_rate', 100)),
    member_discount_pct: Math.max(0, Math.min(100, numv('member_discount_pct', 0))),
    reward_item_id: typeof raw['reward_item_id'] === 'string' ? (raw['reward_item_id'] as string) : null,
    welcome_bonus_points: Math.max(0, Math.floor(numv('welcome_bonus_points', 0))),
    tiers: readTiers(raw),
    reward_catalog: readCatalog(raw),
    scope: str('scope', 'restaurant') === 'network' ? 'network' : 'restaurant',
    earn_trigger: str('earn_trigger', 'paid') === 'served' ? 'served' : 'paid',
  }
}

/** Pure: the tier for a given LIFETIME points total + the next tier & progress.
 *  Tier = the highest tier whose `min` is ≤ lifetimePoints. */
export function computeTier(lifetimePoints: number, tiers: LoyaltyTier[]): {
  tier: LoyaltyTier
  tierIndex: number
  nextTier: LoyaltyTier | null
  tierProgress: number // 0–100 toward nextTier (100 if top tier)
} {
  const list = tiers.length > 0 ? tiers : DEFAULT_TIERS
  const lp = Math.max(0, lifetimePoints)
  let idx = 0
  for (let i = 0; i < list.length; i++) {
    if (lp >= list[i]!.min) idx = i
  }
  const tier = list[idx]!
  const nextTier = idx < list.length - 1 ? list[idx + 1]! : null
  const tierProgress = nextTier
    ? Math.max(
        0,
        Math.min(
          100,
          Math.floor(((lp - tier.min) / Math.max(1, nextTier.min - tier.min)) * 100),
        ),
      )
    : 100
  return { tier, tierIndex: idx, nextTier, tierProgress }
}

const scopeKeyFor = (cfg: LoyaltyConfig, restaurantId: string) =>
  cfg.scope === 'network' ? NETWORK_SCOPE_KEY : restaurantId

/** Service-role: resolve a restaurant's balance scope_key + tier list from its
 *  loyalty config. Used by the customers CRM (list aggregator scope + tier
 *  computation) without N per-customer getMemberBalances calls. */
export async function getLoyaltyScope(
  restaurantId: string,
): Promise<{ scopeKey: string; tiers: LoyaltyTier[]; pointsEnabled: boolean } | null> {
  const supabase = createServiceClient()
  const { data: restRow } = await supabase
    .from('restaurants')
    .select('settings')
    .eq('id', restaurantId)
    .maybeSingle()
  const cfg = readLoyaltyConfig((restRow as { settings: RawSettings } | null)?.settings ?? null)
  if (!cfg) return null
  return { scopeKey: scopeKeyFor(cfg, restaurantId), tiers: cfg.tiers, pointsEnabled: cfg.points_enabled }
}

type OrderItemLine = { itemId?: unknown; quantity?: unknown }

/** Pure: sum quantities of order lines whose itemId is in the stamp-flagged set. */
export function computeStampDelta(items: unknown, flaggedItemIds: Set<string>): number {
  const lines = (Array.isArray(items) ? items : []) as OrderItemLine[]
  let delta = 0
  for (const line of lines) {
    const id = typeof line.itemId === 'string' ? line.itemId : null
    const qty = typeof line.quantity === 'number' ? line.quantity : 0
    if (id && qty > 0 && flaggedItemIds.has(id)) delta += qty
  }
  return delta
}

/** Pure: floor(total * pointsPerLira), guarded against NaN/negatives. */
export function computePointsDelta(total: number, pointsPerLira: number, multiplier = 1): number {
  const v = Math.floor(Number(total) * Number(pointsPerLira) * Number(multiplier))
  return Number.isFinite(v) && v > 0 ? v : 0
}

/**
 * Pure: should settling an order with `method` earn loyalty?
 * COMP (İkram) must NEVER earn — a freebie can't mint points (staff would farm
 * İkram). Earning also fires only on a FRESH settlement (not a retry / re-callback).
 */
export function shouldEarnOnSettlement(method: PaymentMethod, freshlySettled: boolean): boolean {
  return freshlySettled && method !== 'comp'
}

/** 17b: effective member discount % — the tier's own perk when set, else the
 *  legacy flat member_discount_pct (read-time fallback; no double-apply). */
export function effectivePct(tierDiscountPct: number, memberDiscountPct: number): number {
  const t = Number(tierDiscountPct) || 0
  const m = Number(memberDiscountPct) || 0
  return t > 0 ? t : m
}

/** 17b: tier bonus stamps apply ONLY when the order already earns ≥1 stamp
 *  (never mint stamps from nothing). Pure + idempotent. */
export function applyBonusStamps(stampDelta: number, bonusStamps: number): number {
  return stampDelta >= 1 && bonusStamps > 0 ? stampDelta + bonusStamps : stampDelta
}

/**
 * Pure: stamps EARNED by an order. If a free reward unit was claimed on this
 * order (3c), that unit must NOT re-earn a stamp toward the next card — so we
 * subtract 1 from the reward item's earn count (only when the reward item is
 * itself stamp-earning). Edge: order exactly 1 reward unit + claim it → 1−1 = 0.
 */
export function computeStampEarn(
  items: unknown,
  flaggedItemIds: Set<string>,
  rewardItemId: string | null,
  freeClaimed: boolean,
): number {
  let delta = computeStampDelta(items, flaggedItemIds)
  if (freeClaimed && rewardItemId && flaggedItemIds.has(rewardItemId)) {
    delta = Math.max(0, delta - 1)
  }
  return delta
}

/**
 * Best-effort loyalty earning. Called AFTER the paid/served write succeeds.
 * NEVER throws — a loyalty failure must not break the order write. Idempotent
 * via unique(order_id, type): paid→served, realtime retries and kitchen
 * re-flips can all call this safely.
 */
export async function earnForOrder(orderId: string, firedTrigger: 'paid' | 'served'): Promise<void> {
  try {
    const supabase = createServiceClient()

    // Read the order's OWN data from the DB (never trust client-supplied totals).
    const { data: orderRow } = await supabase
      .from('orders')
      .select('customer_id, restaurant_id, total, items')
      .eq('id', orderId)
      .maybeSingle()
    const order = orderRow as
      | { customer_id: string | null; restaurant_id: string; total: number; items: unknown }
      | null
    if (!order || !order.customer_id) return // guest order → no earning

    const { data: restRow } = await supabase
      .from('restaurants')
      .select('settings')
      .eq('id', order.restaurant_id)
      .maybeSingle()
    const cfg = readLoyaltyConfig((restRow as { settings: RawSettings } | null)?.settings ?? null)
    if (!cfg) return
    if (!cfg.stamp_enabled && !cfg.points_enabled) return
    if (cfg.earn_trigger !== firedTrigger) return // only the configured trigger earns

    const scopeKey = scopeKeyFor(cfg, order.restaurant_id)

    // 17b: tier perks (points multiplier + bonus stamps) from the customer's
    // PRE-this-order lifetime points — sum of earn-direction points EXCLUDING
    // this order's own earn row, so it's stable across paid→served retries (you
    // earn at the tier you were at before this order).
    let tierMultiplier = 1
    let tierBonusStamps = 0
    {
      const { data: ltRows } = await supabase
        .from('loyalty_transactions')
        .select('delta, order_id')
        .eq('customer_id', order.customer_id)
        .eq('scope_key', scopeKey)
        .eq('type', 'points')
        .eq('direction', 'earn')
      let lifetimeBefore = 0
      for (const r of (ltRows as Array<{ delta: number; order_id: string | null }> | null) ?? []) {
        if (r.order_id !== orderId) lifetimeBefore += r.delta
      }
      const { tier } = computeTier(lifetimeBefore, cfg.tiers)
      tierMultiplier = tier.pointsMultiplier
      tierBonusStamps = tier.bonusStamps
    }

    // STAMP: per-item — sum quantities of order lines whose menu_item.earns_stamp.
    let stampDelta = 0
    if (cfg.stamp_enabled) {
      const lines = (Array.isArray(order.items) ? order.items : []) as OrderItemLine[]
      const ids = [...new Set(lines.map((l) => (typeof l.itemId === 'string' ? l.itemId : '')).filter(Boolean))]
      if (ids.length > 0) {
        const { data: flaggedRows } = await supabase
          .from('menu_items')
          .select('id')
          .in('id', ids)
          .eq('earns_stamp', true)
        const flagged = new Set(((flaggedRows as Array<{ id: string }> | null) ?? []).map((r) => r.id))
        // Did this order claim a free reward unit? A redeem stamp row on the
        // order means yes → that unit must not re-earn (computeStampEarn handles it).
        const { data: redeemRows } = await supabase
          .from('loyalty_transactions')
          .select('id')
          .eq('order_id', orderId)
          .eq('type', 'stamp')
          .eq('direction', 'redeem')
          .limit(1)
        const freeClaimed = (((redeemRows as unknown[] | null) ?? []).length > 0)
        stampDelta = computeStampEarn(order.items, flagged, cfg.reward_item_id, freeClaimed)
      }
    }
    // 17b: tier bonus stamps — only when the order already earns ≥1 stamp (never
    // mint stamps from nothing), on top of the net positive delta.
    stampDelta = applyBonusStamps(stampDelta, tierBonusStamps)

    // POINTS: floor(order_total * points_per_lira * tier multiplier) — DB total.
    const pointsDelta = cfg.points_enabled ? computePointsDelta(order.total, cfg.points_per_lira, tierMultiplier) : 0

    const rows: Array<Record<string, unknown>> = []
    if (stampDelta > 0) rows.push({ type: 'stamp', delta: stampDelta, reason: `earn_${firedTrigger}` })
    if (pointsDelta > 0) rows.push({ type: 'points', delta: pointsDelta, reason: `earn_${firedTrigger}` })
    if (rows.length === 0) return // nothing to credit

    const insert = supabase.from('loyalty_transactions') as unknown as {
      insert: (rows: Array<Record<string, unknown>>, opts: { onConflict: string; ignoreDuplicates: boolean }) => Promise<{ error: unknown }>
    }
    await insert.insert(
      rows.map((r) => ({
        customer_id: order.customer_id,
        restaurant_id: order.restaurant_id,
        scope_key: scopeKey,
        order_id: orderId,
        direction: 'earn', // earn side; redeem rows use direction='redeem'
        ...r,
      })),
      { onConflict: 'order_id,type,direction', ignoreDuplicates: true }, // idempotent earn
    )
  } catch (err) {
    // Best-effort: log and swallow. Never break the paid/served write.
    console.error(`[earnForOrder] order=${orderId} trigger=${firedTrigger}:`, err)
  }
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
  /** SPENDABLE points = earn − redeem (used for redemption affordability). */
  points: number
  /** LIFETIME points = earn only (drives tier; never reduced by redemption). */
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
  /** Open KVKK contact-data consent at THIS restaurant (owner can see phone). */
  consentGiven: boolean
  /** Open marketing consent at THIS restaurant (campaign SMS eligibility). */
  marketingConsentGiven: boolean
  recentActivity: LoyaltyActivity[]
}

/** Service-role balance read, scoped to one customer + one restaurant's bucket. */
export async function getMemberBalances(customerId: string, restaurantId: string): Promise<MemberBalances | null> {
  const supabase = createServiceClient()

  const { data: restRow } = await supabase
    .from('restaurants')
    .select('settings')
    .eq('id', restaurantId)
    .maybeSingle()
  const cfg = readLoyaltyConfig((restRow as { settings: RawSettings } | null)?.settings ?? null)
  if (!cfg) return null

  const scopeKey = scopeKeyFor(cfg, restaurantId)
  const [{ data: customerRow }, { data: txRows }, { data: consentRows }] = await Promise.all([
    supabase
      .from('customers')
      .select('created_at')
      .eq('id', customerId)
      .maybeSingle(),
    supabase
      .from('loyalty_transactions')
      .select('id, type, delta, direction, reason, created_at')
      .eq('customer_id', customerId)
      .eq('scope_key', scopeKey)
      .order('created_at', { ascending: false }),
    supabase
      .from('customer_consents')
      .select('consent_type, granted_at, revoked_at')
      .eq('customer_id', customerId)
      .eq('restaurant_id', restaurantId)
      .in('consent_type', ['contact_data', 'marketing']),
  ])
  const customer = customerRow as { created_at: string } | null
  if (!customer) return null
  const consentList = (consentRows as Array<{ consent_type?: string; granted_at: string | null; revoked_at: string | null }> | null) ?? []
  const consentGiven = consentList.some((row) => row.consent_type === 'contact_data' && row.granted_at && !row.revoked_at)
  const marketingConsentGiven = consentList.some((row) => row.consent_type === 'marketing' && row.granted_at && !row.revoked_at)
  const rows = (txRows as Array<{
    id: string
    type: string
    delta: number
    direction: string
    reason: string
    created_at: string
  }> | null) ?? []

  let stamps = 0
  let points = 0 // spendable (earn − redeem)
  let lifetimePoints = 0 // earn only
  let visits = 0
  for (const r of rows) {
    if (r.type === 'stamp') stamps += r.delta
    else if (r.type === 'points') {
      points += r.delta
      if (r.direction === 'earn') lifetimePoints += r.delta
    } else if (r.type === 'visit') visits += r.delta
  }

  const { tier, tierIndex, nextTier, tierProgress } = computeTier(lifetimePoints, cfg.tiers)

  return {
    memberCode: `GRS-${customerId.replaceAll('-', '').slice(0, 8).toUpperCase().replace(/(.{4})(.{4})/, '$1-$2')}`,
    joinedAt: customer.created_at,
    stamps,
    points,
    lifetimePoints,
    visits,
    tier,
    tierIndex,
    nextTier,
    tierProgress,
    stampGoal: cfg.stamp_goal,
    stampRewardText: cfg.stamp_reward_text,
    stampUnlocked: cfg.stamp_enabled && cfg.stamp_goal > 0 && stamps >= cfg.stamp_goal,
    stampEnabled: cfg.stamp_enabled,
    pointsEnabled: cfg.points_enabled,
    consentGiven,
    marketingConsentGiven,
    recentActivity: rows.slice(0, 8).flatMap((row): LoyaltyActivity[] => {
      if (row.type !== 'stamp' && row.type !== 'points' && row.type !== 'visit') return []
      if (row.direction !== 'earn' && row.direction !== 'redeem' && row.direction !== 'refund') return []
      return [{
        id: row.id,
        type: row.type,
        direction: row.direction,
        delta: row.delta,
        reason: row.reason,
        createdAt: row.created_at,
      }]
    }),
  }
}

/**
 * Credit +1 visit to each DISTINCT member who had a non-cancelled order in a
 * closed table session. Idempotent via unique(session_id, customer_id, type):
 * a session closed once credits each member exactly once, no matter how many
 * times the close path re-fires. Best-effort — NEVER throws (must not block
 * closeTableSession).
 */
export async function creditVisitsForSession(sessionId: string): Promise<void> {
  try {
    const supabase = createServiceClient()

    const { data: sessRow } = await supabase
      .from('table_sessions')
      .select('restaurant_id')
      .eq('id', sessionId)
      .maybeSingle()
    const session = sessRow as { restaurant_id: string } | null
    if (!session) return

    const { data: restRow } = await supabase
      .from('restaurants')
      .select('settings')
      .eq('id', session.restaurant_id)
      .maybeSingle()
    const cfg = readLoyaltyConfig((restRow as { settings: RawSettings } | null)?.settings ?? null)
    if (!cfg) return
    const scopeKey = scopeKeyFor(cfg, session.restaurant_id)

    const { data: orderRows } = await supabase
      .from('orders')
      .select('customer_id, status')
      .eq('table_session_id', sessionId)
      .is('deleted_at', null)
    const members = [
      ...new Set(
        ((orderRows as Array<{ customer_id: string | null; status: string }> | null) ?? [])
          .filter((o) => o.customer_id && o.status !== 'cancelled')
          .map((o) => o.customer_id as string),
      ),
    ]
    if (members.length === 0) return // guest-only / empty session → no visit

    const insert = supabase.from('loyalty_transactions') as unknown as {
      insert: (rows: Array<Record<string, unknown>>, opts: { onConflict: string; ignoreDuplicates: boolean }) => Promise<{ error: unknown }>
    }
    await insert.insert(
      members.map((customerId) => ({
        customer_id: customerId,
        restaurant_id: session.restaurant_id,
        scope_key: scopeKey,
        session_id: sessionId,
        type: 'visit',
        delta: 1,
        reason: 'visit',
        direction: 'earn',
      })),
      { onConflict: 'session_id,customer_id,type', ignoreDuplicates: true }, // idempotent per (session, member)
    )
  } catch (err) {
    console.error(`[creditVisitsForSession] session=${sessionId}:`, err)
  }
}

/**
 * Credit the one-time welcome bonus (config welcome_bonus_points) on first
 * verify, scoped to the restaurant's bucket. IDEMPOTENCY = app-layer guard:
 * skip if a (customer_id, scope_key, reason='welcome') points row already
 * exists. The realistic flow can't double-credit because OTP codes are
 * single-use, so a second verify is a separate call that finds the existing
 * welcome row. Best-effort — never throws.
 */
export async function creditWelcomeBonus(customerId: string, restaurantId: string): Promise<void> {
  try {
    const supabase = createServiceClient()
    const { data: restRow } = await supabase
      .from('restaurants')
      .select('settings')
      .eq('id', restaurantId)
      .maybeSingle()
    const cfg = readLoyaltyConfig((restRow as { settings: RawSettings } | null)?.settings ?? null)
    if (!cfg || cfg.welcome_bonus_points <= 0) return
    const scopeKey = scopeKeyFor(cfg, restaurantId)

    const { data: existing } = await supabase
      .from('loyalty_transactions')
      .select('id')
      .eq('customer_id', customerId)
      .eq('scope_key', scopeKey)
      .eq('reason', 'welcome')
      .limit(1)
    if (((existing as unknown[] | null) ?? []).length > 0) return // already credited

    const insert = supabase.from('loyalty_transactions') as unknown as {
      insert: (row: Record<string, unknown>) => Promise<{ error: unknown }>
    }
    await insert.insert({
      customer_id: customerId,
      restaurant_id: restaurantId,
      scope_key: scopeKey,
      type: 'points',
      delta: cfg.welcome_bonus_points,
      reason: 'welcome',
      direction: 'earn',
    })
  } catch (err) {
    console.error(`[creditWelcomeBonus] customer=${customerId} restaurant=${restaurantId}:`, err)
  }
}

// ─── Phase 3a: redemption / discount engine ─────────────────────────────────────

/**
 * Pure: ₺ value of redeeming `requestedPoints`, capped by (a) the member's
 * balance, (b) the remaining bill, and converted via `rate` = points needed for
 * ₺1 (e.g. 10 → 10 puan = ₺1). Returns a WHOLE-₺ discount and the EXACT points
 * consumed (a multiple of rate, never exceeding the balance). CANONICAL FORMULA —
 * computeOrderDiscount and the cart preview both go through here.
 */
export function computePointsRedemption(
  requestedPoints: number,
  pointsBalance: number,
  remaining: number,
  rate: number,
): { pointsDiscountAmount: number; pointsConsumed: number } {
  if (!(rate >= 1) || requestedPoints <= 0 || pointsBalance <= 0 || remaining <= 0) {
    return { pointsDiscountAmount: 0, pointsConsumed: 0 }
  }
  const effReq = Math.min(Math.floor(requestedPoints), Math.floor(pointsBalance))
  const valueTl = Math.min(Math.floor(effReq / rate), Math.floor(remaining))
  return { pointsDiscountAmount: valueTl, pointsConsumed: valueTl * rate }
}

export interface OrderLineInput {
  itemId: string
  quantity: number
  modifiersPriceDelta: number
}

export interface DiscountResult {
  subtotal: number
  memberDiscountAmount: number
  memberDiscountPct: number
  memberTierName: string | null // 17b: tier driving the discount, for the cart label
  pointsDiscountAmount: number
  pointsRedeemed: number // points to consume (proposed)
  stampDiscountAmount: number
  stampsConsumed: number // stamps to debit when a free item is claimed (= stamp_goal)
  rewardItemName: string | null // stamp-free reward item name, for the breakdown label
  // catalog reward (15c) — free item bought with points from the configured catalog:
  catalogDiscountAmount: number // ₺ off = the catalog item's DB price (one free unit)
  catalogPointsCost: number // EXACT points to debit (all-or-nothing); 0 = no catalog reward
  catalogItemName: string | null // catalog reward item name, for the breakdown label
  catalogItemId: string | null
  finalTotal: number
  // placement internals (not surfaced to the client):
  pointsRate: number
  scopeKey: string | null // null when no loyalty config / no member
  customerTierSnapshot: OrderCustomerTierSnapshot | null
}

/**
 * Pure: the full discount stack in the locked order — stamp-free → catalog-free
 * (15c) → member % → points (last). Both free-item slots (stamp + catalog) come
 * off at full price first; member % is floored to whole ₺ on what remains; points
 * come off last. finalTotal never goes negative. Member % is a PRICE REDUCTION
 * (no ledger row); only points/stamps debit the ledger. either/or between catalog
 * and points-as-₺ is enforced UPSTREAM (catalog active → requestedPoints passed 0).
 */
export function computeDiscountStack(input: {
  subtotal: number
  stampDiscountAmount: number
  catalogDiscountAmount?: number
  memberPct: number
  requestedPoints: number
  pointsBalance: number
  pointsRate: number
}): {
  stampDiscountAmount: number
  catalogDiscountAmount: number
  memberDiscountAmount: number
  pointsDiscountAmount: number
  pointsRedeemed: number
  finalTotal: number
} {
  const stamp = Math.max(0, input.stampDiscountAmount)
  const catalog = Math.max(0, input.catalogDiscountAmount ?? 0)
  const afterFree = Math.max(0, input.subtotal - stamp - catalog)
  const member = input.memberPct > 0
    ? Math.min(afterFree, Math.floor((afterFree * input.memberPct) / 100))
    : 0
  const remaining = Math.max(0, afterFree - member)
  const pts = computePointsRedemption(input.requestedPoints, input.pointsBalance, remaining, input.pointsRate)
  const finalTotal = Math.max(0, input.subtotal - stamp - catalog - member - pts.pointsDiscountAmount)
  return {
    stampDiscountAmount: stamp,
    catalogDiscountAmount: catalog,
    memberDiscountAmount: member,
    pointsDiscountAmount: pts.pointsDiscountAmount,
    pointsRedeemed: pts.pointsConsumed,
    finalTotal,
  }
}

/**
 * Server-authoritative discount computation. Subtotal is recomputed from DB
 * `menu_items.price` (NOT client prices); modifier deltas are client-supplied
 * (flagged residual). READ-ONLY — never writes. Used by both the cart preview
 * endpoint and order placement. 3a covers points only (member %=3b, stamp=3c).
 */
export async function computeOrderDiscount(input: {
  customerId: string | null
  restaurantId: string
  lines: OrderLineInput[]
  requestedPointsRedeem?: number
  requestedStampClaim?: boolean
  /** 15c: claim a catalog reward (free unit of this item, paid in points). */
  requestedCatalogReward?: { itemId: string } | null
}): Promise<DiscountResult> {
  const supabase = createServiceClient()

  // Authoritative subtotal from DB base prices (also captures names for labels).
  const ids = [...new Set(input.lines.map((l) => l.itemId).filter(Boolean))]
  const priceById = new Map<string, number>()
  const nameById = new Map<string, string>()
  if (ids.length > 0) {
    const { data } = await supabase.from('menu_items').select('id, price, name').in('id', ids)
    for (const r of (data as Array<{ id: string; price: number; name: string }> | null) ?? []) {
      priceById.set(r.id, Number(r.price))
      nameById.set(r.id, r.name)
    }
  }
  let subtotal = 0
  for (const l of input.lines) {
    const base = priceById.get(l.itemId) ?? 0
    subtotal += (base + (Number(l.modifiersPriceDelta) || 0)) * (Number(l.quantity) || 0)
  }
  subtotal = Math.max(0, Math.round(subtotal * 100) / 100)

  const empty: DiscountResult = {
    subtotal, memberDiscountAmount: 0, memberDiscountPct: 0, memberTierName: null, pointsDiscountAmount: 0, pointsRedeemed: 0,
    stampDiscountAmount: 0, stampsConsumed: 0, rewardItemName: null,
    catalogDiscountAmount: 0, catalogPointsCost: 0, catalogItemName: null, catalogItemId: null,
    finalTotal: subtotal, pointsRate: 1, scopeKey: null, customerTierSnapshot: null,
  }
  if (!input.customerId) return empty

  const { data: restRow } = await supabase.from('restaurants').select('settings').eq('id', input.restaurantId).maybeSingle()
  const cfg = readLoyaltyConfig((restRow as { settings: RawSettings } | null)?.settings ?? null)
  if (!cfg) return empty
  const scopeKey = scopeKeyFor(cfg, input.restaurantId)
  const balances = await getMemberBalances(input.customerId, input.restaurantId)
  if (!balances) return { ...empty, scopeKey }

  // STAMP free item (3c): eligible only if a full card is available, a reward
  // item is configured, AND that item is actually in the cart. One free unit
  // (full price) per order. Otherwise the claim is invalid → no discount.
  let stampDiscountAmount = 0
  let stampsConsumed = 0
  let rewardItemName: string | null = null
  if (
    input.requestedStampClaim &&
    cfg.stamp_enabled &&
    cfg.stamp_goal > 0 &&
    cfg.reward_item_id &&
    balances.stamps >= cfg.stamp_goal
  ) {
    const inCart = input.lines.some((l) => l.itemId === cfg.reward_item_id && (Number(l.quantity) || 0) > 0)
    const rewardPrice = priceById.get(cfg.reward_item_id) ?? 0
    if (inCart && rewardPrice > 0) {
      stampDiscountAmount = rewardPrice
      stampsConsumed = cfg.stamp_goal
      rewardItemName = nameById.get(cfg.reward_item_id) ?? null
    }
  }

  // CATALOG reward (15c): redeem points → one free unit of a catalog item.
  // pointCost is re-read SERVER-SIDE from reward_catalog (client never trusted).
  // Eligible only if: points enabled + the itemId is in the catalog + that item
  // is in the cart + spendable points cover the cost. Else clamp to no-claim.
  let catalogDiscountAmount = 0
  let catalogPointsCost = 0
  let catalogItemName: string | null = null
  let catalogItemId: string | null = null
  const reqCatalogId = input.requestedCatalogReward?.itemId ?? null
  if (reqCatalogId && cfg.points_enabled) {
    const entry = cfg.reward_catalog.find((r) => r.itemId === reqCatalogId)
    const inCart = input.lines.some((l) => l.itemId === reqCatalogId && (Number(l.quantity) || 0) > 0)
    const itemPrice = priceById.get(reqCatalogId) ?? 0
    if (entry && inCart && itemPrice > 0 && balances.points >= entry.pointCost) {
      catalogDiscountAmount = itemPrice
      catalogPointsCost = entry.pointCost
      catalogItemName = nameById.get(reqCatalogId) ?? null
      catalogItemId = reqCatalogId
    }
  }

  // EITHER/OR: a catalog reward and free-form points-as-₺ never both apply on one
  // order. When a catalog reward is claimed, points-as-₺ is forced to 0 (the
  // catalog reward IS the points spend this order).
  const requestedPoints = catalogPointsCost > 0
    ? 0
    : (cfg.points_enabled ? (input.requestedPointsRedeem ?? 0) : 0)

  // 17b: tier perk discount supersedes the flat member_discount_pct (fallback).
  const memberPct = effectivePct(balances.tier.discountPct, cfg.member_discount_pct)

  // Locked order: stamp-free (3c) → catalog-free (15c) → member/tier % (3b/17b) → points (3a).
  const stack = computeDiscountStack({
    subtotal,
    stampDiscountAmount,
    catalogDiscountAmount,
    memberPct, // tier perk discountPct, else legacy member_discount_pct
    requestedPoints,
    pointsBalance: balances.points,
    pointsRate: cfg.points_redeem_rate,
  })

  return {
    subtotal,
    memberDiscountAmount: stack.memberDiscountAmount,
    memberDiscountPct: memberPct,
    memberTierName: stack.memberDiscountAmount > 0 ? balances.tier.name : null,
    pointsDiscountAmount: stack.pointsDiscountAmount,
    pointsRedeemed: stack.pointsRedeemed,
    stampDiscountAmount: stack.stampDiscountAmount,
    stampsConsumed,
    rewardItemName,
    catalogDiscountAmount: stack.catalogDiscountAmount,
    catalogPointsCost,
    catalogItemName,
    catalogItemId,
    finalTotal: stack.finalTotal,
    pointsRate: cfg.points_redeem_rate,
    scopeKey,
    customerTierSnapshot: snapshotOrderCustomerTier({
      tier: balances.tier,
      tierIndex: balances.tierIndex,
      lifetimePoints: balances.lifetimePoints,
    }),
  }
}

/**
 * Atomic, double-spend-safe redemption debit (calls the redeem_loyalty RPC,
 * which serializes per customer+scope via an advisory lock). Returns the ACTUAL
 * amounts debited — may be less than requested if a concurrent order spent the
 * balance first. Service-role only.
 */
export async function redeemForOrder(params: {
  customerId: string
  scopeKey: string
  restaurantId: string
  orderId: string
  points: number
  stamps: number
  pointsRate: number
  /** 15c: true → all-or-nothing points debit (catalog reward); false → points-as-₺. */
  pointsExact?: boolean
}): Promise<{ pointsDebited: number; stampsDebited: number }> {
  const supabase = createServiceClient()
  const { data } = await supabase.rpc('redeem_loyalty', {
    p_customer: params.customerId,
    p_scope_key: params.scopeKey,
    p_restaurant: params.restaurantId,
    p_order: params.orderId,
    p_points: params.points,
    p_stamps: params.stamps,
    p_points_rate: params.pointsRate,
    p_points_exact: params.pointsExact ?? false,
  })
  const row = (data as Array<{ points_debited: number; stamps_debited: number }> | null)?.[0]
  return { pointsDebited: row?.points_debited ?? 0, stampsDebited: row?.stamps_debited ?? 0 }
}

export interface LoyaltyRefundResult {
  refundedPoints: number
  refundedStamps: number
  rows: Array<{ type: 'points' | 'stamp'; refunded: number }>
}

/**
 * Reverse loyalty redemption rows when an order is cancelled. The DB RPC writes
 * positive `direction='refund'` ledger rows and uses the existing
 * (order_id,type,direction) key, so repeated cancel/paid/served/status retries
 * cannot double-refund. Refund rows restore spendable balance but do NOT count
 * toward lifetime points because lifetime only sums direction='earn'.
 */
export async function refundCancelledLoyaltyOrder(orderId: string): Promise<LoyaltyRefundResult> {
  try {
    const supabase = createServiceClient()
    const { data, error } = await supabase.rpc('refund_cancelled_loyalty', { p_order: orderId })
    if (error) {
      console.error(`[refundCancelledLoyaltyOrder] order=${orderId}:`, error.message)
      return { refundedPoints: 0, refundedStamps: 0, rows: [] }
    }
    const rows: LoyaltyRefundResult['rows'] = ((data as Array<{ type: string; refunded: number }> | null) ?? []).flatMap((row) => {
      if ((row.type !== 'points' && row.type !== 'stamp') || row.refunded <= 0) return []
      return [{ type: row.type, refunded: row.refunded }]
    })
    return {
      refundedPoints: rows.filter((row) => row.type === 'points').reduce((sum, row) => sum + row.refunded, 0),
      refundedStamps: rows.filter((row) => row.type === 'stamp').reduce((sum, row) => sum + row.refunded, 0),
      rows,
    }
  } catch (err) {
    console.error(`[refundCancelledLoyaltyOrder] order=${orderId}:`, err)
    return { refundedPoints: 0, refundedStamps: 0, rows: [] }
  }
}
