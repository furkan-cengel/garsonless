import { NextResponse } from 'next/server'
import { z } from 'zod'
import { resolvePublicTableContext } from '@garsonless/application/tables'
import { createPublicTableQueryPort, readPaymentCredentialMeta } from '@garsonless/db/server'
import { publicRestaurantHasFeature } from '../../../../lib/restaurant-feature-access'

const querySchema = z.object({ token: z.string().uuid() })

export async function GET(request: Request) {
  const parsed = querySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams))
  if (!parsed.success) return NextResponse.json({ success: false, error: 'Geçersiz masa bağlantısı.' }, { status: 400 })
  const tableResult = await resolvePublicTableContext(parsed.data.token, createPublicTableQueryPort())
  if (!tableResult.ok || !tableResult.value) {
    return NextResponse.json({ success: false, error: 'Masa bağlantısı doğrulanamadı.' }, { status: tableResult.ok ? 404 : 503 })
  }
  const restaurantId = tableResult.value.restaurantId
  const [splitAllowed, onlineAllowed, credential] = await Promise.all([
    publicRestaurantHasFeature(restaurantId, 'split_payments'),
    publicRestaurantHasFeature(restaurantId, 'online_payments'),
    readPaymentCredentialMeta(restaurantId),
  ])
  const configured = credential.error === null && credential.meta?.configured === true
  const productionReady = process.env['NODE_ENV'] !== 'production' || credential.meta?.mode === 'live'
  const cardAvailable = splitAllowed && onlineAllowed && configured && productionReady
  const reason = !splitAllowed ? 'split_unavailable'
    : !onlineAllowed ? 'addon_inactive'
      : !configured ? 'not_configured'
        : !productionReady ? 'live_credentials_required'
          : null
  return NextResponse.json({ success: true, data: { cardAvailable, reason } })
}
