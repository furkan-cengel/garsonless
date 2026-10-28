import type { LoyaltyTier, MemberBalances } from './loyalty'

export type CustomerSort = 'last_seen' | 'spend' | 'visits' | 'points' | 'joined'
export type CustomerSegment = 'new' | 'frequent' | 'lapsed' | 'consented'
export type CustomerSegmentCounts = Record<CustomerSegment | 'total', number>
export type CustomerSegmentOperator = '>=' | '<='
export type CustomerSegmentConsent = 'granted' | 'missing'
export type CustomerConsentType = 'contact_data' | 'marketing'
export type CustomerConsentSource = 'join' | 'member_sheet' | 'account_center'

export const CUSTOMER_NEW_WINDOW_DAYS = 30
export const CUSTOMER_LAPSED_WINDOW_DAYS = 60
const DAY_MS = 86_400_000

export interface CustomerAuthIdentity {
  authUserId: string
  /** Only a provider-confirmed address may be supplied by the auth adapter. */
  email: string | null
  /** Supabase Auth's verified phone claim. Provider/user metadata is not trusted. */
  phone?: string | null
  userMetadata: Readonly<Record<string, unknown>>
  appMetadata: Readonly<Record<string, unknown>>
}

export interface EnsureCustomerOptions {
  name?: string | null
  restaurantId?: string
  consent?: boolean
  marketingConsent?: boolean
}

export type EnsureCustomerResult =
  | { ok: true; customer: { id: string; email: string | null; name: string | null } }
  | {
      ok: false
      error: string
      code?: 'IDENTITY_CONFLICT' | 'STAFF_ACCOUNT_REJECTED' | 'SERVICE_UNAVAILABLE'
    }

export interface CustomerConsentSnapshot {
  consentGiven: boolean
  marketingConsentGiven: boolean
}

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

export interface RestaurantCustomer {
  customerId: string
  name: string | null
  phone: string
  phoneMasked: boolean
  email: string
  emailMasked: boolean
  authLinked: boolean
  hasConsent: boolean
  /** Null when the viewer is not the restaurant owner. */
  spend: number | null
  visits: number
  points: number
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

export interface CustomerListOptions {
  search?: string
  segment?: CustomerSegment | null
  customSegment?: CustomerSegmentDefinition | null
  sort?: CustomerSort
  page?: number
  pageSize?: number
}

export interface CustomerTimelineEvent {
  id: string
  at: string
  kind: 'order' | 'ledger'
  amount?: number
  status?: string
  paid?: boolean
  /** True only when the order participates in canonical collected spend. */
  collected?: boolean
  type?: 'stamp' | 'points' | 'visit'
  direction?: 'earn' | 'redeem' | 'refund' | 'reversal'
  delta?: number
  reason?: string
}

export interface CustomerTimelinePage {
  events: CustomerTimelineEvent[]
  nextCursor: string | null
  hasMore: boolean
}

export interface RestaurantCustomerDetail {
  customerId: string
  name: string | null
  phone: string
  phoneMasked: boolean
  email: string
  emailMasked: boolean
  authLinked: boolean
  hasConsent: boolean
  joinedAt: string
  firstSeenAt: string | null
  lastSeenAt: string | null
  /** Null when the viewer is not the restaurant owner. */
  spend: number | null
  visits: number
  /** Day and month only; null when unknown or when the viewer is not the owner. */
  birthday: CustomerBirthday | null
  /** Latest answers to the after-visit question, newest first. */
  feedback: CustomerFeedback[]
  balances: MemberBalances | null
  timeline: CustomerTimelineEvent[]
  timelineNextCursor: string | null
  timelineHasMore: boolean
}

export interface CustomerBirthday {
  month: number
  day: number
  source: 'customer' | 'owner'
}

/** A valid day for the month; 29 February is allowed because it exists in leap years. */
export function isValidBirthday(month: number, day: number): boolean {
  if (!Number.isInteger(month) || !Number.isInteger(day) || month < 1 || month > 12 || day < 1) return false
  return day <= new Date(Date.UTC(2024, month, 0)).getUTCDate()
}

export const CUSTOMER_REWARD_KINDS = ['birthday', 'visit', 'spend', 'winback'] as const
export type CustomerRewardKind = typeof CUSTOMER_REWARD_KINDS[number]
export interface CustomerRewardParams {
  leadDays?: 0 | 3 | 7
  every?: number
  minimum?: number
  inactiveDays?: number
}
export interface CustomerRewardRule {
  kind: CustomerRewardKind
  enabled: boolean
  points: number
  params: CustomerRewardParams
  enabledAt: string | null
}
/** What a rule starts with before the owner changes it. All rewards are loyalty points. */
export const DEFAULT_CUSTOMER_REWARD_RULES: Record<CustomerRewardKind, CustomerRewardRule> = {
  birthday: { kind: 'birthday', enabled: false, points: 300, params: { leadDays: 3 }, enabledAt: null },
  visit: { kind: 'visit', enabled: false, points: 200, params: { every: 10 }, enabledAt: null },
  spend: { kind: 'spend', enabled: false, points: 200, params: { minimum: 1000 }, enabledAt: null },
  winback: { kind: 'winback', enabled: false, points: 200, params: { inactiveDays: 60 }, enabledAt: null },
}
export interface CustomerRewardNotice {
  id: string
  kind: CustomerRewardKind
  points: number
  createdAt: string
}

const REWARD_NOTICE_TITLES: Record<CustomerRewardKind, string> = {
  birthday: 'Doğum günün kutlu olsun!',
  visit: 'Ziyaret ödülü kazandın',
  spend: 'Bonus puan kazandın',
  winback: 'Seni özledik',
}

/** The card a customer sees in the QR menu; the dashboard previews the same words. */
export function customerRewardMessage(kind: CustomerRewardKind, points: number): { title: string; body: string } {
  const amount = points.toLocaleString('tr-TR')
  return {
    title: REWARD_NOTICE_TITLES[kind],
    body: kind === 'winback'
      ? `Tekrar bekleriz: hesabına ${amount} puan eklendi.`
      : `Hesabına ${amount} puan eklendi. Bir sonraki siparişinde kullanabilirsin.`,
  }
}

/** The after-visit question; off until the owner switches it on. */
export interface CustomerReviewSettings {
  enabled: boolean
  googleUrl: string | null
}
/** One answer to the after-visit question. A null rating means "not now". */
export interface CustomerFeedback {
  id: string
  rating: number | null
  comment: string | null
  createdAt: string
  handledAt: string | null
}
/** A low rating still waiting for someone to look at it. */
export interface OpenCustomerFeedback {
  id: string
  customerId: string
  customerName: string | null
  rating: number
  comment: string | null
  createdAt: string
}
export interface CustomerReviewPrompt {
  visitKey: string
  availableAt: string
  googleUrl: string | null
}
export const CUSTOMER_FEEDBACK_COMMENT_MAX_LENGTH = 1000
/** 1-3 stars go to the business as well; every rating is offered the Google link. */
export const isLowCustomerRating = (rating: number) => rating <= 3

/** Google review links are https only. */
export function isValidReviewUrl(value: string): boolean {
  if (value.length > 500 || /\s/.test(value)) return false
  try {
    return new URL(value).protocol === 'https:'
  } catch {
    return false
  }
}

/** A team note on a customer. Every member with customer access can read and add them. */
export interface CustomerNote {
  id: string
  body: string
  authorId: string | null
  authorLabel: string
  createdAt: string
}

export const CUSTOMER_NOTE_MAX_LENGTH = 500
export const CUSTOMER_POINTS_REASON_MAX_LENGTH = 80

/** Full contact details returned by an audited owner reveal. Null when the customer
 * has not given open contact consent at this venue. */
export interface CustomerContactReveal {
  phone: string | null
  email: string | null
}

/** Spend and consent are owner-only; staff may not filter or sort by them either,
 * since a filter result reveals the value it filters on. */
export function customerSegmentUsesOwnerFields(definition: CustomerSegmentDefinition): boolean {
  return Boolean(definition.spend || definition.consent)
}

function customerTimestamp(value: string | null): number | null {
  if (!value) return null
  const timestamp = new Date(value).getTime()
  return Number.isFinite(timestamp) ? timestamp : null
}

/** Built-in segment boundaries are exact elapsed-time windows. Both edges are
 * inclusive so the UI labels and the canonical SQL predicates agree. */
export function isCustomerNew(firstSeen: string | null, referenceNow: string | number | Date): boolean {
  const seenAt = customerTimestamp(firstSeen)
  const now = new Date(referenceNow).getTime()
  return seenAt !== null && Number.isFinite(now) && seenAt >= now - CUSTOMER_NEW_WINDOW_DAYS * DAY_MS
}

export function isCustomerLapsed(lastSeen: string | null, referenceNow: string | number | Date): boolean {
  const seenAt = customerTimestamp(lastSeen)
  const now = new Date(referenceNow).getTime()
  return seenAt !== null && Number.isFinite(now) && seenAt <= now - CUSTOMER_LAPSED_WINDOW_DAYS * DAY_MS
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

export function maskCustomerPhone(e164: string | null): string {
  if (!e164) return '-'
  const digits = e164.replace(/\D/g, '')
  const national = digits.startsWith('90') ? `0${digits.slice(2)}` : digits.startsWith('0') ? digits : `0${digits}`
  if (national.length < 7) return '*** ** **'
  return `${national.slice(0, 4)} *** ** ${national.slice(-2)}`
}

export function maskCustomerEmail(email: string | null): string {
  if (!email) return '-'
  const [local, domain] = email.split('@')
  if (!local || !domain) return '***'
  const visible = local.slice(0, Math.min(2, local.length))
  return `${visible}${'*'.repeat(Math.max(3, local.length - visible.length))}@${domain}`
}

export function normalizeCustomerEmail(email: string | null | undefined): string | null {
  const normalized = email?.trim().toLowerCase() ?? ''
  return normalized && normalized.includes('@') ? normalized : null
}

export function resolveCustomerName(
  explicitName: string | null | undefined,
  metadata: Readonly<Record<string, unknown>>,
): string | null {
  const candidates = [explicitName, metadata['full_name'], metadata['name']]
  for (const candidate of candidates) {
    if (typeof candidate !== 'string') continue
    const name = candidate.trim().slice(0, 80)
    if (name) return name
  }
  return null
}
