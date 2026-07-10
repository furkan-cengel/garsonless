import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requestOtp } from '@garsonless/db'

const schema = z.object({ phone: z.string().min(1) })

const IS_DEV = process.env.NODE_ENV !== 'production'

function clientIp(req: Request): string | null {
  const fwd = req.headers.get('x-forwarded-for')
  if (fwd) return fwd.split(',')[0]!.trim()
  return req.headers.get('x-real-ip')
}

type ApiResponse = { ok: true; devCode?: string } | { ok: false; error: string }

export async function POST(req: Request): Promise<NextResponse<ApiResponse>> {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'Geçersiz istek.' }, { status: 400 })
  }

  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: 'Geçerli bir telefon numarası girin.' }, { status: 400 })
  }

  const result = await requestOtp({ rawPhone: parsed.data.phone, ip: clientIp(req) })

  if (!result.ok) {
    if (result.reason === 'invalid_phone') {
      return NextResponse.json({ ok: false, error: 'Geçerli bir telefon numarası girin.' }, { status: 400 })
    }
    if (result.reason === 'sms_failed') {
      // Provider send failed — no code was stored, the rate budget is untouched,
      // the customer can retry immediately. Distinct from 429 (throttle) / 400.
      return NextResponse.json(
        { ok: false, error: 'SMS gönderilemedi. Lütfen tekrar deneyin.' },
        { status: 503 },
      )
    }
    // throttled — never reveal whether the phone exists; uniform friendly message.
    return NextResponse.json(
      { ok: false, error: 'Çok fazla deneme. Lütfen birazdan tekrar deneyin.' },
      { status: 429 },
    )
  }

  // Dev OTP echo — STRICTLY gated; codes never leak in production.
  return NextResponse.json(IS_DEV ? { ok: true, devCode: result.devCode } : { ok: true })
}
