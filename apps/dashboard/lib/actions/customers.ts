'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { assertAccess } from '../auth/access'
import {
  getRestaurantCustomers,
  grantStoreCredit,
  getCustomerSegment,
  createCustomerSegment,
  updateCustomerSegment,
  deleteCustomerSegment,
  type RestaurantCustomersPage,
  type CustomerSort,
  type CustomerSegment,
  type CustomerSegmentDefinition,
  type SavedCustomerSegment,
} from '@garsonless/db'

// Owner gate: every customer action validates the authed user OWNS the
// restaurant (RLS-backed) BEFORE any service-role read. customers/consents are
// service-role only, so this gate is the entire authorization boundary.
// Phase 3: owner OR a member with the 'customers' section (data loads via the
// service role, so this app-layer gate — not RLS — protects customer PII).
async function assertOwner(restaurantId: string): Promise<{ userId: string } | { error: string }> {
  return assertAccess(restaurantId, 'customers')
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
  const gate = await assertOwner(restaurantId)
  if ('error' in gate) return gate
  const sort = (SORTS as string[]).includes(input.sort ?? '') ? (input.sort as CustomerSort) : 'last_seen'
  const segment = (SEGMENTS as string[]).includes(input.segment ?? '') ? (input.segment as CustomerSegment) : null
  const customSegmentId = input.customSegmentId?.trim() || null
  let customSegment: CustomerSegmentDefinition | null = null
  if (customSegmentId) {
    if (!z.string().uuid().safeParse(customSegmentId).success) return { error: 'Geçersiz segment' }
    try {
      const saved = await getCustomerSegment(restaurantId, customSegmentId)
      if (!saved) return { error: 'Segment bulunamadı' }
      customSegment = saved.definition
    } catch {
      return { error: 'Segment yüklenemedi' }
    }
  }
  try {
    return await getRestaurantCustomers(restaurantId, {
      sort,
      segment: customSegment ? null : segment,
      customSegment,
      page: Math.max(1, Math.floor(input.page ?? 1)),
      pageSize: 25,
      ...(input.search?.trim() ? { search: input.search.trim() } : {}),
    })
  } catch {
    return { error: 'Müşteriler yüklenemedi' }
  }
}

const grantSchema = z.object({
  points: z.number().int().positive().max(1_000_000),
  note: z.string().max(80).optional(),
})

export async function grantStoreCreditAction(
  restaurantId: string,
  customerId: string,
  points: number,
  note?: string,
): Promise<{ error: string } | { success: true; granted: number }> {
  const gate = await assertOwner(restaurantId)
  if ('error' in gate) return gate
  const parsed = grantSchema.safeParse({ points, note })
  if (!parsed.success) return { error: 'Geçersiz puan miktarı' }

  const res = await grantStoreCredit({
    restaurantId,
    customerId,
    points: parsed.data.points,
    grantedBy: gate.userId,
    ...(parsed.data.note ? { note: parsed.data.note } : {}),
  })
  if (!res.ok) return { error: res.error }
  revalidatePath(`/dashboard/${restaurantId}/customers/${customerId}`)
  revalidatePath(`/dashboard/${restaurantId}/customers`)
  return { success: true, granted: res.granted }
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
  const gate = await assertOwner(restaurantId)
  if ('error' in gate) return gate
  const parsed = segmentInputSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Geçersiz segment' }
  try {
    const segment = await createCustomerSegment({
      restaurantId,
      name: parsed.data.name,
      definition: parsed.data.definition,
      createdBy: gate.userId,
    })
    revalidatePath(`/dashboard/${restaurantId}/customers`)
    return segment
  } catch {
    return { error: 'Segment kaydedilemedi' }
  }
}

export async function updateCustomerSegmentAction(
  restaurantId: string,
  segmentId: string,
  input: { name: string; definition: CustomerSegmentDefinition },
): Promise<{ error: string } | SavedCustomerSegment> {
  const gate = await assertOwner(restaurantId)
  if ('error' in gate) return gate
  if (!z.string().uuid().safeParse(segmentId).success) return { error: 'Geçersiz segment' }
  const parsed = segmentInputSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Geçersiz segment' }
  try {
    const segment = await updateCustomerSegment({
      restaurantId,
      segmentId,
      name: parsed.data.name,
      definition: parsed.data.definition,
    })
    if (!segment) return { error: 'Segment bulunamadı' }
    revalidatePath(`/dashboard/${restaurantId}/customers`)
    return segment
  } catch {
    return { error: 'Segment güncellenemedi' }
  }
}

export async function deleteCustomerSegmentAction(
  restaurantId: string,
  segmentId: string,
): Promise<{ error: string } | { success: true }> {
  const gate = await assertOwner(restaurantId)
  if ('error' in gate) return gate
  if (!z.string().uuid().safeParse(segmentId).success) return { error: 'Geçersiz segment' }
  try {
    const deleted = await deleteCustomerSegment(restaurantId, segmentId)
    if (!deleted) return { error: 'Segment bulunamadı' }
    revalidatePath(`/dashboard/${restaurantId}/customers`)
    return { success: true }
  } catch {
    return { error: 'Segment silinemedi' }
  }
}
