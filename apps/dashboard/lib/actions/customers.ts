'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { assertAccess, getUserRestaurantAccess } from '../auth/access'
import {
  addCustomerNote,
  createCustomerSegment as createCustomerSegmentCommand,
  deductCustomerPoints,
  deleteCustomerNote,
  deleteCustomerSegment as deleteCustomerSegmentCommand,
  grantCustomerStoreCredit,
  readCustomerDetail,
  readCustomerNotes,
  readCustomerSegmentCounts,
  readCustomerSegments,
  readCustomerTimeline,
  readCustomers,
  revealCustomerContact,
  updateCustomerSegment as updateCustomerSegmentCommand,
} from '@garsonless/application/customers'
import { readCampaigns } from '@garsonless/application/campaigns'
import {
  createCampaignApplicationPort,
  createCustomerApplicationPort,
  listCampaignEmailTemplates,
} from '@garsonless/db/server'
import type {
  CampaignSummary,
  SavedCampaignEmailTemplate,
} from '@garsonless/domain/campaigns'
import type {
  CustomerContactReveal,
  CustomerNote,
  RestaurantCustomerDetail,
  RestaurantCustomersPage,
  CustomerSegmentCounts,
  CustomerTimelinePage,
  CustomerSort,
  CustomerSegment,
  CustomerSegmentDefinition,
  SavedCustomerSegment,
} from '@garsonless/domain/customers'

// Every customer action resolves owner OR an active member with the customers
// section before constructing a trusted application actor. CRM data is
// service-role-only, so both this adapter gate and the application tenant /
// permission check intentionally run before the DB port can expose PII.
async function assertCustomerAccess(restaurantId: string): Promise<{ userId: string } | { error: string }> {
  return assertAccess(restaurantId, 'customers')
}

async function getCustomerActor(restaurantId: string) {
  const [gate, access] = await Promise.all([
    assertCustomerAccess(restaurantId),
    getUserRestaurantAccess(restaurantId),
  ])
  if ('error' in gate) return gate
  if (!access) return { error: 'Not authorized' }
  return {
    actor: 'dashboard-member' as const,
    restaurantId,
    userId: gate.userId,
    permissions: ['customers'],
    isOwner: access.isOwner,
  }
}

const SORTS: CustomerSort[] = ['last_seen', 'spend', 'visits', 'points', 'joined']
const SEGMENTS: CustomerSegment[] = ['new', 'frequent', 'lapsed', 'consented']

export interface ListCustomersInput {
  search?: string
  segment?: string | null
  customSegmentId?: string | null
  sort?: string
  page?: number
}

export async function listCustomers(
  restaurantId: string,
  input: ListCustomersInput = {},
): Promise<{ error: string } | RestaurantCustomersPage> {
  const actor = await getCustomerActor(restaurantId)
  if ('error' in actor) return actor
  const sort = (SORTS as string[]).includes(input.sort ?? '') ? (input.sort as CustomerSort) : 'last_seen'
  const segment = (SEGMENTS as string[]).includes(input.segment ?? '') ? (input.segment as CustomerSegment) : null
  const customSegmentId = input.customSegmentId?.trim() || null
  if (customSegmentId) {
    if (!z.string().uuid().safeParse(customSegmentId).success) return { error: 'Geçersiz segment' }
  }
  const result = await readCustomers(actor, {
    restaurantId,
    sort,
    segment,
    customSegmentId,
    page: Math.max(1, Math.floor(input.page ?? 1)),
    pageSize: 25,
    ...(input.search?.trim() ? { search: input.search.trim() } : {}),
  }, createCustomerApplicationPort())
  if (!result.ok) {
    return { error: result.error === 'Segment bulunamadı' ? result.error : 'Müşteriler yüklenemedi' }
  }
  return result.value
}

export interface CustomerPageSupportData {
  segmentCounts: CustomerSegmentCounts
  segments: SavedCustomerSegment[]
  campaigns: CampaignSummary[]
  emailTemplates: SavedCampaignEmailTemplate[]
}

/** Secondary CRM data intentionally stays outside the route's critical path.
 * The customer list can paint first while these independent aggregates and
 * campaign tools load in one authenticated round trip. */
export async function loadCustomerPageSupportAction(
  restaurantId: string,
): Promise<{ error: string } | CustomerPageSupportData> {
  const actor = await getCustomerActor(restaurantId)
  if ('error' in actor) return actor

  const customerPort = createCustomerApplicationPort()
  try {
    const [counts, segments, campaigns, emailTemplates] = await Promise.all([
      readCustomerSegmentCounts(actor, restaurantId, customerPort),
      readCustomerSegments(actor, restaurantId, customerPort),
      actor.isOwner
        ? readCampaigns(actor, { restaurantId }, createCampaignApplicationPort())
        : Promise.resolve({ ok: true as const, value: [] }),
      actor.isOwner ? listCampaignEmailTemplates(restaurantId) : Promise.resolve([]),
    ])
    if (!counts.ok || !segments.ok || !campaigns.ok) {
      return { error: 'Müşteri özetleri yüklenemedi' }
    }
    return {
      segmentCounts: counts.value,
      segments: segments.value,
      campaigns: campaigns.value,
      emailTemplates,
    }
  } catch {
    return { error: 'Müşteri özetleri yüklenemedi' }
  }
}

export async function loadCustomerTimelineAction(
  restaurantId: string,
  customerId: string,
  cursor: string,
): Promise<{ error: string } | CustomerTimelinePage> {
  const actor = await getCustomerActor(restaurantId)
  if ('error' in actor) return actor
  if (!z.string().uuid().safeParse(customerId).success || !cursor || cursor.length > 512) {
    return { error: 'Geçersiz hareket isteği' }
  }
  const result = await readCustomerTimeline(actor, {
    restaurantId,
    customerId,
    cursor,
  }, createCustomerApplicationPort())
  if (!result.ok || !result.value) return { error: 'Müşteri hareketleri yüklenemedi' }
  return result.value
}

export interface CustomerProfileData {
  detail: RestaurantCustomerDetail
  notes: CustomerNote[]
}

/** The profile side panel: detail and team notes in one authenticated round trip. */
export async function loadCustomerProfileAction(
  restaurantId: string,
  customerId: string,
): Promise<{ error: string } | CustomerProfileData> {
  const actor = await getCustomerActor(restaurantId)
  if ('error' in actor) return actor
  if (!z.string().uuid().safeParse(customerId).success) return { error: 'Müşteri bulunamadı' }
  const port = createCustomerApplicationPort()
  const [detail, notes] = await Promise.all([
    readCustomerDetail(actor, { restaurantId, customerId }, port),
    readCustomerNotes(actor, { restaurantId, customerId }, port),
  ])
  if (!detail.ok || !notes.ok) return { error: 'Müşteri profili yüklenemedi' }
  if (!detail.value) return { error: 'Müşteri bulunamadı' }
  return { detail: detail.value, notes: notes.value }
}

/** Owner-only. Each successful reveal writes an audit row before the details leave the server. */
export async function revealCustomerContactAction(
  restaurantId: string,
  customerId: string,
): Promise<{ error: string } | CustomerContactReveal> {
  const actor = await getCustomerActor(restaurantId)
  if ('error' in actor) return actor
  if (!z.string().uuid().safeParse(customerId).success) return { error: 'Müşteri bulunamadı' }
  const result = await revealCustomerContact(actor, { restaurantId, customerId }, createCustomerApplicationPort())
  if (!result.ok) return { error: result.error === 'Not authorized' ? 'İletişim bilgilerini yalnızca işletme sahibi görebilir' : 'İletişim bilgisi gösterilemedi' }
  if (!result.value) return { error: 'Müşteri bulunamadı' }
  return result.value
}

const pointsAdjustmentSchema = z.object({
  customerId: z.string().uuid(),
  requestId: z.string().uuid(),
  points: z.number().int().positive().max(1_000_000),
  reason: z.string().trim().min(1, 'Bir sebep yazın').max(80, 'Sebep en fazla 80 karakter olabilir'),
})

type PointsAdjustmentRequest = { customerId: string; requestId: string; points: number; reason: string }

function revalidateCustomer(restaurantId: string, customerId: string) {
  revalidatePath(`/dashboard/${restaurantId}/customers/${customerId}`)
  revalidatePath(`/dashboard/${restaurantId}/customers`)
}

export async function grantStoreCreditAction(
  restaurantId: string,
  request: PointsAdjustmentRequest,
): Promise<{ error: string } | { success: true; granted: number; replayed: boolean }> {
  const actor = await getCustomerActor(restaurantId)
  if ('error' in actor) return actor
  const parsed = pointsAdjustmentSchema.safeParse(request)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Geçersiz puan miktarı' }

  const res = await grantCustomerStoreCredit(actor, { restaurantId, ...parsed.data }, createCustomerApplicationPort())
  if (!res.ok) return { error: res.error }
  revalidateCustomer(restaurantId, parsed.data.customerId)
  return { success: true, granted: res.value.granted, replayed: res.value.replayed }
}

export async function deductCustomerPointsAction(
  restaurantId: string,
  request: PointsAdjustmentRequest,
): Promise<{ error: string } | { success: true; deducted: number; replayed: boolean }> {
  const actor = await getCustomerActor(restaurantId)
  if ('error' in actor) return actor
  const parsed = pointsAdjustmentSchema.safeParse(request)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Geçersiz puan miktarı' }

  const res = await deductCustomerPoints(actor, { restaurantId, ...parsed.data }, createCustomerApplicationPort())
  if (!res.ok) return { error: res.error }
  revalidateCustomer(restaurantId, parsed.data.customerId)
  return { success: true, deducted: res.value.deducted, replayed: res.value.replayed }
}

export async function addCustomerNoteAction(
  restaurantId: string,
  customerId: string,
  body: string,
): Promise<{ error: string } | CustomerNote> {
  const actor = await getCustomerActor(restaurantId)
  if ('error' in actor) return actor
  if (!z.string().uuid().safeParse(customerId).success || typeof body !== 'string') return { error: 'Geçersiz not' }
  const result = await addCustomerNote(actor, { restaurantId, customerId, body }, createCustomerApplicationPort())
  return result.ok ? result.value : { error: result.error === 'Not authorized' ? 'Bu işlem için yetkiniz yok' : result.error }
}

export async function deleteCustomerNoteAction(
  restaurantId: string,
  customerId: string,
  noteId: string,
): Promise<{ error: string } | { success: true }> {
  const actor = await getCustomerActor(restaurantId)
  if ('error' in actor) return actor
  if (!z.string().uuid().safeParse(customerId).success) return { error: 'Geçersiz not' }
  const result = await deleteCustomerNote(actor, { restaurantId, customerId, noteId }, createCustomerApplicationPort())
  if (!result.ok) return { error: 'Not silinemedi' }
  if (!result.value) return { error: 'Bu notu yalnızca yazan kişi ya da işletme sahibi silebilir' }
  return { success: true }
}

const opSchema = z.enum(['>=', '<='])
const numericRuleSchema = z.object({
  op: opSchema,
  value: z.number().nonnegative().max(10_000_000),
})
const segmentDefinitionSchema = z.object({
  consent: z.enum(['granted', 'missing']).optional(),
  last_seen_days: numericRuleSchema.optional(),
  visits: numericRuleSchema.optional(),
  spend: numericRuleSchema.optional(),
  points: numericRuleSchema.optional(),
  lifetime_points: numericRuleSchema.optional(),
}).strict()
const segmentInputSchema = z.object({
  name: z.string().trim().min(1).max(60),
  definition: segmentDefinitionSchema,
})

export async function createCustomerSegmentAction(
  restaurantId: string,
  input: { name: string; definition: CustomerSegmentDefinition },
): Promise<{ error: string } | SavedCustomerSegment> {
  const actor = await getCustomerActor(restaurantId)
  if ('error' in actor) return actor
  const parsed = segmentInputSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Geçersiz segment' }
  const segment = await createCustomerSegmentCommand(actor, {
    restaurantId,
    name: parsed.data.name,
    definition: parsed.data.definition,
  }, createCustomerApplicationPort())
  if (!segment.ok) return { error: 'Segment kaydedilemedi' }
  revalidatePath(`/dashboard/${restaurantId}/customers`)
  return segment.value
}

export async function updateCustomerSegmentAction(
  restaurantId: string,
  segmentId: string,
  input: { expectedUpdatedAt: string; name: string; definition: CustomerSegmentDefinition },
): Promise<{ error: string; code?: 'conflict' } | SavedCustomerSegment> {
  const actor = await getCustomerActor(restaurantId)
  if ('error' in actor) return actor
  if (!z.string().uuid().safeParse(segmentId).success) return { error: 'Geçersiz segment' }
  const parsed = segmentInputSchema.extend({ expectedUpdatedAt: z.string().datetime({ offset: true }) }).safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Geçersiz segment' }
  const segment = await updateCustomerSegmentCommand(actor, {
    restaurantId,
    segmentId,
    expectedUpdatedAt: parsed.data.expectedUpdatedAt,
    name: parsed.data.name,
    definition: parsed.data.definition,
  }, createCustomerApplicationPort())
  if (!segment.ok) return segment.error.includes('customer_segment_conflict')
    ? { code: 'conflict', error: 'Segment başka bir oturumda değiştirildi veya silindi. Taslağınız korundu. Güncel sürümü açmak için düzenlemeyi kapatıp yeniden açın.' }
    : { error: 'Segment güncellenemedi' }
  if (!segment.value) return { error: 'Segment bulunamadı' }
  revalidatePath(`/dashboard/${restaurantId}/customers`)
  return segment.value
}

export async function deleteCustomerSegmentAction(
  restaurantId: string,
  segmentId: string,
): Promise<{ error: string } | { success: true }> {
  const actor = await getCustomerActor(restaurantId)
  if ('error' in actor) return actor
  if (!z.string().uuid().safeParse(segmentId).success) return { error: 'Geçersiz segment' }
  const deleted = await deleteCustomerSegmentCommand(actor, {
    restaurantId,
    segmentId,
  }, createCustomerApplicationPort())
  if (!deleted.ok) return { error: 'Segment silinemedi' }
  if (!deleted.value) return { error: 'Segment bulunamadı' }
  revalidatePath(`/dashboard/${restaurantId}/customers`)
  return { success: true }
}
