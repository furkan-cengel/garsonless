import type { SplitPaymentPort } from '@garsonless/application/splits'
import { err, ok } from '@garsonless/domain/result'
import { createServiceClient } from './client'
import { createShareDB } from './split'

type RpcError = { message: string } | null
type UntypedRpc = (
  functionName: string,
  args: Record<string, unknown>,
) => Promise<{ data: unknown; error: RpcError }>

function rpc(service: ReturnType<typeof createServiceClient>): UntypedRpc {
  return service.rpc.bind(service) as unknown as UntypedRpc
}

function sumAmounts(rows: unknown): number {
  if (!Array.isArray(rows)) return 0
  return rows.reduce((sum, row) => {
    if (!row || typeof row !== 'object') return sum
    const record = row as { amount?: unknown; total?: unknown }
    const amount = typeof record.amount === 'number' ? record.amount : record.total
    return sum + (typeof amount === 'number' ? amount : 0)
  }, 0)
}

/** Supabase implementation for split declaration, checkout preflight and both
 * settlement authorities. Raw payment-share primitives stay package-private. */
export function createSplitPaymentPort(): SplitPaymentPort {
  return {
    async readDeclarationSnapshot(input) {
      const service = createServiceClient()
      const { data: session, error: sessionError } = await service
        .from('table_sessions')
        .select('id')
        .eq('id', input.tableSessionId)
        .eq('restaurant_id', input.restaurantId)
        .eq('table_id', input.tableId)
        .is('closed_at', null)
        .maybeSingle()
      if (sessionError) return err(sessionError.message)
      if (!session) return err('Adisyon bulunamadı ya da kapanmış')

      const [ordersResult, settledResult] = await Promise.all([
        service.from('orders')
          .select('id, total, items')
          .eq('table_session_id', input.tableSessionId)
          .eq('restaurant_id', input.restaurantId)
          .neq('status', 'cancelled')
          .is('deleted_at', null),
        service.from('payment_shares')
          .select('amount')
          .eq('table_session_id', input.tableSessionId)
          .eq('restaurant_id', input.restaurantId)
          .eq('status', 'settled'),
      ])
      if (ordersResult.error) return err(ordersResult.error.message)
      if (settledResult.error) return err(settledResult.error.message)
      return ok({
        orders: (ordersResult.data ?? []) as Array<{ id: string; total: number; items: unknown }>,
        settledTotal: sumAmounts(settledResult.data),
      })
    },
    async createDeclaredShare(input) {
      const result = await createShareDB(input)
      return result.error || !result.shareId
        ? err(result.error ?? 'Pay oluşturulamadı')
        : ok({ shareId: result.shareId })
    },
    async reserveOnlineCheckout(input) {
      const service = createServiceClient()
      const { data, error } = await rpc(service)('reserve_split_checkout', {
        p_share_id: input.shareId,
        p_restaurant_id: input.restaurantId,
        p_table_id: input.tableId,
        p_reservation_seconds: 900,
      })
      if (error) return err(error.message)
      const value = data as { amount?: unknown; restaurantSettings?: unknown } | null
      return typeof value?.amount === 'number'
        ? ok({ amount: value.amount, restaurantSettings: value.restaurantSettings ?? null })
        : err('Checkout rezervasyonu geçersiz yanıt döndürdü')
    },
    async releaseOnlineCheckout(input) {
      const { data, error } = await rpc(createServiceClient())('release_split_checkout_reservation', {
        p_share_id: input.shareId,
        p_restaurant_id: input.restaurantId,
      })
      if (error) return err(error.message)
      return data === true ? ok(true) : err('Checkout rezervasyonu bırakılamadı')
    },
    async voidUnstartedOnlineShare(input) {
      const { data, error } = await rpc(createServiceClient())('void_unstarted_split_share_atomic', {
        p_share_id: input.shareId,
        p_restaurant_id: input.restaurantId,
      })
      if (error) return err('Kart payı güvenli biçimde bırakılamadı')
      const outcomes = ['voided', 'provider_pending', 'already_resolved', 'not_found'] as const
      return outcomes.includes(data as typeof outcomes[number])
        ? ok(data as typeof outcomes[number])
        : err('Kart payı güvenli biçimde bırakılamadı')
    },
    async settleShare(input) {
      const { data, error } = await rpc(createServiceClient())('settle_payment_share_atomic', {
        p_share_id: input.shareId,
        p_restaurant_id: input.restaurantId,
        p_expected_method: input.expectedMethod,
        p_settled_by: input.settledBy,
      })
      if (error) return err(error.message)
      const value = data as { finalized?: unknown; amount?: unknown; idempotent?: unknown } | null
      return typeof value?.finalized === 'boolean'
        && typeof value.amount === 'number'
        && typeof value.idempotent === 'boolean'
        ? ok({ finalized: value.finalized, amount: value.amount, idempotent: value.idempotent })
        : err('Settlement geçersiz yanıt döndürdü')
    },
  }
}
