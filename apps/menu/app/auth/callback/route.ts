import { NextResponse } from 'next/server'
import { createMenuServerClient } from '../../../lib/supabase-server'
import { configuredMenuOrigin } from '../../../lib/customer-auth-request'
import {
  clearCustomerAuthIntentCookie,
  completeCustomerIdentity,
  consumeStoredCustomerAuthIntent,
  readCustomerAuthIntent,
} from '../../../lib/customer-auth-server'

function withCustomerAuthResult(url: URL, result: 'complete' | 'failed'): URL {
  url.searchParams.set('customerAuth', result)
  return url
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const suppliedIntent = url.searchParams.get('intent')
  const menuOrigin = configuredMenuOrigin()
  if (!menuOrigin) return NextResponse.json({ ok: false, error: { code: 'SERVICE_UNAVAILABLE' } }, { status: 503 })

  const intent = suppliedIntent ? await readCustomerAuthIntent(suppliedIntent) : null
  const returnUrl = new URL(intent?.returnPath ?? '/', menuOrigin)
  if (!code || !intent || intent.flow !== 'oauth') {
    await clearCustomerAuthIntentCookie()
    return NextResponse.redirect(withCustomerAuthResult(returnUrl, 'failed'))
  }

  const supabase = await createMenuServerClient()
  const { data, error } = await supabase.auth.exchangeCodeForSession(code)
  if (error || !data.user) {
    await clearCustomerAuthIntentCookie()
    return NextResponse.redirect(withCustomerAuthResult(returnUrl, 'failed'))
  }

  const consumed = await consumeStoredCustomerAuthIntent(intent)
  if (!consumed) {
    await supabase.auth.signOut({ scope: 'local' })
    await clearCustomerAuthIntentCookie()
    return NextResponse.redirect(withCustomerAuthResult(returnUrl, 'failed'))
  }

  const completed = await completeCustomerIdentity(data.user, intent)
  await clearCustomerAuthIntentCookie()
  if (!completed.ok) await supabase.auth.signOut({ scope: 'local' })
  return NextResponse.redirect(withCustomerAuthResult(returnUrl, completed.ok ? 'complete' : 'failed'))
}
