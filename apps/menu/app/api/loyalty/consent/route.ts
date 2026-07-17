import { NextResponse } from 'next/server'
import { z } from 'zod'
import { updateCustomerConsent } from '@garsonless/application/customers'
import { createCustomerConsentApplicationPort } from '@garsonless/db/server'
import { getCustomerSession } from '../../../../lib/customer-session'

const schema = z.object({
  restaurantId: z.string().uuid(),
  grant: z.boolean(),
  consentType: z.enum(['contact_data', 'marketing']).optional(),
})

type ApiResponse = { ok: true; consentGiven: boolean; marketingConsentGiven: boolean } | { ok: false; error: string }

// Cookie-scoped: a member grants/withdraws their OWN per-restaurant consent.
// contact_data flips the owner's phone view; marketing gates campaign SMS.
// The customerId comes from the httpOnly session — never the body.
export async function POST(req: Request): Promise<NextResponse<ApiResponse>> {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'Geçersiz istek.' }, { status: 400 })
  }
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: 'Geçersiz istek.' }, { status: 400 })
  }

  const session = await getCustomerSession()
  if (!session) {
    return NextResponse.json({ ok: false, error: 'Üye değilsiniz.' }, { status: 401 })
  }

  const consentType = parsed.data.consentType ?? 'contact_data'
  const res = await updateCustomerConsent({
    actor: 'customer-member',
    authUserId: session.authUserId,
    customerId: session.customerId,
    restaurantId: parsed.data.restaurantId,
  }, {
    restaurantId: parsed.data.restaurantId,
    grant: parsed.data.grant,
    consentType,
    source: 'member_sheet',
  }, createCustomerConsentApplicationPort())
  if (!res.ok) {
    return NextResponse.json({ ok: false, error: 'İzin güncellenemedi.' }, { status: 500 })
  }
  return NextResponse.json({ ok: true, ...res.value })
}
