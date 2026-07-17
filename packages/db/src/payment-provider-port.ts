import type { OrderCheckoutPort } from '@garsonless/application/payments'
import { err, ok } from '@garsonless/domain/result'
import { createServiceClient } from './client'

export interface IyzicoCredentialRecord {
  apiKey: string
  secretKey: string
  mode: string
}

export function createOrderCheckoutPort(): OrderCheckoutPort {
  return {
    async reserveOrderCheckout(input) {
      const service = createServiceClient()
      const call = service.rpc.bind(service) as unknown as (
        name: string,
        args: Record<string, unknown>,
      ) => Promise<{ data: unknown; error: { message: string } | null }>
      const { data, error } = await call('reserve_order_checkout', {
        p_order_id: input.orderId,
        p_restaurant_id: input.restaurantId,
        p_table_id: input.tableId,
        p_reservation_seconds: 900,
      })
      if (error) return err(error.message)
      const value = data as { amount?: unknown; restaurantSettings?: unknown; reservationId?: unknown } | null
      return typeof value?.amount === 'number' && typeof value.reservationId === 'string'
        ? ok({ amount: value.amount, restaurantSettings: value.restaurantSettings ?? null, reservationId: value.reservationId })
        : err('Checkout rezervasyonu geçersiz yanıt döndürdü')
    },
    async releaseOrderCheckout(input) {
      const service = createServiceClient()
      const call = service.rpc.bind(service) as unknown as (
        name: string,
        args: Record<string, unknown>,
      ) => Promise<{ data: unknown; error: { message: string } | null }>
      const { data, error } = await call('release_order_checkout_reservation', {
        p_order_id: input.orderId,
        p_restaurant_id: input.restaurantId,
        p_reservation_id: input.reservationId,
      })
      if (error) return err(error.message)
      return data === true ? ok(true) : err('Checkout rezervasyonu bırakılamadı')
    },
  }
}

export async function readIyzicoCredentialRecord(restaurantId: string): Promise<{
  record: IyzicoCredentialRecord | null
  error: string | null
}> {
  const { data, error } = await createServiceClient()
    .from('payment_credentials')
    .select('api_key, secret_key, mode')
    .eq('restaurant_id', restaurantId)
    .eq('provider', 'iyzico')
    .maybeSingle()
  if (error) return { record: null, error: error.message }
  if (!data) return { record: null, error: null }
  const row = data as { api_key: string; secret_key: string; mode: string }
  return { record: { apiKey: row.api_key, secretKey: row.secret_key, mode: row.mode }, error: null }
}

export async function readOrderPaymentMapping(token: string): Promise<{
  orderId: string | null
  restaurantId: string | null
  error: string | null
}> {
  const service = createServiceClient()
  const { data: tokenRow, error } = await service.from('order_payment_tokens')
    .select('order_id').eq('token', token).maybeSingle()
  const orderId = (tokenRow as { order_id: string } | null)?.order_id ?? null
  if (error || !orderId) return { orderId: null, restaurantId: null, error: error?.message ?? null }
  const { data: orderRow, error: orderError } = await service.from('orders')
    .select('restaurant_id').eq('id', orderId).is('deleted_at', null).maybeSingle()
  return {
    orderId,
    restaurantId: (orderRow as { restaurant_id: string } | null)?.restaurant_id ?? null,
    error: orderError?.message ?? null,
  }
}

export async function readSharePaymentMapping(token: string): Promise<{
  shareId: string | null
  restaurantId: string | null
  error: string | null
}> {
  const service = createServiceClient()
  const { data: tokenRow, error } = await service.from('payment_share_tokens')
    .select('share_id').eq('token', token).maybeSingle()
  const shareId = (tokenRow as { share_id: string } | null)?.share_id ?? null
  if (error || !shareId) return { shareId: null, restaurantId: null, error: error?.message ?? null }
  const { data: shareRow, error: shareError } = await service.from('payment_shares')
    .select('restaurant_id').eq('id', shareId).maybeSingle()
  return {
    shareId,
    restaurantId: (shareRow as { restaurant_id: string } | null)?.restaurant_id ?? null,
    error: shareError?.message ?? null,
  }
}

export async function attachOrderPaymentToken(
  orderId: string,
  restaurantId: string,
  reservationId: string,
  token: string,
): Promise<string | null> {
  const service = createServiceClient()
  const call = service.rpc.bind(service) as unknown as (
    name: string,
    args: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: { message: string } | null }>
  const { data, error } = await call('attach_order_checkout_token', {
    p_order_id: orderId,
    p_restaurant_id: restaurantId,
    p_reservation_id: reservationId,
    p_token: token,
  })
  if (error) return error.message
  return data === true ? null : 'Provider token siparişe bağlanamadı'
}

export async function attachSharePaymentToken(
  shareId: string,
  restaurantId: string,
  token: string,
): Promise<string | null> {
  const service = createServiceClient()
  const call = service.rpc.bind(service) as unknown as (
    name: string,
    args: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: { message: string } | null }>
  const { data, error } = await call('attach_split_checkout_token', {
    p_share_id: shareId,
    p_restaurant_id: restaurantId,
    p_token: token,
  })
  if (error) return error.message
  return data === true ? null : 'Provider token paya bağlanamadı'
}
