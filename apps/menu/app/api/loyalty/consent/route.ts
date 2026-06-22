import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { z } from 'zod'
import { verifyCustomerSession, recordConsent, getConsentStatus, CUSTOMER_SESSION_COOKIE } from '@garsonless/db'

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

  const token = (await cookies()).get(CUSTOMER_SESSION_COOKIE)?.value
  const session = await verifyCustomerSession(token)
  if (!session) {
    return NextResponse.json({ ok: false, error: 'Üye değilsiniz.' }, { status: 401 })
  }

  const consentType = parsed.data.consentType ?? 'contact_data'
  const res = await recordConsent(session.customerId, parsed.data.restaurantId, parsed.data.grant, 'member_sheet', consentType)
  if (!res.ok) {
    return NextResponse.json({ ok: false, error: 'İzin güncellenemedi.' }, { status: 500 })
  }
  const consentGiven = await getConsentStatus(session.customerId, parsed.data.restaurantId)
  const marketingConsentGiven = await getConsentStatus(session.customerId, parsed.data.restaurantId, 'marketing')
  return NextResponse.json({ ok: true, consentGiven, marketingConsentGiven })
}
