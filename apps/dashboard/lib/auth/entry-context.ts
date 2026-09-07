import { safeCallbackPath } from './callback-path'

export type AuthEntryQuery = Record<string, string | string[] | undefined>
export type AuthEntryContext = { next: string; plan: 'starter' | 'plus' | 'pro' | null; interval: 'monthly' | 'yearly' }
export type AuthActionState = { error?: string; fieldErrors?: Record<string, string>; code?: 'INVALID' | 'EXPIRED' | 'RATE_LIMITED' | 'UNAVAILABLE' | 'COMPLETE_PENDING'; success?: true; retryAfter?: number }

export function readEntryContext(query: AuthEntryQuery, signup = false): AuthEntryContext {
  const rawNext = typeof query.next === 'string' ? query.next : null
  const nested = new URL(safeCallbackPath(rawNext), 'https://app.masabu.co').searchParams
  const candidate = query.plan ?? nested.get('plan')
  const plan = candidate === 'starter' || candidate === 'plus' || candidate === 'pro' ? candidate : null
  const interval = (query.interval ?? nested.get('interval')) === 'yearly' ? 'yearly' : 'monthly'
  let next = safeCallbackPath(rawNext, signup || plan ? '/dashboard/onboarding' : '/dashboard')
  if (new URL(next, 'https://app.masabu.co').pathname.startsWith('/auth/')) next = '/dashboard'
  if (next.split('?')[0] === '/dashboard/onboarding') {
    const url = new URL(next, 'https://app.masabu.co')
    if (plan) url.searchParams.set('plan', plan)
    url.searchParams.set('interval', interval)
    next = url.pathname + url.search
  }
  return { next, plan, interval }
}

export function authEntryHref(path: string, context: AuthEntryContext, email = ''): string {
  const query = new URLSearchParams({ next: context.next, interval: context.interval })
  if (context.plan) query.set('plan', context.plan)
  if (email) query.set('email', email)
  return path + '?' + query.toString()
}

export function callbackMessage(value: unknown): string | undefined {
  if (value === 'auth_callback_failed') return 'Bu bağlantı geçersiz veya süresi dolmuş. Yeni bir bağlantı isteyebilirsin.'
  if (value === 'recovery_required') return 'Şifreni yenilemek için yeni bir şifre yenileme bağlantısı iste.'
  if (value === 'session_unavailable') return 'Doğrulama tamamlandı. Devam etmek için tekrar giriş yap.'
  return undefined
}
