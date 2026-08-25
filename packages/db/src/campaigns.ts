import { createHash } from 'node:crypto'
import { createServiceClient } from './service-client'
import {
  getSmsDeliveryAvailability,
  getSmsProvider,
  SmsDeliveryUnavailableError,
} from './sms'
import { normalizePhone } from './phone'
import {
  CampaignEmailDeliveryUnavailableError,
  getCampaignEmailDeliveryAvailability,
  normalizeCampaignEmail,
  readCampaignEmailIdentity,
  renderCampaignEmail,
  sanitizeCampaignHtml,
  sendCampaignEmail,
} from './campaign-email'
import {
  BUILTIN_CUSTOMER_SEGMENTS,
  normalizeCampaignAudience,
  normalizeCampaignEmailDesign,
  normalizeCampaignEmailContent,
  sanitizeCampaignMessage,
  sanitizeCampaignName,
  sanitizeCampaignSubject,
  type CampaignAudienceInput,
  type CampaignAudienceContactPage,
  type CampaignAudiencePreview,
  type CampaignChannel,
  type CampaignEmailContentMode,
  type CampaignEmailDesign,
  type CampaignEmailTemplateId,
  type CampaignDeliveryLog,
  type CampaignEmailDeliveryStatus,
  type CampaignStatus,
  type CampaignSummary,
  type SavedCampaignEmailTemplate,
  type SendCampaignResult,
} from '@garsonless/domain/campaigns'
import {
  getCustomerSegment,
  getRestaurantCustomers,
} from './customers'
import {
  sanitizeCustomerSegmentDefinition,
  type CustomerSegment,
  type CustomerSegmentDefinition,
} from '@garsonless/domain/customers'
import type { Json } from './types.gen'

const PAGE_SIZE = 100

type LooseSupabase = {
  from: (table: string) => any
  rpc: (fn: string, args?: Record<string, unknown>) => Promise<{
    data: any
    error: { code?: string; message: string } | null
  }>
}

type CandidateCustomer = {
  customerId: string
  name: string | null
}

type MarketingContact = CandidateCustomer & {
  recipient: string
}

type MarketingContactResolution = {
  contacts: MarketingContact[]
  skippedNoMarketingConsent: number
  skippedInvalidContact: number
  skippedDuplicateContact: number
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
  skippedNoMarketingConsent: number
  skippedInvalidContact: number
  skippedDuplicateContact: number
  channel: CampaignChannel
}

type CampaignRow = {
  id: string
  restaurant_id: string
  name: string
  channel: string
  subject: string | null
  message_body: string
  content_mode: string
  template_id: string | null
  email_design: unknown
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
    channel: row.channel === 'email' ? 'email' : 'sms',
    subject: row.subject,
    messageBody: row.message_body,
    contentMode: row.content_mode === 'html' || row.content_mode === 'template' || row.content_mode === 'builder' ? row.content_mode : 'plain',
    templateId: row.template_id === 'minimal' || row.template_id === 'announcement' || row.template_id === 'offer'
      ? row.template_id
      : null,
    emailDesign: row.content_mode === 'builder' ? normalizeCampaignEmailDesign(row.email_design) : null,
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
  channel: CampaignChannel,
): Promise<MarketingContactResolution> {
  if (candidates.length === 0) return {
    contacts: [],
    skippedNoMarketingConsent: 0,
    skippedInvalidContact: 0,
    skippedDuplicateContact: 0,
  }
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

  if (consented.size === 0) return {
    contacts: [],
    skippedNoMarketingConsent: candidates.length,
    skippedInvalidContact: 0,
    skippedDuplicateContact: 0,
  }
  const rawById = new Map<string, { phone: string | null; email: string | null; name: string | null }>()
  for (const part of chunk(Array.from(consented), 500)) {
    const { data, error } = await db
      .from('customers')
      .select('id, name, phone, email')
      .in('id', part)
    if (error) throw new Error(`customer contact lookup failed: ${error.message}`)
    for (const row of (data ?? []) as Array<{ id: string; name: string | null; phone: string | null; email: string | null }>) {
      rawById.set(row.id, { name: row.name, phone: row.phone, email: row.email })
    }
  }

  return channel === 'email'
    ? classifyCampaignMarketingEmails(candidates, consented, rawById)
    : classifyCampaignMarketingContacts(candidates, consented, rawById)
}

export function classifyCampaignMarketingContacts(
  candidates: CandidateCustomer[],
  consented: ReadonlySet<string>,
  rawById: ReadonlyMap<string, { phone: string | null; name: string | null }>,
): MarketingContactResolution {
  const contacts: MarketingContact[] = []
  const phones = new Set<string>()
  let skippedNoMarketingConsent = 0
  let skippedInvalidContact = 0
  let skippedDuplicateContact = 0
  for (const candidate of candidates) {
    if (!consented.has(candidate.customerId)) {
      skippedNoMarketingConsent += 1
      continue
    }
    const raw = rawById.get(candidate.customerId)
    const phone = normalizePhone(raw?.phone)
    if (!raw || !phone) {
      skippedInvalidContact += 1
      continue
    }
    if (phones.has(phone)) {
      skippedDuplicateContact += 1
      continue
    }
    phones.add(phone)
    contacts.push({ customerId: candidate.customerId, name: raw.name ?? candidate.name, recipient: phone })
  }
  return { contacts, skippedNoMarketingConsent, skippedInvalidContact, skippedDuplicateContact }
}

export function classifyCampaignMarketingEmails(
  candidates: CandidateCustomer[],
  consented: ReadonlySet<string>,
  rawById: ReadonlyMap<string, { email: string | null; name: string | null }>,
): MarketingContactResolution {
  const contacts: MarketingContact[] = []
  const emails = new Set<string>()
  let skippedNoMarketingConsent = 0
  let skippedInvalidContact = 0
  let skippedDuplicateContact = 0
  for (const candidate of candidates) {
    if (!consented.has(candidate.customerId)) {
      skippedNoMarketingConsent += 1
      continue
    }
    const raw = rawById.get(candidate.customerId)
    const email = normalizeCampaignEmail(raw?.email)
    if (!raw || !email) {
      skippedInvalidContact += 1
      continue
    }
    if (emails.has(email)) {
      skippedDuplicateContact += 1
      continue
    }
    emails.add(email)
    contacts.push({ customerId: candidate.customerId, name: raw.name ?? candidate.name, recipient: email })
  }
  return { contacts, skippedNoMarketingConsent, skippedInvalidContact, skippedDuplicateContact }
}

async function resolveCampaignAudience(
  restaurantId: string,
  input: CampaignAudienceInput,
  channel: CampaignChannel,
): Promise<ResolvedAudience> {
  const candidateResult = await resolveCandidateCustomers(restaurantId, input)
  const contactResult = await fetchMarketingContacts(restaurantId, candidateResult.candidates, channel)
  return { ...candidateResult, ...contactResult, channel }
}

function previewFromAudience(audience: ResolvedAudience): CampaignAudiencePreview {
  return {
    channel: audience.channel,
    totalCandidates: audience.candidates.length,
    eligibleRecipients: audience.contacts.length,
    skippedNoMarketingConsent: audience.skippedNoMarketingConsent,
    skippedInvalidContact: audience.skippedInvalidContact,
    skippedDuplicateContact: audience.skippedDuplicateContact,
    segmentLabel: audience.segmentLabel,
  }
}

export async function previewCampaignAudience(
  restaurantId: string,
  channel: CampaignChannel,
  input: CampaignAudienceInput,
): Promise<CampaignAudiencePreview> {
  return previewFromAudience(await resolveCampaignAudience(restaurantId, input, channel))
}

export async function listCampaignAudienceContacts(
  restaurantId: string,
  input: CampaignAudienceInput,
  limit = 200,
): Promise<CampaignAudienceContactPage> {
  const audience = await resolveCampaignAudience(restaurantId, input, 'email')
  const boundedLimit = Math.min(500, Math.max(1, Math.floor(limit)))
  return {
    contacts: audience.contacts.slice(0, boundedLimit).map((contact) => ({
      customerId: contact.customerId,
      name: contact.name,
      email: contact.recipient,
    })),
    totalEligible: audience.contacts.length,
    truncated: audience.contacts.length > boundedLimit,
  }
}

const DELIVERY_STATUSES: CampaignEmailDeliveryStatus[] = [
  'pending', 'processing', 'accepted', 'delivered', 'delayed', 'opened', 'clicked',
  'bounced', 'complained', 'suppressed', 'failed',
]

export async function getCampaignDeliveryLog(
  restaurantId: string,
  campaignId: string,
  limit = 500,
): Promise<CampaignDeliveryLog | null> {
  const campaign = await getCampaignById(restaurantId, campaignId)
  if (!campaign || campaign.channel !== 'email') return null
  const db = serviceDb()
  const boundedLimit = Math.min(1_000, Math.max(1, Math.floor(limit)))
  const { data, error, count } = await db
    .from('campaign_recipients')
    .select('id, customer_id, email, status, delivery_status, provider_message_id, sent_at, last_event_at, opened_at, clicked_at, error', { count: 'exact' })
    .eq('restaurant_id', restaurantId)
    .eq('campaign_id', campaignId)
    .order('created_at', { ascending: true })
    .limit(boundedLimit)
  if (error) throw new Error(`campaign delivery log failed: ${error.message}`)
  const rows = (data ?? []) as Array<{
    id: string
    customer_id: string
    email: string | null
    status: string
    delivery_status: string | null
    provider_message_id: string | null
    sent_at: string | null
    last_event_at: string | null
    opened_at: string | null
    clicked_at: string | null
    error: string | null
  }>
  const names = new Map<string, string | null>()
  const customerIds = Array.from(new Set(rows.map((row) => row.customer_id)))
  for (const part of chunk(customerIds, 500)) {
    const result = await db.from('customers').select('id, name').in('id', part)
    if (result.error) throw new Error(`campaign delivery customer lookup failed: ${result.error.message}`)
    for (const customer of (result.data ?? []) as Array<{ id: string; name: string | null }>) names.set(customer.id, customer.name)
  }
  const total = Number(count ?? rows.length)
  return {
    campaignId,
    campaignName: campaign.name,
    subject: campaign.subject,
    recipients: rows.map((row) => {
      const projected = row.delivery_status ?? (row.status === 'sent' ? 'accepted' : row.status)
      const status = DELIVERY_STATUSES.includes(projected as CampaignEmailDeliveryStatus)
        ? projected as CampaignEmailDeliveryStatus
        : 'failed'
      return {
        id: row.id,
        customerId: row.customer_id,
        name: names.get(row.customer_id) ?? null,
        email: row.email ?? '',
        status,
        providerMessageId: row.provider_message_id,
        sentAt: row.sent_at,
        lastEventAt: row.last_event_at,
        openedAt: row.opened_at,
        clickedAt: row.clicked_at,
        error: row.error,
      }
    }),
    total,
    truncated: total > rows.length,
  }
}

type SavedCampaignEmailTemplateRow = {
  id: string
  restaurant_id: string
  name: string
  subject: string
  design: unknown
  created_at: string
  updated_at: string
}

function savedEmailTemplateFromRow(row: SavedCampaignEmailTemplateRow): SavedCampaignEmailTemplate {
  return {
    id: row.id,
    restaurantId: row.restaurant_id,
    name: row.name,
    subject: row.subject,
    design: normalizeCampaignEmailDesign(row.design),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function listCampaignEmailTemplates(restaurantId: string): Promise<SavedCampaignEmailTemplate[]> {
  const { data, error } = await serviceDb()
    .from('campaign_email_templates')
    .select('id, restaurant_id, name, subject, design, created_at, updated_at')
    .eq('restaurant_id', restaurantId)
    .is('deleted_at', null)
    .order('updated_at', { ascending: false })
    .limit(50)
  if (error) throw new Error(`email template list failed: ${error.message}`)
  return ((data ?? []) as SavedCampaignEmailTemplateRow[]).map(savedEmailTemplateFromRow)
}

export async function saveCampaignEmailTemplate(input: {
  id?: string | null
  restaurantId: string
  name: string
  subject: string
  design: CampaignEmailDesign
  createdBy: string
}): Promise<SavedCampaignEmailTemplate> {
  const name = input.name.replace(/\s+/g, ' ').trim().slice(0, 80)
  const subject = sanitizeCampaignSubject(input.subject)
  if (!name) throw new Error('invalid_template_name')
  const payload = {
    restaurant_id: input.restaurantId,
    name,
    subject,
    design: normalizeCampaignEmailDesign(input.design) as unknown as Json,
    created_by: input.createdBy,
    deleted_at: null,
  }
  const query = input.id
    ? serviceDb().from('campaign_email_templates').update(payload).eq('id', input.id).eq('restaurant_id', input.restaurantId).is('deleted_at', null)
    : serviceDb().from('campaign_email_templates').insert(payload)
  const { data, error } = await query
    .select('id, restaurant_id, name, subject, design, created_at, updated_at')
    .maybeSingle()
  if (error || !data) throw new Error(`email template save failed: ${error?.message ?? 'not found'}`)
  return savedEmailTemplateFromRow(data as SavedCampaignEmailTemplateRow)
}

export async function deleteCampaignEmailTemplate(restaurantId: string, templateId: string): Promise<boolean> {
  const { data, error } = await serviceDb()
    .from('campaign_email_templates')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', templateId)
    .eq('restaurant_id', restaurantId)
    .is('deleted_at', null)
    .select('id')
    .maybeSingle()
  if (error) throw new Error(`email template delete failed: ${error.message}`)
  return Boolean(data)
}

export async function listCampaigns(restaurantId: string, limit = 12): Promise<CampaignSummary[]> {
  const db = serviceDb()
  const queryLimit = Math.min(50, Math.max(1, Math.floor(limit)))
  const { data, error } = await db
    .from('campaigns')
    .select('id, restaurant_id, name, channel, subject, message_body, content_mode, template_id, email_design, segment_kind, builtin_segment, custom_segment_id, status, recipient_count, sent_count, failed_count, skipped_count, sent_at, created_at')
    .eq('restaurant_id', restaurantId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(queryLimit)
  if (error?.code === '42703') {
    const legacy = await db
      .from('campaigns')
      .select('id, restaurant_id, name, message_body, segment_kind, builtin_segment, custom_segment_id, status, recipient_count, sent_count, failed_count, skipped_count, sent_at, created_at')
      .eq('restaurant_id', restaurantId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(queryLimit)
    if (legacy.error) throw new Error(`listCampaigns: ${legacy.error.message}`)
    return ((legacy.data ?? []) as Array<Omit<CampaignRow, 'channel' | 'subject' | 'content_mode' | 'template_id' | 'email_design'>>)
      .map((row) => campaignFromRow({ ...row, channel: 'sms', subject: null, content_mode: 'plain', template_id: null, email_design: null }))
  }
  if (error) throw new Error(`listCampaigns: ${error.message}`)
  return ((data ?? []) as CampaignRow[]).map(campaignFromRow)
}

export async function getCampaignById(restaurantId: string, campaignId: string): Promise<CampaignSummary | null> {
  const db = serviceDb()
  const { data, error } = await db
    .from('campaigns')
    .select('id, restaurant_id, name, channel, subject, message_body, content_mode, template_id, email_design, segment_kind, builtin_segment, custom_segment_id, status, recipient_count, sent_count, failed_count, skipped_count, sent_at, created_at')
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
  if (!getSmsDeliveryAvailability().enabled) return { ok: false, error: 'SMS gönderimi henüz etkin değil' }

  const db = serviceDb()
  try {
    const provider = getSmsProvider()
    const sent = await provider.send(phone, message, { purpose: 'test', restaurantId: params.restaurantId })
    await db.from('message_events').insert({
      restaurant_id: params.restaurantId,
      channel: 'sms',
      event_type: 'test_sent',
      phone: null,
      provider: sent.provider,
      provider_message_id: sent.messageId ?? null,
      created_by: params.createdBy,
      metadata: { purpose: 'test' } satisfies Json,
    })
    return { ok: true, ...(sent.messageId ? { messageId: sent.messageId } : {}) }
  } catch (err) {
    const error = smsFailureCode(err)
    await db.from('message_events').insert({
      restaurant_id: params.restaurantId,
      channel: 'sms',
      event_type: 'test_failed',
      phone: null,
      provider: 'unavailable',
      error,
      created_by: params.createdBy,
      metadata: { purpose: 'test' } satisfies Json,
    })
    return { ok: false, error: err instanceof SmsDeliveryUnavailableError ? err.message : 'Test SMS gönderilemedi' }
  }
}

function smsFailureCode(error: unknown): string {
  if (error instanceof SmsDeliveryUnavailableError) return 'configuration_unavailable'
  return 'provider_failure'
}

function campaignFailureCode(error: unknown): string {
  if (error instanceof SmsDeliveryUnavailableError || error instanceof CampaignEmailDeliveryUnavailableError) return 'configuration_unavailable'
  if (error instanceof Error && error.message === 'provider_rejected') return 'provider_rejected'
  return 'provider_failure'
}

function campaignRequestFingerprint(input: {
  restaurantId: string
  channel: CampaignChannel
  name: string
  subject: string | null
  message: string
  contentMode: CampaignEmailContentMode
  templateId: CampaignEmailTemplateId | null
  emailDesign: CampaignEmailDesign | null
  audience: ResolvedAudience['normalized']
}): string {
  return createHash('sha256').update(JSON.stringify({
    restaurantId: input.restaurantId,
    channel: input.channel,
    name: input.name,
    subject: input.subject,
    message: input.message,
    contentMode: input.contentMode,
    templateId: input.templateId,
    emailDesign: input.emailDesign,
    segmentKind: input.audience.segmentKind,
    builtinSegment: input.audience.builtinSegment,
    customSegmentId: input.audience.customSegmentId,
  })).digest('hex')
}

function safeQueueError(error: { code?: string; message?: string } | null): string {
  if (error?.code === 'GL001') return 'İstek kimliği farklı bir kampanya için kullanılmış'
  if (error?.code === '42501') return 'Kampanya alıcıları işletmeyle eşleşmiyor'
  if (error?.code === '22023') return 'Gönderim anında uygun kampanya alıcısı kalmadı'
  return 'Kampanya kuyruğa alınamadı'
}

export async function sendCampaign(params: {
  restaurantId: string
  requestId: string
  channel: CampaignChannel
  name: string
  subject: string | null
  message: string
  contentMode: CampaignEmailContentMode
  templateId: CampaignEmailTemplateId | null
  emailDesign: CampaignEmailDesign | null
  audience: CampaignAudienceInput
  createdBy: string
}): Promise<SendCampaignResult> {
  const name = sanitizeCampaignName(params.name, new Date(), params.channel)
  const subject = params.channel === 'email' ? sanitizeCampaignSubject(params.subject ?? '') : null
  const emailContent = normalizeCampaignEmailContent({
    contentMode: params.contentMode,
    templateId: params.templateId,
  })
  const emailDesign = params.channel === 'email' && emailContent.contentMode === 'builder'
    ? normalizeCampaignEmailDesign(params.emailDesign)
    : null
  const message = params.channel === 'email' && emailContent.contentMode === 'html'
    ? sanitizeCampaignHtml(params.message)
    : sanitizeCampaignMessage(params.message, params.channel)
  if (message.length < 5) return { ok: false, error: 'Mesaj çok kısa' }
  if (params.channel === 'email' && !subject) return { ok: false, error: 'E-posta konusu gerekli' }
  if (params.channel === 'email' && !getCampaignEmailDeliveryAvailability().enabled) return { ok: false, error: 'E-posta gönderimi yapılandırılmadı' }
  if (params.channel === 'sms' && !getSmsDeliveryAvailability().enabled) return { ok: false, error: 'SMS gönderimi henüz etkin değil' }

  const audience = await resolveCampaignAudience(params.restaurantId, params.audience, params.channel)
  const preview = previewFromAudience(audience)
  if (preview.eligibleRecipients === 0) {
    return { ok: false, error: 'Marketing izni açık alıcı yok', preview }
  }

  const db = serviceDb()
  const queueFunction = params.channel === 'email'
    ? 'queue_email_campaign_delivery_v2_atomic'
    : 'queue_marketing_campaign_delivery_atomic'
  const queueArgs = {
    p_request_id: params.requestId,
    p_request_fingerprint: campaignRequestFingerprint({
      restaurantId: params.restaurantId,
      channel: params.channel,
      name,
      subject,
      message,
      contentMode: params.channel === 'email' ? emailContent.contentMode : 'plain',
      templateId: params.channel === 'email' ? emailContent.templateId : null,
      emailDesign,
      audience: audience.normalized,
    }),
    p_restaurant_id: params.restaurantId,
    p_channel: params.channel,
    p_name: name,
    p_subject: subject,
    p_message_body: message,
    p_segment_kind: audience.normalized.segmentKind,
    p_builtin_segment: audience.normalized.builtinSegment,
    p_custom_segment_id: audience.normalized.customSegmentId,
    p_segment_definition: audience.definition as unknown as Json,
    p_created_by: params.createdBy,
    p_contacts: audience.candidates.map((candidate) => ({ customerId: candidate.customerId })) as unknown as Json,
    p_segment_label: audience.segmentLabel,
    ...(params.channel === 'email' ? {
      p_content_mode: emailContent.contentMode,
      p_template_id: emailContent.templateId,
      p_email_design: emailDesign as unknown as Json,
    } : {}),
  }
  const { data: queueRows, error: queueError } = await db.rpc(queueFunction, queueArgs)
  const queue = ((queueRows ?? []) as Array<{
    campaign_id: string
    replayed: boolean
    recipient_count: number
    skipped_consent_count: number
    skipped_contact_count: number
    skipped_duplicate_count: number
  }>)[0]
  if (queueError || !queue?.campaign_id) {
    return { ok: false, error: safeQueueError(queueError), preview }
  }

  const campaign = await getCampaignById(params.restaurantId, queue.campaign_id)
  if (!campaign) return { ok: false, error: 'Kampanya oluşturulamadı', preview }
  const authoritativePreview: CampaignAudiencePreview = {
    channel: params.channel,
    totalCandidates: queue.recipient_count + queue.skipped_consent_count + queue.skipped_contact_count + queue.skipped_duplicate_count,
    eligibleRecipients: queue.recipient_count,
    skippedNoMarketingConsent: queue.skipped_consent_count,
    skippedInvalidContact: queue.skipped_contact_count,
    skippedDuplicateContact: queue.skipped_duplicate_count,
    segmentLabel: preview.segmentLabel,
  }
  return { ok: true, campaign, preview: authoritativePreview, replayed: queue.replayed }
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

  const smsProvider = campaign.channel === 'sms' ? getSmsProvider() : null
  let emailIdentity: ReturnType<typeof readCampaignEmailIdentity> | null = null
  if (campaign.channel === 'email') {
    const { data: restaurant, error: restaurantError } = await db
      .from('restaurants')
      .select('name, settings')
      .eq('id', input.restaurantId)
      .is('deleted_at', null)
      .maybeSingle()
    if (restaurantError || !restaurant) throw new Error('Campaign restaurant identity unavailable')
    emailIdentity = readCampaignEmailIdentity(restaurant.name, restaurant.settings)
  }
  for (;;) {
    const { data, error } = await db.rpc('claim_campaign_recipient', {
      p_campaign_id: input.campaignId,
      p_restaurant_id: input.restaurantId,
    })
    if (error) throw new Error(`campaign recipient claim failed: ${error.message}`)
    const recipient = ((data ?? []) as Array<{ id: string; phone: string | null; email: string | null }>)[0]
    if (!recipient) break

    let success = false
    let providerName = campaign.channel === 'email' ? 'resend' : (smsProvider?.name ?? 'unavailable')
    let providerMessageId: string | null = null
    let deliveryError: string | null = null
    try {
      const sent = campaign.channel === 'email'
        ? await sendCampaignEmail({
            to: recipient.email ?? '',
            subject: campaign.subject ?? '',
            message: campaign.messageBody,
            html: renderCampaignEmail({
              contentMode: campaign.contentMode,
              templateId: campaign.templateId,
              content: campaign.messageBody,
              restaurantName: emailIdentity!.senderName,
              emailDesign: campaign.emailDesign,
            }),
            senderName: emailIdentity!.senderName,
            replyTo: emailIdentity!.replyTo,
          })
        : await smsProvider!.send(recipient.phone ?? '', campaign.messageBody, {
            purpose: 'campaign',
            restaurantId: input.restaurantId,
            campaignId: input.campaignId,
          })
      success = true
      providerName = sent.provider
      providerMessageId = sent.messageId ?? null
    } catch (cause) {
      deliveryError = campaignFailureCode(cause)
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

export async function recordResendCampaignEvent(input: {
  webhookId: string
  providerMessageId: string
  eventType: 'sent' | 'delivered' | 'delivery_delayed' | 'opened' | 'clicked' | 'bounced' | 'complained' | 'suppressed' | 'failed'
  occurredAt: string
}): Promise<boolean> {
  const occurredAt = new Date(input.occurredAt)
  if (Number.isNaN(occurredAt.getTime())) throw new Error('invalid_resend_event_time')
  const { data, error } = await serviceDb().rpc('record_resend_campaign_event', {
    p_webhook_id: input.webhookId,
    p_provider_message_id: input.providerMessageId,
    p_event_type: input.eventType,
    p_occurred_at: occurredAt.toISOString(),
  })
  if (error) throw new Error(`record Resend campaign event failed: ${error.message}`)
  return data === true
}
