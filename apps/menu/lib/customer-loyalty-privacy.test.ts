import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import {
  decodeCustomerLoyaltyCursor,
  encodeCustomerLoyaltyCursor,
  parseCustomerConsentUpdate,
  parseCustomerDeleteRequest,
  parseCustomerPrivacyExport,
} from './customer-account-contract.ts'

const restaurantId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const requestId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'

test('consent updates keep marketing explicit, independent and reversible', () => {
  assert.deepEqual(parseCustomerConsentUpdate({
    restaurantId,
    consentType: 'marketing',
    grant: false,
  }), { restaurantId, consentType: 'marketing', grant: false })
  assert.deepEqual(parseCustomerConsentUpdate({
    restaurantId,
    consentType: 'contact_data',
    grant: true,
  }), { restaurantId, consentType: 'contact_data', grant: true })
  assert.equal(parseCustomerConsentUpdate({ restaurantId, grant: true }), null)
  assert.equal(parseCustomerConsentUpdate({ restaurantId, consentType: 'all', grant: true }), null)
  assert.equal(parseCustomerConsentUpdate({ restaurantId, consentType: 'marketing', grant: true, customerId: requestId }), null)
})

test('privacy mutations require an idempotency UUID and exact destructive confirmation', () => {
  assert.deepEqual(parseCustomerPrivacyExport({ requestId }), { requestId })
  assert.equal(parseCustomerPrivacyExport({ requestId, customerId: restaurantId }), null)
  assert.deepEqual(parseCustomerDeleteRequest({ requestId, confirmation: 'HESABIMI SİL' }), {
    requestId,
    confirmation: 'HESABIMI SİL',
  })
  assert.equal(parseCustomerDeleteRequest({ requestId, confirmation: 'hesabımı sil' }), null)
  assert.equal(parseCustomerDeleteRequest({ requestId, confirmation: 'HESABIMI SİL', customerId: restaurantId }), null)
})

test('loyalty activity cursor is opaque, stable and rejects malformed values', () => {
  const input = { createdAt: '2026-07-30T13:25:00.000Z', id: requestId }
  const cursor = encodeCustomerLoyaltyCursor(input)
  assert.doesNotMatch(cursor, /2026|bbbbbbbb/)
  assert.deepEqual(decodeCustomerLoyaltyCursor(cursor), input)
  assert.equal(decodeCustomerLoyaltyCursor(Buffer.from(JSON.stringify({ v: 1, a: input.createdAt, i: 'bad' })).toString('base64url')), null)
  assert.equal(decodeCustomerLoyaltyCursor('not-json'), null)
})

test('loyalty, consent and privacy routes derive customer ownership from the trusted session', () => {
  const routes = [
    '../app/api/account/consents/route.ts',
    '../app/api/account/loyalty-activity/route.ts',
    '../app/api/account/privacy/export/route.ts',
    '../app/api/account/privacy/delete-request/route.ts',
  ].map((path) => readFileSync(new URL(path, import.meta.url), 'utf8'))

  for (const route of routes) {
    assert.match(route, /getCustomerSession\(\)/)
    assert.doesNotMatch(route, /searchParams\.get\(['"]customerId|body\.customerId|input\.customerId/)
    assert.match(route, /customerAuthErrorResponse/)
  }
  for (const route of [routes[0]!, routes[2]!, routes[3]!]) {
    assert.match(route, /validateCustomerAuthMutation\(request\)/)
  }

  const server = readFileSync(new URL('./customer-account-server.ts', import.meta.url), 'utf8')
  assert.match(server, /customerId: input\.session\.customerId/)
  assert.match(server, /customerId: session\.customerId, requestId/)
  assert.match(server, /source: 'account_center'/)
  assert.match(server, /current\?\.consents\.some\(\(consent\) => consent\.restaurantId === input\.restaurantId\)/)
})

test('account center exposes cursor activity and accessible independent privacy controls', () => {
  const center = readFileSync(new URL('../app/[slug]/components/AccountCenter.tsx', import.meta.url), 'utf8')

  assert.match(center, /\/api\/account\/loyalty-activity\?\$\{params\}/)
  assert.match(center, /data-direction=\{item\.direction\}/)
  assert.match(center, /direction === 'reversal'/)
  assert.match(center, /type="checkbox"[\s\S]*consentType: 'contact_data'|onConsent\(consent\.restaurant\.id, 'contact_data'/)
  assert.match(center, /onConsent\(consent\.restaurant\.id, 'marketing'/)
  assert.match(center, /Opsiyoneldir, varsayılan olarak kapalıdır ve üstteki izinden ayrıdır\./)
  assert.match(center, /marketing: false/)
  assert.match(center, /Verilerimi dışa aktar/)
  assert.match(center, /Onaylamak için <b>HESABIMI SİL<\/b> yaz/)
  assert.match(center, /Hesabın hemen silinmez/)
  assert.match(center, /min-height:44px/)
  assert.match(center, /prefers-reduced-motion:reduce/)
  assert.match(center, /data-account-loyalty/)
  assert.match(center, /<SectionHeading title="Sadakat kartların" \/>/)
  assert.doesNotMatch(center, /ac-profile-loyalty-title/)
  assert.match(center, /LoyaltyStampGrid/)
  assert.match(center, /stampRewardText/)
  assert.match(center, /initialTab/)

  const memberSheet = readFileSync(new URL('../app/[slug]/components/MemberSheet.tsx', import.meta.url), 'utf8')
  assert.match(memberSheet, /currentRestaurantLoyalty/)
  assert.match(memberSheet, /points: balances\.points/)
  assert.match(memberSheet, /stamps: balances\.stamps/)
  assert.match(memberSheet, /initialTarget === 'loyalty' \? 'profile' : 'overview'/)
  assert.match(memberSheet, /stampUnlocked: balances\.stampUnlocked/)
})
