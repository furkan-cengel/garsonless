'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { confirmDashboardCashShare } from '@garsonless/application/splits'
import { createSplitPaymentPort } from '@garsonless/db/server'
import { assertAccess } from '../auth/access'

const schema = z.object({
  shareId: z.string().uuid(),
  restaurantId: z.string().uuid(),
})

/**
 * Staff confirms a customer's DECLARED CASH share — physical money received.
 * THIS is the only path that makes a cash share count (RLS blocks every direct
 * customer/authenticated write to payment_shares). Gate = owner OR a member with
 * 'tables' (whoever sees the cash), mirroring settleOrder's authority. The
 * finalize inside the split repository stamps covered orders paid+'split' but leaves
 * the table open until staff close / idle sweep.
 */
export async function confirmCashShare(
  shareId: string,
  restaurantId: string,
): Promise<{ error: string } | { success: true; finalized: boolean }> {
  const parsed = schema.safeParse({ shareId, restaurantId })
  if (!parsed.success) return { error: 'Geçersiz istek' }

  const gate = await assertAccess(restaurantId, 'tables')
  if ('error' in gate) return { error: gate.error }

  const result = await confirmDashboardCashShare(
    {
      actor: 'dashboard-member',
      userId: gate.userId,
      restaurantId,
      permissions: ['tables'],
    },
    { shareId, restaurantId },
    createSplitPaymentPort(),
  )
  if (!result.ok) return { error: result.error }

  revalidatePath(`/dashboard/${restaurantId}/tables`)
  revalidatePath(`/dashboard/${restaurantId}/orders`)
  return { success: true, finalized: result.value.finalized }
}
