import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import test from 'node:test'

const layout = readFileSync(new URL('../app/layout.tsx', import.meta.url), 'utf8')
const legacyInjector = new URL('../components/PreviewInjector.tsx', import.meta.url)
const experiencePreview = readFileSync(new URL('../app/[slug]/ExperienceStatePreview.tsx', import.meta.url), 'utf8')
const experienceRoute = readFileSync(new URL('../app/[slug]/_menu-experience.tsx', import.meta.url), 'utf8')
const themePreviewRoute = readFileSync(new URL('../app/theme-preview/[slug]/page.tsx', import.meta.url), 'utf8')
const publicQueries = readFileSync(new URL('./queries.ts', import.meta.url), 'utf8')
const memberSheet = readFileSync(new URL('../app/[slug]/components/MemberSheet.tsx', import.meta.url), 'utf8')
const paymentModal = readFileSync(new URL('../app/[slug]/components/PaymentModal.tsx', import.meta.url), 'utf8')
const playwrightConfig = readFileSync(new URL('../../../playwright.config.ts', import.meta.url), 'utf8')

test('menu root no longer mounts the legacy global CSS preview receiver', () => {
  assert.doesNotMatch(layout, /PreviewInjector|GARSONLESS_THEME/)
  assert.equal(existsSync(legacyInjector), false)
})

test('theme previews and live identity reads bypass cross-deployment cache while menu data is revision-keyed', () => {
  assert.match(publicQueries, /export function getPreviewRestaurantBySlug[\s\S]*return readRestaurantBySlug\(slug\)/)
  assert.match(publicQueries, /export const getRestaurantBySlug = cache\(readRestaurantBySlug\)/)
  assert.match(publicQueries, /publicMenuCacheKey\('categories', restaurantId, revision\)/)
  assert.match(publicQueries, /publicMenuCacheKey\('items', restaurantId, revision\)/)
  assert.match(experienceRoute, /isPreview\s*\? await getPreviewRestaurantBySlug\(slug\)\s*:\s*await getRestaurantBySlug\(slug\)/)
  assert.match(themePreviewRoute, /await getPreviewRestaurantBySlug\(slug\)/)
  assert.doesNotMatch(themePreviewRoute, /getRestaurantBySlug/)
})

test('preview-only routes require a short-lived restaurant-scoped access token', () => {
  assert.match(experienceRoute, /hasThemePreviewAccess\(\{[\s\S]*token: sp\['previewAccess'\]/)
  assert.match(experienceRoute, /if \(isPreview && !previewAccessGranted\) notFound\(\)/)
  assert.match(themePreviewRoute, /sp\['preview'\] !== '1' \|\| !hasThemePreviewAccess\(\{/)
  assert.match(themePreviewRoute, /previewAccessToken=\{typeof sp\['previewAccess'\] === 'string'/)
})

test('auth theme preview renders the production member auth UI instead of a duplicate fixture', () => {
  assert.match(experiencePreview, /import MemberSheet from '.\/components\/MemberSheet'/)
  assert.match(experiencePreview, /<MemberSheet[\s\S]*previewState=\{state as AuthPreviewState\}/)
  assert.doesNotMatch(experiencePreview, /function AuthFixture/)
  assert.match(memberSheet, /previewState\?: AuthPreviewState/)
})

test('auth preview interactions are local and cannot start OTP or OAuth requests', () => {
  const sendOtp = memberSheet.slice(memberSheet.indexOf('async function sendEmailOtp'), memberSheet.indexOf('async function handleEmail'))
  const oauth = memberSheet.slice(memberSheet.indexOf('async function handleOAuth'), memberSheet.indexOf('async function handleVerify'))
  const verify = memberSheet.slice(memberSheet.indexOf('async function handleVerify'), memberSheet.indexOf('const name = localName'))

  assert.ok(sendOtp.indexOf('if (previewState)') < sendOtp.indexOf("fetch('/api/customer-auth/email/start'"))
  assert.ok(oauth.indexOf('if (previewState)') < oauth.indexOf("fetch('/api/customer-auth/oauth/start'"))
  assert.ok(verify.indexOf('if (previewState)') < verify.indexOf("fetch(authMethod === 'phone'"))
  assert.match(memberSheet, /if \(previewState\) \{\s*setOffline\(false\)\s*return/)
  assert.match(memberSheet, /const visiblePhase = accountPreviewState[\s\S]*\? 'home'/)
  assert.match(memberSheet, /\{visiblePhase === 'join' &&/)
})

test('account preview renders the production account center with closed non-mutating fixtures', () => {
  assert.match(experiencePreview, /data-experience-preview="account"/)
  assert.match(experiencePreview, /<MemberSheet[\s\S]*accountPreviewState=\{state as AccountPreviewState\}/)
  assert.match(experiencePreview, /PREVIEW_ACCOUNT_ACTIONS/)
  assert.match(memberSheet, /accountPreviewState\?: AccountPreviewState/)
  assert.match(themePreviewRoute, /new Set<AccountPreviewState>/)
  assert.doesNotMatch(experiencePreview, /function AccountFixture/)
})

test('account smoke fixtures require an explicit server-only runtime gate and a closed state allowlist', () => {
  assert.match(experienceRoute, /process\.env\['SMOKE_FIXTURES_ENABLED'\] !== 'true'/)
  assert.match(experienceRoute, /new Set<AccountPreviewState>/)
  assert.match(experienceRoute, /readSmokeAccountPreview\(sp\['__customerAccountPreview'\]\)/)
  assert.match(playwrightConfig, /SMOKE_FIXTURES_ENABLED=true corepack pnpm --filter @garsonless\/menu/)
})

test('checkout theme preview renders the production cart and payment components', () => {
  assert.match(experiencePreview, /import \{ CartDrawer,[\s\S]*\} from '@garsonless\/ui\/menu'/)
  assert.match(experiencePreview, /import PaymentModal from '.\/components\/PaymentModal'/)
  assert.match(experiencePreview, /<CartDrawer[\s\S]*isOpen/)
  assert.match(experiencePreview, /<PaymentModal[\s\S]*previewState=\{state\}/)
  assert.doesNotMatch(experiencePreview, /function CheckoutFixture/)
})

test('checkout preview cannot create an order or payment request', () => {
  const initializePayment = paymentModal.slice(paymentModal.indexOf('async function initializePayment'), paymentModal.indexOf('async function submit'))
  const submit = paymentModal.slice(paymentModal.indexOf('async function submit'), paymentModal.indexOf('useEffect(() =>'))

  assert.ok(initializePayment.indexOf('if (previewState) return') < initializePayment.indexOf("fetch('/api/payment'"))
  assert.match(submit, /event\.preventDefault\(\)\s*if \(previewState\) return/)
  assert.match(experiencePreview, /onPlaceOrder=\{\(\) => undefined\}/)
  assert.doesNotMatch(experiencePreview, /fetch\(|\/api\/orders|\/api\/payment/)
})
