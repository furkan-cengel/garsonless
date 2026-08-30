import {
  BILLING_INTERVALS,
  calculatePlanCharge,
  getPlanPrice,
  SELF_SERVE_PLANS,
  type BillingInterval,
  type SelfServePlan,
} from '@garsonless/domain/entitlements'

export const IYZICO_SUBSCRIPTION_PRODUCT_NAME = 'Masabu SaaS Abonelik v1'

export type IyzicoProvisioningPlan = {
  plan: SelfServePlan
  interval: BillingInterval
  name: string
  amountMinor: number
  envReferenceKey: string
  envAmountKey: string
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
  return SELF_SERVE_PLANS.flatMap((plan) => BILLING_INTERVALS.map((interval) => {
    const prefix = `IYZICO_BILLING_${plan.toUpperCase()}_${interval.toUpperCase()}`
    const amountMinor = calculatePlanCharge(getPlanPrice(plan, interval), vatRate).totalAmountMinor
    const name = `Masabu ${PLAN_LABELS[plan]} ${interval === 'annual' ? 'Yıllık' : 'Aylık'} v1`
    return {
      plan,
      interval,
      name,
      amountMinor,
      envReferenceKey: `${prefix}_PLAN_REF`,
      envAmountKey: `${prefix}_AMOUNT_MINOR`,
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
}
