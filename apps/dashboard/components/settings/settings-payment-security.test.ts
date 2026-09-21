import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const actions = readFileSync(new URL('../../lib/actions/payments.ts', import.meta.url), 'utf8')
const paymentPort = readFileSync(
  new URL('../../../../packages/db/src/payment-provider-port.ts', import.meta.url),
  'utf8',
)
const menuCredentials = readFileSync(
  new URL('../../../menu/lib/payment-credentials.ts', import.meta.url),
  'utf8',
)
const paymentRoute = readFileSync(
  new URL('../../../menu/app/api/payment/route.ts', import.meta.url),
  'utf8',
)
const callbackRoute = readFileSync(
  new URL('../../../menu/app/api/payment/callback/route.ts', import.meta.url),
  'utf8',
)
const restaurantActions = readFileSync(new URL('../../lib/actions/restaurant.ts', import.meta.url), 'utf8')
const authActions = readFileSync(new URL('../../lib/actions/auth.ts', import.meta.url), 'utf8')
const settingsForm = readFileSync(new URL('./SettingsForm.tsx', import.meta.url), 'utf8')
const businessSections = readFileSync(new URL('./BusinessSections.tsx', import.meta.url), 'utf8')

test('settings payment actions never select or persist raw credential columns directly', () => {
  assert.doesNotMatch(actions, /\.from\(['"]payment_credentials['"]\)/)
  assert.match(actions, /writePaymentCredentialVault/)
  assert.match(actions, /rotatePaymentCredentialVault/)
  assert.match(actions, /requestId: z\.string\(\)\.uuid\(\)/)
})

test('credential mutations require owner password step-up before vault access', () => {
  assert.match(actions, /credentialMutationSchema[\s\S]*currentPassword:/)
  assert.match(actions, /supabase\.auth\.signInWithPassword/)
  for (const vaultCall of [
    'writePaymentCredentialVault',
    'rotatePaymentCredentialVault',
    'deletePaymentCredentialVault',
  ]) {
    const call = actions.indexOf(`${vaultCall}({`)
    const gate = actions.lastIndexOf('assertOwnerPassword', call)
    assert.ok(gate >= 0, `${vaultCall} must follow password step-up`)
    assert.ok(call > gate)
  }
  assert.match(businessSections, /autoComplete="current-password"/)
  assert.match(businessSections, /currentPassword,/)
  assert.doesNotMatch(businessSections, /window\.confirm|window\.prompt/)
})

test('payment consumers prefer the encrypted vault and keep legacy access isolated', () => {
  assert.match(paymentPort, /from\('payment_credential_vaults'\)/)
  assert.match(paymentPort, /decryptPaymentCredentials/)
  assert.match(paymentPort, /legacy-plaintext/)
  assert.match(paymentPort, /PAYMENT_CREDENTIAL_VAULT_WRITES_ENABLED/)
  assert.doesNotMatch(menuCredentials, /IYZICO_API_KEY|IYZICO_SECRET_KEY|envFallback/)
})

test('provider errors are converted to stable public messages and stable log events', () => {
  assert.doesNotMatch(actions, /err\.message|result\.errorMessage/)
  assert.doesNotMatch(paymentRoute, /err instanceof Error \? err\.message/)
  assert.doesNotMatch(callbackRoute, /err instanceof Error \? err\.message/)
  assert.doesNotMatch(callbackRoute, /console\.(?:warn|error)\([^\n]*(?:orderId|restaurantId|shareId|basketId|\.error)/)
  assert.doesNotMatch(authActions, /return \{ error: (?:error|updateError)\.message/)
  assert.doesNotMatch(restaurantActions, /return \{ error: error\.message/)
})

test('logo upload rejects SVG and derives storage type and extension from inspected bytes', () => {
  assert.match(restaurantActions, /inspectLogoImage\(bytes, file\.type\)/)
  assert.match(restaurantActions, /ingestMediaFile\(restaurantId, 'settings', file, 'logo'\)/)
  const librarySource = readFileSync(new URL('../../lib/media-library-server.ts', import.meta.url), 'utf8')
  assert.match(librarySource, /sniffMenuImageMime/)
  assert.match(librarySource, /mime: "image\/webp"/)
  assert.doesNotMatch(settingsForm, /image\/svg\+xml/)
})
