// Server-only: resolves İyzico credentials for a restaurant.
// Reads payment_credentials with the SERVICE ROLE client — this module must
// only be imported from route handlers, never from client components.

import {
  attachOrderPaymentToken,
  attachSharePaymentToken,
  readIyzicoCredentialRecord,
  readOrderPaymentMapping,
  readSharePaymentMapping,
} from '@garsonless/db/server'

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
  const { record, error } = await readIyzicoCredentialRecord(restaurantId)
  if (error) return envFallback(`credentials query failed: ${error}`, restaurantId)
  if (!record) return envFallback('no credentials configured', restaurantId)
  return {
    apiKey: record.apiKey,
    secretKey: record.secretKey,
    baseUrl: record.mode === 'live' ? LIVE_URL : SANDBOX_URL,
    source: 'restaurant',
  }
}

/** Callback path: token → order_payment_tokens → orders.restaurant_id →
 *  credentials. The token lives in a service-role-only side table (GAP #2) so
 *  it can never appear on the anon-readable orders row (REST or realtime). */
export async function resolveCredentialsByPaymentToken(
  token: string,
): Promise<{ credentials: IyzicoCredentials | null; orderId: string | null; restaurantId: string | null }> {
  const mapping = await readOrderPaymentMapping(token)
  if (mapping.error || !mapping.orderId) {
    return {
      credentials: envFallback(
        mapping.error ? `token lookup failed: ${mapping.error}` : 'no order found for payment token',
        null,
      ),
      orderId: null,
      restaurantId: null,
    }
  }
  const { orderId, restaurantId } = mapping
  if (!restaurantId) {
    return { credentials: envFallback('order not found for payment token', null), orderId, restaurantId: null }
  }

  return {
    credentials: await resolveIyzicoCredentials(restaurantId),
    orderId,
    restaurantId,
  }
}

export async function attachPaymentTokenToOrder(
  orderId: string,
  restaurantId: string,
  reservationId: string,
  token: string,
): Promise<string | null> {
  const error = await attachOrderPaymentToken(orderId, restaurantId, reservationId, token)
  if (error) {
    console.warn(
      JSON.stringify({ event: 'payment.token.attach_failed', orderId, error }),
    )
  }
  return error
}

/** Split payment: token ↔ SHARE (mirror of attachPaymentTokenToOrder). The token
 *  lives in the service-role-only payment_share_tokens side table, never on the
 *  anon-readable share row and not in realtime. */
export async function attachPaymentTokenToShare(
  shareId: string,
  restaurantId: string,
  token: string,
): Promise<string | null> {
  const error = await attachSharePaymentToken(shareId, restaurantId, token)
  if (error) {
    console.warn(JSON.stringify({ event: 'payment.share_token.attach_failed', shareId, error }))
  }
  return error
}

/** Callback path for a SHARE token: token → payment_share_tokens → share →
 *  restaurant → credentials. Returns shareId=null when the token is NOT a share
 *  token (so the caller falls through to the order-token resolver). */
export async function resolveCredentialsByShareToken(
  token: string,
): Promise<{ credentials: IyzicoCredentials | null; shareId: string | null; restaurantId: string | null }> {
  const mapping = await readSharePaymentMapping(token)
  const { shareId, restaurantId } = mapping
  if (!shareId) return { credentials: null, shareId: null, restaurantId: null }
  if (!restaurantId) return { credentials: null, shareId, restaurantId: null }

  return { credentials: await resolveIyzicoCredentials(restaurantId), shareId, restaurantId }
}
