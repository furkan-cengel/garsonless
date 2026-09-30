'use client'

import {
  ANALYTICS_CONSENT_COOKIE, ANALYTICS_CONSENT_VERSION, ANALYTICS_CAMPAIGN_COOKIE,
  SIGNUP_RECEIPT_COOKIE, SIGNUP_PENDING_COOKIE, validMeasurementId,
  analyticsCampaign, analyticsEventParameters, analyticsLocation, analyticsReferrer, parseAnalyticsConsent,
  type AnalyticsConsent, type MarketingAnalyticsEvent,
} from '@garsonless/domain/marketing-analytics'

declare global {
  interface Window {
    dataLayer?: IArguments[]
    gtag?: (...args: unknown[]) => void
  }
}

let measurementId: string | null = null
let active = false
let currentSurface: 'marketing' | 'dashboard' = 'marketing'
let lastPage: string | null = null

export function analyticsDebugEnabled(): boolean {
  return process.env.NODE_ENV !== 'production' && process.env.NEXT_PUBLIC_ANALYTICS_DEBUG === 'true'
}

function browserAvailable() {
  return typeof window !== 'undefined' && typeof document !== 'undefined' && typeof location !== 'undefined'
}

export function readAnalyticsCookie(name: string): string | undefined {
  try {
    if (!browserAvailable()) return undefined
    return document.cookie.split(/;\s*/).find((part) => part.startsWith(name + '='))?.slice(name.length + 1)
  } catch { return undefined }
}

export function analyticsConsent(): AnalyticsConsent {
  return parseAnalyticsConsent(readAnalyticsCookie(ANALYTICS_CONSENT_COOKIE))
}

function cookieScope() {
  return location.hostname === 'masabu.co' || location.hostname.endsWith('.masabu.co') ? '; Domain=masabu.co' : ''
}

function writeCookie(name: string, value: string, age: number) {
  try {
    document.cookie = `${name}=${value}; Path=/; Max-Age=${age}; SameSite=Lax${cookieScope()}${location.protocol === 'https:' ? '; Secure' : ''}`
  } catch { /* Cookie restrictions must not break the application. */ }
}

export function forgetAnalyticsCookies() {
  try {
    if (!browserAvailable()) return
    for (const part of document.cookie.split(/;\s*/)) {
      const name = part.split('=')[0] ?? ''
      if (!/^_ga(?:_|$)/.test(name) && ![ANALYTICS_CAMPAIGN_COOKIE, SIGNUP_RECEIPT_COOKIE, SIGNUP_PENDING_COOKIE].includes(name)) continue
      for (const scope of ['', cookieScope(), `; Domain=${location.hostname}`]) {
        document.cookie = `${name}=; Path=/; Max-Age=0${scope}; SameSite=Lax`
      }
    }
  } catch { /* Storage can be unavailable in privacy modes. */ }
}

export function setAnalyticsConsent(value: 'granted' | 'denied' | 'essential') {
  try {
    if (!browserAvailable()) return
    writeCookie(ANALYTICS_CONSENT_COOKIE, `${ANALYTICS_CONSENT_VERSION}:${value}`, 15552000)
    if (value !== 'granted') stopAnalytics()
    window.dispatchEvent(new Event('masabu:analytics-consent'))
  } catch { /* Optional analytics cannot block consent controls. */ }
}

/** Pause on private routes without destroying a consented cross-subdomain session. */
export function pauseAnalytics() {
  active = false
  lastPage = null
  try {
    if (browserAvailable() && measurementId) (window as unknown as Record<string, unknown>)[`ga-disable-${measurementId}`] = true
  } catch { /* Fail closed. */ }
}

export function stopAnalytics() {
  pauseAnalytics()
  try {
    if (browserAvailable() && measurementId) window.gtag?.('consent', 'update', { analytics_storage: 'denied' })
  } catch { /* A provider error must not prevent deletion. */ }
  forgetAnalyticsCookies()
}

/** Fixed 30-minute first-touch window, shared by the two first-party subdomains. */
function campaignAttribution(): Record<string, string> {
  const stored = readAnalyticsCookie(ANALYTICS_CAMPAIGN_COOKIE)
  if (stored && stored.length < 2048) {
    try {
      const parsed = JSON.parse(decodeURIComponent(stored)) as { at?: unknown; search?: unknown }
      if (typeof parsed.at === 'number' && parsed.at <= Date.now() && Date.now() - parsed.at < 1800000 && typeof parsed.search === 'string') {
        return analyticsCampaign(parsed.search)
      }
    } catch { /* Discard malformed or obsolete attribution. */ }
  }
  const campaign = analyticsCampaign(location.search)
  if (Object.keys(campaign).length) {
    const query = new URLSearchParams()
    for (const [key, value] of Object.entries(campaign)) query.set(key === 'campaign_name' ? 'utm_campaign' : key.replace('campaign_', 'utm_'), value)
    writeCookie(ANALYTICS_CAMPAIGN_COOKIE, encodeURIComponent(JSON.stringify({ at: Date.now(), search: query.toString() })), 1800)
  }
  // gclid is deliberately not retained: the current consent model denies ad_storage.
  return campaign
}

function send(name: string, params: Record<string, string>) {
  if (analyticsDebugEnabled()) {
    // Local-only, sanitized output; no gtag queue, script or Google network request.
    console.debug('[masabu analytics]', name, JSON.stringify(params))
    window.dispatchEvent(new CustomEvent('masabu:analytics-debug', { detail: { name, parameters: params } }))
  } else window.gtag?.('event', name, params)
}

export function syncAnalytics(id: string | null, surface: 'marketing' | 'dashboard') {
  try {
    if (!browserAvailable()) return
    currentSurface = surface
    const debug = analyticsDebugEnabled()
    if (!debug && (process.env.NODE_ENV !== 'production' || !validMeasurementId(id ?? undefined)
      || !['masabu.co', 'app.masabu.co'].includes(location.hostname))) { pauseAnalytics(); return }
    if (analyticsConsent() !== 'granted') { stopAnalytics(); return }
    const page = analyticsLocation(location.href, surface)
    if (!page) { pauseAnalytics(); return }
    if (measurementId !== id) lastPage = null
    measurementId = id
    const params = {
      page_location: page, page_referrer: analyticsReferrer(document.referrer),
      page_title: surface === 'dashboard' ? 'masabu hesap kurulumu' : document.title,
      ...campaignAttribution(),
    }
    if (!debug && id) {
      ;(window as unknown as Record<string, unknown>)[`ga-disable-${id}`] = false
      if (!document.getElementById('masabu-ga4')) {
        window.dataLayer = window.dataLayer ?? []
        // Do not overwrite another provider's gtag function.
        // eslint-disable-next-line prefer-rest-params -- Google's documented command queue consumes Arguments.
        window.gtag ??= function () { window.dataLayer?.push(arguments) }
        window.gtag('consent', 'default', { analytics_storage: 'denied', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' })
        window.gtag('js', new Date())
        window.gtag('config', id, {
          send_page_view: false, cookie_domain: 'masabu.co', cookie_expires: 15552000,
          allow_google_signals: false, allow_ad_personalization_signals: false, ...params,
        })
        const script = document.createElement('script')
        script.id = 'masabu-ga4'; script.async = true
        script.src = `https://www.googletagmanager.com/gtag/js?id=${id}`
        document.head.appendChild(script)
      }
      // Required on re-grant too, even if the script was loaded earlier.
      window.gtag?.('consent', 'update', { analytics_storage: 'granted' })
      window.gtag?.('set', params)
    }
    active = true
    if (lastPage !== page) {
      send('page_view', params)
      lastPage = page
    }
  } catch { pauseAnalytics() }
}

export function trackMarketingEvent(event: MarketingAnalyticsEvent): void {
  try {
    if (!browserAvailable() || !active || analyticsConsent() !== 'granted') return
    const page = analyticsLocation(location.href, currentSurface)
    const params = analyticsEventParameters(event)
    if (!page || !params) return
    send(event.name, { ...params, ...campaignAttribution(), page_location: page, page_referrer: analyticsReferrer(document.referrer) })
  } catch { /* Measurement must never interrupt a business action. */ }
}

export function consumeSignupReceipt() {
  try {
    const value = readAnalyticsCookie(SIGNUP_RECEIPT_COOKIE)
    if (!value) return
    document.cookie = `${SIGNUP_RECEIPT_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`
    if (value === 'email' || value === 'google') trackMarketingEvent({ name: 'sign_up', method: value })
  } catch { /* Signup must succeed even when cookies are inaccessible. */ }
}
