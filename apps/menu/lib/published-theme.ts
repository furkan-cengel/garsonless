import { cache } from 'react'
import { readPublishedTheme } from '@garsonless/application/themes'
import { createThemeApplicationPort } from '@garsonless/db/server'
import { listActivePublicCoupons } from '@garsonless/db/server'
import type { GarsonlessTheme } from '@garsonless/design-engine'

async function withLiveCoupons(restaurantId: string, theme: GarsonlessTheme): Promise<GarsonlessTheme> {
  const choices = await listActivePublicCoupons(restaurantId).catch(() => [])
  const byId = new Map(choices.map((coupon) => [coupon.id, coupon]))
  const settings = Object.fromEntries(Object.entries(theme.sectionSettings ?? {}).map(([instanceId, value]) => {
    const couponId = value['couponId']
    if (!couponId) return [instanceId, value]
    const coupon = byId.get(couponId)
    return [instanceId, coupon ? {
      ...value,
      couponEnabled: value['couponEnabled'] === 'false' ? 'false' : 'true',
      couponEyebrow: coupon.eyebrow,
      couponTitle: coupon.title,
      couponSubtitle: coupon.subtitle,
      couponCode: coupon.code,
    } : { ...value, couponEnabled: 'false' }]
  }))
  return { ...theme, sectionSettings: settings }
}

/**
 * The layout, metadata and page all need the same published theme. React cache
 * deduplicates the read within one request. Do not put this behind a process-local
 * Next cache: the dashboard and public menu are separate applications, so a
 * dashboard revalidation cannot reliably evict the menu application's cache.
 * Reading the small published snapshot directly makes a successful publish
 * visible on the very next QR request.
 */
export const getPublishedTheme = cache(async function getPublishedTheme(
  restaurantId: string,
) {
  const result = await readPublishedTheme({ restaurantId }, createThemeApplicationPort())
  return result.ok ? { ...result, value: { ...result.value, theme: await withLiveCoupons(restaurantId, result.value.theme) } } : result
})

/** Preview overrides are editor-scoped and must never enter the public cache. */
export const getPreviewTheme = cache(async function getPreviewTheme(
  restaurantId: string,
  templateOverride: string | null,
) {
  const result = await readPublishedTheme(
    { restaurantId, templateOverride },
    createThemeApplicationPort(),
  )
  return result.ok ? { ...result, value: { ...result.value, theme: await withLiveCoupons(restaurantId, result.value.theme) } } : result
})
