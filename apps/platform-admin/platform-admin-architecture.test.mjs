import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8')

test('account detail and activation use an isolated, re-authorized and audited server boundary', () => {
  const page = read('./app/tenants/[tenantId]/page.tsx')
  const panel = read('./app/tenants/[tenantId]/TenantAccounts.tsx')
  const actions = read('./app/tenants/[tenantId]/account-actions.ts')
  assert.match(page, /canManageData \? <TenantAccounts/)
  assert.match(page, /platformAdminCan\(actor, 'tenant\.accounts\.manage'\)/)
  assert.equal((actions.match(/await requirePlatformAdminActor\(\)/g) ?? []).length, 3)
  assert.match(actions, /requestId: randomUUID\(\)/)
  assert.match(actions, /activatePlatformTenantAccount/)
  assert.match(actions, /reconcilePlatformTenantUnban/)
  assert.doesNotMatch(actions, /createServiceClient|\.from\(|form\.get\(['"]actor/)
  assert.doesNotMatch(panel, /localStorage\.|sessionStorage\.|console\.|dangerouslySetInnerHTML/)
  assert.match(panel, /PLATFORM_UNBAN_CONFIRMATION/)
  assert.match(panel, /PLATFORM_MEMBER_CONFIRMATION/)
  assert.match(panel, /10 \* 60 \* 1000/)
})

test('protected platform routes resolve the isolated actor and MFA gate', () => {
  const home = read('./app/page.tsx')
  const auth = read('./lib/platform-admin-auth.ts')
  assert.match(home, /requirePlatformAdminActor/)
  assert.match(auth, /resolvePlatformAdminActor/)
  assert.match(auth, /createPlatformAdminIdentityPort/)
  assert.match(auth, /Platform admin MFA is required/)
})

test('tenant roles cannot appear in the platform access adapter', () => {
  const auth = read('./lib/platform-admin-auth.ts')
  assert.doesNotMatch(auth, /restaurant_members|owner_id|is_staff_user|assertAccess/)
})

test('platform login exposes neither sign-up nor social authentication', () => {
  const login = read('./app/auth/login/LoginForm.tsx')
  assert.match(login, /signInWithPassword/)
  assert.doesNotMatch(login, /signUp|signInWithOAuth|google|apple/i)
})

test('tenant directory and detail cross the application and service-port boundaries', () => {
  const directory = read('./app/page.tsx')
  const detail = read('./app/tenants/[tenantId]/page.tsx')
  for (const source of [directory, detail]) {
    assert.match(source, /requirePlatformAdminActor/)
    assert.match(source, /createPlatformAdminTenantReadPort/)
    assert.doesNotMatch(source, /createServiceClient|\.from\(['"]restaurants|owner_id|contact_email/)
  }
  assert.match(directory, /listPlatformTenants/)
  assert.match(detail, /readPlatformTenant/)
})

test('global error center is AAL2-gated, privacy-safe and crosses the application read port', () => {
  const page = read('./app/errors/page.tsx')
  const shell = read('./app/PlatformShell.tsx')
  assert.match(page, /requirePlatformAdminActor/)
  assert.match(page, /readPlatformErrorOverview/)
  assert.match(page, /createPlatformErrorReadPort/)
  assert.match(shell, /href="\/errors"/)
  assert.doesNotMatch(page, /createServiceClient|\.from\(|error\.message|last_error|stack_trace|payload_sanitized/)
})

test('directory stays read-only while tenant lifecycle mutation crosses the application port', () => {
  const directory = read('./app/page.tsx')
  const detail = read('./app/tenants/[tenantId]/page.tsx')
  assert.match(directory, /Salt okunur/)
  assert.match(detail, /readPlatformTenantServiceControl/)
  assert.match(detail, /changeTenantServiceStatus/)
  assert.match(detail, /minLength=\{10\}/)
  assert.doesNotMatch(detail, /createServiceClient|\.from\(['"]tenant_service_controls/)
})

test('platform mutation action re-resolves MFA actor and derives request id server-side', () => {
  const actions = read('./app/actions.ts')
  assert.match(actions, /requirePlatformAdminActor/)
  assert.match(actions, /setPlatformTenantServiceStatus/)
  assert.match(actions, /setPlatformTenantPlan/)
  assert.match(actions, /createPlatformAdminTenantOperationsPort/)
  assert.match(actions, /createPlatformAdminTenantPlanManagementPort/)
  assert.match(actions, /randomUUID\(\)/)
  assert.doesNotMatch(actions, /formData\.get\(['"]requestId/)
})

test('tenant plan management is visibly superadmin-only and blocks live billing drift', () => {
  const detail = read('./app/tenants/[tenantId]/page.tsx')
  assert.match(detail, /platformAdminCan\(actor, 'catalog\.manage'\)/)
  assert.match(detail, /changeTenantPlan/)
  assert.match(detail, /hasLiveSubscription/)
  assert.match(detail, /minLength=\{10\}/)
})

test('finance timeline is role-gated and uses only the safe billing read port', () => {
  const detail = read('./app/tenants/[tenantId]/page.tsx')
  const timeline = read('./app/tenants/[tenantId]/TenantBillingTimeline.tsx')
  assert.match(detail, /platformAdminCan\(actor, 'billing\.manage'\)/)
  assert.match(detail, /readPlatformTenantBillingTimeline/)
  assert.match(detail, /createPlatformAdminTenantBillingReadPort/)
  assert.match(timeline, /billingStatusLabel/)
  assert.doesNotMatch(timeline, /provider_(event|attempt|checkout|payment|subscription)_ref|payload_sanitized|last_error|contact_email|identity_number/)
})

test('dunning interventions use the audited application/DB boundary without payment authority', () => {
  const detail = read('./app/tenants/[tenantId]/page.tsx')
  const timeline = read('./app/tenants/[tenantId]/TenantBillingTimeline.tsx')
  const actions = read('./app/actions.ts')
  assert.match(timeline, /interveneTenantDunning/)
  assert.match(timeline, /Şimdi yeniden sırala/)
  assert.match(timeline, /Süreli erteleme/)
  assert.match(actions, /intervenePlatformBillingDunning/)
  assert.match(actions, /createPlatformAdminDunningInterventionPort/)
  assert.match(actions, /requirePlatformAdminActor/)
  assert.match(actions, /randomUUID\(\)/)
  assert.match(detail, /dunning-retry-scheduled/)
  assert.doesNotMatch(actions, /mark.*paid|activate.*subscription|createServiceClient/i)
  assert.doesNotMatch(timeline, /providerPaymentRef|providerSubscriptionRef|contact_email/)
})

test('subscription refunds cross the audited boundary and make full-refund access policy explicit', () => {
  const detail = read('./app/tenants/[tenantId]/page.tsx')
  const timeline = read('./app/tenants/[tenantId]/TenantBillingTimeline.tsx')
  const actions = read('./app/actions.ts')
  const provider = read('./lib/iyzico-subscription-refund.ts')
  assert.match(detail, /platformAdminCan\(actor, 'billing\.manage'\)/)
  assert.match(timeline, /SubscriptionRefundForm/)
  const refundForm = read('./app/tenants/[tenantId]/SubscriptionRefundForm.tsx')
  assert.match(refundForm, /İade sonrası erişim/)
  assert.match(refundForm, /İade et ve aboneliği hemen kapat/)
  assert.match(refundForm, /Kısmi iadelerde erişim/)
  assert.match(actions, /requestPlatformSubscriptionRefund/)
  assert.match(actions, /createPlatformSubscriptionRefundPort/)
  assert.match(actions, /createIyzicoSubscriptionRefundProvider/)
  assert.match(actions, /const requestId = randomUUID\(\)/)
  assert.match(provider, /validSignature\(config\.secretKey/)
  assert.match(provider, /\[paymentId, price, currency, conversationId\]/)
  assert.match(provider, /requires_reconciliation|uncertain/)
  assert.doesNotMatch(`${timeline}\n${refundForm}`, /providerPaymentId|providerPaymentRef|providerSubscriptionRef|contact_email/)
  assert.doesNotMatch(actions, /createServiceClient|\.from\(/)
})

test('time-bounded entitlement overrides cross audited ports and never mutate plan or billing state', () => {
  const detail = read('./app/tenants/[tenantId]/page.tsx')
  const panel = read('./app/tenants/[tenantId]/TenantEntitlementOverrides.tsx')
  const actions = read('./app/actions.ts')
  assert.match(detail, /readPlatformTenantFeatureOverrides/)
  assert.match(detail, /createPlatformAdminEntitlementPort/)
  assert.match(detail, /platformAdminCan\(actor, 'entitlements\.override'\)/)
  assert.match(panel, /changeTenantFeatureOverride/)
  assert.match(panel, /En fazla 30 gün/)
  assert.match(actions, /changePlatformTenantFeatureOverride/)
  assert.match(actions, /createPlatformAdminEntitlementPort/)
  assert.match(actions, /requirePlatformAdminActor/)
  assert.match(actions, /randomUUID\(\)/)
  assert.doesNotMatch(actions, /formData\.get\(['"]requestId/)
  assert.doesNotMatch(actions, /update.*restaurants|billing_subscriptions|subscription_invoices/i)
})

test('support view is time-bounded, read-only and isolated from tenant membership', () => {
  const detail = read('./app/tenants/[tenantId]/page.tsx')
  const view = read('./app/tenants/[tenantId]/view/[sessionId]/page.tsx')
  const actions = read('./app/actions.ts')
  assert.match(detail, /platformAdminCan\(actor, 'impersonation\.read'\)/)
  assert.match(detail, /startTenantImpersonation/)
  assert.match(detail, /En fazla 60 dk/)
  assert.match(view, /readPlatformImpersonationSession/)
  assert.match(view, /session\?\.status === 'active'/)
  assert.match(view, /Yazma kapalı/)
  assert.match(view, /endTenantImpersonation/)
  assert.match(actions, /startPlatformImpersonationSession/)
  assert.match(actions, /endPlatformImpersonationSession/)
  assert.match(actions, /createPlatformAdminImpersonationPort/)
  for (const source of [detail, view, actions]) {
    assert.doesNotMatch(source, /restaurant_members|owner_id|assertAccess|createServiceClient/)
  }
  assert.doesNotMatch(view, /changeTenantPlan|changeTenantServiceStatus|changeTenantFeatureOverride|interveneTenantDunning/)
})

test('tenant privacy operations are superadmin-only, audited and keep exports transient', () => {
  const detail = read('./app/tenants/[tenantId]/page.tsx')
  const panel = read('./app/tenants/[tenantId]/TenantPrivacyOperations.tsx')
  const route = read('./app/tenants/[tenantId]/privacy/export/route.ts')
  const actions = read('./app/actions.ts')
  assert.match(detail, /platformAdminCan\(actor, 'data\.manage'\)/)
  assert.match(detail, /readPlatformTenantPrivacyOperations/)
  assert.match(panel, /PLATFORM_PRIVACY_ERASE_CONFIRMATION/)
  assert.match(route, /exportPlatformTenantPrivacyData/)
  assert.match(route, /Content-Disposition/)
  assert.match(route, /Cache-Control.*no-store/)
  assert.match(actions, /erasePlatformTenantPrivacyData/)
  assert.match(actions, /createPlatformAdminPrivacyPort/)
  assert.match(actions, /randomUUID\(\)/)
  assert.doesNotMatch(actions, /formData\.get\(['"]requestId/)
  for (const source of [detail, panel, route, actions]) {
    assert.doesNotMatch(source, /createServiceClient|\.from\(/)
  }
})

test('local platform development reuses the linked dashboard sandbox and local env without copying secrets', () => {
  const packageJson = JSON.parse(read('./package.json'))
  const nextConfig = read('./next.config.ts')
  assert.match(packageJson.scripts.dev, /--env-file-if-exists=\.\.\/dashboard\/\.env\.sandbox/)
  assert.match(packageJson.scripts.dev, /--env-file-if-exists=\.\.\/dashboard\/\.env\.local/)
  assert.match(packageJson.scripts.dev, /next dev --turbopack --port 3005/)
  assert.match(nextConfig, /serverExternalPackages:\s*\['iyzipay'\]/)
  assert.equal(packageJson.dependencies.postcss, undefined)
})

test('platform admin auth cookie is isolated from the dashboard session on the same localhost host', () => {
  const cookie = read('./lib/auth-cookie.ts')
  const browser = read('./lib/supabase-browser.ts')
  const server = read('./lib/supabase-server.ts')
  const middleware = read('./middleware.ts')

  assert.match(cookie, /platform-admin-auth-token/)
  assert.match(cookie, /NEXT_PUBLIC_SUPABASE_URL/)
  for (const source of [browser, server, middleware]) {
    assert.match(source, /getPlatformAdminAuthCookieName/)
    assert.match(source, /cookieOptions/)
  }
})

test('Supabase TOTP QR data is normalized before Next Image receives it', () => {
  const challenge = read('./app/auth/mfa/MfaChallenge.tsx')
  assert.match(challenge, /qr_code\.trimEnd\(\)/)
})

test('stale unverified TOTP factors are reset from the complete factor collection', () => {
  const challenge = read('./app/auth/mfa/MfaChallenge.tsx')
  assert.match(challenge, /data\.all\.filter/)
  assert.match(challenge, /factor_type === 'totp'/)
  assert.match(challenge, /mfa\.unenroll/)
  assert.match(challenge, /unenrollError/)
})

test('platform route, global and not-found failures use the shared safe recovery surface', () => {
  for (const file of ['error.tsx', 'global-error.tsx', 'not-found.tsx']) {
    const source = read(`./app/${file}`)
    assert.match(source, /RecoveryScreen/)
    assert.match(source, /MAS-(UI-500|ROUTE-404)/)
    assert.doesNotMatch(source, /error\.message|error\.stack/)
  }
})
