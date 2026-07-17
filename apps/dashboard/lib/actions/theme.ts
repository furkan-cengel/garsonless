'use server'

import { revalidatePath } from 'next/cache'
import { publishRestaurantTheme } from '@garsonless/application/themes'
import { createThemeApplicationPort } from '@garsonless/db/server'
import { assertAccess } from '../auth/access'
import type { GarsonlessTheme } from '@garsonless/design-engine'

export async function publishTheme(
  restaurantId: string,
  config: GarsonlessTheme,
  templateId: string,
): Promise<{ error: string } | { success: true }> {
  const gate = await assertAccess(restaurantId, 'theme')
  if ('error' in gate) return { error: gate.error }

  const result = await publishRestaurantTheme({
    actor: 'dashboard-member',
    userId: gate.userId,
    restaurantId,
    permissions: ['theme'],
  }, {
    restaurantId,
    templateId,
    theme: config,
  }, createThemeApplicationPort())
  if (!result.ok) return { error: result.error }

  revalidatePath(`/dashboard/${restaurantId}/theme`)
  revalidatePath(`/dashboard/${restaurantId}/theme/${templateId}/edit`)
  revalidatePath(`/${result.value.slug}`)
  return { success: true }
}
