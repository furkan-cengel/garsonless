'use server'

import { createHash } from 'node:crypto'
import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import {
  cancelUnstartedSplitShare,
  confirmDashboardCashShare,
  settleProviderShare,
} from '@garsonless/application/splits'
import {
  createSplitPaymentPort,
  readIyzicoCredentialRecord,
  readShareProviderCheckout,
  voidVerifiedFailedSplitShare,
} from '@garsonless/db/server'
import { assertAccess } from '../auth/access'
import { retrieveIyzicoSplitCheckout } from '../iyzico-split-reconciliation'

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

/** Releases only a card share that never received an İyzico token. Token-bound
 * payments return provider_pending and remain untouched. */
export async function releaseUnstartedCardShare(
  shareId: string,
  restaurantId: string,
): Promise<{ error: string } | { success: true; outcome: 'voided' | 'already_resolved' | 'not_found' }> {
  const parsed = schema.safeParse({ shareId, restaurantId })
  if (!parsed.success) return { error: 'Geçersiz istek' }
  const gate = await assertAccess(restaurantId, 'tables')
  if ('error' in gate) return { error: gate.error }

  const result = await cancelUnstartedSplitShare(
    {
      actor: 'dashboard-member',
      userId: gate.userId,
      restaurantId,
      permissions: ['tables'],
    },
    { shareId, restaurantId },
    createSplitPaymentPort(),
  )
  if (!result.ok) return { error: 'Kart payı güvenli biçimde bırakılamadı. Lütfen tekrar deneyin.' }
  if (result.value === 'provider_pending') {
    return { error: 'Bu pay İyzico tarafından işleme alınmış. Sonuç doğrulanmadan kaldırılamaz.' }
  }
  revalidatePath(`/dashboard/${restaurantId}/tables`)
  return { success: true, outcome: result.value }
}

/** Reconciles a token-bound card share directly with İyzico. Only a verified
 * signed SUCCESS settles money; only a verified signed FAILURE releases it. */
export async function reconcileCardShare(
  shareId: string,
  restaurantId: string,
): Promise<{ error: string } | { success: true; outcome: 'settled' | 'voided' | 'already_resolved' }> {
  const parsed = schema.safeParse({ shareId, restaurantId })
  if (!parsed.success) return { error: 'Geçersiz istek' }
  const gate = await assertAccess(restaurantId, 'tables')
  if ('error' in gate) return { error: gate.error }

  const checkout = await readShareProviderCheckout({ shareId, restaurantId })
  if (checkout.error) return { error: 'Ödeme kaydı doğrulanamadı. Lütfen tekrar deneyin.' }
  if (!checkout.share || checkout.share.status !== 'declared') {
    return { success: true, outcome: 'already_resolved' }
  }
  if (checkout.share.method !== 'iyzico') return { error: 'Bu pay kart ödemesi değil.' }
  if (!checkout.token) {
    const released = await releaseUnstartedCardShare(shareId, restaurantId)
    return 'error' in released ? released : { success: true, outcome: released.outcome === 'voided' ? 'voided' : 'already_resolved' }
  }

  const credential = await readIyzicoCredentialRecord(restaurantId)
  if (credential.error || !credential.record) {
    return { error: 'İyzico yapılandırmasına ulaşılamadı. Ödeme kaydı değiştirilmedi.' }
  }
  const result = await retrieveIyzicoSplitCheckout({
    apiKey: credential.record.apiKey,
    secretKey: credential.record.secretKey,
    baseUrl: credential.record.mode === 'live' ? 'https://api.iyzipay.com' : 'https://sandbox-api.iyzipay.com',
    shareId,
    token: checkout.token,
    amount: checkout.share.amount,
  })
  if (result.outcome === 'unknown') {
    return { error: 'İyzico kesin bir sonuç döndürmedi. Çift tahsilatı önlemek için pay beklemede tutuldu; biraz sonra tekrar deneyin.' }
  }
  if (result.outcome === 'paid') {
    const settlement = await settleProviderShare(
      { actor: 'payment-provider', restaurantId, provider: 'iyzico' },
      { restaurantId, shareId },
      createSplitPaymentPort(),
    )
    if (!settlement.ok) return { error: 'Ödeme doğrulandı ancak adisyon güncellenemedi. Tekrar ödeme almayın; yeniden deneyin.' }
    revalidatePath(`/dashboard/${restaurantId}/tables`)
    revalidatePath(`/dashboard/${restaurantId}/orders`)
    return { success: true, outcome: 'settled' }
  }

  const voided = await voidVerifiedFailedSplitShare({
    shareId,
    restaurantId,
    providerTokenHash: createHash('sha256').update(checkout.token).digest('hex'),
  })
  if (voided.error || !voided.outcome || voided.outcome === 'provider_mapping_mismatch') {
    return { error: 'Başarısız ödeme sonucu doğrulandı ancak pay serbest bırakılamadı. Lütfen tekrar deneyin.' }
  }
  revalidatePath(`/dashboard/${restaurantId}/tables`)
  return { success: true, outcome: voided.outcome === 'voided' ? 'voided' : 'already_resolved' }
}
