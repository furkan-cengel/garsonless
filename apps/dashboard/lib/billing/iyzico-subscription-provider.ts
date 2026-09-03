import Iyzipay from 'iyzipay'
import type {
  SubscriptionBillingCustomer,
  SubscriptionBillingProvider,
  SubscriptionCardUpdateProvider,
  SubscriptionPlanChangeProvider,
  SubscriptionRenewalProvider,
} from '@garsonless/application/billing'
import { err, ok, type Result } from '@garsonless/domain/result'
import {
  configuredProviderPlanBindings,
  assertIyzicoSubscriptionSalesEnabled,
  providerPlanForSelection,
  readIyzicoSubscriptionProviderConfig,
  type IyzicoSubscriptionProviderConfig,
} from './iyzico-subscription-config'
import { validateIyzicoCheckoutContent } from './iyzico-checkout-document'

const MAX_PROVIDER_REFERENCE = 200
const DEFAULT_TIMEOUT_MS = 15_000
const MAX_PROVIDER_TIMESTAMP_DRIFT_MS = 1_000

type ProviderResponse = Record<string, unknown>
type ProviderCallback = (error: Error | null, response: ProviderResponse) => void

export type IyzicoSubscriptionClient = {
  subscriptionCustomer: {
    create(request: Record<string, unknown>, callback: ProviderCallback): void
  }
  subscriptionCheckoutForm: {
    initialize(request: Record<string, unknown>, callback: ProviderCallback): void
    retrieve(request: Record<string, unknown>, callback: ProviderCallback): void
  }
  subscriptionPayment: {
    retry(request: Record<string, unknown>, callback: ProviderCallback): void
  }
  subscriptionCard: {
    updateWithSubscriptionReferenceCode(request: Record<string, unknown>, callback: ProviderCallback): void
  }
  subscription: {
    cancel(request: Record<string, unknown>, callback: ProviderCallback): void
    search(request: Record<string, unknown>, callback: ProviderCallback): void
    upgrade(request: Record<string, unknown>, callback: ProviderCallback): void
  }
}

export {
  assertIyzicoSubscriptionSalesEnabled,
  providerPlanForSelection,
  readIyzicoSubscriptionProviderConfig,
}
export type { IyzicoSubscriptionProviderConfig }

type ProviderOptions = {
  client?: IyzicoSubscriptionClient
  timeoutMs?: number
  now?: () => number
}

function string(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function reference(value: unknown): string | null {
  const result = string(value)
  return result && result.length <= MAX_PROVIDER_REFERENCE ? result : null
}

function object(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

function array(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function epochTimestamp(value: unknown): string | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return null
  const milliseconds = value < 10_000_000_000 ? value * 1_000 : value
  const result = new Date(milliseconds).toISOString()
  return Number.isFinite(Date.parse(result)) ? result : null
}

function sameProviderInstant(left: string | null, right: string | null): boolean {
  if (!left || !right) return false
  return Math.abs(Date.parse(left) - Date.parse(right)) <= MAX_PROVIDER_TIMESTAMP_DRIFT_MS
}

function tryAmountMinor(value: unknown): number | null {
  const numeric = typeof value === 'number' ? value
    : typeof value === 'string' && /^\d+(?:\.\d{1,2})?$/.test(value.trim())
      ? Number(value)
      : Number.NaN
  const minor = Math.round(numeric * 100)
  return Number.isFinite(numeric) && numeric > 0 && Number.isSafeInteger(minor) ? minor : null
}

function renewalOrderStatus(value: unknown): 'succeeded' | 'failed' | 'pending' | null {
  const normalized = string(value)?.toUpperCase()
  if (['SUCCESS', 'SUCCEEDED', 'PAID'].includes(normalized ?? '')) return 'succeeded'
  if (['FAILURE', 'FAILED', 'UNPAID'].includes(normalized ?? '')) return 'failed'
  if (['WAITING', 'PENDING', 'PROCESSING'].includes(normalized ?? '')) return 'pending'
  return null
}

function paymentReference(value: unknown): string | null {
  if (typeof value === 'number' && Number.isSafeInteger(value) && value > 0) {
    return String(value)
  }
  return reference(value)
}

function successfulPaymentIds(order: Record<string, unknown> | null | undefined): string[] {
  return [...new Set(array(order?.paymentAttempts).map(object).flatMap((attempt) => {
    const status = string(attempt?.paymentStatus ?? attempt?.status)?.toUpperCase()
    const paymentId = paymentReference(attempt?.paymentId)
    return ['SUCCESS', 'SUCCEEDED', 'PAID'].includes(status ?? '') && paymentId ? [paymentId] : []
  }))]
}

function calendarPeriodEnd(periodStart: string, interval: 'monthly' | 'annual'): string | null {
  const start = new Date(periodStart)
  if (!Number.isFinite(start.getTime())) return null
  const year = start.getUTCFullYear()
  const month = start.getUTCMonth()
  const day = start.getUTCDate()
  const targetMonth = month + (interval === 'monthly' ? 1 : 12)
  const targetYear = year + Math.floor(targetMonth / 12)
  const normalizedMonth = ((targetMonth % 12) + 12) % 12
  const lastDay = new Date(Date.UTC(targetYear, normalizedMonth + 1, 0)).getUTCDate()
  return new Date(Date.UTC(
    targetYear,
    normalizedMonth,
    Math.min(day, lastDay),
    start.getUTCHours(),
    start.getUTCMinutes(),
    start.getUTCSeconds(),
    start.getUTCMilliseconds(),
  )).toISOString()
}

function checkoutTokenExpiryTimestamp(value: unknown, now: number): string | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return null

  // iyzico defines tokenExpireTime as a validity duration in seconds (normally
  // 1800), not as an epoch timestamp. Keep accepting an absolute timestamp for
  // compatibility with older fixtures/provider variants, but never turn a TTL
  // into a date near the Unix epoch.
  const milliseconds = value <= 7 * 24 * 60 * 60
    ? now + value * 1_000
    : value < 10_000_000_000 ? value * 1_000 : value
  const result = new Date(milliseconds).toISOString()
  return Number.isFinite(Date.parse(result)) && milliseconds > now ? result : null
}

function providerFailure(response: ProviderResponse): string {
  const code = reference(response.errorCode)
  return code
    ? `Iyzico subscription operation failed (${code})`
    : 'Iyzico subscription operation failed'
}

function providerSucceeded(response: ProviderResponse): boolean {
  return string(response.status)?.toLowerCase() === 'success'
}

function invoke(
  operation: (callback: ProviderCallback) => void,
  timeoutMs: number,
): Promise<Result<ProviderResponse>> {
  return new Promise((resolve) => {
    let settled = false
    const finish = (result: Result<ProviderResponse>) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      resolve(result)
    }
    const timer = setTimeout(
      () => finish(err('Iyzico subscription operation timed out')),
      timeoutMs,
    )
    try {
      operation((error, response) => {
        if (error) return finish(err('Iyzico subscription provider is unavailable'))
        if (!object(response)) return finish(err('Iyzico subscription response is invalid'))
        if (!providerSucceeded(response)) return finish(err(providerFailure(response)))
        finish(ok(response))
      })
    } catch {
      finish(err('Iyzico subscription provider is unavailable'))
    }
  })
}

function invokeRaw(
  operation: (callback: ProviderCallback) => void,
  timeoutMs: number,
): Promise<Result<ProviderResponse>> {
  return new Promise((resolve) => {
    let settled = false
    const finish = (result: Result<ProviderResponse>) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      resolve(result)
    }
    const timer = setTimeout(
      () => finish(err('Iyzico subscription operation timed out')),
      timeoutMs,
    )
    try {
      operation((error, response) => {
        if (error) return finish(err('Iyzico subscription provider is unavailable'))
        if (!object(response)) return finish(err('Iyzico subscription response is invalid'))
        finish(ok(response))
      })
    } catch {
      finish(err('Iyzico subscription provider is unavailable'))
    }
  })
}

function validUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'https:'
      || (url.protocol === 'http:' && (url.hostname === 'localhost' || url.hostname === '127.0.0.1'))
  } catch {
    return false
  }
}

function validCustomer(customer: SubscriptionBillingCustomer): boolean {
  const fields = [
    customer.name, customer.surname, customer.identityNumber,
    customer.email, customer.gsmNumber,
    customer.billingAddress.contactName, customer.billingAddress.city,
    customer.billingAddress.country, customer.billingAddress.address,
    customer.shippingAddress.contactName, customer.shippingAddress.city,
    customer.shippingAddress.country, customer.shippingAddress.address,
  ]
  return fields.every((value) => value.trim().length > 0)
    && customer.email.includes('@')
    && customer.identityNumber.trim().length >= 5
}

function customerRequest(customer: SubscriptionBillingCustomer): Record<string, unknown> {
  const address = (value: SubscriptionBillingCustomer['billingAddress']) => ({
    contactName: value.contactName.trim(),
    city: value.city.trim(),
    ...(value.district?.trim() ? { district: value.district.trim() } : {}),
    country: value.country.trim(),
    address: value.address.trim(),
    ...(value.zipCode?.trim() ? { zipCode: value.zipCode.trim() } : {}),
  })
  return {
    name: customer.name.trim(),
    surname: customer.surname.trim(),
    identityNumber: customer.identityNumber.trim(),
    email: customer.email.trim().toLowerCase(),
    gsmNumber: customer.gsmNumber.trim(),
    billingAddress: address(customer.billingAddress),
    shippingAddress: address(customer.shippingAddress),
  }
}

function checkoutStatus(value: unknown):
  'active' | 'pending' | 'unpaid' | 'cancelled' | 'expired' | 'upgraded' | null {
  const normalized = string(value)?.toUpperCase()
  if (normalized === 'ACTIVE') return 'active'
  if (normalized === 'PENDING') return 'pending'
  if (normalized === 'UNPAID') return 'unpaid'
  if (normalized === 'CANCELED' || normalized === 'CANCELLED') return 'cancelled'
  if (normalized === 'EXPIRED') return 'expired'
  if (normalized === 'UPGRADED') return 'upgraded'
  return null
}

export function createIyzicoSubscriptionBillingProvider(
  config: IyzicoSubscriptionProviderConfig,
  options: ProviderOptions = {},
): SubscriptionBillingProvider & SubscriptionRenewalProvider
  & SubscriptionPlanChangeProvider & SubscriptionCardUpdateProvider {
  const client = options.client ?? new Iyzipay({
    apiKey: config.apiKey,
    secretKey: config.secretKey,
    uri: config.baseUrl,
  }) as unknown as IyzicoSubscriptionClient
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const now = options.now ?? Date.now

  const probeCheckout: SubscriptionBillingProvider['probeCheckout'] = async (input) => {
    if (!reference(input.providerCheckoutRef) || !reference(input.expectedProviderPlanRef)
      || !input.idempotencyKey.trim()
      || !input.expectedAmount || input.expectedAmount.currency !== 'TRY'
      || !Number.isSafeInteger(input.expectedAmount.minor) || input.expectedAmount.minor <= 0
      || !['monthly', 'annual'].includes(input.expectedBillingInterval)) {
      return err('Iyzico subscription checkout reference is invalid')
    }
    const response = await invokeRaw((callback) => client.subscriptionCheckoutForm.retrieve({
      checkoutFormToken: input.providerCheckoutRef,
      conversationId: input.idempotencyKey,
    }, callback), timeoutMs)
    if (!response.ok) return ok({ outcome: 'ambiguous' })
    if (!providerSucceeded(response.value)) {
      return string(response.value.errorCode) === '201601'
        ? ok({ outcome: 'incomplete' })
        : ok({ outcome: 'ambiguous' })
    }
    const data = object(response.value.data)
    const providerCustomerRef = reference(data?.customerReferenceCode)
    const providerSubscriptionRef = reference(data?.referenceCode)
    const providerPlanRef = reference(data?.pricingPlanReferenceCode)
    const status = checkoutStatus(data?.subscriptionStatus)
    const activationStart = epochTimestamp(data?.startDate)
    if (!providerCustomerRef || !providerSubscriptionRef || !providerPlanRef || !status
      || !activationStart || data?.trialDays !== 0) {
      return ok({ outcome: 'ambiguous' })
    }
    if (providerPlanRef !== input.expectedProviderPlanRef) {
      return err('Iyzico subscription checkout plan does not match the claimed operation')
    }
    if (status === 'expired' || status === 'cancelled') return ok({ outcome: 'expired' })
    if (status !== 'active') return ok({ outcome: 'incomplete' })

    const search = await invokeRaw((callback) => client.subscription.search({
      locale: 'tr',
      conversationId: input.idempotencyKey,
      subscriptionReferenceCode: providerSubscriptionRef,
      page: 1,
      count: 20,
    }, callback), timeoutMs)
    if (!search.ok || !providerSucceeded(search.value)) return ok({ outcome: 'ambiguous' })
    const searchData = object(search.value.data)
    const item = array(searchData?.items).map(object)
      .find((row) => reference(row?.referenceCode) === providerSubscriptionRef)
    if (!item || reference(item.customerReferenceCode) !== providerCustomerRef
      || reference(item.pricingPlanReferenceCode) !== providerPlanRef
      || !sameProviderInstant(epochTimestamp(item.startDate), activationStart)) {
      return ok({ outcome: 'ambiguous' })
    }
    // Search results can contain a future WAITING renewal. The activation
    // order is the unique order whose period starts at the authenticated
    // checkout activation timestamp; provider list order is irrelevant.
    const activationOrders = array(item.orders).map(object).filter((candidate) => (
      sameProviderInstant(epochTimestamp(candidate?.startPeriod), activationStart)
    ))
    if (activationOrders.length !== 1) return ok({ outcome: 'ambiguous' })
    const order = activationOrders[0]
    const providerInvoiceRef = reference(order?.referenceCode)
    const paymentIds = successfulPaymentIds(order)
    const providerPaymentId = paymentIds.length === 1 ? paymentIds[0] ?? null : null
    const providerOrderStatus = renewalOrderStatus(order?.orderStatus)
    const amountMinor = tryAmountMinor(order?.price)
    const periodStart = epochTimestamp(order?.startPeriod)
    const periodEnd = epochTimestamp(order?.endPeriod)
    const expectedPeriodEnd = periodStart
      ? calendarPeriodEnd(periodStart, input.expectedBillingInterval)
      : null
    return providerInvoiceRef && providerPaymentId && providerOrderStatus === 'succeeded'
      && amountMinor === input.expectedAmount.minor && string(order?.currencyCode) === input.expectedAmount.currency
      && periodStart && sameProviderInstant(periodStart, activationStart)
      && periodEnd && periodEnd === expectedPeriodEnd
      ? ok({
        outcome: 'active',
        checkout: {
          providerCustomerRef, providerSubscriptionRef, providerPlanRef,
          providerInvoiceRef, providerPaymentId, providerOrderStatus,
          amount: input.expectedAmount, periodStart, periodEnd, status: 'active',
        },
      })
      : ok({ outcome: 'ambiguous' })
  }

  const retrieveSubscriptionOrder: SubscriptionRenewalProvider['retrieveSubscriptionOrder'] = async (input) => {
    if (!reference(input.providerCustomerRef) || !reference(input.providerSubscriptionRef)
      || !reference(input.providerInvoiceRef) || !input.idempotencyKey.trim()) {
      return err('Iyzico subscription order input is invalid')
    }
    const response = await invoke((callback) => client.subscription.search({
      locale: 'tr',
      conversationId: input.idempotencyKey,
      subscriptionReferenceCode: input.providerSubscriptionRef,
      page: 1,
      count: 20,
    }, callback), timeoutMs)
    if (!response.ok) return response
    const item = array(object(response.value.data)?.items).map(object)
      .find((candidate) => reference(candidate?.referenceCode) === input.providerSubscriptionRef)
    if (!item || reference(item.customerReferenceCode) !== input.providerCustomerRef) {
      return err('Iyzico subscription order identity does not match')
    }
    const providerPlanRef = reference(item.pricingPlanReferenceCode)
    const order = array(item.orders).map(object)
      .find((candidate) => reference(candidate?.referenceCode) === input.providerInvoiceRef)
    const amountMinor = tryAmountMinor(order?.price)
    const periodStart = epochTimestamp(order?.startPeriod)
    const periodEnd = epochTimestamp(order?.endPeriod)
    const status = renewalOrderStatus(order?.orderStatus)
    const paymentIds = successfulPaymentIds(order)
    const providerPaymentId = paymentIds.length === 1 ? paymentIds[0] ?? null : null
    if (!providerPlanRef || !order || !amountMinor || !periodStart || !periodEnd || !status
      || string(order.currencyCode) !== 'TRY'
      || (status === 'succeeded' && paymentIds.length !== 1)
      || (status === 'failed' && paymentIds.length !== 0)) {
      return err('Iyzico subscription order response is invalid')
    }
    const binding = configuredProviderPlanBindings(config)
      .find((candidate) => candidate.referenceCode === providerPlanRef) ?? null
    if (!binding || binding.amountMinor !== amountMinor) {
      return err('Iyzico subscription order plan or amount does not match configuration')
    }
    return ok({
      providerCustomerRef: input.providerCustomerRef,
      providerSubscriptionRef: input.providerSubscriptionRef,
      providerInvoiceRef: input.providerInvoiceRef,
      providerPaymentId,
      providerPlanRef,
      plan: binding.plan,
      addOns: binding.addOns,
      billingInterval: binding.billingInterval,
      amount: { minor: amountMinor, currency: 'TRY' },
      periodStart,
      periodEnd,
      status,
    })
  }

  return {
    async initializeSubscriptionCardUpdate(input) {
      if (!reference(input.providerSubscriptionRef) || !validUrl(input.callbackUrl)
        || !input.idempotencyKey.trim()) {
        return err('Iyzico subscription card update input is invalid')
      }
      const response = await invoke((callback) => client.subscriptionCard.updateWithSubscriptionReferenceCode({
        locale: 'tr',
        conversationId: input.idempotencyKey,
        subscriptionReferenceCode: input.providerSubscriptionRef,
        callbackUrl: input.callbackUrl,
      }, callback), timeoutMs)
      if (!response.ok) return response
      const providerCheckoutRef = reference(response.value.token)
      const checkoutContent = string(response.value.checkoutFormContent)
        ?? string(response.value.htmlContent)
      const expectedEnvironment = config.baseUrl === 'https://sandbox-api.iyzipay.com' ? 'sandbox' : 'live'
      const validatedCheckout = checkoutContent
        ? validateIyzicoCheckoutContent(checkoutContent, expectedEnvironment)
        : null
      if (!providerCheckoutRef || !validatedCheckout) {
        return err('Iyzico subscription card update response is invalid')
      }
      return ok({
        providerCheckoutRef,
        checkoutContent: validatedCheckout.content,
        expiresAt: checkoutTokenExpiryTimestamp(response.value.tokenExpireTime, now()),
      })
    },
    async createCustomer(input) {
      if (!input.restaurantId.trim() || !input.idempotencyKey.trim() || !validCustomer(input.customer)) {
        return err('Iyzico subscription customer input is invalid')
      }
      const response = await invoke((callback) => client.subscriptionCustomer.create({
        locale: 'tr',
        conversationId: input.idempotencyKey,
        ...customerRequest(input.customer),
      }, callback), timeoutMs)
      if (!response.ok) return response
      const data = object(response.value.data)
      const providerCustomerRef = reference(data?.referenceCode ?? response.value.referenceCode)
      return providerCustomerRef
        ? ok({ providerCustomerRef })
        : err('Iyzico subscription customer response is invalid')
    },

    async createCheckout(input) {
      const addOns = [...(input.addOns ?? [])]
      const plan = providerPlanForSelection(config, input.plan, input.interval, addOns)
      if (!plan || !validCustomer(input.customer) || !validUrl(input.callbackUrl)
        || !input.invoiceId.trim() || !input.idempotencyKey.trim()
        || input.amount.currency !== 'TRY' || input.amount.minor !== plan.amountMinor) {
        return err('Iyzico subscription checkout input is invalid')
      }
      const response = await invoke((callback) => client.subscriptionCheckoutForm.initialize({
        locale: 'tr',
        conversationId: input.idempotencyKey,
        callbackUrl: input.callbackUrl,
        pricingPlanReferenceCode: plan.referenceCode,
        subscriptionInitialStatus: 'ACTIVE',
        customer: customerRequest(input.customer),
      }, callback), timeoutMs)
      if (!response.ok) return response
      const providerCheckoutRef = reference(response.value.token)
      const checkoutContent = string(response.value.checkoutFormContent)
        ?? string(response.value.htmlContent)
      const expectedEnvironment = config.baseUrl === 'https://sandbox-api.iyzipay.com' ? 'sandbox' : 'live'
      const validatedCheckout = checkoutContent
        ? validateIyzicoCheckoutContent(checkoutContent, expectedEnvironment)
        : null
      if (!providerCheckoutRef || !validatedCheckout) {
        return err('Iyzico subscription checkout response is invalid')
      }
      return ok({
        providerCheckoutRef,
        providerPlanRef: plan.referenceCode,
        checkoutContent: validatedCheckout.content,
        expiresAt: checkoutTokenExpiryTimestamp(response.value.tokenExpireTime, now()),
      })
    },

    probeCheckout,

    retrieveSubscriptionOrder,

    async retrieveCheckout(input) {
      const probed = await probeCheckout(input)
      if (!probed.ok) return probed
      return probed.value.outcome === 'active'
        ? ok(probed.value.checkout)
        : err(`Iyzico subscription checkout is ${probed.value.outcome}`)
    },

    async verifyWebhook() {
      return err('Use the isolated Iyzico subscription webhook verifier')
    },

    async retryInvoice(input) {
      if (!reference(input.providerPaymentRef) || !input.invoiceId.trim() || !input.idempotencyKey.trim()) {
        return err('Iyzico subscription retry input is invalid')
      }
      const response = await invoke((callback) => client.subscriptionPayment.retry({
        locale: 'tr',
        conversationId: input.idempotencyKey,
        referenceCode: input.providerPaymentRef,
      }, callback), timeoutMs)
      return response.ok ? ok({ accepted: true as const }) : response
    },

    async cancelSubscription(input) {
      if (!reference(input.providerSubscriptionRef) || !input.idempotencyKey.trim()) {
        return err('Iyzico subscription cancellation input is invalid')
      }
      const response = await invoke((callback) => client.subscription.cancel({
        subscriptionReferenceCode: input.providerSubscriptionRef,
      }, callback), timeoutMs)
      return response.ok
        ? ok({ cancelledAt: new Date(now()).toISOString() })
        : response
    },

    async probeSubscriptionStatus(input) {
      if (!reference(input.providerSubscriptionRef) || !input.idempotencyKey.trim()) {
        return err('Iyzico subscription status probe input is invalid')
      }
      const response = await invoke((callback) => client.subscription.search({
        locale: 'tr',
        conversationId: input.idempotencyKey,
        subscriptionReferenceCode: input.providerSubscriptionRef,
        page: 1,
        count: 20,
      }, callback), timeoutMs)
      if (!response.ok) return response
      const item = array(object(response.value.data)?.items).map(object)
        .find((candidate) => reference(candidate?.referenceCode) === input.providerSubscriptionRef)
      const status = checkoutStatus(item?.subscriptionStatus)
      return status
        ? ok({ status, observedAt: new Date(now()).toISOString() })
        : err('Iyzico subscription status response is invalid')
    },

    async upgradeSubscription(input) {
      if (!reference(input.providerSubscriptionRef) || !reference(input.providerTargetPlanRef)
        || input.effectivePolicy !== 'next_period' || !input.idempotencyKey.trim()) {
        return err('Iyzico subscription plan change input is invalid')
      }
      const response = await invoke((callback) => client.subscription.upgrade({
        locale: 'tr',
        conversationId: input.idempotencyKey,
        subscriptionReferenceCode: input.providerSubscriptionRef,
        newPricingPlanReferenceCode: input.providerTargetPlanRef,
        upgradePeriod: 'NEXT_PERIOD',
        useTrial: false,
        resetRecurrenceCount: false,
      }, callback), timeoutMs)
      if (!response.ok) return response
      const data = object(response.value.data)
      const providerLineageRef = reference(data?.parentReferenceCode)
      const providerTargetSubscriptionRef = reference(data?.referenceCode)
      const providerTargetPlanRef = reference(data?.pricingPlanReferenceCode)
      const providerStatus = checkoutStatus(data?.subscriptionStatus)
      const responsePeriodStart = epochTimestamp(data?.startDate)
      const responsePeriodEnd = epochTimestamp(data?.endDate)
      if (!providerLineageRef || !providerTargetSubscriptionRef
        || providerTargetSubscriptionRef === input.providerSubscriptionRef
        || providerTargetPlanRef !== input.providerTargetPlanRef
        || providerStatus !== 'active') {
        return err('Iyzico subscription plan change response does not match the request')
      }

      // Iyzico identifies upgrade descendants by a shared root lineage ref;
      // that value is not necessarily the subscription ref used in the
      // upgrade path. Sandbox may also omit endDate for non-expiring plans.
      // Bind both sides of the lineage with authenticated reads and use the
      // scheduled order as the period boundary when endDate is absent.
      const [parentSearch, targetSearch] = await Promise.all([
        invokeRaw((callback) => client.subscription.search({
          locale: 'tr', conversationId: `${input.idempotencyKey}:parent`,
          subscriptionReferenceCode: input.providerSubscriptionRef, page: 1, count: 20,
        }, callback), timeoutMs),
        invokeRaw((callback) => client.subscription.search({
          locale: 'tr', conversationId: `${input.idempotencyKey}:target`,
          subscriptionReferenceCode: providerTargetSubscriptionRef, page: 1, count: 20,
        }, callback), timeoutMs),
      ])
      if (!parentSearch.ok || !targetSearch.ok
        || !providerSucceeded(parentSearch.value) || !providerSucceeded(targetSearch.value)) {
        return err('Iyzico subscription plan change response does not match the request')
      }
      const parentItem = array(object(parentSearch.value.data)?.items).map(object)
        .find((item) => reference(item?.referenceCode) === input.providerSubscriptionRef)
      const targetItem = array(object(targetSearch.value.data)?.items).map(object)
        .find((item) => reference(item?.referenceCode) === providerTargetSubscriptionRef)
      const parentLineageRef = reference(parentItem?.parentReferenceCode)
        ?? reference(parentItem?.referenceCode)
      const targetLineageRef = reference(targetItem?.parentReferenceCode)
      const targetItemPlanRef = reference(targetItem?.pricingPlanReferenceCode)
      const targetItemStatus = checkoutStatus(targetItem?.subscriptionStatus)
      const searchedPeriodStart = epochTimestamp(targetItem?.startDate)
      const searchedPeriodEnd = epochTimestamp(targetItem?.endDate)
      const providerPeriodStart = responsePeriodStart ?? searchedPeriodStart
      const periodOrder = array(targetItem?.orders).map(object).find((order) => {
        const orderStart = epochTimestamp(order?.startPeriod)
        const orderEnd = epochTimestamp(order?.endPeriod)
        return orderStart && orderEnd && providerPeriodStart === orderStart
          && Date.parse(orderEnd) > Date.parse(orderStart)
      })
      const providerPeriodEnd = responsePeriodEnd ?? searchedPeriodEnd
        ?? epochTimestamp(periodOrder?.endPeriod)
      if (!parentItem || !targetItem
        || parentLineageRef !== providerLineageRef
        || targetLineageRef !== providerLineageRef
        || targetItemPlanRef !== input.providerTargetPlanRef
        || targetItemStatus !== 'active'
        || (responsePeriodStart && searchedPeriodStart && responsePeriodStart !== searchedPeriodStart)
        || !providerPeriodStart || !providerPeriodEnd
        || Date.parse(providerPeriodEnd) <= Date.parse(providerPeriodStart)) {
        return err('Iyzico subscription plan change response does not match the request')
      }
      return ok({
        providerParentSubscriptionRef: input.providerSubscriptionRef,
        providerTargetSubscriptionRef,
        providerTargetPlanRef,
        providerStatus: 'active' as const,
        providerPeriodStart,
        providerPeriodEnd,
      })
    },
  }
}
