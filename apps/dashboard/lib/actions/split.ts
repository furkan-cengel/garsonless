'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { createServiceClient, settleShareDB } from '@garsonless/db'
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
 * finalize inside settleShareDB stamps covered orders paid+'split' but leaves
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

  // Only a DECLARED CASH share is staff-confirmable (card self-settles via İyzico).
  const svc = createServiceClient()
  const { data } = await svc
    .from('payment_shares')
    .select('method, status')
    .eq('id', shareId)
    .eq('restaurant_id', restaurantId)
    .maybeSingle()
  const share = data as { method: string | null; status: string } | null
  if (!share) return { error: 'Pay bulunamadı' }
  if (share.method !== 'cash') return { error: 'Yalnız nakit pay elle onaylanır' }
  if (share.status === 'void') return { error: 'Pay iptal edilmiş' }

  const { error, finalized } = await settleShareDB(shareId, restaurantId, { settledBy: gate.userId })
  if (error) return { error }

  revalidatePath(`/dashboard/${restaurantId}/tables`)
  revalidatePath(`/dashboard/${restaurantId}/orders`)
  return { success: true, finalized }
}
