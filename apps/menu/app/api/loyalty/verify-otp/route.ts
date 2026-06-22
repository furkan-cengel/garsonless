import { NextResponse } from 'next/server'
import { z } from 'zod'
import { verifyOtp, signCustomerSession, creditWelcomeBonus, recordConsent, CUSTOMER_SESSION_COOKIE } from '@garsonless/db'

const schema = z.object({
  phone: z.string().min(1),
  code: z.string().regex(/^\d{6}$/),
  name: z.string().max(80).optional(),
  restaurantId: z.string().uuid().optional(),
  // KVKK açık rıza captured at join. contact_data and marketing are separate:
  // contact lets the venue view/contact the member; marketing gates campaign SMS.
  consent: z.boolean().optional(),
  marketingConsent: z.boolean().optional(),
})

const SESSION_MAX_AGE = 60 * 24 * 60 * 60 // 60 days, matches the JWT TTL

type Member = { id: string; phone: string; name: string | null }
type ApiResponse = { ok: true; member: Member } | { ok: false; error: string }

export async function POST(req: Request): Promise<NextResponse<ApiResponse>> {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'Geçersiz istek.' }, { status: 400 })
  }

  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: 'Kod hatalı veya süresi dolmuş.' }, { status: 400 })
  }

  const result = await verifyOtp({
    rawPhone: parsed.data.phone,
    code: parsed.data.code,
    name: parsed.data.name ?? null,
  })

  if (!result.ok) {
    if (result.reason === 'too_many_attempts') {
      return NextResponse.json(
        { ok: false, error: 'Çok fazla hatalı deneme. Yeni kod isteyin.' },
        { status: 429 },
      )
    }
    return NextResponse.json({ ok: false, error: 'Kod hatalı veya süresi dolmuş.' }, { status: 400 })
  }

  // One-time welcome bonus (idempotent, best-effort) for the restaurant the
  // member verified on. No-op if welcome_bonus_points is 0 or already credited.
  if (parsed.data.restaurantId) {
    await creditWelcomeBonus(result.customer.id, parsed.data.restaurantId)
    // Record per-restaurant KVKK consent from affirmative opt-ins. Best-effort;
    // never blocks login.
    if (parsed.data.consent) {
      await recordConsent(result.customer.id, parsed.data.restaurantId, true, 'join')
    }
    if (parsed.data.marketingConsent) {
      await recordConsent(result.customer.id, parsed.data.restaurantId, true, 'join', 'marketing')
    }
  }

  const token = await signCustomerSession({ customerId: result.customer.id, phone: result.customer.phone })

  const res = NextResponse.json<ApiResponse>({ ok: true, member: result.customer })
  // httpOnly so JS can't read it (XSS-safe); path '/' scopes it to THIS (menu) app
  // origin only; Secure in production; Lax is fine for same-site menu requests.
  res.cookies.set(CUSTOMER_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE,
  })
  return res
}
