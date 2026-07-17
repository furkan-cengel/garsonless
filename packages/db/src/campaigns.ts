import { createServiceClient } from './client'
import { getSmsProvider } from './sms'
import { normalizePhone } from './phone'
import {
  BUILTIN_CUSTOMER_SEGMENTS,
  normalizeCampaignAudience,
  sanitizeCampaignMessage,
  sanitizeCampaignName,
  type CampaignAudienceInput,
  type CampaignAudiencePreview,
  type CampaignStatus,
  type CampaignSummary,
  type SendCampaignResult,
} from '@garsonless/domain/campaigns'
import {
  getCustomerSegment,
  getRestaurantCustomers,
  sanitizeCustomerSegmentDefinition,
  type CustomerSegmentDefinition,
} from './customers'
import type { CustomerSegment } from '@garsonless/domain/customers'
import type { Json } from './types.gen'

export type {
  CampaignAudienceInput,
  CampaignAudiencePreview,
  CampaignSegmentKind,
  CampaignStatus,
  CampaignSummary,
  SendCampaignResult,
} from '@garsonless/domain/campaigns'
export { sanitizeCampaignMessage } from '@garsonless/domain/campaigns'

const PAGE_SIZE = 100

type LooseSupabase = {
  from: (table: string) => any
  rpc: (fn: string, args?: Record<string, unknown>) => Promise<{
    data: any
    error: { message: string } | null
  }>
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
  return createServiceClient() as unknown as LooseSupabase
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

function campaignFromRow(row: CampaignRow): CampaignSummary {
  return {
    id: row.id,
    restaurantId: row.restaurant_id,
    name: row.name,
    messageBody: row.message_body,
    segmentKind: (row.segment_kind === 'builtin' || row.segment_kind === 'custom') ? row.segment_kind : 'all',
    builtinSegment: BUILTIN_CUSTOMER_SEGMENTS.includes(row.builtin_segment as CustomerSegment) ? row.builtin_segment as CustomerSegment : null,
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
  const normalized = normalizeCampaignAudience(input)
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

export async function getCampaignById(restaurantId: string, campaignId: string): Promise<CampaignSummary | null> {
  const db = serviceDb()
  const { data, error } = await db
    .from('campaigns')
    .select('id, restaurant_id, name, message_body, segment_kind, builtin_segment, custom_segment_id, status, recipient_count, sent_count, failed_count, skipped_count, sent_at, created_at')
    .eq('id', campaignId)
    .eq('restaurant_id', restaurantId)
    .is('deleted_at', null)
    .maybeSingle()
  if (error) throw new Error(`getCampaignById: ${error.message}`)
  return data ? campaignFromRow(data as CampaignRow) : null
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
  const { data: campaignId, error: queueError } = await db.rpc('queue_campaign_delivery_atomic', {
    p_restaurant_id: params.restaurantId,
    p_name: name,
    p_message_body: message,
    p_segment_kind: audience.normalized.segmentKind,
    p_builtin_segment: audience.normalized.builtinSegment,
    p_custom_segment_id: audience.normalized.customSegmentId,
    p_segment_definition: audience.definition as unknown as Json,
    p_created_by: params.createdBy,
    p_contacts: audience.contacts.map((contact) => ({ customerId: contact.customerId, phone: contact.phone })) as unknown as Json,
    p_skipped_count: preview.skippedNoMarketingConsent,
    p_segment_label: audience.segmentLabel,
  })
  if (queueError || typeof campaignId !== 'string') {
    return { ok: false, error: queueError?.message ?? 'Kampanya kuyruğa alınamadı', preview }
  }

  const campaign = await getCampaignById(params.restaurantId, campaignId)
  if (!campaign) return { ok: false, error: 'Kampanya oluşturulamadı', preview }
  return { ok: true, campaign, preview }
}

/** Durable campaign consumer. Every recipient is atomically claimed before
 * the provider call. A crash after provider success leaves `processing`; it is
 * never blindly resent, and the SQL finalizer exposes it as an unknown/failed
 * delivery after the lease window. */
export async function deliverCampaign(input: {
  restaurantId: string
  campaignId: string
  createdBy: string | null
  segmentLabel: string
}): Promise<void> {
  const db = serviceDb()
  const campaign = await getCampaignById(input.restaurantId, input.campaignId)
  if (!campaign) throw new Error('Campaign not found for restaurant')
  if (campaign.status === 'sent' || campaign.status === 'failed' || campaign.status === 'cancelled') return

  const provider = getSmsProvider()
  for (;;) {
    const { data, error } = await db.rpc('claim_campaign_recipient', {
      p_campaign_id: input.campaignId,
      p_restaurant_id: input.restaurantId,
    })
    if (error) throw new Error(`campaign recipient claim failed: ${error.message}`)
    const recipient = ((data ?? []) as Array<{ id: string; phone: string }>)[0]
    if (!recipient) break

    let success = false
    let providerName = provider.name
    let providerMessageId: string | null = null
    let deliveryError: string | null = null
    try {
      const sent = await provider.send(recipient.phone, campaign.messageBody, {
        purpose: 'campaign',
        restaurantId: input.restaurantId,
        campaignId: input.campaignId,
      })
      success = true
      providerName = sent.provider
      providerMessageId = sent.messageId ?? null
    } catch (cause) {
      deliveryError = cause instanceof Error ? cause.message : 'SMS gönderilemedi'
    }

    const { data: completed, error: completeError } = await db.rpc('complete_campaign_recipient', {
      p_recipient_id: recipient.id,
      p_restaurant_id: input.restaurantId,
      p_success: success,
      p_provider: providerName,
      p_provider_message_id: providerMessageId,
      p_error: deliveryError,
      p_created_by: input.createdBy,
      p_segment_label: input.segmentLabel,
    })
    if (completeError || completed !== true) {
      throw new Error(completeError?.message ?? 'Campaign recipient completion lease was lost')
    }
  }

  const { data: finalStatus, error: finalizeError } = await db.rpc('finalize_campaign_delivery', {
    p_campaign_id: input.campaignId,
    p_restaurant_id: input.restaurantId,
  })
  if (finalizeError) throw new Error(`campaign finalization failed: ${finalizeError.message}`)
  if (finalStatus === 'processing' || finalStatus === 'pending') {
    throw new Error(`Campaign delivery is still ${String(finalStatus)}`)
  }
}
