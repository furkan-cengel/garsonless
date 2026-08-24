import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const actions = readFileSync(new URL('../actions/billing.ts', import.meta.url), 'utf8')
const callback = readFileSync(
  new URL('../../app/api/billing/iyzico/checkout/callback/route.ts', import.meta.url),
  'utf8',
)
const webhook = readFileSync(
  new URL('../../app/api/billing/iyzico/webhook/route.ts', import.meta.url),
  'utf8',
)
const maintenance = readFileSync(
  new URL('../../app/api/internal/billing-maintenance/route.ts', import.meta.url),
  'utf8',
)
const settingsPage = readFileSync(
  new URL('../../app/dashboard/[restaurantId]/settings/page.tsx', import.meta.url),
  'utf8',
)
const settingsForm = readFileSync(
  new URL('../../components/settings/SettingsForm.tsx', import.meta.url),
  'utf8',
)
const settingsSections = readFileSync(
  new URL('../../components/settings/settings-sections.ts', import.meta.url),
  'utf8',
)
const billingSection = readFileSync(
  new URL('../../components/settings/BillingSection.tsx', import.meta.url),
  'utf8',
)

test('billing mutations resolve owner authority before provider configuration or service RPC access', () => {
  const gate = actions.indexOf('const gate = await ownerGate')
  const providerConfig = actions.indexOf('readIyzicoSubscriptionProviderConfig()', gate)
  const operationPort = actions.indexOf('createSubscriptionBillingOperationsPort()', gate)
  assert.ok(gate >= 0)
  assert.ok(providerConfig > gate)
  assert.ok(operationPort > gate)
  assert.match(actions, /const gate = await assertOwner\(parsed\.data\)/)
})

test('checkout price and callback origin are server-derived instead of client supplied', () => {
  assert.match(actions, /config\.plans\[parsed\.data\.plan\]\[parsed\.data\.interval\]/)
  assert.match(actions, /config\.addOns\?\.iyzico_online_payments\?\.\[parsed\.data\.interval\]/)
  assert.match(actions, /addOns: parsed\.data\.addOns/)
  assert.match(actions, /amount: \{ minor: providerPlan\.amountMinor, currency: 'TRY' \}/)
  assert.match(actions, /expectedProviderPlanRef: providerPlan\.referenceCode/)
  assert.match(actions, /providerPlanRef: providerPlan\.referenceCode/)
  assert.match(actions, /billingCheckoutCallbackUrl\(process\.env\['NEXT_PUBLIC_APP_URL'\]\)/)
  assert.doesNotMatch(actions, /input\.amount|input\.callbackUrl/)
})

test('checkout callback is bounded, token-hashed and never returns provider diagnostics', () => {
  assert.match(callback, /const MAX_CALLBACK_BYTES = 8 \* 1024/)
  assert.match(callback, /createHash\('sha256'\)\.update\(token\)/)
  assert.match(callback, /MAS-PAY-409/)
  assert.match(callback, /MAS-SVC-503/)
  assert.match(callback, /isBillingCallbackMediaType/)
  assert.match(callback, /sanitizeServerDiagnostic\(cause\)/)
  assert.match(callback, /cache-control', 'no-store'/)
  assert.doesNotMatch(callback, /result\.error/)
})

test('billing webhook rejects the wrong media type and marks every response no-store', () => {
  assert.match(webhook, /isBillingWebhookMediaType/)
  assert.match(webhook, /BILLING_WEBHOOK_UNSUPPORTED_MEDIA_TYPE/)
  assert.match(webhook, /BILLING_WEBHOOK_INVALID_BODY/)
  assert.match(webhook, /cache-control', 'no-store'/)
})

test('billing settings are read only for a verified owner and degrade without breaking other settings', () => {
  assert.match(settingsPage, /actor\.isOwner && initialSection === 'billing'/)
  assert.match(settingsPage, /readSubscriptionBillingSettings\(actor, restaurantId, createSubscriptionBillingSettingsReadPort\(\)\)/)
  assert.match(settingsPage, /billing=\{billing\?\.ok \? billing\.value : null\}/)
  assert.match(settingsPage, /billingLoadError=\{billing && !billing\.ok \? billing\.error : null\}/)
  assert.match(settingsForm, /canAccessSettingsSection\(id, isOwner\)/)
  assert.match(settingsSections, /const OWNER_ONLY_SETTINGS_SECTIONS = new Set<SettingsSectionId>/)
  for (const section of ['workspace', 'team', 'payments', 'loyalty', 'kitchen', 'api', 'billing']) {
    assert.match(settingsSections, new RegExp(`'${section}'`))
  }
})

test('owner checkout UI keeps provider HTML isolated and omits provider diagnostics', () => {
  assert.match(billingSection, /sandbox="allow-forms allow-scripts allow-popups allow-top-navigation-by-user-activation"/)
  assert.match(billingSection, /referrerPolicy="no-referrer"/)
  assert.doesNotMatch(billingSection, /allow-same-origin/)
  assert.doesNotMatch(billingSection, /dangerouslySetInnerHTML|window\.confirm|providerInvoiceRef|providerSubscriptionRef|lastError|rawPayload/)
  assert.match(billingSection, /retryBillingInvoiceAction/)
  assert.match(billingSection, /cancelBillingSubscriptionAction/)
})

test('successful provider return opens the owner billing section instead of losing context', () => {
  assert.match(settingsPage, /const requestedSection = resolveSettingsSection\(query\.section, actor\.isOwner === true\)/)
  assert.match(settingsPage, /const initialSection = !productAccess && !continuitySections\.has\(requestedSection\)/)
  assert.match(settingsPage, /query\.checkout === 'success' \? 'success' : null/)
  assert.match(settingsForm, /useState<SectionId>\(initialSection\)/)
})

test('billing maintenance authenticates before parsing and uses both durable worker ports', () => {
  const auth = maintenance.indexOf("request.headers.get('x-outbox-secret')")
  const parse = maintenance.indexOf('request.json()')
  assert.ok(auth >= 0 && parse > auth)
  assert.match(maintenance, /createBillingMaintenancePort\(\)/)
  assert.match(maintenance, /createSubscriptionBillingOperationsPort\(\)/)
  assert.match(maintenance, /limit: z\.number\(\)\.int\(\)\.min\(1\)\.max\(100\)/)
  assert.doesNotMatch(maintenance, /NextResponse\.json\(\{[^}]*cause|NextResponse\.json\(\{[^}]*result\.error/)
})
