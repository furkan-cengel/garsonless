import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const actions = readFileSync(new URL('../actions/billing.ts', import.meta.url), 'utf8')
const callback = readFileSync(
  new URL('../../app/api/billing/iyzico/checkout/callback/route.ts', import.meta.url),
  'utf8',
)
const cardUpdateCallback = readFileSync(
  new URL('../../app/api/billing/iyzico/card-update/callback/route.ts', import.meta.url),
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
const checkoutDocument = readFileSync(
  new URL('./iyzico-checkout-document.ts', import.meta.url),
  'utf8',
)
const dashboardConfig = readFileSync(
  new URL('../../next.config.ts', import.meta.url),
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
  const checkout = actions.indexOf('export async function startBillingCheckoutAction')
  const owner = actions.indexOf("ownerGate(restaurantId, 'billing.checkout.start')", checkout)
  const salesGate = actions.indexOf('assertIyzicoSubscriptionSalesEnabled()', owner)
  const providerConfig = actions.indexOf('readIyzicoSubscriptionProviderConfig()', salesGate)
  assert.ok(checkout >= 0 && owner > checkout && salesGate > owner && providerConfig > salesGate)
  assert.match(actions, /providerPlanForSelection\(/)
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
  assert.match(callback, /createBillingCheckoutResultDocument/)
  assert.match(callback, /outcome: 'succeeded'/)
  assert.match(callback, /outcome: 'pending'/)
  assert.match(callback, /outcome: 'failed'/)
  assert.doesNotMatch(callback, /NextResponse\.redirect/)
  assert.doesNotMatch(callback, /result\.error/)
})

test('checkout callback alone can render inside its same-origin checkout iframe', () => {
  assert.match(dashboardConfig, /source: '\/api\/billing\/iyzico\/checkout\/callback'/)
  assert.match(dashboardConfig, /X-Frame-Options', value: 'SAMEORIGIN'/)
  assert.match(dashboardConfig, /Content-Security-Policy', value: "frame-ancestors 'self'"/)
  assert.match(dashboardConfig, /Referrer-Policy', value: 'no-referrer'/)
})

test('card update is owner-started, server-bound, and completed only by token plus state', () => {
  const action = actions.indexOf('export async function startBillingCardUpdateAction')
  const gate = actions.indexOf("ownerGate(restaurantId, 'billing.card-update.start')", action)
  const providerConfig = actions.indexOf('readIyzicoSubscriptionProviderConfig()', gate)
  const start = actions.indexOf('startSubscriptionCardUpdate(', providerConfig)
  assert.ok(action >= 0 && gate > action && providerConfig > gate && start > providerConfig)
  assert.match(actions, /createHmac\('sha256', config\.secretKey\)/)
  assert.match(actions, /createHash\('sha256'\)\.update\(callbackState\)\.digest\('hex'\)/)
  assert.match(actions, /billingCardUpdateCallbackUrl\([\s\S]*callbackState/)
  assert.match(actions, /Kart güncelleme sonucu kontrol ediliyor\. Aynı işlemi tekrar başlatmayın\./)
  assert.doesNotMatch(actions, /cardNumber|cardHolderName|expireMonth|expireYear|\bcvc\b|\bcvv\b/i)

  assert.match(cardUpdateCallback, /const MAX_CALLBACK_BYTES = 8 \* 1024/)
  assert.match(cardUpdateCallback, /new URL\(request\.url\)\.searchParams\.get\('state'\)/)
  assert.match(cardUpdateCallback, /completeSubscriptionCardUpdate\(\{[\s\S]*providerCheckoutRef: token,[\s\S]*callbackState/)
  assert.match(cardUpdateCallback, /outcome: 'succeeded'/)
  assert.match(cardUpdateCallback, /outcome: 'pending'/)
  assert.match(cardUpdateCallback, /sanitizeServerDiagnostic\(cause\)/)
  assert.match(cardUpdateCallback, /cache-control', 'no-store'/)
  assert.doesNotMatch(cardUpdateCallback, /cardNumber|cardHolderName|expireMonth|expireYear|\bcvc\b|\bcvv\b/i)
})

test('card update callback can render only in the same-origin hosted form iframe', () => {
  assert.match(dashboardConfig, /source: '\/api\/billing\/iyzico\/card-update\/callback'/)
  assert.match(dashboardConfig, /X-Frame-Options', value: 'SAMEORIGIN'/)
  assert.match(dashboardConfig, /Content-Security-Policy', value: "frame-ancestors 'self'"/)
  assert.match(dashboardConfig, /Referrer-Policy', value: 'no-referrer'/)
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
  assert.match(billingSection, /sandbox="allow-forms allow-scripts allow-same-origin allow-popups allow-top-navigation-by-user-activation"/)
  assert.match(billingSection, /referrerPolicy="no-referrer"/)
  assert.match(billingSection, /srcDoc=\{checkoutDocument\}/)
  assert.match(checkoutDocument, /id="iyzipay-checkout-form" class="responsive"/)
  assert.ok(checkoutDocument.indexOf('CHECKOUT_MOUNT') < checkoutDocument.indexOf('${validated.content}'))
  assert.match(checkoutDocument, /validateIyzicoCheckoutContent/)
  assert.match(billingSection, /masabu:iyzico-mounted/)
  assert.match(billingSection, /masabu:iyzico-attempting/)
  assert.match(billingSection, /masabu:iyzico-navigating/)
  assert.match(billingSection, /checkSubscriptionCheckoutAction/)
  assert.match(billingSection, /isBillingCheckoutResultMessage/)
  assert.match(billingSection, /event\.source !== iframeRef\.current\?\.contentWindow/)
  assert.match(billingSection, /event\.origin !== window\.location\.origin/)
  assert.match(billingSection, /CHECKOUT_PROBE_DELAYS_MS/)
  assert.match(billingSection, /Ödemeniz doğrulanıyor/)
  assert.match(billingSection, /İyzico mesajını kontrol edip aynı formda/)
  assert.doesNotMatch(billingSection, /CHECKOUT_RESULT_TIMEOUT_MS|Aboneliğiniz etkinleştiriliyor/)
  assert.match(billingSection, /planınız aktif/)
  assert.match(billingSection, /tekrar ödeme yapmayın/)
  assert.match(billingSection, /dialogState === 'pending'[\s\S]*\? <Spinner \/>[\s\S]*dialogState === 'succeeded'[\s\S]*\? <I\.check/)
  assert.match(billingSection, /dialogState !== 'succeeded'/)
  assert.match(billingSection, /successRefreshStartedRef\.current = true[\s\S]*router\.refresh\(\)/)
  assert.match(billingSection, /requestedAddOnsActive[\s\S]*activationComplete[\s\S]*CHECKOUT_SUCCESS_CLOSE_DELAY_MS/)
  assert.match(billingSection, /const activationPending = dialogState === 'succeeded' && !activationComplete/)
  assert.match(billingSection, /const dismissLocked = dialogState === 'verifying' \|\| activationPending/)
  assert.match(billingSection, /onOpenChange=\{\(open\) => \{ if \(!open && !dismissLocked\) onClose\(\) \}\}/)
  assert.match(billingSection, /!dismissLocked && \([\s\S]*aria-label="Ödeme penceresini kapat"/)
  assert.match(billingSection, /Ödemeniz alındı\. Planınız ve ücretli özellikleriniz hesabınıza güvenli biçimde uygulanıyor\./)
  assert.match(billingSection, /Hesabınız güncelleniyor[\s\S]*Abonelik aktivasyon ilerlemesi/)
  assert.match(billingSection, /<Button type="button" disabled>[\s\S]*Etkinleştirme tamamlanıyor…/)
  assert.match(billingSection, /const CHECKOUT_ACTIVATION_TIMEOUT_MS = 45_000/)
  assert.match(billingSection, /if \(!activationPending\) return[\s\S]*setDialogState\('pending'\)[\s\S]*CHECKOUT_ACTIVATION_TIMEOUT_MS/)
  assert.match(billingSection, /addOns: \[\]/)
  assert.doesNotMatch(billingSection, /selectedAddOn|setSelectedAddOn/)
  assert.match(billingSection, /CHECKOUT_LOAD_TIMEOUT_MS/)
  assert.match(billingSection, /Ödeme formu yüklenemedi/)
  assert.match(billingSection, /key=\{frameSession\?\.key\}/)
  assert.match(billingSection, /setAttempt\(\(current\) => current \+ 1\)/)
  assert.doesNotMatch(billingSection, /dangerouslySetInnerHTML|window\.confirm|providerInvoiceRef|providerSubscriptionRef|lastError|rawPayload/)
  assert.match(billingSection, /retryBillingInvoiceAction/)
  assert.match(billingSection, /cancelBillingSubscriptionAction/)
  assert.match(billingSection, /money\(planPrices\[selectedPlan\]\[selectedInterval\]\)\} \+ KDV/)
  assert.match(billingSection, /<AddOnBilling/)
  assert.doesNotMatch(billingSection, /planPrices\[selectedPlan\]\[selectedInterval\] \+ addOnPrice/)
})

test('owner billing UI hosts card update safely and schedules plan changes through the ledger', () => {
  assert.match(billingSection, /startBillingCardUpdateAction/)
  assert.match(billingSection, /scheduleBillingPlanChangeAction/)
  assert.match(billingSection, /function HostedCardUpdateDialog/)
  assert.match(billingSection, /title="İyzico abonelik kart güncelleme formu"/)
  assert.match(billingSection, /event\.source !== iframeRef\.current\?\.contentWindow/)
  assert.match(billingSection, /event\.origin !== window\.location\.origin/)
  assert.match(billingSection, /Kart bilgileri yalnız İyzico formuna girilir/)
  assert.match(billingSection, /const CARD_UPDATE_VERIFY_TIMEOUT_MS = 15_000/)
  assert.match(billingSection, /if \(state !== 'verifying'\) return[\s\S]*setResultCode\('MAS-PAY-409'\)[\s\S]*setState\('pending'\)[\s\S]*CARD_UPDATE_VERIFY_TIMEOUT_MS/)
  assert.match(billingSection, /Sonuç uzlaştırılıyor\. Aynı işlemi tekrar başlatmayın\./)
  assert.match(billingSection, /başarılı dönem ödemesinden sonra özellikler güncellenecek/)
  assert.match(billingSection, /Açık adisyon varsa yeni sipariş girişi durdurulur/)
})

test('owner cancellation schedules a reversible period-end intent without calling iyzico inline', () => {
  const start = actions.indexOf('export async function cancelBillingSubscriptionAction')
  const end = actions.indexOf('export async function undoBillingSubscriptionCancellationAction', start)
  const scheduleAction = actions.slice(start, end)
  assert.ok(start >= 0 && end > start)
  assert.match(scheduleAction, /requireFreshOwnerPassword/)
  assert.match(scheduleAction, /scheduleTenantSubscriptionCancellation/)
  assert.match(scheduleAction, /createSubscriptionCancellationSchedulePort/)
  assert.doesNotMatch(scheduleAction, /cancelTenantSubscription|createIyzicoSubscriptionBillingProvider|readIyzicoSubscriptionProviderConfig/)
  assert.match(actions.slice(end), /withdrawTenantSubscriptionCancellation/)
  assert.match(billingSection, /İptal talebini geri al/)
  assert.match(billingSection, /Mevcut planınız ve ücretli özellikleriniz ödediğiniz dönemin sonuna kadar açık kalır/)
  assert.match(billingSection, /<AlertDialogAction[\s\S]*variant="destructive"[\s\S]*Dönem sonunda iptal et/)
  assert.doesNotMatch(billingSection, /text-destructive-foreground/)
  assert.doesNotMatch(billingSection, /Aboneliği hemen iptal et/)
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
