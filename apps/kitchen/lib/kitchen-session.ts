import { cookies } from 'next/headers'
import { verifyKitchenSession } from '@garsonless/db/server'

export function kitchenSessionCookieName(restaurantId: string): string {
  return `masabu_kds_${restaurantId}`
}

export async function hasValidKitchenSession(restaurantId: string): Promise<boolean> {
  const cookieStore = await cookies()
  const session = cookieStore.get(kitchenSessionCookieName(restaurantId))?.value
  return session ? verifyKitchenSession(restaurantId, session) : false
}
