'use client'

import {
  ANALYTICS_CONSENT_COOKIE, ANALYTICS_CONSENT_VERSION, SIGNUP_RECEIPT_COOKIE, SIGNUP_PENDING_COOKIE,
  analyticsCampaign, analyticsLocation, analyticsReferrer, parseAnalyticsConsent,
  type AnalyticsConsent, type MarketingAnalyticsEvent,
} from '@garsonless/domain/marketing-analytics'

declare global {
  interface Window {
    dataLayer?: IArguments[]
    gtag?: (...args: unknown[]) => void
  }
}

let measurementId: string | null = null
let currentSurface: 'marketing' | 'dashboard' = 'marketing'
let lastPage: string | null = null

export function readAnalyticsCookie(name: string): string | undefined {
  if (typeof document === 'undefined') return undefined
  return document.cookie.split('; ').find((part) => part.startsWith(name + '='))?.slice(name.length + 1)
}

export function analyticsConsent(): AnalyticsConsent {
  return parseAnalyticsConsent(readAnalyticsCookie(ANALYTICS_CONSENT_COOKIE))
}

function cookieScope() {
  return location.hostname === 'masabu.co' || location.hostname.endsWith('.masabu.co') ? '; Domain=masabu.co' : ''
}

export function forgetAnalyticsCookies() {
  for (const part of document.cookie.split('; ')) {
    const name = part.split('=')[0] ?? ''
    if (!/^_ga(?:_|$)/.test(name) && name !== SIGNUP_RECEIPT_COOKIE && name !== SIGNUP_PENDING_COOKIE) continue
    for (const scope of ['', cookieScope(), `; Domain=${location.hostname}`]) {
      document.cookie = `${name}=; Path=/; Max-Age=0${scope}; SameSite=Lax`
    }
  }
}

export function setAnalyticsConsent(value: 'granted' | 'denied' | 'essential') {
  document.cookie = `${ANALYTICS_CONSENT_COOKIE}=${ANALYTICS_CONSENT_VERSION}:${value}; Path=/; Max-Age=15552000; SameSite=Lax${cookieScope()}${location.protocol === 'https:' ? '; Secure' : ''}`
  if (value !== 'granted') stopAnalytics()
  window.dispatchEvent(new Event('masabu:analytics-consent'))
}

export function stopAnalytics() {
  if (measurementId) (window as unknown as Record<string, unknown>)[`ga-disable-${measurementId}`] = true
  measurementId = null
  forgetAnalyticsCookies()
  lastPage = null
}

export function syncAnalytics(id: string, surface: 'marketing' | 'dashboard') {
  currentSurface = surface
  if (!['masabu.co', 'app.masabu.co', 'localhost', '127.0.0.1'].includes(location.hostname)) return
  if (analyticsConsent() !== 'granted') { stopAnalytics(); return }
  const page = analyticsLocation(location.href, surface)
  if (!page) { stopAnalytics(); return }
  measurementId = id
  ;(window as unknown as Record<string, unknown>)[`ga-disable-${id}`] = false
  if (!document.getElementById('masabu-ga4')) {
    window.dataLayer = window.dataLayer ?? []
    // Google's command queue requires an Arguments object.
    // eslint-disable-next-line prefer-rest-params -- gtag's documented queue consumes Arguments, not arrays.
    window.gtag = function () { window.dataLayer?.push(arguments) }
    window.gtag('consent', 'default', { analytics_storage: 'denied', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' })
    window.gtag('consent', 'update', { analytics_storage: 'granted' })
    window.gtag('js', new Date())
    window.gtag('config', id, {
      send_page_view: false, cookie_domain: 'auto', cookie_expires: 15552000,
      allow_google_signals: false, allow_ad_personalization_signals: false,
      page_location: page, page_referrer: analyticsReferrer(document.referrer),
      page_title: surface === 'dashboard' ? 'masabu hesap kurulumu' : document.title,
      ...analyticsCampaign(location.search),
    })
    const script = document.createElement('script')
    script.id = 'masabu-ga4'; script.async = true
    script.src = `https://www.googletagmanager.com/gtag/js?id=${id}`
    document.head.appendChild(script)
  }
  if (lastPage !== page) {
    window.gtag?.('event', 'page_view', { page_location: page, page_referrer: analyticsReferrer(document.referrer), page_title: surface === 'dashboard' ? 'masabu hesap kurulumu' : document.title })
    lastPage = page
  }
}

export function trackMarketingEvent(event: MarketingAnalyticsEvent): void {
  try {
    if (!measurementId || analyticsConsent() !== 'granted') return
    const page = analyticsLocation(location.href, currentSurface)
    if (!page) return
    // Rebuild the payload so callers cannot accidentally add personal fields.
    const params = event.name === 'signup_click' ? { placement: event.placement }
      : event.name === 'generate_lead' ? { topic: event.topic }
        : event.name === 'sign_up' ? { method: event.method } : { plan: event.plan }
    window.gtag?.('event', event.name, { ...params, page_location: page, page_referrer: analyticsReferrer(document.referrer) })
  } catch { /* Measurement must never interrupt a business action. */ }
}

export function consumeSignupReceipt() {
  const value = readAnalyticsCookie(SIGNUP_RECEIPT_COOKIE)
  if (!value) return
  document.cookie = `${SIGNUP_RECEIPT_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`
  if (value === 'email' || value === 'google') trackMarketingEvent({ name: 'sign_up', method: value })
}
