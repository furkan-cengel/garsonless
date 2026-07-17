import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import {
  exchangeKitchenLaunchTicket,
  KITCHEN_SESSION_TTL_SECONDS,
} from '@garsonless/db/server'
import { kitchenSessionCookieName } from '../../../../lib/kitchen-session'

const paramsSchema = z.object({ restaurantId: z.string().uuid() })

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ restaurantId: string }> },
) {
  const parsed = paramsSchema.safeParse(await params)
  if (!parsed.success) return new NextResponse('Geçersiz restoran.', { status: 400 })

  const form = await request.formData()
  const ticket = form.get('ticket')
  if (typeof ticket !== 'string' || ticket.length > 2_048) {
    return new NextResponse('Geçersiz mutfak açılış bileti.', { status: 400 })
  }

  const restaurantId = parsed.data.restaurantId
  const session = await exchangeKitchenLaunchTicket(restaurantId, ticket)
  if (!session) {
    return new NextResponse('Mutfak açılış bileti geçersiz veya süresi dolmuş.', { status: 401 })
  }

  const response = NextResponse.redirect(new URL(`/kitchen/${restaurantId}`, request.url), 303)
  response.cookies.set(kitchenSessionCookieName(restaurantId), session, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: `/kitchen/${restaurantId}`,
    maxAge: KITCHEN_SESSION_TTL_SECONDS,
  })
  response.headers.set('Cache-Control', 'no-store')
  return response
}
