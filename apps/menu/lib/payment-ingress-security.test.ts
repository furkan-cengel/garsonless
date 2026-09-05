import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const paymentRoute = readFileSync(new URL('../app/api/payment/route.ts', import.meta.url), 'utf8')
const callbackRoute = readFileSync(new URL('../app/api/payment/callback/route.ts', import.meta.url), 'utf8')
const splitPayRoute = readFileSync(new URL('../app/api/split/pay/route.ts', import.meta.url), 'utf8')
const paymentModal = readFileSync(new URL('../app/[slug]/components/PaymentModal.tsx', import.meta.url), 'utf8')
const splitModal = readFileSync(new URL('../app/[slug]/components/SplitBillModal.tsx', import.meta.url), 'utf8')
const credentialResolver = readFileSync(new URL('./payment-credentials.ts', import.meta.url), 'utf8')

test('normal and split card checkout fail closed outside the allowed Iyzico environment', () => {
  assert.match(paymentRoute, /!isIyzicoEnvironmentAllowed\(credentials\.baseUrl\)/)
  assert.match(splitPayRoute, /!isIyzicoEnvironmentAllowed\(credentials\.baseUrl\)/)
  assert.match(credentialResolver, /isIyzicoEnvironmentAllowed\(credentials\.baseUrl\)/)
  assert.match(credentialResolver, /live_credentials_required/)
})

test('all public card ingress routes use the streaming request byte ceiling', () => {
  assert.match(paymentRoute, /await readBoundedPaymentJson\(req\)/)
  assert.match(splitPayRoute, /await readBoundedPaymentJson\(req\)/)
  assert.match(callbackRoute, /await readBoundedPaymentCallbackToken\(req\)/)
  assert.doesNotMatch(callbackRoute, /await req\.(?:text|json)\(\)/)
})

test('checkout routes forward real validated buyer identity without fake constants', () => {
  assert.doesNotMatch(paymentRoute, /identityNumber:\s*['"]11111111111['"]|guest@masabu\.co/)
  assert.doesNotMatch(splitPayRoute, /identityNumber:\s*['"]11111111111['"]|guest@masabu\.co/)
  assert.match(paymentRoute, /identityNumber: buyerIdentityNumber/)
  assert.match(splitPayRoute, /identityNumber: buyerIdentityNumber/)
  assert.match(paymentModal, /buyerIdentityNumber: buyer\.identityNumber\.trim\(\)/)
  assert.match(splitModal, /buyerIdentityNumber: buyer\.identityNumber\.trim\(\)/)
})

test('split client reuses a stable UUID for an unchanged declaration intent', () => {
  assert.match(splitModal, /requestIntentRef/)
  assert.match(splitModal, /requestId: crypto\.randomUUID\(\)/)
  assert.match(splitModal, /requestId: intent\.requestId/)
  assert.match(splitModal, /const body = \{ \.\.\.declarationBody\(method\), method \}/)
  assert.match(splitModal, /const declaration = declarationBody\('iyzico'\)/)
  assert.doesNotMatch(splitModal, /deviceId:\s*`dev-/)
})
