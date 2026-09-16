import { createHash } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { scheduleSubscriptionPlanChange } from '@garsonless/application/billing'
import { createSubscriptionBillingOperationsPort } from '../../../packages/db/src/subscription-billing-operations-port'
import {
  createIyzicoSubscriptionBillingProvider,
  readIyzicoSubscriptionProviderConfig,
} from '../lib/billing/iyzico-subscription-provider'
import { readIyzicoAddOnPaymentReport } from '../lib/billing/iyzico-add-on-provider'
import type {
  BillingInterval,
  RestaurantAddOn,
  SelfServePlan,
} from '@garsonless/domain/entitlements'

const args = process.argv.slice(2)
const target = args.find((x) => x.startsWith('--target='))?.split('=')[1]
const apply = args.includes('--apply')
if (
  !['dev', 'prod'].includes(target ?? '') ||
  args.some(
    (x) =>
      ![
        '--target=dev',
        '--target=prod',
        '--apply',
        '--confirm-prod=svxvloeosiksqfadgkvo',
      ].includes(x),
  )
)
  throw new Error('Use --target=dev|prod [--apply]')
const projectRef =
  target === 'dev' ? 'yxsegwkzyiscrxiwdeuf' : 'svxvloeosiksqfadgkvo'
if (target === 'prod' && !args.includes('--confirm-prod=svxvloeosiksqfadgkvo'))
  throw new Error('Production target confirmation required')
if (
  new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').hostname !==
  `${projectRef}.supabase.co`
)
  throw new Error('Database target mismatch')
const config = readIyzicoSubscriptionProviderConfig()
if (
  config.baseUrl !==
  (target === 'dev'
    ? 'https://sandbox-api.iyzipay.com'
    : 'https://api.iyzipay.com')
)
  throw new Error('Payment environment mismatch')
const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } },
)
const rpc = async (name: string, args: Record<string, unknown> = {}) => {
  const { data, error } = await admin.rpc(name, args)
  if (error) throw new Error(error.message)
  return data
}
type Transition = {
  restaurantId: string
  subscriptionId: string
  ownerId: string
  plan: SelfServePlan
  interval: BillingInterval
  status: string
  cancelAtPeriodEnd: boolean
  scheduledPlan: SelfServePlan | null
  providerSubscriptionRef: string | null
  transitionStatus: string | null
}
type Candidate = Transition & {
  invoiceId: string
  addOn: RestaurantAddOn
  providerPaymentId: string
}
const candidates = (await rpc('read_legacy_add_on_candidates')) as Candidate[]
const transitions = (await rpc(
  'read_legacy_add_on_transitions',
)) as Transition[]
const grants: Array<{
  restaurantId: string
  invoiceId: string
  addOn: RestaurantAddOn
  status: string
  error?: string
}> = []
// Provider reads run in dry-run too. A local fixture or sandbox payment ID cannot grant a live right.
for (const c of candidates) {
  try {
    const invoice = await admin
      .from('subscription_invoices')
      .select('amount_paid_minor,currency')
      .eq('id', c.invoiceId)
      .single()
    if (invoice.error || !invoice.data)
      throw new Error('legacy_invoice_missing')
    const response = await readIyzicoAddOnPaymentReport(
      c.providerPaymentId,
      `legacy-add-on:${c.invoiceId}`,
    )
    const payments = Array.isArray(response.payments)
      ? (response.payments as Array<Record<string, unknown>>)
      : []
    const payment = payments.find(
      (p) => String(p.paymentId) === c.providerPaymentId,
    )
    if (
      response.status !== 'success' ||
      !payment ||
      payment.currency !== invoice.data.currency ||
      Math.round(Number(payment.paidPrice) * 100) !==
        invoice.data.amount_paid_minor ||
      payment.paymentStatus !== 1 ||
      !['NOT_REFUNDED', 'NONE'].includes(String(payment.paymentRefundStatus))
    )
      throw new Error('legacy_provider_payment_unverified')
    if (apply)
      await rpc('grant_legacy_add_on_ownership', {
        p_invoice_id: c.invoiceId,
        p_add_on: c.addOn,
      })
    grants.push({
      restaurantId: c.restaurantId,
      invoiceId: c.invoiceId,
      addOn: c.addOn,
      status: apply ? 'granted' : 'verified',
    })
  } catch (error) {
    grants.push({
      restaurantId: c.restaurantId,
      invoiceId: c.invoiceId,
      addOn: c.addOn,
      status: 'failed',
      error:
        error instanceof Error ? error.message : 'legacy_provider_unavailable',
    })
  }
}
const report = []
for (const c of transitions) {
  const targetPlan = c.scheduledPlan ?? c.plan
  const ref = config.plans[targetPlan]?.[c.interval]?.referenceCode
  let status = 'pending',
    error: string | null = null
  try {
    if (c.status === 'cancelled' || c.cancelAtPeriodEnd) status = 'cancelled'
    else if (c.transitionStatus === 'confirmed') status = 'confirmed'
    else if (!ref || !c.providerSubscriptionRef) {
      status = 'failed'
      error = 'provider_binding_missing'
    } else if (c.scheduledPlan) {
      const pending = await admin
        .from('subscription_change_requests')
        .select(
          'to_add_ons,provider_target_plan_ref,status,provider_target_subscription_ref',
        )
        .eq('subscription_id', c.subscriptionId)
        .eq('status', 'scheduled')
        .maybeSingle()
      if (
        !pending.error &&
        pending.data?.to_add_ons.length === 0 &&
        pending.data.provider_target_plan_ref === ref &&
        pending.data.provider_target_subscription_ref
      )
        status = 'confirmed'
      // Do not overwrite a scheduled provider descendant: NEXT_PERIOD on it can move the boundary.
      else {
        status = 'failed'
        error = 'existing_scheduled_change_requires_reconciliation'
      }
    } else if (apply) {
      const key = `lifetime-add-ons:${c.subscriptionId}`
      const changed = await scheduleSubscriptionPlanChange(
        {
          actor: 'dashboard-member',
          restaurantId: c.restaurantId,
          userId: c.ownerId,
          permissions: ['settings'],
          isOwner: true,
        },
        {
          restaurantId: c.restaurantId,
          toPlan: c.plan,
          toAddOns: [],
          toBillingInterval: c.interval,
          providerTargetPlanRef: ref,
          effectivePolicy: 'next_period',
          idempotencyKey: key,
          requestFingerprint: createHash('sha256')
            .update(JSON.stringify({ key, ref }))
            .digest('hex'),
        },
        createSubscriptionBillingOperationsPort(
          async (name, args) => await admin.rpc(name, args),
        ),
        createIyzicoSubscriptionBillingProvider(config),
      )
      status = changed.ok ? 'confirmed' : 'failed'
      error = changed.ok ? null : 'provider_transition_requires_reconciliation'
    }
  } catch {
    status = 'failed'
    error = 'provider_transition_requires_reconciliation'
  }
  if (apply)
    await rpc('record_add_on_transition', {
      p_subscription_id: c.subscriptionId,
      p_status: status,
      p_target_plan_ref: ref ?? null,
      p_error_code: error,
    })
  report.push({
    restaurantId: c.restaurantId,
    subscriptionId: c.subscriptionId,
    targetPlan,
    status,
    error,
  })
}
console.log(
  JSON.stringify(
    {
      target,
      apply,
      eligiblePayments: candidates.length,
      grants,
      subscriptions: report,
    },
    null,
    2,
  ),
)
if (
  report.some((r) => r.status === 'failed') ||
  grants.some((r) => r.status === 'failed')
)
  process.exitCode = 1
