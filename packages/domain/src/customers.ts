import type { LoyaltyTier, MemberBalances } from './loyalty'

export type CustomerSort = 'last_seen' | 'spend' | 'visits' | 'points' | 'joined'
export type CustomerSegment = 'new' | 'frequent' | 'lapsed' | 'consented'
export type CustomerSegmentCounts = Record<CustomerSegment, number>
export type CustomerSegmentOperator = '>=' | '<='
export type CustomerSegmentConsent = 'granted' | 'missing'
export type CustomerConsentType = 'contact_data' | 'marketing'
export type CustomerConsentSource = 'join' | 'member_sheet'

export interface CustomerAuthIdentity {
  authUserId: string
  email: string | null
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
  | { ok: true; customer: { id: string; email: string; name: string | null } }
  | { ok: false; error: string }

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
  spend: number
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
  email: string
  emailMasked: boolean
  authLinked: boolean
  hasConsent: boolean
  joinedAt: string
  firstSeenAt: string | null
  lastSeenAt: string | null
  spend: number
  visits: number
  balances: MemberBalances | null
  timeline: CustomerTimelineEvent[]
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
  if (!e164) return '—'
  const digits = e164.replace(/\D/g, '')
  const national = digits.startsWith('90') ? `0${digits.slice(2)}` : digits.startsWith('0') ? digits : `0${digits}`
  if (national.length < 7) return '*** ** **'
  return `${national.slice(0, 4)} *** ** ${national.slice(-2)}`
}

export function maskCustomerEmail(email: string | null): string {
  if (!email) return '—'
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
