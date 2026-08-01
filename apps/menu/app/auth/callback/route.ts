import { NextResponse } from 'next/server'
import { ensureCustomerIdentity } from '@garsonless/application/customers'
import { createCustomerIdentityApplicationPort } from '@garsonless/db/server'
import { createMenuServerClient } from '../../../lib/supabase-server'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const next = safeNext(url.searchParams.get('next'))
  if (!code) return NextResponse.redirect(new URL(`${next}?authError=oauth`, url.origin))

  const supabase = await createMenuServerClient()
  const { data, error } = await supabase.auth.exchangeCodeForSession(code)
  if (error || !data.user) return NextResponse.redirect(new URL(`${next}?authError=oauth`, url.origin))

  const result = await ensureCustomerIdentity({
    authUserId: data.user.id,
    email: data.user.email ?? null,
    phone: data.user.phone ?? null,
    userMetadata: data.user.user_metadata ?? {},
    appMetadata: data.user.app_metadata ?? {},
  }, {
    name: url.searchParams.get('name'),
    restaurantId: uuidOrUndefined(url.searchParams.get('restaurantId')),
    consent: url.searchParams.get('consent') === '1',
    marketingConsent: url.searchParams.get('marketingConsent') === '1',
  }, createCustomerIdentityApplicationPort())
  return NextResponse.redirect(new URL(result.ok ? next : `${next}?authError=link`, url.origin))
}

function safeNext(value: string | null): string {
  return value?.startsWith('/') && !value.startsWith('//') ? value : '/'
}

function uuidOrUndefined(value: string | null): string | undefined {
  return value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value) ? value : undefined
}
