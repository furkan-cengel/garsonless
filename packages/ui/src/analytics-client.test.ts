import assert from 'node:assert/strict'
import test from 'node:test'
import {
  ANALYTICS_CAMPAIGN_COOKIE, ANALYTICS_CONSENT_COOKIE, ANALYTICS_CONSENT_VERSION, SIGNUP_RECEIPT_COOKIE,
} from '@garsonless/domain/marketing-analytics'
import { consumeSignupReceipt, forgetAnalyticsCookies, pauseAnalytics, setAnalyticsConsent, stopAnalytics, syncAnalytics, trackMarketingEvent } from './analytics-client'

function fixture(mode = 'production', debug = false) {
  const keys = ['window', 'document', 'location'] as const
  const originals = keys.map(key => Object.getOwnPropertyDescriptor(globalThis, key))
  const environment = { NODE_ENV: process.env.NODE_ENV, NEXT_PUBLIC_ANALYTICS_DEBUG: process.env.NEXT_PUBLIC_ANALYTICS_DEBUG }
  Object.assign(process.env, { NODE_ENV: mode, NEXT_PUBLIC_ANALYTICS_DEBUG: String(debug) })
  const cookies = new Map([[ANALYTICS_CONSENT_COOKIE, `${ANALYTICS_CONSENT_VERSION}:granted`]])
  const calls: unknown[][] = []
  const scripts: { id?: string; src?: string }[] = []
  const debugEvents: unknown[] = []
  const url = new URL('https://masabu.co/')
  const doc = {
    get cookie() { return [...cookies].map(([k, v]) => `${k}=${v}`).join('; ') },
    set cookie(raw: string) {
      const pair = raw.split(';')[0]!
      const index = pair.indexOf('=')
      if (raw.includes('Max-Age=0')) cookies.delete(pair.slice(0, index))
      else cookies.set(pair.slice(0, index), pair.slice(index + 1))
    },
    title: 'Masabu', referrer: 'https://example.com/private-person?email=secret@example.com',
    getElementById: (id: string) => scripts.find(script => script.id === id),
    createElement: () => ({}),
    head: { appendChild: (script: { id?: string; src?: string }) => scripts.push(script) },
  }
  const win = {
    gtag: (...args: unknown[]) => { calls.push(args) },
    dispatchEvent: (event: Event) => { if (event instanceof CustomEvent) debugEvents.push(event.detail); return true },
  }
  Object.defineProperty(globalThis, 'window', { value: win, configurable: true })
  Object.defineProperty(globalThis, 'document', { value: doc, configurable: true })
  Object.defineProperty(globalThis, 'location', { value: url, configurable: true })
  pauseAnalytics()
  return {
    cookies, calls, scripts, doc, win, url, debugEvents,
    events: () => calls.filter(call => call[0] === 'event'),
    restore() {
      stopAnalytics()
      keys.forEach((key, index) => {
        const original = originals[index]
        if (original) Object.defineProperty(globalThis, key, original)
        else Reflect.deleteProperty(globalThis, key)
      })
      for (const [key, value] of Object.entries(environment)) {
        if (value === undefined) delete process.env[key]
        else process.env[key] = value
      }
    },
  }
}

test('SSR entry points and missing browser/provider are harmless', () => {
  assert.doesNotThrow(() => {
    syncAnalytics('G-MASABUTEST', 'marketing'); stopAnalytics(); forgetAnalyticsCookies()
    setAnalyticsConsent('denied'); consumeSignupReceipt()
    trackMarketingEvent({ name: 'business_created' })
  })
})

test('StrictMode/focus reruns do not duplicate initial or SPA page views; returning to a page does count', () => {
  const f = fixture()
  try {
    for (const path of ['/', '/', '/fiyatlar', '/fiyatlar', '/menu-alerjen-zorunlulugu', '/iletisim', '/']) {
      f.url.pathname = path
      syncAnalytics('G-MASABUTEST', 'marketing')
    }
    assert.equal(f.scripts.length, 1)
    assert.deepEqual(f.events().map(call => (call[2] as { page_location: string }).page_location), [
      'https://masabu.co/', 'https://masabu.co/fiyatlar', 'https://masabu.co/menu-alerjen-zorunlulugu', 'https://masabu.co/iletisim', 'https://masabu.co/',
    ])
    assert.equal((f.calls.find(call => call[0] === 'config')?.[2] as { send_page_view: boolean }).send_page_view, false)
    assert.ok(!JSON.stringify(f.calls).includes('secret'))
  } finally { f.restore() }
})

test('unknown/denied/essential consent never loads Google or queues a conversion', () => {
  for (const consent of ['unknown', 'denied', 'essential']) {
    const f = fixture()
    try {
      f.cookies.set(ANALYTICS_CONSENT_COOKIE, `${ANALYTICS_CONSENT_VERSION}:${consent}`)
      syncAnalytics('G-MASABUTEST', 'marketing')
      trackMarketingEvent({ name: 'free_trial_click', placement: 'content' })
      assert.equal(f.scripts.length, 0)
      assert.equal(f.events().length, 0)
      assert.equal(f.cookies.has(ANALYTICS_CAMPAIGN_COOKIE), false)
    } finally { f.restore() }
  }
})

test('development and localhost production builds never send real analytics; debug is local only', () => {
  for (const [mode, debug, host] of [['development', false, 'masabu.co'], ['production', false, 'localhost'], ['development', true, 'localhost']] as const) {
    const f = fixture(mode, debug)
    const oldDebug = console.debug
    console.debug = () => {}
    try {
      f.url.hostname = host
      syncAnalytics(debug ? null : 'G-MASABUTEST', 'marketing')
      trackMarketingEvent({ name: 'free_trial_click', placement: 'content' })
      assert.equal(f.calls.length, 0)
      assert.equal(f.scripts.length, 0)
      assert.equal(f.debugEvents.length, debug ? 2 : 0)
    } finally { f.restore(); console.debug = oldDebug }
  }
})

test('withdrawal clears attribution, signup and GA cookies; re-grant updates existing provider consent', () => {
  const f = fixture()
  try {
    syncAnalytics('G-MASABUTEST', 'marketing')
    f.cookies.set('_ga', 'private-client')
    f.cookies.set(ANALYTICS_CAMPAIGN_COOKIE, 'campaign')
    setAnalyticsConsent('denied')
    assert.equal(f.cookies.has('_ga'), false)
    assert.equal(f.cookies.has(ANALYTICS_CAMPAIGN_COOKIE), false)
    f.calls.length = 0
    trackMarketingEvent({ name: 'business_created' })
    assert.equal(f.events().length, 0)
    setAnalyticsConsent('granted')
    syncAnalytics('G-MASABUTEST', 'marketing')
    assert.equal(f.scripts.length, 1)
    assert.ok(f.calls.some(call => call[0] === 'consent' && call[1] === 'update' && (call[2] as { analytics_storage: string }).analytics_storage === 'granted'))
    assert.equal(f.events().length, 1)
  } finally { f.restore() }
})

test('private routes pause delivery but preserve consented session; theme URLs are anonymized', () => {
  const f = fixture()
  try {
    f.url.href = 'https://app.masabu.co/dashboard/onboarding'
    syncAnalytics('G-MASABUTEST', 'dashboard')
    f.cookies.set('_ga', 'existing-client')
    f.url.pathname = '/dashboard/private-id/customers'
    syncAnalytics('G-MASABUTEST', 'dashboard')
    trackMarketingEvent({ name: 'business_created' })
    assert.equal(f.cookies.get('_ga'), 'existing-client')
    assert.equal(f.events().length, 1)
    f.url.pathname = '/dashboard/03352bb3-d38b-4db1-90ef-37379a07b1e5/theme/default/edit'
    syncAnalytics('G-MASABUTEST', 'dashboard')
    trackMarketingEvent({ name: 'menu_published', publication_type: 'explicit_publish' })
    assert.equal(f.events().length, 3)
    assert.ok(!JSON.stringify(f.calls).includes('03352'))
  } finally { f.restore() }
})

test('first-touch campaign persists to signup and business conversions, excludes gclid and invalid PII', () => {
  const f = fixture()
  try {
    f.url.search = '?utm_source=google&utm_medium=cpc&utm_campaign=launch&utm_content=hero&utm_term=qr_menu&gclid=privateClickId&email=secret@example.com'
    syncAnalytics('G-MASABUTEST', 'marketing')
    const attribution = f.cookies.get(ANALYTICS_CAMPAIGN_COOKIE)
    assert.ok(attribution)
    f.url.href = 'https://app.masabu.co/auth/signup?utm_source=other'
    syncAnalytics('G-MASABUTEST', 'dashboard')
    trackMarketingEvent({ name: 'sign_up', method: 'google' })
    assert.equal((f.events().at(-1)?.[2] as { campaign_source: string }).campaign_source, 'google')
    assert.ok(!JSON.stringify(f.calls).includes('privateClickId'))
    assert.ok(!attribution.includes('gclid'))
    f.url.href = 'https://app.masabu.co/dashboard/onboarding'
    syncAnalytics('G-MASABUTEST', 'dashboard')
    trackMarketingEvent({ name: 'business_created', selected_plan: 'pro' })
    assert.equal((f.events().at(-1)?.[2] as { campaign_name: string }).campaign_name, 'launch')
    f.cookies.set(ANALYTICS_CAMPAIGN_COOKIE, encodeURIComponent(JSON.stringify({ at: Date.now() - 1800001, search: 'utm_source=expired' })))
    f.url.search = '?utm_source=user@example.com&utm_campaign=valid_campaign'
    syncAnalytics('G-MASABUTEST', 'dashboard')
    trackMarketingEvent({ name: 'business_created' })
    assert.equal((f.events().at(-1)?.[2] as { campaign_source?: string }).campaign_source, undefined)
  } finally { f.restore() }
})

test('email/Google signup receipt is consumed once and never replayed after denied consent', () => {
  for (const method of ['email', 'google']) {
    const f = fixture()
    try {
      f.url.href = 'https://app.masabu.co/dashboard/onboarding'
      syncAnalytics('G-MASABUTEST', 'dashboard')
      f.cookies.set(SIGNUP_RECEIPT_COOKIE, method)
      consumeSignupReceipt(); consumeSignupReceipt()
      assert.equal(f.events().filter(call => call[1] === 'sign_up').length, 1)
      f.cookies.set(ANALYTICS_CONSENT_COOKIE, `${ANALYTICS_CONSENT_VERSION}:denied`)
      f.cookies.set(SIGNUP_RECEIPT_COOKIE, method)
      consumeSignupReceipt()
      f.cookies.set(ANALYTICS_CONSENT_COOKIE, `${ANALYTICS_CONSENT_VERSION}:granted`)
      consumeSignupReceipt()
      assert.equal(f.events().filter(call => call[1] === 'sign_up').length, 1)
    } finally { f.restore() }
  }
})

test('provider exceptions and blocked cookies fail closed without affecting application actions', () => {
  const f = fixture()
  try {
    f.win.gtag = () => { throw new Error('blocked') }
    assert.doesNotThrow(() => syncAnalytics('G-MASABUTEST', 'marketing'))
    assert.doesNotThrow(() => trackMarketingEvent({ name: 'business_created' }))
    Object.defineProperty(f.doc, 'cookie', { get() { throw new Error('storage blocked') }, set() { throw new Error('storage blocked') }, configurable: true })
    assert.doesNotThrow(() => { setAnalyticsConsent('denied'); syncAnalytics('G-MASABUTEST', 'marketing'); consumeSignupReceipt(); stopAnalytics() })
  } finally { f.restore() }
})
