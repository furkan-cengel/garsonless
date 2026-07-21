'use server'

import { revalidatePath } from 'next/cache'
import { publishRestaurantTheme } from '@garsonless/application/themes'
import { createThemeApplicationPort } from '@garsonless/db/server'
import { assertAccess } from '../auth/access'
import type { GarsonlessTheme } from '@garsonless/design-engine'
import {
  dashboardAccessFailure,
  dashboardActionFailure,
  type DashboardActionFailure,
} from '../server-action-error'

function dashboardThemeFailure(error: string): DashboardActionFailure {
  if (error === 'Plan feature unavailable') {
    return dashboardActionFailure('PLAN_REQUIRED', { operation: 'theme.publish' })
  }
  if (error === 'Restaurant not found') {
    return dashboardActionFailure('RESOURCE_NOT_FOUND', { operation: 'theme.publish' })
  }
  if (error === 'Invalid theme document' || error === 'Unknown theme template') {
    return dashboardActionFailure('VALIDATION_FAILED', { operation: 'theme.publish' })
  }
  return dashboardActionFailure('SERVICE_UNAVAILABLE', { operation: 'theme.publish' })
}

export async function publishTheme(
  restaurantId: string,
  config: GarsonlessTheme,
  templateId: string,
): Promise<{ error: string } | { success: true }> {
  const gate = await assertAccess(restaurantId, 'theme')
  if ('error' in gate) return dashboardAccessFailure(gate.error, 'theme.publish')

  try {
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
    if (!result.ok) return dashboardThemeFailure(result.error)

    revalidatePath(`/dashboard/${restaurantId}/theme`)
    revalidatePath(`/dashboard/${restaurantId}/theme/${templateId}/edit`)
    revalidatePath(`/${result.value.slug}`)
    return { success: true }
  } catch (error) {
    return dashboardActionFailure('SERVICE_UNAVAILABLE', {
      operation: 'theme.publish',
      cause: error,
    })
  }
}
