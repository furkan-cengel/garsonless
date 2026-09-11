import assert from 'node:assert/strict'
import test from 'node:test'
import type { OnboardingSnapshot } from '@garsonless/application/onboarding'
import { ANALYTICS_CONSENT_COOKIE, ANALYTICS_CONSENT_VERSION } from '@garsonless/domain/marketing-analytics'
import { syncAnalytics, trackMarketingEvent, stopAnalytics } from '@garsonless/ui/analytics-client'
import { menuSetupEvents, trackOnboardingEvent } from './onboarding-analytics'

const completed: OnboardingSnapshot = {
  status: 'completed', restaurantId: 'private-id', restaurantName: 'Private name', slug: 'private-slug',
  logoUrl: null, accent: '#000000', currentStep: 'complete', completedSteps: ['business', 'branding', 'menu'],
  menuEntryMethod: 'manual', targetPlan: 'pro', trialEndsAt: null, startedAt: null, completedAt: '2026-09-11',
  revision: 3, categoryCount: 1, itemCount: 1, checklistDismissedAt: null,
}

test('first successful menu setup emits milestones for manual and CSV creation', () => {
  for (const method of ['manual', 'csv'] as const) {
    assert.deepEqual(menuSetupEvents({ replayed: false, snapshot: { ...completed, menuEntryMethod: method } }, 0), [
      { name: 'first_product_added', method }, { name: 'menu_setup_completed', method },
    ])
  }
  assert.deepEqual(menuSetupEvents({ replayed: false, snapshot: completed }, 2), [
    { name: 'menu_setup_completed', method: 'manual' },
  ])
})

test('failed, replayed, incomplete and empty menu mutations do not count as activation', () => {
  assert.deepEqual(menuSetupEvents({ error: 'failed' }, 0), [])
  assert.deepEqual(menuSetupEvents({ replayed: true, snapshot: completed }, 0), [])
  for (const snapshot of [
    { ...completed, status: 'in_progress' as const }, { ...completed, itemCount: 0 },
    { ...completed, completedSteps: [] }, { ...completed, menuEntryMethod: null },
  ]) assert.deepEqual(menuSetupEvents({ replayed: false, snapshot }, 0), [])
})

test('activation sender strips business data, honors consent changes and blocks private routes', async () => {
  const keys = ['document', 'window', 'location'] as const
  const originals = keys.map((key) => Object.getOwnPropertyDescriptor(globalThis, key))
  const oldId = process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID
  const calls: unknown[][] = []
  const doc = {
    cookie: `${ANALYTICS_CONSENT_COOKIE}=${ANALYTICS_CONSENT_VERSION}:granted`,
    referrer: 'https://app.masabu.co/private-id?email=private@example.com',
    getElementById: () => ({}),
  }
  const url = { hostname: 'app.masabu.co', href: 'https://app.masabu.co/dashboard/onboarding?email=private@example.com', search: '' }
  Object.defineProperty(globalThis, 'document', { value: doc, configurable: true })
  Object.defineProperty(globalThis, 'window', { value: { gtag: (...args: unknown[]) => calls.push(args) }, configurable: true })
  Object.defineProperty(globalThis, 'location', { value: url, configurable: true })
  process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID = 'G-MASABUTEST'
  try {
    syncAnalytics('G-MASABUTEST', 'dashboard')
    calls.length = 0
    for (const event of menuSetupEvents({ replayed: false, snapshot: completed }, 0)) {
      const eventWithExtraFields = { ...event, restaurantId: 'private-id', email: 'private@example.com' }
      trackMarketingEvent(eventWithExtraFields)
    }
    trackMarketingEvent({ name: 'menu_preview_click', placement: 'onboarding_complete' })
    assert.deepEqual(calls.map((call) => call[1]), ['first_product_added', 'menu_setup_completed', 'menu_preview_click'])
    assert.deepEqual(calls[0]?.[2], { method: 'manual', page_location: 'https://app.masabu.co/dashboard/onboarding', page_referrer: 'https://app.masabu.co' })
    assert.equal(JSON.stringify(calls).includes('private'), false)
    calls.length = 0
    await trackOnboardingEvent({ name: 'menu_setup_completed', method: 'csv' })
    assert.equal(calls[0]?.[1], 'menu_setup_completed')
    calls.length = 0
    doc.cookie = `${ANALYTICS_CONSENT_COOKIE}=${ANALYTICS_CONSENT_VERSION}:denied`
    const denied = trackOnboardingEvent({ name: 'menu_setup_completed', method: 'csv' })
    doc.cookie = `${ANALYTICS_CONSENT_COOKIE}=${ANALYTICS_CONSENT_VERSION}:granted`
    await denied
    assert.equal(calls.length, 0, 'granting later must not replay a denied event')
    const pending = trackOnboardingEvent({ name: 'menu_setup_completed', method: 'csv' })
    doc.cookie = `${ANALYTICS_CONSENT_COOKIE}=${ANALYTICS_CONSENT_VERSION}:denied`
    await pending
    assert.equal(calls.length, 0, 'revoking during dynamic import must block delivery')
    doc.cookie = `${ANALYTICS_CONSENT_COOKIE}=${ANALYTICS_CONSENT_VERSION}:granted`
    url.href = 'https://app.masabu.co/dashboard/private-id/menu'
    trackMarketingEvent({ name: 'menu_preview_click', placement: 'onboarding_complete' })
    assert.equal(calls.length, 0)
  } finally {
    stopAnalytics()
    keys.forEach((key, index) => {
      const original = originals[index]
      if (original) Object.defineProperty(globalThis, key, original)
      else Reflect.deleteProperty(globalThis, key)
    })
    if (oldId === undefined) delete process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID
    else process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID = oldId
  }
})
