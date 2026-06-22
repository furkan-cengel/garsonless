import { createServiceClient } from './client'
import { getSmsProvider } from './sms'
import { normalizePhone } from './phone'
import {
  getCustomerSegment,
  getRestaurantCustomers,
  sanitizeCustomerSegmentDefinition,
  type CustomerSegment,
  type CustomerSegmentDefinition,
} from './customers'
import type { Json } from './types.gen'

export type CampaignSegmentKind = 'all' | 'builtin' | 'custom'
export type CampaignStatus = 'draft' | 'sending' | 'sent' | 'failed' | 'cancelled'

export interface CampaignAudienceInput {
  segmentKind?: CampaignSegmentKind
  builtinSegment?: CustomerSegment | null
  customSegmentId?: string | null
}

export interface CampaignAudiencePreview {
  totalCandidates: number
  eligibleRecipients: number
  skippedNoMarketingConsent: number
  segmentLabel: string
}

export interface CampaignSummary {
  id: string
  restaurantId: string
  name: string
  messageBody: string
  segmentKind: CampaignSegmentKind
  builtinSegment: CustomerSegment | null
  customSegmentId: string | null
  status: CampaignStatus
  recipientCount: number
  sentCount: number
  failedCount: number
  skippedCount: number
  sentAt: string | null
  createdAt: string
}

export type SendCampaignResult =
  | { ok: true; campaign: CampaignSummary; preview: CampaignAudiencePreview }
  | { ok: false; error: string; preview?: CampaignAudiencePreview }

const BUILTIN_SEGMENTS: CustomerSegment[] = ['new', 'frequent', 'lapsed', 'consented']
const MAX_SMS_CHARS = 459
const PAGE_SIZE = 100

type LooseSupabase = ReturnType<typeof createServiceClient> & {
  from: (table: string) => any
}

type CandidateCustomer = {
  customerId: string
  name: string | null
}

type MarketingContact = CandidateCustomer & {
  phone: string
}

type ResolvedAudience = {
  normalized: Required<Pick<CampaignAudienceInput, 'segmentKind'>> & {
    builtinSegment: CustomerSegment | null
    customSegmentId: string | null
  }
  definition: CustomerSegmentDefinition
  segmentLabel: string
  candidates: CandidateCustomer[]
  contacts: MarketingContact[]
}

type CampaignRow = {
  id: string
  restaurant_id: string
  name: string
  message_body: string
  segment_kind: string
  builtin_segment: string | null
  custom_segment_id: string | null
  status: string
  recipient_count: number
  sent_count: number
  failed_count: number
  skipped_count: number
  sent_at: string | null
  created_at: string
}

function serviceDb(): LooseSupabase {
  return createServiceClient() as LooseSupabase
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

function cleanText(value: string, max: number): string {
  return value.replace(/\s+/g, ' ').trim().slice(0, max)
}

export function sanitizeCampaignMessage(value: string): string {
  return cleanText(value, MAX_SMS_CHARS)
}

function sanitizeCampaignName(value: string): string {
  const cleaned = cleanText(value, 80)
  if (cleaned) return cleaned
  const d = new Date()
  return `SMS ${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}`
}

function normalizeAudience(input: CampaignAudienceInput = {}) {
  if (input.segmentKind === 'builtin' && input.builtinSegment && BUILTIN_SEGMENTS.includes(input.builtinSegment)) {
    return { segmentKind: 'builtin' as const, builtinSegment: input.builtinSegment, customSegmentId: null }
  }
  if (input.segmentKind === 'custom' && input.customSegmentId) {
    return { segmentKind: 'custom' as const, builtinSegment: null, customSegmentId: input.customSegmentId }
  }
  return { segmentKind: 'all' as const, builtinSegment: null, customSegmentId: null }
}

function campaignFromRow(row: CampaignRow): CampaignSummary {
  return {
    id: row.id,
    restaurantId: row.restaurant_id,
    name: row.name,
    messageBody: row.message_body,
    segmentKind: (row.segment_kind === 'builtin' || row.segment_kind === 'custom') ? row.segment_kind : 'all',
    builtinSegment: BUILTIN_SEGMENTS.includes(row.builtin_segment as CustomerSegment) ? row.builtin_segment as CustomerSegment : null,
    customSegmentId: row.custom_segment_id,
    status: (['draft', 'sending', 'sent', 'failed', 'cancelled'] as string[]).includes(row.status) ? row.status as CampaignStatus : 'draft',
    recipientCount: Number(row.recipient_count),
    sentCount: Number(row.sent_count),
    failedCount: Number(row.failed_count),
    skippedCount: Number(row.skipped_count),
    sentAt: row.sent_at,
    createdAt: row.created_at,
  }
}

async function resolveCandidateCustomers(
  restaurantId: string,
  input: CampaignAudienceInput,
): Promise<{
  normalized: ResolvedAudience['normalized']
  definition: CustomerSegmentDefinition
  segmentLabel: string
  candidates: CandidateCustomer[]
}> {
  const normalized = normalizeAudience(input)
  let customDefinition: CustomerSegmentDefinition | null = null
  let segmentLabel = 'Tüm müşteriler'

  if (normalized.segmentKind === 'custom') {
    const saved = await getCustomerSegment(restaurantId, normalized.customSegmentId!)
    if (!saved) throw new Error('Segment bulunamadı')
    customDefinition = saved.definition
    segmentLabel = saved.name
  } else if (normalized.segmentKind === 'builtin') {
    segmentLabel = {
      new: 'Yeni üyeler',
      frequent: 'Sık gelenler',
      lapsed: 'Uzun süredir gelmeyen',
      consented: 'İletişim izni olanlar',
    }[normalized.builtinSegment!] ?? 'Segment'
  }

  const candidates = new Map<string, CandidateCustomer>()
  let page = 1
  let expectedTotal = Number.POSITIVE_INFINITY
  while (candidates.size < expectedTotal) {
    const res = await getRestaurantCustomers(restaurantId, {
      sort: 'last_seen',
      page,
      pageSize: PAGE_SIZE,
      ...(normalized.segmentKind === 'builtin' ? { segment: normalized.builtinSegment } : {}),
      ...(customDefinition ? { customSegment: customDefinition } : {}),
    })
    expectedTotal = res.total
    for (const customer of res.customers) {
      candidates.set(customer.customerId, { customerId: customer.customerId, name: customer.name })
    }
    if (res.customers.length === 0 || res.customers.length < PAGE_SIZE) break
    page += 1
  }

  return {
    normalized,
    definition: sanitizeCustomerSegmentDefinition(customDefinition ?? {}),
    segmentLabel,
    candidates: Array.from(candidates.values()),
  }
}

async function fetchMarketingContacts(
  restaurantId: string,
  candidates: CandidateCustomer[],
): Promise<MarketingContact[]> {
  if (candidates.length === 0) return []
  const db = serviceDb()
  const ids = candidates.map((c) => c.customerId)
  const consented = new Set<string>()

  for (const part of chunk(ids, 500)) {
    const { data, error } = await db
      .from('customer_consents')
      .select('customer_id')
      .eq('restaurant_id', restaurantId)
      .eq('consent_type', 'marketing')
      .not('granted_at', 'is', null)
      .is('revoked_at', null)
      .in('customer_id', part)
    if (error) throw new Error(`marketing consent lookup failed: ${error.message}`)
    for (const row of (data ?? []) as Array<{ customer_id: string }>) consented.add(row.customer_id)
  }

  if (consented.size === 0) return []
  const rawById = new Map<string, { phone: string; name: string | null }>()
  for (const part of chunk(Array.from(consented), 500)) {
    const { data, error } = await db
      .from('customers')
      .select('id, name, phone')
      .in('id', part)
    if (error) throw new Error(`customer phone lookup failed: ${error.message}`)
    for (const row of (data ?? []) as Array<{ id: string; name: string | null; phone: string }>) {
      rawById.set(row.id, { name: row.name, phone: row.phone })
    }
  }

  return candidates.flatMap((candidate) => {
    if (!consented.has(candidate.customerId)) return []
    const raw = rawById.get(candidate.customerId)
    const phone = normalizePhone(raw?.phone)
    if (!raw || !phone) return []
    return [{ customerId: candidate.customerId, name: raw.name ?? candidate.name, phone }]
  })
}

async function resolveCampaignAudience(
  restaurantId: string,
  input: CampaignAudienceInput,
): Promise<ResolvedAudience> {
  const candidateResult = await resolveCandidateCustomers(restaurantId, input)
  const contacts = await fetchMarketingContacts(restaurantId, candidateResult.candidates)
  return { ...candidateResult, contacts }
}

function previewFromAudience(audience: ResolvedAudience): CampaignAudiencePreview {
  return {
    totalCandidates: audience.candidates.length,
    eligibleRecipients: audience.contacts.length,
    skippedNoMarketingConsent: Math.max(0, audience.candidates.length - audience.contacts.length),
    segmentLabel: audience.segmentLabel,
  }
}

export async function previewCampaignAudience(
  restaurantId: string,
  input: CampaignAudienceInput,
): Promise<CampaignAudiencePreview> {
  return previewFromAudience(await resolveCampaignAudience(restaurantId, input))
}

export async function listCampaigns(restaurantId: string, limit = 12): Promise<CampaignSummary[]> {
  const db = serviceDb()
  const { data, error } = await db
    .from('campaigns')
    .select('id, restaurant_id, name, message_body, segment_kind, builtin_segment, custom_segment_id, status, recipient_count, sent_count, failed_count, skipped_count, sent_at, created_at')
    .eq('restaurant_id', restaurantId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(Math.min(50, Math.max(1, Math.floor(limit))))
  if (error) throw new Error(`listCampaigns: ${error.message}`)
  return ((data ?? []) as CampaignRow[]).map(campaignFromRow)
}

export async function sendCampaignTest(params: {
  restaurantId: string
  phone: string
  message: string
  createdBy: string
}): Promise<{ ok: true; messageId?: string } | { ok: false; error: string }> {
  const phone = normalizePhone(params.phone)
  const message = sanitizeCampaignMessage(params.message)
  if (!phone) return { ok: false, error: 'Telefon numarası geçersiz' }
  if (message.length < 5) return { ok: false, error: 'Mesaj çok kısa' }

  const db = serviceDb()
  const provider = getSmsProvider()
  try {
    const sent = await provider.send(phone, message, { purpose: 'test', restaurantId: params.restaurantId })
    await db.from('message_events').insert({
      restaurant_id: params.restaurantId,
      channel: 'sms',
      event_type: 'test_sent',
      phone,
      provider: sent.provider,
      provider_message_id: sent.messageId ?? null,
      created_by: params.createdBy,
      metadata: { purpose: 'test' } satisfies Json,
    })
    return { ok: true, ...(sent.messageId ? { messageId: sent.messageId } : {}) }
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Test SMS gönderilemedi'
    await db.from('message_events').insert({
      restaurant_id: params.restaurantId,
      channel: 'sms',
      event_type: 'test_failed',
      phone,
      provider: provider.name,
      error,
      created_by: params.createdBy,
      metadata: { purpose: 'test' } satisfies Json,
    })
    return { ok: false, error }
  }
}

export async function sendCampaign(params: {
  restaurantId: string
  name: string
  message: string
  audience: CampaignAudienceInput
  createdBy: string
}): Promise<SendCampaignResult> {
  const name = sanitizeCampaignName(params.name)
  const message = sanitizeCampaignMessage(params.message)
  if (message.length < 5) return { ok: false, error: 'Mesaj çok kısa' }

  const audience = await resolveCampaignAudience(params.restaurantId, params.audience)
  const preview = previewFromAudience(audience)
  if (preview.eligibleRecipients === 0) {
    return { ok: false, error: 'Marketing izni açık alıcı yok', preview }
  }

  const db = serviceDb()
  const { data: insertedCampaign, error: campaignError } = await db
    .from('campaigns')
    .insert({
      restaurant_id: params.restaurantId,
      name,
      channel: 'sms',
      message_body: message,
      segment_kind: audience.normalized.segmentKind,
      builtin_segment: audience.normalized.builtinSegment,
      custom_segment_id: audience.normalized.customSegmentId,
      segment_definition: audience.definition as unknown as Json,
      status: 'sending',
      recipient_count: preview.eligibleRecipients,
      skipped_count: preview.skippedNoMarketingConsent,
      created_by: params.createdBy,
    })
    .select('id, restaurant_id, name, message_body, segment_kind, builtin_segment, custom_segment_id, status, recipient_count, sent_count, failed_count, skipped_count, sent_at, created_at')
    .single()
  if (campaignError || !insertedCampaign) return { ok: false, error: campaignError?.message ?? 'Kampanya oluşturulamadı', preview }

  const campaign = insertedCampaign as CampaignRow
  const { data: recipients, error: recipientsError } = await db
    .from('campaign_recipients')
    .insert(audience.contacts.map((contact) => ({
      campaign_id: campaign.id,
      restaurant_id: params.restaurantId,
      customer_id: contact.customerId,
      phone: contact.phone,
      status: 'pending',
    })))
    .select('id, customer_id, phone')
  if (recipientsError) {
    await db.from('campaigns').update({ status: 'failed', failed_count: preview.eligibleRecipients }).eq('id', campaign.id)
    return { ok: false, error: recipientsError.message, preview }
  }

  const provider = getSmsProvider()
  let sentCount = 0
  let failedCount = 0
  for (const recipient of (recipients ?? []) as Array<{ id: string; customer_id: string; phone: string }>) {
    try {
      const sent = await provider.send(recipient.phone, message, {
        purpose: 'campaign',
        restaurantId: params.restaurantId,
        campaignId: campaign.id,
      })
      sentCount += 1
      const now = new Date().toISOString()
      await db.from('campaign_recipients').update({
        status: 'sent',
        provider_message_id: sent.messageId ?? null,
        sent_at: now,
      }).eq('id', recipient.id)
      await db.from('message_events').insert({
        restaurant_id: params.restaurantId,
        campaign_id: campaign.id,
        recipient_id: recipient.id,
        customer_id: recipient.customer_id,
        channel: 'sms',
        event_type: 'sent',
        phone: recipient.phone,
        provider: sent.provider,
        provider_message_id: sent.messageId ?? null,
        created_by: params.createdBy,
        metadata: { segment: audience.segmentLabel } satisfies Json,
      })
    } catch (err) {
      failedCount += 1
      const error = err instanceof Error ? err.message : 'SMS gönderilemedi'
      await db.from('campaign_recipients').update({ status: 'failed', error }).eq('id', recipient.id)
      await db.from('message_events').insert({
        restaurant_id: params.restaurantId,
        campaign_id: campaign.id,
        recipient_id: recipient.id,
        customer_id: recipient.customer_id,
        channel: 'sms',
        event_type: 'failed',
        phone: recipient.phone,
        provider: provider.name,
        error,
        created_by: params.createdBy,
        metadata: { segment: audience.segmentLabel } satisfies Json,
      })
    }
  }

  const finalStatus: CampaignStatus = sentCount > 0 ? 'sent' : 'failed'
  const { data: updatedCampaign } = await db
    .from('campaigns')
    .update({
      status: finalStatus,
      sent_count: sentCount,
      failed_count: failedCount,
      skipped_count: preview.skippedNoMarketingConsent,
      sent_at: new Date().toISOString(),
    })
    .eq('id', campaign.id)
    .select('id, restaurant_id, name, message_body, segment_kind, builtin_segment, custom_segment_id, status, recipient_count, sent_count, failed_count, skipped_count, sent_at, created_at')
    .single()

  return {
    ok: true,
    campaign: campaignFromRow((updatedCampaign ?? { ...campaign, status: finalStatus, sent_count: sentCount, failed_count: failedCount, skipped_count: preview.skippedNoMarketingConsent, sent_at: new Date().toISOString() }) as CampaignRow),
    preview,
  }
}
