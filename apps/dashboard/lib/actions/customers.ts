'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { assertAccess } from '../auth/access'
import {
  createCustomerSegment as createCustomerSegmentCommand,
  deleteCustomerSegment as deleteCustomerSegmentCommand,
  grantCustomerStoreCredit,
  readCustomers,
  updateCustomerSegment as updateCustomerSegmentCommand,
} from '@garsonless/application/customers'
import { createCustomerApplicationPort } from '@garsonless/db/server'
import type {
  RestaurantCustomersPage,
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
  const gate = await assertCustomerAccess(restaurantId)
  if ('error' in gate) return gate
  return {
    actor: 'dashboard-member' as const,
    restaurantId,
    userId: gate.userId,
    permissions: ['customers'],
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
  const actor = await getCustomerActor(restaurantId)
  if ('error' in actor) return actor
  const parsed = grantSchema.safeParse({ points, note })
  if (!parsed.success) return { error: 'Geçersiz puan miktarı' }

  const res = await grantCustomerStoreCredit(actor, {
    restaurantId,
    customerId,
    points: parsed.data.points,
    ...(parsed.data.note ? { note: parsed.data.note } : {}),
  }, createCustomerApplicationPort())
  if (!res.ok) return { error: res.error }
  revalidatePath(`/dashboard/${restaurantId}/customers/${customerId}`)
  revalidatePath(`/dashboard/${restaurantId}/customers`)
  return { success: true, granted: res.value.granted }
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
  input: { name: string; definition: CustomerSegmentDefinition },
): Promise<{ error: string } | SavedCustomerSegment> {
  const actor = await getCustomerActor(restaurantId)
  if ('error' in actor) return actor
  if (!z.string().uuid().safeParse(segmentId).success) return { error: 'Geçersiz segment' }
  const parsed = segmentInputSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Geçersiz segment' }
  const segment = await updateCustomerSegmentCommand(actor, {
    restaurantId,
    segmentId,
    name: parsed.data.name,
    definition: parsed.data.definition,
  }, createCustomerApplicationPort())
  if (!segment.ok) return { error: 'Segment güncellenemedi' }
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
