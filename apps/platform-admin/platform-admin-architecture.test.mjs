import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8')

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
  assert.match(page, /Ham hata metni, payload, stack ve müşteri PII bilgileri gösterilmez/)
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
  assert.match(detail, /Canlı abonelik provider tarafından yönetiliyor/)
  assert.match(detail, /minLength=\{10\}/)
})

test('finance timeline is role-gated and uses only the safe billing read port', () => {
  const detail = read('./app/tenants/[tenantId]/page.tsx')
  const timeline = read('./app/tenants/[tenantId]/TenantBillingTimeline.tsx')
  assert.match(detail, /platformAdminCan\(actor, 'billing\.manage'\)/)
  assert.match(detail, /readPlatformTenantBillingTimeline/)
  assert.match(detail, /createPlatformAdminTenantBillingReadPort/)
  assert.match(timeline, /Provider referansları, payload, hata metni ve müşteri PII bilgileri/)
  assert.doesNotMatch(timeline, /provider_(event|attempt|checkout|payment|subscription)_ref|payload_sanitized|last_error|contact_email|identity_number/)
})

test('dunning interventions use the audited application/DB boundary without payment authority', () => {
  const detail = read('./app/tenants/[tenantId]/page.tsx')
  const timeline = read('./app/tenants/[tenantId]/TenantBillingTimeline.tsx')
  const actions = read('./app/actions.ts')
  assert.match(timeline, /interveneTenantDunning/)
  assert.match(timeline, /Şimdi yeniden sırala/)
  assert.match(timeline, /Süreli erteleme/)
  assert.match(timeline, /Ödeme otoritesi değişmez/)
  assert.match(actions, /intervenePlatformBillingDunning/)
  assert.match(actions, /createPlatformAdminDunningInterventionPort/)
  assert.match(actions, /requirePlatformAdminActor/)
  assert.match(actions, /randomUUID\(\)/)
  assert.match(detail, /dunning-retry-scheduled/)
  assert.doesNotMatch(actions, /mark.*paid|activate.*subscription|createServiceClient/i)
  assert.doesNotMatch(timeline, /providerPaymentRef|providerSubscriptionRef|contact_email/)
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
  assert.match(panel, /Süre sonunda erişim otomatik olarak paket kataloğuna döner/)
  assert.match(actions, /changePlatformTenantFeatureOverride/)
  assert.match(actions, /createPlatformAdminEntitlementPort/)
  assert.match(actions, /requirePlatformAdminActor/)
  assert.match(actions, /randomUUID\(\)/)
  assert.doesNotMatch(actions, /formData\.get\(['"]requestId/)
  assert.doesNotMatch(actions, /update.*restaurants|billing_subscriptions|subscription_invoices|provider/i)
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
  assert.match(panel, /Fatura ve anonim operasyon kayıtları korunur/)
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

test('local platform development reuses the linked dashboard env without copying secrets', () => {
  const packageJson = JSON.parse(read('./package.json'))
  assert.match(packageJson.scripts.dev, /--env-file-if-exists=\.\.\/dashboard\/\.env\.local/)
  assert.match(packageJson.scripts.dev, /next dev --port 3004/)
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
