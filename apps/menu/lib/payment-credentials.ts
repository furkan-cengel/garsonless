// Server-only: resolves İyzico credentials for a restaurant.
// Reads payment_credentials with the SERVICE ROLE client — this module must
// only be imported from route handlers, never from client components.

import { createServiceClient } from '@garsonless/db'

export interface IyzicoCredentials {
  apiKey: string
  secretKey: string
  baseUrl: string
  source: 'restaurant' | 'env'
}

const SANDBOX_URL = 'https://sandbox-api.iyzipay.com'
const LIVE_URL = 'https://api.iyzipay.com'

function envFallback(reason: string, restaurantId: string | null): IyzicoCredentials | null {
  const apiKey = process.env['IYZICO_API_KEY']
  const secretKey = process.env['IYZICO_SECRET_KEY']
  if (!apiKey || !secretKey) return null
  console.warn(
    JSON.stringify({
      event: 'payment.credentials.env_fallback',
      reason,
      restaurantId,
    }),
  )
  return {
    apiKey,
    secretKey,
    baseUrl: process.env['IYZICO_BASE_URL'] ?? SANDBOX_URL,
    source: 'env',
  }
}

export async function resolveIyzicoCredentials(
  restaurantId: string,
): Promise<IyzicoCredentials | null> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('payment_credentials')
    .select('api_key, secret_key, mode')
    .eq('restaurant_id', restaurantId)
    .eq('provider', 'iyzico')
    .maybeSingle()

  if (error) return envFallback(`credentials query failed: ${error.message}`, restaurantId)
  if (!data) return envFallback('no credentials configured', restaurantId)

  const row = data as { api_key: string; secret_key: string; mode: string }
  return {
    apiKey: row.api_key,
    secretKey: row.secret_key,
    baseUrl: row.mode === 'live' ? LIVE_URL : SANDBOX_URL,
    source: 'restaurant',
  }
}

/** Callback path: token → order_payment_tokens → orders.restaurant_id →
 *  credentials. The token lives in a service-role-only side table (GAP #2) so
 *  it can never appear on the anon-readable orders row (REST or realtime). */
export async function resolveCredentialsByPaymentToken(
  token: string,
): Promise<{ credentials: IyzicoCredentials | null; orderId: string | null; restaurantId: string | null }> {
  const supabase = createServiceClient()
  const { data: tokenRow, error: tokErr } = await supabase
    .from('order_payment_tokens')
    .select('order_id')
    .eq('token', token)
    .maybeSingle()

  const orderId = (tokenRow as { order_id: string } | null)?.order_id ?? null
  if (tokErr || !orderId) {
    return {
      credentials: envFallback(
        tokErr ? `token lookup failed: ${tokErr.message}` : 'no order found for payment token',
        null,
      ),
      orderId: null,
      restaurantId: null,
    }
  }

  const { data: orderRow } = await supabase
    .from('orders')
    .select('restaurant_id')
    .eq('id', orderId)
    .is('deleted_at', null)
    .maybeSingle()
  const restaurantId = (orderRow as { restaurant_id: string } | null)?.restaurant_id ?? null
  if (!restaurantId) {
    return { credentials: envFallback('order not found for payment token', null), orderId, restaurantId: null }
  }

  return {
    credentials: await resolveIyzicoCredentials(restaurantId),
    orderId,
    restaurantId,
  }
}

export async function attachPaymentTokenToOrder(orderId: string, token: string): Promise<void> {
  const supabase = createServiceClient()
  const builder = supabase.from('order_payment_tokens') as unknown as {
    upsert: (row: Record<string, unknown>, opts: { onConflict: string }) => Promise<{ error: { message: string } | null }>
  }
  const { error } = await builder.upsert({ order_id: orderId, token }, { onConflict: 'order_id' })
  if (error) {
    console.warn(
      JSON.stringify({ event: 'payment.token.attach_failed', orderId, error: error.message }),
    )
  }
}

/** Split payment: token ↔ SHARE (mirror of attachPaymentTokenToOrder). The token
 *  lives in the service-role-only payment_share_tokens side table, never on the
 *  anon-readable share row and not in realtime. */
export async function attachPaymentTokenToShare(shareId: string, token: string): Promise<void> {
  const supabase = createServiceClient()
  const builder = supabase.from('payment_share_tokens') as unknown as {
    upsert: (row: Record<string, unknown>, opts: { onConflict: string }) => Promise<{ error: { message: string } | null }>
  }
  const { error } = await builder.upsert({ share_id: shareId, token }, { onConflict: 'share_id' })
  if (error) {
    console.warn(JSON.stringify({ event: 'payment.share_token.attach_failed', shareId, error: error.message }))
  }
}

/** Callback path for a SHARE token: token → payment_share_tokens → share →
 *  restaurant → credentials. Returns shareId=null when the token is NOT a share
 *  token (so the caller falls through to the order-token resolver). */
export async function resolveCredentialsByShareToken(
  token: string,
): Promise<{ credentials: IyzicoCredentials | null; shareId: string | null; restaurantId: string | null }> {
  const supabase = createServiceClient()
  const { data: tokenRow } = await supabase
    .from('payment_share_tokens')
    .select('share_id')
    .eq('token', token)
    .maybeSingle()
  const shareId = (tokenRow as { share_id: string } | null)?.share_id ?? null
  if (!shareId) return { credentials: null, shareId: null, restaurantId: null }

  const { data: shareRow } = await supabase
    .from('payment_shares')
    .select('restaurant_id')
    .eq('id', shareId)
    .maybeSingle()
  const restaurantId = (shareRow as { restaurant_id: string } | null)?.restaurant_id ?? null
  if (!restaurantId) return { credentials: null, shareId, restaurantId: null }

  return { credentials: await resolveIyzicoCredentials(restaurantId), shareId, restaurantId }
}
