import {
  ADD_ON_DEFINITIONS,
  BILLING_INTERVALS,
  calculatePlanCharge,
  getAddOnPrice,
  getPlanPrice,
  RESTAURANT_ADD_ONS,
  SELF_SERVE_PLANS,
  subscriptionNetAmountMinor,
  type BillingInterval,
  type RestaurantAddOn,
  type SelfServePlan,
} from '@garsonless/domain/entitlements'
import { providerAddOnEnvPrefix } from './iyzico-subscription-config'

export const IYZICO_SUBSCRIPTION_PRODUCT_NAME = 'Masabu SaaS Abonelik v1'
export const IYZICO_SUBSCRIPTION_ENDPOINTS = {
  sandbox: 'https://sandbox-api.iyzipay.com',
  live: 'https://api.iyzipay.com',
} as const

export type IyzicoProvisioningTarget = keyof typeof IYZICO_SUBSCRIPTION_ENDPOINTS

export function validateIyzicoProvisioningTarget(input: {
  target: string | null
  baseUrl: string
  apply: boolean
  liveConfirmed: boolean
}): IyzicoProvisioningTarget {
  if (input.target !== 'sandbox' && input.target !== 'live') {
    throw new Error('provisioning_target_required')
  }
  if (input.baseUrl !== IYZICO_SUBSCRIPTION_ENDPOINTS[input.target]) {
    throw new Error('provisioning_target_base_url_mismatch')
  }
  if (input.apply && input.target === 'live' && !input.liveConfirmed) {
    throw new Error('live_provisioning_confirmation_required')
  }
  return input.target
}

export type IyzicoProvisioningPlan = {
  plan: SelfServePlan
  addOns: RestaurantAddOn[]
  interval: BillingInterval
  name: string
  amountMinor: number
  envReferenceKey: string
  envAmountKey: string
  envAddOnNetAmountKey: string | null
  addOnNetAmountMinor: number | null
  request: {
    locale: 'tr'
    name: string
    price: number
    currencyCode: 'TRY'
    paymentInterval: 'MONTHLY' | 'YEARLY'
    paymentIntervalCount: 1
    planPaymentType: 'RECURRING'
  }
}

const PLAN_LABELS: Record<SelfServePlan, string> = {
  starter: 'Starter',
  plus: 'Plus',
  pro: 'Pro',
}

export function iyzicoSubscriptionProvisioningPlans(vatRate: number): IyzicoProvisioningPlan[] {
  const basePlans: IyzicoProvisioningPlan[] = SELF_SERVE_PLANS.flatMap((plan) => BILLING_INTERVALS.map((interval) => {
    const prefix = `IYZICO_BILLING_${plan.toUpperCase()}_${interval.toUpperCase()}`
    const amountMinor = calculatePlanCharge(getPlanPrice(plan, interval), vatRate).totalAmountMinor
    const name = `Masabu ${PLAN_LABELS[plan]} ${interval === 'annual' ? 'Yıllık' : 'Aylık'} v1`
    return {
      plan,
      addOns: [],
      interval,
      name,
      amountMinor,
      envReferenceKey: `${prefix}_PLAN_REF`,
      envAmountKey: `${prefix}_AMOUNT_MINOR`,
      envAddOnNetAmountKey: null,
      addOnNetAmountMinor: null,
      request: {
        locale: 'tr',
        name,
        price: amountMinor / 100,
        currencyCode: 'TRY',
        paymentInterval: interval === 'annual' ? 'YEARLY' : 'MONTHLY',
        paymentIntervalCount: 1,
        planPaymentType: 'RECURRING',
      },
    }
  }))
  const addOnPlans: IyzicoProvisioningPlan[] = RESTAURANT_ADD_ONS.flatMap((addOn) => (
    ADD_ON_DEFINITIONS[addOn].availableOn
      .filter((plan): plan is SelfServePlan => SELF_SERVE_PLANS.includes(plan as SelfServePlan))
      .flatMap((plan) => BILLING_INTERVALS.map((interval) => {
        const prefix = `${providerAddOnEnvPrefix(plan, addOn)}_${interval.toUpperCase()}`
        const amountMinor = calculatePlanCharge({
          amountMinor: subscriptionNetAmountMinor(plan, interval, [addOn]),
          currency: 'TRY', vatIncluded: false,
        }, vatRate).totalAmountMinor
        const addOnLabel = ADD_ON_DEFINITIONS[addOn].label
        const name = `Masabu ${PLAN_LABELS[plan]} + ${addOnLabel} ${interval === 'annual' ? 'Yıllık' : 'Aylık'} v1`
        return {
          plan, addOns: [addOn], interval, name, amountMinor,
          envReferenceKey: `${prefix}_PLAN_REF`,
          envAmountKey: `${prefix}_AMOUNT_MINOR`,
          envAddOnNetAmountKey: `${prefix}_ADDON_NET_AMOUNT_MINOR`,
          addOnNetAmountMinor: getAddOnPrice(addOn, interval).amountMinor,
          request: {
            locale: 'tr' as const, name, price: amountMinor / 100,
            currencyCode: 'TRY' as const,
            paymentInterval: interval === 'annual' ? 'YEARLY' as const : 'MONTHLY' as const,
            paymentIntervalCount: 1 as const,
            planPaymentType: 'RECURRING' as const,
          },
        }
      }))
  ))
  return [...basePlans, ...addOnPlans]
}
