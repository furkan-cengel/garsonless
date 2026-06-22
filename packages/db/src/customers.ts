// Sprint 16a — Customers CRM data layer. ALL functions are service-role and
// trust a restaurantId that the CALLER (a dashboard server action) has already
// validated the authed owner owns. customers + customer_consents are
// service-role-only at the RLS layer, so this is the only read path. Phone PII
// is masked here whenever the customer has NOT given open consent at this venue;
// the raw phone never leaves this module without consent.

import { createServiceClient } from './client'
import type { Json } from './types.gen'
import { computeTier, getLoyaltyScope, getMemberBalances, type LoyaltyTier, type MemberBalances } from './loyalty'

// ── phone masking (TR): +905321234567 → "0532 *** ** 67" ─────────────────────
export function maskPhone(e164: string | null): string {
  if (!e164) return '—'
  const digits = e164.replace(/\D/g, '')
  const national = digits.startsWith('90') ? '0' + digits.slice(2) : digits.startsWith('0') ? digits : '0' + digits
  if (national.length < 7) return '*** ** **'
  return `${national.slice(0, 4)} *** ** ${national.slice(-2)}`
}

export interface RestaurantCustomer {
  customerId: string
  name: string | null
  /** Masked unless open consent at this venue. */
  phone: string
  phoneMasked: boolean
  hasConsent: boolean
  spend: number // paid-only ₺ at this venue
  visits: number
  points: number // spendable (scope_key)
  lifetimePoints: number
  tier: LoyaltyTier
  tierIndex: number
  lastSeen: string | null
  firstSeen: string | null
}

export interface RestaurantCustomersPage {
  customers: RestaurantCustomer[]
  total: number
  page: number
  pageSize: number
}

export type CustomerSort = 'last_seen' | 'spend' | 'visits' | 'points' | 'joined'
export type CustomerSegment = 'new' | 'frequent' | 'lapsed' | 'consented'
export type CustomerSegmentOperator = '>=' | '<='
export type CustomerSegmentConsent = 'granted' | 'missing'

export interface CustomerSegmentRule {
  op: CustomerSegmentOperator
  value: number
}

export interface CustomerSegmentDefinition {
  consent?: CustomerSegmentConsent
  last_seen_days?: CustomerSegmentRule
  visits?: CustomerSegmentRule
  spend?: CustomerSegmentRule
  points?: CustomerSegmentRule
  lifetime_points?: CustomerSegmentRule
}

export interface SavedCustomerSegment {
  id: string
  restaurantId: string
  name: string
  definition: CustomerSegmentDefinition
  createdAt: string
  updatedAt: string
}

interface ListOpts {
  search?: string
  segment?: CustomerSegment | null
  customSegment?: CustomerSegmentDefinition | null
  sort?: CustomerSort
  page?: number
  pageSize?: number
}

type RawRow = {
  customer_id: string
  name: string | null
  phone: string | null
  has_consent: boolean
  spend: number | string
  visits: number
  points: number
  lifetime_points: number
  last_seen: string | null
  first_seen: string | null
  total_count: number | string
}

type SegmentRuleKey = 'last_seen_days' | 'visits' | 'spend' | 'points' | 'lifetime_points'
const SEGMENT_RULE_KEYS: SegmentRuleKey[] = ['last_seen_days', 'visits', 'spend', 'points', 'lifetime_points']

function readRecord(value: unknown): Record<string, unknown> | null {
  return value != null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

function sanitizeRule(value: unknown): CustomerSegmentRule | undefined {
  const raw = readRecord(value)
  if (!raw) return undefined
  const op = raw['op']
  const num = Number(raw['value'])
  if (op !== '>=' && op !== '<=') return undefined
  if (!Number.isFinite(num) || num < 0) return undefined
  return { op, value: Math.floor(num * 100) / 100 }
}

export function sanitizeCustomerSegmentDefinition(input: unknown): CustomerSegmentDefinition {
  const raw = readRecord(input)
  if (!raw) return {}
  const out: CustomerSegmentDefinition = {}
  if (raw['consent'] === 'granted' || raw['consent'] === 'missing') out.consent = raw['consent']
  for (const key of SEGMENT_RULE_KEYS) {
    const rule = sanitizeRule(raw[key])
    if (rule) out[key] = rule
  }
  return out
}

export function isEmptyCustomerSegmentDefinition(definition: CustomerSegmentDefinition): boolean {
  return !definition.consent && SEGMENT_RULE_KEYS.every((key) => !definition[key])
}

function segmentDefinitionToJson(definition: CustomerSegmentDefinition): Json {
  return definition as unknown as Json
}

function mapSavedSegment(row: {
  id: string
  restaurant_id: string
  name: string
  definition: unknown
  created_at: string
  updated_at: string
}): SavedCustomerSegment {
  return {
    id: row.id,
    restaurantId: row.restaurant_id,
    name: row.name,
    definition: sanitizeCustomerSegmentDefinition(row.definition),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

/** Owner-scoped customer list (caller validates ownership). Aggregates run in
 *  the security-definer get_restaurant_customers fn, hard-filtered by venue. */
export async function getRestaurantCustomers(
  restaurantId: string,
  opts: ListOpts = {},
): Promise<RestaurantCustomersPage> {
  const page = Math.max(1, Math.floor(opts.page ?? 1))
  const pageSize = Math.min(100, Math.max(1, Math.floor(opts.pageSize ?? 25)))
  const scope = await getLoyaltyScope(restaurantId)
  const tiers = scope?.tiers ?? []
  const scopeKey = scope?.scopeKey ?? restaurantId

  const supabase = createServiceClient()
  const search = opts.search?.trim()
  const customSegment = opts.customSegment
    ? sanitizeCustomerSegmentDefinition(opts.customSegment)
    : null
  const { data, error } = await supabase.rpc('get_restaurant_customers', {
    p_restaurant_id: restaurantId,
    p_scope_key: scopeKey,
    p_sort: opts.sort ?? 'last_seen',
    p_limit: pageSize,
    p_offset: (page - 1) * pageSize,
    ...(search ? { p_search: search } : {}),
    ...(customSegment && !isEmptyCustomerSegmentDefinition(customSegment)
      ? { p_custom_segment: segmentDefinitionToJson(customSegment) }
      : {}),
    ...(!customSegment && opts.segment ? { p_segment: opts.segment } : {}),
  })
  if (error) throw new Error(`getRestaurantCustomers: ${error.message}`)

  const rows = (data as RawRow[] | null) ?? []
  const total = rows.length > 0 ? Number(rows[0]!.total_count) : 0
  const customers: RestaurantCustomer[] = rows.map((r) => {
    const lifetime = Number(r.lifetime_points)
    const { tier, tierIndex } = computeTier(lifetime, tiers)
    return {
      customerId: r.customer_id,
      name: r.name,
      phone: r.has_consent ? (r.phone ?? '—') : maskPhone(r.phone),
      phoneMasked: !r.has_consent,
      hasConsent: r.has_consent,
      spend: Number(r.spend),
      visits: Number(r.visits),
      points: Number(r.points),
      lifetimePoints: lifetime,
      tier,
      tierIndex,
      lastSeen: r.last_seen,
      firstSeen: r.first_seen,
    }
  })
  return { customers, total, page, pageSize }
}

export async function listCustomerSegments(restaurantId: string): Promise<SavedCustomerSegment[]> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('customer_segments')
    .select('id, restaurant_id, name, definition, created_at, updated_at')
    .eq('restaurant_id', restaurantId)
    .is('deleted_at', null)
    .order('created_at', { ascending: true })
  if (error) throw new Error(`listCustomerSegments: ${error.message}`)
  return ((data ?? []) as Array<{
    id: string
    restaurant_id: string
    name: string
    definition: unknown
    created_at: string
    updated_at: string
  }>).map(mapSavedSegment)
}

export async function getCustomerSegment(
  restaurantId: string,
  segmentId: string,
): Promise<SavedCustomerSegment | null> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('customer_segments')
    .select('id, restaurant_id, name, definition, created_at, updated_at')
    .eq('id', segmentId)
    .eq('restaurant_id', restaurantId)
    .is('deleted_at', null)
    .maybeSingle()
  if (error) throw new Error(`getCustomerSegment: ${error.message}`)
  return data ? mapSavedSegment(data as {
    id: string
    restaurant_id: string
    name: string
    definition: unknown
    created_at: string
    updated_at: string
  }) : null
}

export async function createCustomerSegment(params: {
  restaurantId: string
  name: string
  definition: CustomerSegmentDefinition
  createdBy: string
}): Promise<SavedCustomerSegment> {
  const name = params.name.trim().slice(0, 60)
  const definition = sanitizeCustomerSegmentDefinition(params.definition)
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('customer_segments')
    .insert({
      restaurant_id: params.restaurantId,
      name,
      definition: segmentDefinitionToJson(definition),
      created_by: params.createdBy,
    })
    .select('id, restaurant_id, name, definition, created_at, updated_at')
    .single()
  if (error) throw new Error(`createCustomerSegment: ${error.message}`)
  return mapSavedSegment(data as {
    id: string
    restaurant_id: string
    name: string
    definition: unknown
    created_at: string
    updated_at: string
  })
}

export async function updateCustomerSegment(params: {
  restaurantId: string
  segmentId: string
  name: string
  definition: CustomerSegmentDefinition
}): Promise<SavedCustomerSegment | null> {
  const name = params.name.trim().slice(0, 60)
  const definition = sanitizeCustomerSegmentDefinition(params.definition)
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('customer_segments')
    .update({ name, definition: segmentDefinitionToJson(definition) })
    .eq('id', params.segmentId)
    .eq('restaurant_id', params.restaurantId)
    .is('deleted_at', null)
    .select('id, restaurant_id, name, definition, created_at, updated_at')
    .maybeSingle()
  if (error) throw new Error(`updateCustomerSegment: ${error.message}`)
  return data ? mapSavedSegment(data as {
    id: string
    restaurant_id: string
    name: string
    definition: unknown
    created_at: string
    updated_at: string
  }) : null
}

export async function deleteCustomerSegment(restaurantId: string, segmentId: string): Promise<boolean> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('customer_segments')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', segmentId)
    .eq('restaurant_id', restaurantId)
    .is('deleted_at', null)
    .select('id')
    .maybeSingle()
  if (error) throw new Error(`deleteCustomerSegment: ${error.message}`)
  return Boolean(data)
}

export interface CustomerTimelineEvent {
  id: string
  at: string
  kind: 'order' | 'ledger'
  // order
  amount?: number
  status?: string
  paid?: boolean
  // ledger
  type?: 'stamp' | 'points' | 'visit'
  direction?: 'earn' | 'redeem' | 'refund'
  delta?: number
  reason?: string
}

export interface RestaurantCustomerDetail {
  customerId: string
  name: string | null
  phone: string
  phoneMasked: boolean
  hasConsent: boolean
  joinedAt: string // global platform join
  firstSeenAt: string | null
  lastSeenAt: string | null
  spend: number
  visits: number
  balances: MemberBalances | null
  timeline: CustomerTimelineEvent[]
}

/** Has this customer any activity at this venue? Gate for detail + grant so an
 *  owner can't probe arbitrary customer UUIDs or touch another venue's members. */
async function hasActivityAtVenue(
  supabase: ReturnType<typeof createServiceClient>,
  restaurantId: string,
  customerId: string,
): Promise<boolean> {
  const [{ count: oc }, { count: lc }] = await Promise.all([
    supabase.from('orders').select('id', { count: 'exact', head: true })
      .eq('restaurant_id', restaurantId).eq('customer_id', customerId).is('deleted_at', null),
    supabase.from('loyalty_transactions').select('id', { count: 'exact', head: true })
      .eq('restaurant_id', restaurantId).eq('customer_id', customerId),
  ])
  return (oc ?? 0) > 0 || (lc ?? 0) > 0
}

export async function getRestaurantCustomerDetail(
  restaurantId: string,
  customerId: string,
): Promise<RestaurantCustomerDetail | null> {
  const supabase = createServiceClient()
  if (!(await hasActivityAtVenue(supabase, restaurantId, customerId))) return null

  const [{ data: cust }, consentOpen, balances, { data: orderRows }, { data: ledgerRows }] = await Promise.all([
    supabase.from('customers').select('name, phone, created_at').eq('id', customerId).maybeSingle(),
    getConsentStatus(customerId, restaurantId),
    getMemberBalances(customerId, restaurantId),
    supabase.from('orders').select('id, total, status, paid_at, created_at')
      .eq('restaurant_id', restaurantId).eq('customer_id', customerId).is('deleted_at', null)
      .order('created_at', { ascending: false }).limit(50),
    supabase.from('loyalty_transactions').select('id, type, delta, direction, reason, created_at')
      .eq('restaurant_id', restaurantId).eq('customer_id', customerId)
      .order('created_at', { ascending: false }).limit(50),
  ])
  const customer = cust as { name: string | null; phone: string | null; created_at: string } | null
  if (!customer) return null

  const orders = (orderRows as Array<{ id: string; total: number; status: string; paid_at: string | null; created_at: string }> | null) ?? []
  const ledger = (ledgerRows as Array<{ id: string; type: string; delta: number; direction: string; reason: string; created_at: string }> | null) ?? []

  const spend = orders
    .filter((o) => o.paid_at !== null && o.status !== 'cancelled')
    .reduce((s, o) => s + Number(o.total), 0)
  const visits = ledger.filter((l) => l.type === 'visit').reduce((s, l) => s + l.delta, 0)

  const timeline: CustomerTimelineEvent[] = [
    ...orders.map((o): CustomerTimelineEvent => ({
      id: `o-${o.id}`, at: o.created_at, kind: 'order',
      amount: Number(o.total), status: o.status, paid: o.paid_at !== null,
    })),
    ...ledger.flatMap((l): CustomerTimelineEvent[] => {
      if (l.type !== 'stamp' && l.type !== 'points' && l.type !== 'visit') return []
      if (l.direction !== 'earn' && l.direction !== 'redeem' && l.direction !== 'refund') return []
      return [{ id: `l-${l.id}`, at: l.created_at, kind: 'ledger', type: l.type, direction: l.direction, delta: l.delta, reason: l.reason }]
    }),
  ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())

  const allAt = [...orders.map((o) => o.created_at), ...ledger.map((l) => l.created_at)]
  const lastSeenAt = allAt.length ? allAt.reduce((m, t) => (t > m ? t : m)) : null
  const firstSeenAt = allAt.length ? allAt.reduce((m, t) => (t < m ? t : m)) : null

  return {
    customerId,
    name: customer.name,
    phone: consentOpen ? (customer.phone ?? '—') : maskPhone(customer.phone),
    phoneMasked: !consentOpen,
    hasConsent: consentOpen,
    joinedAt: customer.created_at,
    firstSeenAt,
    lastSeenAt,
    spend,
    visits,
    balances,
    timeline,
  }
}

/** Grant store credit as POINTS (manual ledger credit). Owner-validated by the
 *  caller; activity-at-venue gated here. Reflects in balance immediately. */
export async function grantStoreCredit(params: {
  restaurantId: string
  customerId: string
  points: number
  grantedBy: string // auth.users id (owner) — audit
  note?: string
}): Promise<{ ok: true; granted: number } | { ok: false; error: string }> {
  const points = Math.floor(params.points)
  if (!Number.isFinite(points) || points <= 0) return { ok: false, error: 'Geçersiz puan miktarı' }
  if (points > 1_000_000) return { ok: false, error: 'Puan miktarı çok yüksek' }

  const supabase = createServiceClient()
  if (!(await hasActivityAtVenue(supabase, params.restaurantId, params.customerId))) {
    return { ok: false, error: 'Bu müşteri bu işletmede bulunamadı' }
  }
  const scope = await getLoyaltyScope(params.restaurantId)
  if (!scope) return { ok: false, error: 'Sadakat yapılandırması bulunamadı' }

  const insert = supabase.from('loyalty_transactions') as unknown as {
    insert: (row: Record<string, unknown>) => Promise<{ error: { message: string } | null }>
  }
  const reason = params.note?.trim() ? `store_credit:${params.note.trim().slice(0, 80)}` : 'store_credit'
  const { error } = await insert.insert({
    customer_id: params.customerId,
    restaurant_id: params.restaurantId,
    scope_key: scope.scopeKey,
    type: 'points',
    delta: points,
    direction: 'earn',
    reason,
    granted_by: params.grantedBy,
  })
  if (error) return { ok: false, error: error.message }
  return { ok: true, granted: points }
}

// ── consent (per-restaurant) ─────────────────────────────────────────────────
export type CustomerConsentType = 'contact_data' | 'marketing'

export async function getConsentStatus(
  customerId: string,
  restaurantId: string,
  consentType: CustomerConsentType = 'contact_data',
): Promise<boolean> {
  const supabase = createServiceClient()
  const { data } = await supabase
    .from('customer_consents')
    .select('granted_at, revoked_at')
    .eq('customer_id', customerId)
    .eq('restaurant_id', restaurantId)
    .eq('consent_type', consentType)
    .maybeSingle()
  const row = data as { granted_at: string | null; revoked_at: string | null } | null
  return Boolean(row && row.granted_at && !row.revoked_at)
}

/** Record (grant or revoke) a customer's per-restaurant consent.
 *  Upsert keyed by (customer, restaurant, type). Best-effort caller context:
 *  returns ok/false, never throws into the join/verify path. */
export async function recordConsent(
  customerId: string,
  restaurantId: string,
  grant: boolean,
  source: 'join' | 'member_sheet',
  consentType: CustomerConsentType = 'contact_data',
): Promise<{ ok: boolean }> {
  try {
    const supabase = createServiceClient()
    const now = new Date().toISOString()
    const builder = supabase.from('customer_consents') as unknown as {
      upsert: (row: Record<string, unknown>, opts: { onConflict: string }) => Promise<{ error: { message: string } | null }>
    }
    const { error } = await builder.upsert(
      {
        customer_id: customerId,
        restaurant_id: restaurantId,
        consent_type: consentType,
        granted_at: grant ? now : null,
        revoked_at: grant ? null : now,
        source,
        updated_at: now,
      },
      { onConflict: 'customer_id,restaurant_id,consent_type' },
    )
    return { ok: !error }
  } catch {
    return { ok: false }
  }
}
