import { NextResponse } from 'next/server'
import { z } from 'zod'
import { ensureCustomerIdentity } from '@garsonless/application/customers'
import { createCustomerIdentityApplicationPort } from '@garsonless/db/server'
import { createMenuServerClient } from '../../../../lib/supabase-server'

const schema = z.object({
  name: z.string().trim().max(80).optional(),
  restaurantId: z.string().uuid().optional(),
  consent: z.boolean().optional(),
  marketingConsent: z.boolean().optional(),
})

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ ok: false, error: 'Geçersiz istek.' }, { status: 400 })

  const supabase = await createMenuServerClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return NextResponse.json({ ok: false, error: 'Oturum bulunamadı.' }, { status: 401 })

  const result = await ensureCustomerIdentity({
    authUserId: user.id,
    email: user.email ?? null,
    phone: user.phone ?? null,
    userMetadata: user.user_metadata ?? {},
    appMetadata: user.app_metadata ?? {},
  }, parsed.data, createCustomerIdentityApplicationPort())
  return NextResponse.json(result, { status: result.ok ? 200 : 409 })
}
