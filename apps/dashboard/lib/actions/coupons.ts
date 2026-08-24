'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import {
  archiveRestaurantCoupon,
  listActivePublicCoupons,
  listRestaurantCoupons,
  saveRestaurantCoupon,
  restoreRestaurantCoupon,
} from '@garsonless/db/server'
import { assertOwner, assertRestaurantFeature } from '../auth/access'
import { createDashboardServerClient } from '../supabase-server'

const nullablePositiveInt = z.number().int().positive().nullable()
const couponSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(80),
  code: z.string().trim().min(3).max(32),
  enabled: z.boolean(),
  discountType: z.enum(['percentage', 'fixed']),
  discountValue: z.number().positive().max(100000),
  scope: z.enum(['order', 'category', 'product']),
  minimumAmount: z.number().min(0).max(1000000),
  maximumDiscountAmount: z.number().positive().max(1000000).nullable(),
  startsAt: z.string().datetime().nullable(),
  endsAt: z.string().datetime().nullable(),
  totalUsageLimit: nullablePositiveInt,
  perCustomerLimit: nullablePositiveInt,
  audience: z.enum(['everyone', 'members', 'first_order']),
  stackingPolicy: z.enum(['exclusive', 'combine_loyalty']),
  marketingLabel: z.string().max(60).nullable(),
  marketingDescription: z.string().max(160).nullable(),
  categoryIds: z.array(z.string().uuid()).max(100),
  itemIds: z.array(z.string().uuid()).max(200),
  expectedUpdatedAt: z.string().datetime().nullable().optional(),
})

async function gate(restaurantId: string) {
  const owner = await assertOwner(restaurantId)
  if ('error' in owner) return owner
  const feature = await assertRestaurantFeature(restaurantId, 'loyalty')
  return 'error' in feature ? { error: 'Kuponlar Pro sadakat özelliğiyle kullanılabilir.' } : { success: true as const }
}

export async function getRestaurantCoupons(restaurantId: string) {
  const access = await gate(restaurantId)
  if ('error' in access) return access
  try { return { coupons: await listRestaurantCoupons(restaurantId) } }
  catch { return { error: 'Kuponlar yüklenemedi.' } }
}

export async function getActiveCouponChoices(restaurantId: string) {
  const owner = await assertOwner(restaurantId)
  if ('error' in owner) return owner
  try { return { coupons: await listActivePublicCoupons(restaurantId) } }
  catch { return { error: 'Aktif kuponlar yüklenemedi.' } }
}

export async function getCouponEditorChoices(restaurantId: string) {
  const access = await gate(restaurantId)
  if ('error' in access) return access
  const db = await createDashboardServerClient()
  const [{ data: categories }, { data: items }] = await Promise.all([
    db.from('menu_categories').select('id, name').eq('restaurant_id', restaurantId).is('deleted_at', null).order('position'),
    db.from('menu_items').select('id, name, menu_categories!inner(restaurant_id)').eq('menu_categories.restaurant_id', restaurantId).is('deleted_at', null).order('name'),
  ])
  return {
    categories: ((categories ?? []) as unknown as Array<{ id: string; name: string }>).map((row) => ({ id: row.id, name: row.name })),
    items: ((items ?? []) as unknown as Array<{ id: string; name: string }>).map((row) => ({ id: row.id, name: row.name })),
  }
}

export async function upsertCoupon(restaurantId: string, raw: unknown) {
  const access = await gate(restaurantId)
  if ('error' in access) return access
  const parsed = couponSchema.safeParse(raw)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Kupon bilgileri geçersiz.' }
  try {
    const coupon = await saveRestaurantCoupon(restaurantId, parsed.data)
    revalidatePath(`/dashboard/${restaurantId}/settings`)
    revalidatePath(`/dashboard/${restaurantId}/theme`)
    return { success: true as const, coupon }
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Kupon kaydedilemedi.' }
  }
}

export async function archiveCoupon(restaurantId: string, couponId: string, expectedUpdatedAt: string) {
  const access = await gate(restaurantId)
  if ('error' in access) return access
  if (!z.string().uuid().safeParse(couponId).success) return { error: 'Geçersiz kupon.' }
  try {
    const archiveVersion = await archiveRestaurantCoupon(restaurantId, couponId, expectedUpdatedAt)
    revalidatePath(`/dashboard/${restaurantId}/settings`)
    revalidatePath(`/dashboard/${restaurantId}/theme`)
    return { success: true as const, archiveVersion }
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Kupon arşivlenemedi.' }
  }
}

export async function restoreCoupon(restaurantId: string, couponId: string, expectedUpdatedAt: string) {
  const access = await gate(restaurantId)
  if ('error' in access) return access
  if (!z.string().uuid().safeParse(couponId).success || !z.string().datetime().safeParse(expectedUpdatedAt).success) {
    return { error: 'Geçersiz geri alma isteği.' }
  }
  try {
    await restoreRestaurantCoupon(restaurantId, couponId, expectedUpdatedAt)
    revalidatePath(`/dashboard/${restaurantId}/settings`)
    revalidatePath(`/dashboard/${restaurantId}/theme`)
    return { success: true as const }
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Kupon geri alınamadı.' }
  }
}
