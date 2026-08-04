import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import test from 'node:test'

const layout = readFileSync(new URL('../app/layout.tsx', import.meta.url), 'utf8')
const legacyInjector = new URL('../components/PreviewInjector.tsx', import.meta.url)
const experiencePreview = readFileSync(new URL('../app/[slug]/ExperienceStatePreview.tsx', import.meta.url), 'utf8')
const memberSheet = readFileSync(new URL('../app/[slug]/components/MemberSheet.tsx', import.meta.url), 'utf8')
const paymentModal = readFileSync(new URL('../app/[slug]/components/PaymentModal.tsx', import.meta.url), 'utf8')

test('menu root no longer mounts the legacy global CSS preview receiver', () => {
  assert.doesNotMatch(layout, /PreviewInjector|GARSONLESS_THEME/)
  assert.equal(existsSync(legacyInjector), false)
})

test('auth theme preview renders the production member auth UI instead of a duplicate fixture', () => {
  assert.match(experiencePreview, /import MemberSheet from '.\/components\/MemberSheet'/)
  assert.match(experiencePreview, /<MemberSheet[\s\S]*previewState=\{state as AuthPreviewState\}/)
  assert.doesNotMatch(experiencePreview, /function AuthFixture/)
  assert.match(memberSheet, /previewState\?: AuthPreviewState/)
})

test('auth preview interactions are local and cannot start OTP or OAuth requests', () => {
  const sendOtp = memberSheet.slice(memberSheet.indexOf('async function sendOtp'), memberSheet.indexOf('async function handleEmail'))
  const oauth = memberSheet.slice(memberSheet.indexOf('async function handleOAuth'), memberSheet.indexOf('async function handleVerify'))
  const verify = memberSheet.slice(memberSheet.indexOf('async function handleVerify'), memberSheet.indexOf('const name = localName'))

  assert.ok(sendOtp.indexOf('if (previewState)') < sendOtp.indexOf("fetch('/api/customer-auth/email/start'"))
  assert.ok(oauth.indexOf('if (previewState)') < oauth.indexOf("fetch('/api/customer-auth/oauth/start'"))
  assert.ok(verify.indexOf('if (previewState)') < verify.indexOf("fetch('/api/customer-auth/email/verify'"))
  assert.match(memberSheet, /if \(previewState\) \{\s*setOffline\(false\)\s*return/)
  assert.match(memberSheet, /const visiblePhase = previewState === 'otp'/)
  assert.match(memberSheet, /\{visiblePhase === 'join' &&/)
})

test('checkout theme preview renders the production cart and payment components', () => {
  assert.match(experiencePreview, /import \{ CartDrawer,[\s\S]*\} from '@garsonless\/ui'/)
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
