// Sprint 16a — Customers CRM data layer. ALL functions are service-role and
// trust a restaurantId that the CALLER (a dashboard server action) has already
// validated the authed owner owns. customers + customer_consents are
// service-role-only at the RLS layer, so this is the only read path. Phone PII
// is masked here whenever the customer has NOT given open consent at this venue;
// the raw phone never leaves this module without consent.

import { createServiceClient } from './service-client'
import type { Json } from './types.gen'
import { computeTier } from '@garsonless/domain/loyalty'
import { getLoyaltyScope, getMemberBalances } from './loyalty'
import {
  isEmptyCustomerSegmentDefinition,
  maskCustomerEmail,
  maskCustomerPhone,
  sanitizeCustomerSegmentDefinition,
  type CustomerConsentType,
  type CustomerListOptions,
  type CustomerSegment,
  type CustomerSegmentCounts,
  type CustomerSegmentDefinition,
  type CustomerTimelineEvent,
  type CustomerTimelinePage,
  type RestaurantCustomer,
  type RestaurantCustomerDetail,
  type RestaurantCustomersPage,
  type SavedCustomerSegment,
} from '@garsonless/domain/customers'

// ── phone masking (TR): +905321234567 → "0532 *** ** 67" ─────────────────────
function maskPhone(e164: string | null): string {
  return maskCustomerPhone(e164)
}

function maskEmail(email: string | null): string {
  return maskCustomerEmail(email)
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

export type CustomerLoyaltyScope = Awaited<ReturnType<typeof getLoyaltyScope>>

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
  opts: CustomerListOptions = {},
  visibility: { includeContactData?: boolean; loyaltyScope?: CustomerLoyaltyScope } = {},
): Promise<RestaurantCustomersPage> {
  // Callers outside dashboard CRM (e.g. campaign delivery) retain the
  // historical consent-gated projection. Dashboard member queries explicitly
  // pass false through the application port, so the raw values never leave DB.
  const includeContactData = visibility.includeContactData ?? true
  const page = Math.max(1, Math.floor(opts.page ?? 1))
  const pageSize = Math.min(100, Math.max(1, Math.floor(opts.pageSize ?? 25)))
  const scope = visibility.loyaltyScope === undefined
    ? await getLoyaltyScope(restaurantId)
    : visibility.loyaltyScope
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
  const customerIds = rows.map((row) => row.customer_id)
  const { data: identityRows } = customerIds.length
    ? await supabase.from('customers').select('id, email, auth_user_id').in('id', customerIds)
    : { data: [] }
  const identities = new Map(((identityRows ?? []) as Array<{
    id: string
    email: string | null
    auth_user_id: string | null
  }>).map((identity) => [identity.id, identity]))
  const customers: RestaurantCustomer[] = rows.map((r) => {
    const lifetime = Number(r.lifetime_points)
    const { tier, tierIndex } = computeTier(lifetime, tiers)
    const identity = identities.get(r.customer_id)
    const contactVisible = includeContactData && r.has_consent
    return {
      customerId: r.customer_id,
      name: r.name,
      phone: contactVisible ? (r.phone ?? '—') : maskPhone(r.phone),
      phoneMasked: !contactVisible,
      email: contactVisible ? (identity?.email ?? '—') : maskEmail(identity?.email ?? null),
      emailMasked: !contactVisible,
      authLinked: Boolean(identity?.auth_user_id),
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

/** Global built-in segment counts, independent of the currently visible CRM
 * page/search/filter. Uses the same canonical RPC predicates as the list. */
export async function getRestaurantCustomerSegmentCounts(
  restaurantId: string,
  options: { loyaltyScope?: CustomerLoyaltyScope } = {},
): Promise<CustomerSegmentCounts> {
  const scope = options.loyaltyScope === undefined
    ? await getLoyaltyScope(restaurantId)
    : options.loyaltyScope
  const scopeKey = scope?.scopeKey ?? restaurantId
  const supabase = createServiceClient()
  const segments: CustomerSegment[] = ['new', 'frequent', 'lapsed', 'consented']
  const totals = await Promise.all(segments.map(async (segment) => {
    const { data, error } = await supabase.rpc('get_restaurant_customers', {
      p_restaurant_id: restaurantId,
      p_scope_key: scopeKey,
      p_segment: segment,
      p_sort: 'last_seen',
      p_limit: 1,
      p_offset: 0,
    })
    if (error) throw new Error(`getRestaurantCustomerSegmentCounts: ${error.message}`)
    const row = ((data as RawRow[] | null) ?? [])[0]
    return [segment, row ? Number(row.total_count) : 0] as const
  }))
  return Object.fromEntries(totals) as CustomerSegmentCounts
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

/** Has this customer a trusted relationship with this venue? Gate for detail +
 * grant so an owner can't probe arbitrary customer UUIDs or another venue. */
async function hasActivityAtVenue(
  supabase: ReturnType<typeof createServiceClient>,
  restaurantId: string,
  customerId: string,
): Promise<boolean> {
  const [{ count: oc }, { count: lc }, { count: ac }] = await Promise.all([
    supabase.from('orders').select('id', { count: 'exact', head: true })
      .eq('restaurant_id', restaurantId).eq('customer_id', customerId).is('deleted_at', null),
    supabase.from('loyalty_transactions').select('id', { count: 'exact', head: true })
      .eq('restaurant_id', restaurantId).eq('customer_id', customerId),
    supabase.from('customer_restaurants').select('customer_id', { count: 'exact', head: true })
      .eq('restaurant_id', restaurantId).eq('customer_id', customerId),
  ])
  return (oc ?? 0) > 0 || (lc ?? 0) > 0 || (ac ?? 0) > 0
}

const CUSTOMER_TIMELINE_PAGE_SIZE = 30
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

type CustomerTimelineCursor = {
  version: 1
  at: string
  kind: 'order' | 'ledger'
  id: string
}

type RawTimelineRow = {
  event_id: string
  event_kind: string
  event_at: string
  amount: number | string | null
  status: string | null
  paid: boolean | null
  collected: boolean | null
  loyalty_type: string | null
  direction: string | null
  delta: number | null
  reason: string | null
}

function encodeTimelineCursor(row: RawTimelineRow): string {
  const payload: CustomerTimelineCursor = {
    version: 1,
    at: row.event_at,
    kind: row.event_kind === 'order' ? 'order' : 'ledger',
    id: row.event_id,
  }
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url')
}

function decodeTimelineCursor(cursor: string | null | undefined): CustomerTimelineCursor | null {
  if (!cursor) return null
  if (cursor.length > 512) throw new Error('Geçersiz hareket imleci')
  try {
    const value = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as Partial<CustomerTimelineCursor>
    const timestamp = typeof value.at === 'string' ? new Date(value.at).getTime() : Number.NaN
    if (value.version !== 1 || (value.kind !== 'order' && value.kind !== 'ledger') || !UUID_PATTERN.test(value.id ?? '') || !Number.isFinite(timestamp)) {
      throw new Error('invalid')
    }
    return { version: 1, at: new Date(timestamp).toISOString(), kind: value.kind, id: value.id! }
  } catch {
    throw new Error('Geçersiz hareket imleci')
  }
}

function mapTimelineEvent(row: RawTimelineRow): CustomerTimelineEvent | null {
  if (row.event_kind === 'order') {
    return {
      id: `o-${row.event_id}`,
      at: row.event_at,
      kind: 'order',
      amount: Number(row.amount ?? 0),
      paid: row.paid === true,
      collected: row.collected === true,
      ...(row.status ? { status: row.status } : {}),
    }
  }
  if (
    row.event_kind !== 'ledger'
    || (row.loyalty_type !== 'stamp' && row.loyalty_type !== 'points' && row.loyalty_type !== 'visit')
    || (row.direction !== 'earn' && row.direction !== 'redeem' && row.direction !== 'refund')
  ) return null
  return {
    id: `l-${row.event_id}`,
    at: row.event_at,
    kind: 'ledger',
    type: row.loyalty_type,
    direction: row.direction,
    delta: Number(row.delta ?? 0),
    ...(row.reason ? { reason: row.reason } : {}),
  }
}

async function queryRestaurantCustomerTimeline(
  supabase: ReturnType<typeof createServiceClient>,
  restaurantId: string,
  customerId: string,
  cursor?: string | null,
): Promise<CustomerTimelinePage> {
  const decoded = decodeTimelineCursor(cursor)
  const { data, error } = await supabase.rpc('get_restaurant_customer_timeline', {
    p_restaurant_id: restaurantId,
    p_customer_id: customerId,
    p_limit: CUSTOMER_TIMELINE_PAGE_SIZE,
    ...(decoded ? {
      p_before_at: decoded.at,
      p_before_kind: decoded.kind,
      p_before_id: decoded.id,
    } : {}),
  })
  if (error) throw new Error(`getRestaurantCustomerTimeline: ${error.message}`)
  const rows = ((data as RawTimelineRow[] | null) ?? [])
  const hasMore = rows.length > CUSTOMER_TIMELINE_PAGE_SIZE
  const visibleRows = rows.slice(0, CUSTOMER_TIMELINE_PAGE_SIZE)
  const events = visibleRows.flatMap((row) => {
    const event = mapTimelineEvent(row)
    return event ? [event] : []
  })
  const lastRow = visibleRows.at(-1)
  return {
    events,
    hasMore,
    nextCursor: hasMore && lastRow ? encodeTimelineCursor(lastRow) : null,
  }
}

export async function getRestaurantCustomerTimeline(
  restaurantId: string,
  customerId: string,
  cursor?: string | null,
): Promise<CustomerTimelinePage | null> {
  const supabase = createServiceClient()
  if (!(await hasActivityAtVenue(supabase, restaurantId, customerId))) return null
  return queryRestaurantCustomerTimeline(supabase, restaurantId, customerId, cursor)
}

export async function getRestaurantCustomerDetail(
  restaurantId: string,
  customerId: string,
  visibility: { includeContactData?: boolean } = {},
): Promise<RestaurantCustomerDetail | null> {
  const supabase = createServiceClient()
  if (!(await hasActivityAtVenue(supabase, restaurantId, customerId))) return null

  const [{ data: cust }, consentOpen, balances, { data: summaryRows }, timelinePage] = await Promise.all([
    supabase.from('customers').select('name, phone, email, auth_user_id, created_at').eq('id', customerId).maybeSingle(),
    getConsentStatus(customerId, restaurantId),
    getMemberBalances(customerId, restaurantId),
    supabase.rpc('get_restaurant_customer_summary', {
      p_restaurant_id: restaurantId,
      p_customer_id: customerId,
    }),
    queryRestaurantCustomerTimeline(supabase, restaurantId, customerId),
  ])
  const customer = cust as {
    name: string | null
    phone: string | null
    email: string | null
    auth_user_id: string | null
    created_at: string
  } | null
  if (!customer) return null

  const summary = (summaryRows as Array<{
    spend: number | string
    visits: number
    first_seen: string | null
    last_seen: string | null
  }> | null)?.[0]

  const contactVisible = (visibility.includeContactData ?? true) && consentOpen
  return {
    customerId,
    name: customer.name,
    phone: contactVisible ? (customer.phone ?? '—') : maskPhone(customer.phone),
    phoneMasked: !contactVisible,
    email: contactVisible ? (customer.email ?? '—') : maskEmail(customer.email),
    emailMasked: !contactVisible,
    authLinked: Boolean(customer.auth_user_id),
    hasConsent: consentOpen,
    joinedAt: customer.created_at,
    firstSeenAt: summary?.first_seen ?? null,
    lastSeenAt: summary?.last_seen ?? null,
    spend: Number(summary?.spend ?? 0),
    visits: Number(summary?.visits ?? 0),
    balances,
    timeline: timelinePage.events,
    timelineNextCursor: timelinePage.nextCursor,
    timelineHasMore: timelinePage.hasMore,
  }
}

/** Grant store credit as POINTS (manual ledger credit). Owner-validated by the
 *  caller; activity-at-venue gated here. Reflects in balance immediately. */
export async function grantStoreCredit(params: {
  restaurantId: string
  customerId: string
  requestId: string
  points: number
  grantedBy: string // auth.users id (owner) — audit
  note?: string
}): Promise<{ ok: true; granted: number; replayed: boolean } | { ok: false; error: string }> {
  const points = Math.floor(params.points)
  if (!Number.isFinite(points) || points <= 0) return { ok: false, error: 'Geçersiz puan miktarı' }
  if (points > 1_000_000) return { ok: false, error: 'Puan miktarı çok yüksek' }

  const supabase = createServiceClient()
  if (!(await hasActivityAtVenue(supabase, params.restaurantId, params.customerId))) {
    return { ok: false, error: 'Bu müşteri bu işletmede bulunamadı' }
  }
  const scope = await getLoyaltyScope(params.restaurantId)
  if (!scope) return { ok: false, error: 'Sadakat yapılandırması bulunamadı' }

  const { data, error } = await supabase.rpc('grant_store_credit_atomic', {
    p_request_id: params.requestId,
    p_restaurant_id: params.restaurantId,
    p_customer_id: params.customerId,
    p_scope_key: scope.scopeKey,
    p_points: points,
    // The SQL function canonicalizes an empty string back to NULL. Passing the
    // semantic empty value keeps this call aligned with generated RPC types.
    p_note: params.note?.trim().slice(0, 80) || '',
    p_granted_by: params.grantedBy,
  })
  if (error) {
    if (error.code === '22023') return { ok: false, error: 'Geçersiz puan isteği' }
    if (error.code === '42501') return { ok: false, error: 'Bu işlem için yetkiniz yok' }
    if (error.code === 'GL001') return { ok: false, error: 'İstek kimliği farklı bir işlem için kullanılmış' }
    return { ok: false, error: 'Puan tanımlanamadı' }
  }
  const row = data?.[0]
  if (!row) return { ok: false, error: 'Puan tanımlanamadı' }
  return { ok: true, granted: Number(row.granted), replayed: row.replayed }
}

// ── consent (per-restaurant) ─────────────────────────────────────────────────
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
  source: 'join' | 'member_sheet' | 'account_center',
  consentType: CustomerConsentType = 'contact_data',
): Promise<{ ok: boolean }> {
  try {
    const supabase = createServiceClient()
    const policy = consentType === 'marketing'
      ? {
          version: 'marketing-consent-v1',
          digest: 'f5876bd7a6e24b5efdee0c7bfbd260d45b767f856fa79e836dc454c7544432ee',
        }
      : {
          version: 'contact-data-notice-v1',
          digest: '243ae10e5e0fdca1fa38840ad6c1145d59fe1996c9b0707e3d9073dff8d825bf',
        }
    const rpc = supabase.rpc.bind(supabase) as unknown as (
      name: string,
      args: Record<string, unknown>,
    ) => Promise<{ data: unknown; error: { message: string } | null }>
    const { data, error } = await rpc('record_customer_consent_event', {
      p_customer_id: customerId,
      p_restaurant_id: restaurantId,
      p_consent_type: consentType,
      p_grant: grant,
      p_source: source,
      p_policy_version: policy.version,
      p_text_digest: policy.digest,
      p_lawful_basis: 'explicit_consent',
    })
    return { ok: !error && data === true }
  } catch {
    return { ok: false }
  }
}
