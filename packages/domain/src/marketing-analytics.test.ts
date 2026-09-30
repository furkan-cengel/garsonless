import assert from 'node:assert/strict'
import test from 'node:test'
import { ANALYTICS_CONSENT_VERSION, analyticsCampaign, analyticsLocation, analyticsPath, analyticsReferrer, isFreshSignup, parseAnalyticsConsent, validMeasurementId } from './marketing-analytics'

test('analytics requires a valid current explicit choice', () => {
  for (const value of [undefined, 'true', '2020:granted', 'granted']) assert.equal(parseAnalyticsConsent(value), 'unknown')
  assert.equal(parseAnalyticsConsent(`${ANALYTICS_CONSENT_VERSION}:granted`), 'granted')
  assert.equal(parseAnalyticsConsent(`${ANALYTICS_CONSENT_VERSION}:denied`), 'denied')
  assert.equal(parseAnalyticsConsent(`${ANALYTICS_CONSENT_VERSION}:essential`), 'essential')
  assert.equal(validMeasurementId('G-MASABUTEST'), 'G-MASABUTEST')
  assert.equal(validMeasurementId('G-<script>'), null)
})
test('auth secrets and business identifiers are excluded from analytics URLs', () => {
  assert.equal(analyticsLocation('https://app.masabu.co/auth/confirm?email=secret@example.com&token_hash=secret#code', 'dashboard'), 'https://app.masabu.co/auth/confirm')
  for (const path of ['/dashboard/restaurant-id/orders', '/auth/google/callback', '/auth/reset-password', '/auth/login']) assert.equal(analyticsPath(path, 'dashboard'), null)
  assert.equal(analyticsReferrer('https://app.masabu.co/auth/confirm?email=secret@example.com'), 'https://app.masabu.co')
  assert.equal(analyticsReferrer('javascript:alert(1)'), '')
})
test('campaign allowlist drops email, phone and arbitrary query values', () => {
  assert.deepEqual(analyticsCampaign('?utm_source=google&utm_medium=organic&utm_campaign=launch_tr&utm_content=a%40example.com&utm_term=phone5551234567&email=secret'), { campaign_source: 'google', campaign_medium: 'organic', campaign_name: 'launch_tr' })
})
test('OAuth conversion checks first account creation within the server-started flow', () => {
  const start = Date.parse('2026-09-09T09:00:00Z')
  const first = { created_at: '2026-09-09T09:00:01Z', email_confirmed_at: '2026-09-09T09:00:02Z', last_sign_in_at: '2026-09-09T09:00:02Z' }
  assert.equal(isFreshSignup(first, start), true)
  assert.equal(isFreshSignup({ ...first, created_at: '2026-01-01T09:00:00Z' }, start), false)
  assert.equal(isFreshSignup({ ...first, last_sign_in_at: '2026-09-10T09:00:00Z' }, start), false)
})

test('allergen acquisition route is measured without visitor query values', () => {
  assert.equal(analyticsLocation('https://masabu.co/menu-alerjen-zorunlulugu?email=private@example.com&utm_source=google#uyum-takvimi', 'marketing'), 'https://masabu.co/menu-alerjen-zorunlulugu')
  assert.equal(analyticsPath('/menu-alerjen-zorunlulugu/private', 'marketing'), null)
})


test('desktop/mobile CTA contracts produce each event once with trusted pricing metadata', async () => {
  const { marketingClickEvents } = await import('./marketing-analytics')
  for (const placement of ['header', 'content', 'footer'] as const) {
    const input = { href: 'https://app.masabu.co/auth/signup', origin: 'https://masabu.co', pathname: '/', placement, hero: placement === 'content' }
    const events = marketingClickEvents(input)
    assert.deepEqual(events.map(e => e.name), ['signup_click', 'free_trial_click'])
    assert.equal(new Set(events.map(e => e.name)).size, events.length)
    assert.equal('location' in events[0]! && events[0].location, placement === 'header' ? 'navbar' : placement === 'content' ? 'hero' : 'footer')
  }
  const input = { href: 'https://app.masabu.co/auth/signup?plan=pro&interval=yearly&email=secret@example.com', origin: 'https://masabu.co', pathname: '/fiyatlar', placement: 'content' as const }
  const events = marketingClickEvents(input)
  assert.deepEqual(events.at(-1), { name: 'pricing_cta_click', placement: 'content', location: 'pricing', cta_type: 'signup', plan_name: 'pro', billing_period: 'yearly' })
  assert.ok(!JSON.stringify(events).includes('secret'))
  assert.deepEqual(marketingClickEvents({ ...input, href: 'https://other.example/auth/signup' }), [])
  assert.deepEqual(marketingClickEvents({ ...input, href: '::::', demo: true }), [])
  const demo = marketingClickEvents({ ...input, href: '/iletisim?subject=business', pathname: '/menu-alerjen-zorunlulugu', demo: true })
  assert.deepEqual(demo.map(e => e.name), ['demo_request_click', 'allergen_landing_cta_click'])
})

test('phone/WhatsApp tracking never contains numbers or message text', async () => {
  const { marketingClickEvents } = await import('./marketing-analytics')
  for (const [href, name] of [['tel:+905551234567', 'phone_click'], ['https://wa.me/905551234567?text=private', 'whatsapp_click']]) {
    assert.deepEqual(marketingClickEvents({ href: href!, origin: 'https://masabu.co', pathname: '/', placement: 'footer' }), [{ name, placement: 'footer', location: 'footer' }])
  }
})

test('contact success is distinct from invalid, failed, missing or honeypot responses', async () => {
  const { contactSubmissionEvents, analyticsEventParameters } = await import('./marketing-analytics')
  for (const payload of [null, {}, { success: true }, { success: false, leadAccepted: true }]) assert.deepEqual(contactSubmissionEvents(true, payload, 'sales'), [])
  assert.deepEqual(contactSubmissionEvents(false, { success: true, leadAccepted: true }, 'sales'), [])
  const accepted = contactSubmissionEvents(true, { success: true, leadAccepted: true, email: 'private@example.com' }, 'sales')
  assert.deepEqual(accepted, [{ name: 'contact_form_submit', topic: 'sales' }, { name: 'generate_lead', topic: 'sales' }])
  assert.deepEqual(analyticsEventParameters(accepted[0]!), { topic: 'sales', form_type: 'demo' })
  assert.deepEqual(contactSubmissionEvents(true, { success: true, leadAccepted: false }, 'support'), [{ name: 'contact_form_submit', topic: 'support' }])
})

test('runtime payload allowlist drops extra keys, invalid enum values and unknown event names', async () => {
  const { analyticsEventParameters } = await import('./marketing-analytics')
  const event = { name: 'free_trial_click', placement: 'secret@example.com', email: 'secret@example.com' }
  assert.deepEqual(analyticsEventParameters(event as never), {})
  assert.equal(analyticsEventParameters({ name: 'rogue_event' } as never), null)
  assert.equal(analyticsEventParameters({ name: 'sign_up', method: 'private' } as never), null)
})

test('publication counts a successful explicit publish, never retries, conflicts or draft saves', async () => {
  const { menuPublicationEvent, analyticsLocation } = await import('./marketing-analytics')
  assert.deepEqual(menuPublicationEvent({ status: 'published' }), { name: 'menu_published', publication_type: 'explicit_publish' })
  for (const status of ['replayed', 'conflict', 'draft_conflict', 'saved', undefined]) assert.equal(menuPublicationEvent({ status }), null)
  assert.equal(analyticsLocation('https://app.masabu.co/dashboard/03352bb3-d38b-4db1-90ef-37379a07b1e5/theme/default/edit?token=secret', 'dashboard'), 'https://app.masabu.co/dashboard/theme')
})
