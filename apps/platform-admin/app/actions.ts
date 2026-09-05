'use server'

import { createHash, randomUUID } from 'node:crypto'
import { setPlatformTenantPlan } from '@garsonless/application/platform-admin-tenant-plans'
import {
  changePlatformTenantFeatureOverride,
  PLATFORM_ENTITLEMENT_OVERRIDE_ACTIONS,
  type PlatformEntitlementOverrideAction,
} from '@garsonless/application/platform-admin-entitlements'
import {
  intervenePlatformBillingDunning,
  PLATFORM_DUNNING_INTERVENTIONS,
  type PlatformDunningIntervention,
} from '@garsonless/application/platform-admin-billing'
import {
  requestPlatformSubscriptionRefund,
  SUBSCRIPTION_REFUND_ACCESS_ACTIONS,
  SUBSCRIPTION_REFUND_KINDS,
  SUBSCRIPTION_REFUND_REASON_CODES,
  type SubscriptionRefundKind,
  type SubscriptionRefundAccessAction,
  type SubscriptionRefundReasonCode,
} from '@garsonless/application/platform-admin-subscription-refunds'
import { setPlatformTenantServiceStatus } from '@garsonless/application/platform-admin-tenant-operations'
import {
  endPlatformImpersonationSession,
  PLATFORM_IMPERSONATION_DURATIONS,
  startPlatformImpersonationSession,
  type PlatformImpersonationDuration,
} from '@garsonless/application/platform-admin-impersonation'
import { erasePlatformTenantPrivacyData } from '@garsonless/application/platform-admin-privacy'
import {
  createPlatformAdminDunningInterventionPort,
  createPlatformSubscriptionRefundPort,
  createPlatformAdminEntitlementPort,
  createPlatformAdminImpersonationPort,
  createPlatformAdminPrivacyPort,
  createPlatformAdminTenantOperationsPort,
  createPlatformAdminTenantPlanManagementPort,
} from '@garsonless/db/server'
import {
  FEATURE_OVERRIDE_DECISIONS,
  RESTAURANT_PLANS,
  RUNTIME_OVERRIDEABLE_FEATURES,
  type BillableFeature,
  type FeatureOverrideDecision,
  type RestaurantPlan,
} from '@garsonless/domain/entitlements'
import { isTenantServiceStatus } from '@garsonless/domain/platform-admin'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { requirePlatformAdminActor } from '../lib/platform-admin-auth'
import { createPlatformAdminServerClient } from '../lib/supabase-server'
import {
  createIyzicoSubscriptionRefundProvider,
  readIyzicoSubscriptionRefundConfig,
} from '../lib/iyzico-subscription-refund'

function tryAmountMinor(value: FormDataEntryValue | null): number | null {
  const raw = String(value ?? '').trim()
  if (!/^[1-9]\d*(?:[.,]\d{1,2})?$/.test(raw)) return null
  const normalized = raw.replace(',', '.')
  const [whole, fraction = ''] = normalized.split('.')
  const minor = Number(whole) * 100 + Number(fraction.padEnd(2, '0'))
  return Number.isSafeInteger(minor) && minor > 0 ? minor : null
}

export async function signOut() {
  const supabase = await createPlatformAdminServerClient()
  await supabase.auth.signOut()
  redirect('/auth/login')
}

export async function startTenantImpersonation(formData: FormData) {
  const actor = await requirePlatformAdminActor()
  const restaurantId = String(formData.get('restaurantId') ?? '')
  const durationMinutes = Number(String(formData.get('durationMinutes') ?? ''))
  const reason = String(formData.get('reason') ?? '')
  if (!PLATFORM_IMPERSONATION_DURATIONS.includes(durationMinutes as PlatformImpersonationDuration)) {
    redirect(`/tenants/${encodeURIComponent(restaurantId)}?operation=impersonation-invalid`)
  }
  const result = await startPlatformImpersonationSession(actor, {
    restaurantId,
    durationMinutes: durationMinutes as PlatformImpersonationDuration,
    reason,
    requestId: randomUUID(),
  }, createPlatformAdminImpersonationPort())
  if (!result.ok) {
    const code = result.error === 'Not authorized' ? 'impersonation-forbidden' : 'impersonation-failed'
    redirect(`/tenants/${encodeURIComponent(restaurantId)}?operation=${code}`)
  }
  redirect(`/tenants/${encodeURIComponent(restaurantId)}/view/${encodeURIComponent(result.value.session.id)}`)
}

export async function endTenantImpersonation(formData: FormData) {
  const actor = await requirePlatformAdminActor()
  const restaurantId = String(formData.get('restaurantId') ?? '')
  const sessionId = String(formData.get('sessionId') ?? '')
  const reason = String(formData.get('reason') ?? '')
  const result = await endPlatformImpersonationSession(actor, {
    sessionId,
    reason,
    requestId: randomUUID(),
  }, createPlatformAdminImpersonationPort())
  if (!result.ok) {
    redirect(`/tenants/${encodeURIComponent(restaurantId)}?operation=impersonation-end-failed`)
  }
  redirect(`/tenants/${encodeURIComponent(restaurantId)}?operation=impersonation-ended`)
}

export async function changeTenantFeatureOverride(formData: FormData) {
  const actor = await requirePlatformAdminActor()
  const restaurantId = String(formData.get('restaurantId') ?? '')
  const action = String(formData.get('action') ?? '')
  const feature = String(formData.get('feature') ?? '')
  const decision = String(formData.get('decision') ?? '')
  const durationDays = Number(String(formData.get('durationDays') ?? ''))
  const reason = String(formData.get('reason') ?? '')
  if (
    !PLATFORM_ENTITLEMENT_OVERRIDE_ACTIONS.includes(action as PlatformEntitlementOverrideAction)
    || !RUNTIME_OVERRIDEABLE_FEATURES.includes(feature as typeof RUNTIME_OVERRIDEABLE_FEATURES[number])
    || (action === 'set' && !FEATURE_OVERRIDE_DECISIONS.includes(decision as FeatureOverrideDecision))
  ) redirect('/')

  const result = await changePlatformTenantFeatureOverride(actor, {
    restaurantId,
    action: action as PlatformEntitlementOverrideAction,
    feature: feature as BillableFeature,
    decision: action === 'set' ? decision as FeatureOverrideDecision : null,
    durationDays: action === 'set' ? durationDays : null,
    reason,
    requestId: randomUUID(),
  }, createPlatformAdminEntitlementPort())

  if (!result.ok) {
    const code = result.error === 'Not authorized' ? 'entitlement-forbidden' : 'entitlement-failed'
    redirect(`/tenants/${encodeURIComponent(restaurantId)}?operation=${code}`)
  }
  revalidatePath(`/tenants/${restaurantId}`)
  redirect(`/tenants/${encodeURIComponent(restaurantId)}?operation=${result.value.duplicate ? 'entitlement-duplicate' : result.value.action === 'revoke' ? 'entitlement-revoked' : 'entitlement-updated'}`)
}

export async function interveneTenantDunning(formData: FormData) {
  const actor = await requirePlatformAdminActor()
  const restaurantId = String(formData.get('restaurantId') ?? '')
  const invoiceId = String(formData.get('invoiceId') ?? '')
  const intervention = String(formData.get('intervention') ?? '')
  const deferDaysRaw = String(formData.get('deferDays') ?? '')
  const reason = String(formData.get('reason') ?? '')
  if (!PLATFORM_DUNNING_INTERVENTIONS.includes(intervention as PlatformDunningIntervention)) redirect('/')

  const result = await intervenePlatformBillingDunning(actor, {
    restaurantId,
    invoiceId,
    intervention: intervention as PlatformDunningIntervention,
    deferDays: intervention === 'defer' ? Number(deferDaysRaw) : null,
    reason,
    requestId: randomUUID(),
  }, createPlatformAdminDunningInterventionPort())

  if (!result.ok) {
    const code = result.error === 'Not authorized'
      ? 'dunning-forbidden'
      : result.error === 'Dunning run is currently being processed'
        ? 'dunning-busy'
        : result.error === 'Dunning run is not actionable'
          ? 'dunning-not-actionable'
          : 'dunning-failed'
    redirect(`/tenants/${encodeURIComponent(restaurantId)}?operation=${code}`)
  }
  revalidatePath(`/tenants/${restaurantId}`)
  redirect(`/tenants/${encodeURIComponent(restaurantId)}?operation=${result.value.duplicate ? 'dunning-duplicate' : result.value.intervention === 'defer' ? 'dunning-deferred' : 'dunning-retry-scheduled'}`)
}

export async function refundTenantSubscriptionInvoice(formData: FormData) {
  const actor = await requirePlatformAdminActor()
  const restaurantId = String(formData.get('restaurantId') ?? '')
  const invoiceId = String(formData.get('invoiceId') ?? '')
  const requestId = randomUUID()
  const kind = String(formData.get('kind') ?? '')
  const accessActionRaw = String(formData.get('accessAction') ?? 'keep')
  const reasonCode = String(formData.get('reasonCode') ?? '')
  const reasonDetail = String(formData.get('reasonDetail') ?? '')
  const amountMinor = tryAmountMinor(formData.get('amount'))
  if (!amountMinor
    || !SUBSCRIPTION_REFUND_KINDS.includes(kind as SubscriptionRefundKind)
    || !SUBSCRIPTION_REFUND_ACCESS_ACTIONS.includes(accessActionRaw as SubscriptionRefundAccessAction)
    || !SUBSCRIPTION_REFUND_REASON_CODES.includes(reasonCode as SubscriptionRefundReasonCode)) redirect('/')

  const accessAction: SubscriptionRefundAccessAction = kind === 'same_day_cancel'
    ? 'cancel_immediately'
    : accessActionRaw as SubscriptionRefundAccessAction
  const idempotencyKey = `subscription-refund:${requestId}`
  const requestFingerprint = createHash('sha256').update([
    restaurantId, invoiceId, kind, accessAction, String(amountMinor), reasonCode, reasonDetail.trim(), requestId,
  ].join('\n')).digest('hex')

  let provider
  try {
    provider = createIyzicoSubscriptionRefundProvider(readIyzicoSubscriptionRefundConfig())
  } catch {
    redirect(`/tenants/${encodeURIComponent(restaurantId)}?operation=refund-provider-unavailable`)
  }
  const result = await requestPlatformSubscriptionRefund(actor, {
    restaurantId, invoiceId, kind: kind as SubscriptionRefundKind, accessAction, amountMinor,
    reasonCode: reasonCode as SubscriptionRefundReasonCode, reasonDetail,
    requestId, idempotencyKey, requestFingerprint,
  }, createPlatformSubscriptionRefundPort(), provider)

  if (!result.ok) {
    const code = result.error === 'Not authorized' ? 'refund-forbidden' : 'refund-failed'
    redirect(`/tenants/${encodeURIComponent(restaurantId)}?operation=${code}`)
  }
  revalidatePath(`/tenants/${restaurantId}`)
  const code = result.value.status === 'succeeded' && result.value.accessAction === 'cancel_immediately'
    ? result.value.cancellationStatus === 'requires_reconciliation'
      ? 'refund-cancel-reconciliation'
      : 'refund-cancel-pending'
    : result.value.status === 'succeeded' ? 'refund-succeeded'
    : result.value.status === 'requires_reconciliation' ? 'refund-reconciliation'
      : result.value.status === 'failed' ? 'refund-rejected' : 'refund-processing'
  redirect(`/tenants/${encodeURIComponent(restaurantId)}?operation=${code}`)
}

export async function changeTenantServiceStatus(formData: FormData) {
  const actor = await requirePlatformAdminActor()
  const restaurantId = String(formData.get('restaurantId') ?? '')
  const status = String(formData.get('status') ?? '')
  const reason = String(formData.get('reason') ?? '')
  if (!isTenantServiceStatus(status)) redirect('/')

  const result = await setPlatformTenantServiceStatus(actor, {
    restaurantId,
    status,
    reason,
    requestId: randomUUID(),
  }, createPlatformAdminTenantOperationsPort())

  if (!result.ok) {
    const code = result.error === 'Not authorized' ? 'forbidden' : 'failed'
    redirect(`/tenants/${encodeURIComponent(restaurantId)}?operation=${code}`)
  }
  revalidatePath('/')
  revalidatePath(`/tenants/${restaurantId}`)
  redirect(`/tenants/${encodeURIComponent(restaurantId)}?operation=${result.value.changed ? 'updated' : 'unchanged'}`)
}

export async function changeTenantPlan(formData: FormData) {
  const actor = await requirePlatformAdminActor()
  const restaurantId = String(formData.get('restaurantId') ?? '')
  const plan = String(formData.get('plan') ?? '')
  const reason = String(formData.get('reason') ?? '')
  if (!RESTAURANT_PLANS.includes(plan as RestaurantPlan)) redirect('/')

  const result = await setPlatformTenantPlan(actor, {
    restaurantId,
    plan: plan as RestaurantPlan,
    reason,
    requestId: randomUUID(),
  }, createPlatformAdminTenantPlanManagementPort())

  if (!result.ok) {
    const code = result.error === 'Not authorized'
      ? 'plan-forbidden'
      : result.error === 'Tenant plan is managed by an active billing subscription'
        ? 'plan-billing-managed'
        : 'plan-failed'
    redirect(`/tenants/${encodeURIComponent(restaurantId)}?operation=${code}`)
  }
  revalidatePath('/')
  revalidatePath(`/tenants/${restaurantId}`)
  redirect(`/tenants/${encodeURIComponent(restaurantId)}?operation=${result.value.scheduled ? 'plan-draining' : result.value.changed ? 'plan-updated' : 'plan-unchanged'}`)
}

export async function eraseTenantPrivacyData(formData: FormData) {
  const actor = await requirePlatformAdminActor()
  const restaurantId = String(formData.get('restaurantId') ?? '')
  const reason = String(formData.get('reason') ?? '')
  const confirmation = String(formData.get('confirmation') ?? '')
  const result = await erasePlatformTenantPrivacyData(actor, {
    restaurantId,
    reason,
    confirmation,
    requestId: randomUUID(),
  }, createPlatformAdminPrivacyPort())

  if (!result.ok) {
    const code = result.error === 'Not authorized'
      ? 'privacy-forbidden'
      : result.error === 'Invalid erase confirmation'
        ? 'privacy-confirmation-invalid'
        : 'privacy-erase-failed'
    redirect(`/tenants/${encodeURIComponent(restaurantId)}?operation=${code}`)
  }

  revalidatePath(`/tenants/${restaurantId}`)
  redirect(`/tenants/${encodeURIComponent(restaurantId)}?operation=${result.value.duplicate ? 'privacy-erase-duplicate' : 'privacy-erased'}`)
}
