export const ANALYTICS_CONSENT_VERSION = '2026-09-09'
export const ANALYTICS_CONSENT_COOKIE = 'masabu_analytics_consent'
export const SIGNUP_RECEIPT_COOKIE = 'masabu_signup_receipt'
export const SIGNUP_PENDING_COOKIE = 'masabu_signup_pending'
export type AnalyticsConsent = 'granted' | 'denied' | 'essential' | 'unknown'
export const ANALYTICS_CAMPAIGN_COOKIE = 'masabu_analytics_campaign'
export type AnalyticsPlacement = 'header' | 'footer' | 'content'
export type AnalyticsClickDetails = {
  placement: AnalyticsPlacement
  location?: 'hero' | 'navbar' | 'pricing' | 'footer' | 'allergen_page' | 'content'
  cta_type?: 'signup' | 'demo'
  plan_name?: 'starter' | 'plus' | 'pro' | 'business'
  billing_period?: 'monthly' | 'yearly'
}
export type MarketingAnalyticsEvent =
  | ({ name: 'signup_click' | 'free_trial_click' | 'demo_request_click' | 'pricing_cta_click' | 'allergen_landing_cta_click' | 'phone_click' | 'whatsapp_click' } & AnalyticsClickDetails)
  | { name: 'contact_form_submit'; topic: 'general' | 'sales' | 'support' }
  | { name: 'generate_lead'; topic: 'general' | 'sales' }
  | { name: 'sign_up'; method: 'email' | 'google' }
  | { name: 'trial_started'; plan: 'starter' | 'plus' | 'pro' | 'business' }
  | { name: 'first_product_added' | 'menu_setup_completed'; method: 'manual' | 'csv' }
  | { name: 'menu_preview_click'; placement: 'onboarding_complete' }
  | { name: 'business_created'; selected_plan?: 'starter' | 'plus' | 'pro' }
  | { name: 'menu_published'; publication_type: 'explicit_publish' }


export function parseAnalyticsConsent(value: string | undefined): AnalyticsConsent {
  if (value === `${ANALYTICS_CONSENT_VERSION}:granted`) return 'granted'
  if (value === `${ANALYTICS_CONSENT_VERSION}:denied`) return 'denied'
  if (value === `${ANALYTICS_CONSENT_VERSION}:essential`) return 'essential'
  return 'unknown'
}

export function validMeasurementId(value: string | undefined): string | null {
  return value && /^G-[A-Z0-9]{5,20}$/.test(value) ? value : null
}

export function analyticsPath(pathname: string, surface: 'marketing' | 'dashboard'): string | null {
  if (surface === 'dashboard') {
    // A virtual page removes tenant/template identifiers from the publication flow.
    if (/^\/dashboard\/[a-f0-9-]{36}\/theme(?:\/[a-z0-9-]+\/edit)?$/.test(pathname)) return '/dashboard/theme'

    return ['/auth/signup', '/auth/verify-email', '/auth/confirm', '/auth/terms', '/auth/complete', '/dashboard/onboarding'].includes(pathname) ? pathname : null
  }
  if (pathname === '/' || /^\/(qr-menu|dijital-adisyon|qr-siparis|mutfak-ekrani|fiyatlar|hakkimizda|iletisim|menu-alerjen-zorunlulugu|blog)$/.test(pathname)
    || /^\/blog\/[a-z0-9-]+$/.test(pathname) || /^\/yasal(?:\/[a-z0-9-]+)?$/.test(pathname)) return pathname
  return null
}

/** Never send query strings, fragments, credentials or unknown paths to GA. */
export function analyticsLocation(raw: string, surface: 'marketing' | 'dashboard'): string | null {
  try {
    const url = new URL(raw)
    const path = analyticsPath(url.pathname, surface)
    return path && ['https:', 'http:'].includes(url.protocol) ? url.origin + path : null
  } catch { return null }
}

export function analyticsReferrer(raw: string): string {
  try {
    const url = new URL(raw)
    if (!['https:', 'http:'].includes(url.protocol)) return ''
    // An origin suffices for acquisition; paths can contain account identifiers.
    return url.origin
  } catch { return '' }
}

export function analyticsCampaign(search: string): Record<string, string> {
  const params = new URLSearchParams(search)
  const fields: Record<string, string> = {}
  for (const key of ['source', 'medium', 'campaign', 'content', 'term'] as const) {
    const value = params.get(`utm_${key}`)
    // Campaign slugs only; reject email addresses, phone numbers and arbitrary text.
    if (value && /^[a-z][a-z0-9_-]{0,63}$/i.test(value) && !/\d{7}/.test(value)) {
      fields[key === 'campaign' ? 'campaign_name' : `campaign_${key}`] = value
    }
  }
  return fields
}

/** Auth-created metadata proves first email confirmation, not the URL's flow. */
export function isFreshSignup(user: { created_at: string; email_confirmed_at?: string; last_sign_in_at?: string }, startedAt?: number): boolean {
  const created = Date.parse(user.created_at)
  const confirmed = Date.parse(user.email_confirmed_at ?? '')
  const signedIn = Date.parse(user.last_sign_in_at ?? '')
  return Number.isFinite(created) && Number.isFinite(confirmed) && Number.isFinite(signedIn)
    && confirmed >= created && Math.abs(signedIn - confirmed) < 60_000
    && (startedAt === undefined || created >= startedAt - 5_000)
}

/** Rebuild every event from an explicit value allowlist, even for untyped callers. */
export function analyticsEventParameters(event: MarketingAnalyticsEvent): Record<string, string> | null {
  const data = event as unknown as Record<string, unknown>
  const params: Record<string, string> = {}
  const copy = (key: string, allowed: readonly string[]) => {
    const value = data[key]
    if (typeof value === 'string' && allowed.includes(value)) params[key] = value
  }
  switch (event.name) {
    case 'signup_click': case 'free_trial_click': case 'demo_request_click':
    case 'pricing_cta_click': case 'allergen_landing_cta_click': case 'phone_click': case 'whatsapp_click':
      copy('placement', ['header', 'footer', 'content'])
      copy('location', ['hero', 'navbar', 'pricing', 'footer', 'allergen_page', 'content'])
      copy('cta_type', ['signup', 'demo'])
      copy('plan_name', ['starter', 'plus', 'pro', 'business'])
      copy('billing_period', ['monthly', 'yearly'])
      break
    case 'contact_form_submit': case 'generate_lead':
      copy('topic', event.name === 'generate_lead' ? ['general', 'sales'] : ['general', 'sales', 'support'])
      if (!params.topic) return null
      params.form_type = params.topic === 'sales' ? 'demo' : params.topic === 'support' ? 'support' : 'contact'
      break
    case 'sign_up': copy('method', ['email', 'google']); if (!params.method) return null; break
    case 'trial_started': copy('plan', ['starter', 'plus', 'pro', 'business']); break
    case 'first_product_added': case 'menu_setup_completed': copy('method', ['manual', 'csv']); break
    case 'menu_preview_click': copy('placement', ['onboarding_complete']); break
    case 'business_created': copy('selected_plan', ['starter', 'plus', 'pro']); break
    case 'menu_published': copy('publication_type', ['explicit_publish']); break
    default: return null
  }
  return params
}

/** Both desktop and mobile use this one delegated click contract. */
export function marketingClickEvents(input: {
  href: string; origin: string; pathname: string; placement: AnalyticsPlacement
  context?: string | undefined; hero?: boolean; demo?: boolean; plan?: string | undefined; billing?: string | undefined
}): MarketingAnalyticsEvent[] {
  try {
    const target = new URL(input.href, input.origin)
    const signup = target.pathname === '/auth/signup' && ['https:', 'http:'].includes(target.protocol)
      && ['app.masabu.co', 'localhost', '127.0.0.1'].includes(target.hostname)
    const demo = input.demo === true && target.origin === input.origin && target.pathname === '/iletisim'
    const pricing = input.context === 'pricing' || input.pathname === '/fiyatlar'
    const location: AnalyticsClickDetails['location'] = input.placement === 'header' ? 'navbar'
      : input.placement === 'footer' ? 'footer' : pricing ? 'pricing'
        : input.pathname === '/menu-alerjen-zorunlulugu' ? 'allergen_page' : input.hero ? 'hero' : 'content'
    const details: AnalyticsClickDetails = { placement: input.placement, location }
    if (signup || demo) details.cta_type = signup ? 'signup' : 'demo'
    const plan = input.plan ?? target.searchParams.get('plan')
    if (['starter', 'plus', 'pro', 'business'].includes(plan ?? '')) details.plan_name = plan as NonNullable<AnalyticsClickDetails['plan_name']>
    const billing = input.billing ?? target.searchParams.get('interval')
    if (billing === 'monthly' || billing === 'yearly') details.billing_period = billing
    const events: MarketingAnalyticsEvent[] = []
    if (signup) events.push({ name: 'signup_click', ...details }, { name: 'free_trial_click', ...details })
    if (demo) events.push({ name: 'demo_request_click', ...details })
    if (signup || demo) {
      if (pricing) events.push({ name: 'pricing_cta_click', ...details })
      if (input.pathname === '/menu-alerjen-zorunlulugu') events.push({ name: 'allergen_landing_cta_click', ...details })
    }
    if (target.protocol === 'tel:') events.push({ name: 'phone_click', placement: input.placement, location })
    if (['https:', 'http:'].includes(target.protocol) && ['wa.me', 'api.whatsapp.com', 'web.whatsapp.com'].includes(target.hostname)) {
      events.push({ name: 'whatsapp_click', placement: input.placement, location })
    }
    return events
  } catch { return [] }
}

/** The API deliberately omits leadAccepted for a honeypot success response. */
export function contactSubmissionEvents(ok: boolean, payload: unknown, topic: 'general' | 'sales' | 'support'): MarketingAnalyticsEvent[] {
  if (!ok || !payload || typeof payload !== 'object') return []
  const result = payload as Record<string, unknown>
  if (result.success !== true || typeof result.leadAccepted !== 'boolean') return []
  const events: MarketingAnalyticsEvent[] = [{ name: 'contact_form_submit', topic }]
  if (result.leadAccepted && topic !== 'support') events.push({ name: 'generate_lead', topic })
  return events
}

/** There is no durable first-ever menu publication flag; do not invent one from theme revision. */
export function menuPublicationEvent(result: { status?: string | undefined }): MarketingAnalyticsEvent | null {
  return result.status === 'published' ? { name: 'menu_published', publication_type: 'explicit_publish' } : null
}
