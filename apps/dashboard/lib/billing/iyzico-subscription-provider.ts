import Iyzipay from 'iyzipay'
import type {
  SubscriptionBillingCustomer,
  SubscriptionBillingProvider,
} from '@garsonless/application/billing'
import { err, ok, type Result } from '@garsonless/domain/result'
import {
  readIyzicoSubscriptionProviderConfig,
  type IyzicoSubscriptionProviderConfig,
} from './iyzico-subscription-config'

const MAX_PROVIDER_REFERENCE = 200
const MAX_CHECKOUT_CONTENT_BYTES = 512 * 1024
const DEFAULT_TIMEOUT_MS = 15_000

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
  subscription: {
    cancel(request: Record<string, unknown>, callback: ProviderCallback): void
    search(request: Record<string, unknown>, callback: ProviderCallback): void
  }
}

export { readIyzicoSubscriptionProviderConfig }
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
  const result = new Date(value).toISOString()
  return Number.isFinite(Date.parse(result)) ? result : null
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
): SubscriptionBillingProvider {
  const client = options.client ?? new Iyzipay({
    apiKey: config.apiKey,
    secretKey: config.secretKey,
    uri: config.baseUrl,
  }) as unknown as IyzicoSubscriptionClient
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const now = options.now ?? Date.now

  return {
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
      const plan = addOns.length === 0
        ? config.plans[input.plan]?.[input.interval]
        : input.plan === 'pro'
          && addOns.length === 1
          && addOns[0] === 'iyzico_online_payments'
          ? config.addOns?.iyzico_online_payments?.[input.interval]
          : null
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
      if (!providerCheckoutRef || !checkoutContent
        || Buffer.byteLength(checkoutContent, 'utf8') > MAX_CHECKOUT_CONTENT_BYTES) {
        return err('Iyzico subscription checkout response is invalid')
      }
      return ok({
        providerCheckoutRef,
        providerPlanRef: plan.referenceCode,
        checkoutContent,
        expiresAt: null,
      })
    },

    async retrieveCheckout(input) {
      if (!reference(input.providerCheckoutRef) || !reference(input.expectedProviderPlanRef)
        || !input.idempotencyKey.trim()) {
        return err('Iyzico subscription checkout reference is invalid')
      }
      const response = await invoke((callback) => client.subscriptionCheckoutForm.retrieve({
        checkoutFormToken: input.providerCheckoutRef,
        conversationId: input.idempotencyKey,
      }, callback), timeoutMs)
      if (!response.ok) return response
      const data = object(response.value.data)
      const providerCustomerRef = reference(data?.customerReferenceCode)
      const providerSubscriptionRef = reference(data?.referenceCode)
      const providerPlanRef = reference(data?.pricingPlanReferenceCode)
      const status = checkoutStatus(data?.subscriptionStatus)
      if (!providerCustomerRef || !providerSubscriptionRef || !providerPlanRef || !status) {
        return err('Iyzico subscription checkout result is invalid')
      }
      if (providerPlanRef !== input.expectedProviderPlanRef) {
        return err('Iyzico subscription checkout plan does not match the claimed operation')
      }
      const search = await invoke((callback) => client.subscription.search({
        locale: 'tr',
        conversationId: input.idempotencyKey,
        subscriptionReferenceCode: providerSubscriptionRef,
        page: 1,
        count: 1,
      }, callback), timeoutMs)
      if (!search.ok) return search
      const searchData = object(search.value.data)
      const item = array(searchData?.items).map(object)
        .find((row) => reference(row?.referenceCode) === providerSubscriptionRef)
      const order = array(item?.orders).map(object)[0]
      const providerInvoiceRef = reference(order?.referenceCode)
      const periodStart = epochTimestamp(order?.startPeriod)
      const periodEnd = epochTimestamp(order?.endPeriod)
      return providerInvoiceRef && periodStart && periodEnd
        ? ok({
          providerCustomerRef, providerSubscriptionRef, providerPlanRef,
          providerInvoiceRef, periodStart, periodEnd, status,
        })
        : err('Iyzico subscription order mapping is invalid')
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
  }
}
