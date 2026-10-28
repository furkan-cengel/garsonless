'use server'

import { assertAccess } from '../auth/access'
import { getPanoBusiness, getPanoSnapshot } from '../queries/pano'
import type { PanoBusinessSource } from '@garsonless/application/read-models'
import type { PanoSnapshot } from '../queries/pano'

export async function fetchPanoSnapshot(
  restaurantId: string,
): Promise<{ error: string } | { snapshot: PanoSnapshot }> {
  const gate = await assertAccess(restaurantId, 'pano')
  if ('error' in gate) return { error: gate.error }
  try {
    return { snapshot: await getPanoSnapshot(restaurantId) }
  } catch {
    return { error: 'Pano verileri alınamadı.' }
  }
}

/** The business view for the last 7 or 30 days; analytics section only. */
export async function fetchPanoBusiness(
  restaurantId: string,
  periodDays: number,
): Promise<{ error: string } | PanoBusinessSource> {
  if (periodDays !== 7 && periodDays !== 30) return { error: 'Geçersiz dönem' }
  const gate = await assertAccess(restaurantId, 'analytics')
  if ('error' in gate) return { error: gate.error }
  try {
    return await getPanoBusiness(restaurantId, periodDays)
  } catch {
    return { error: 'İşletme özeti alınamadı.' }
  }
}
