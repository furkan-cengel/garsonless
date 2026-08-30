import { randomUUID } from 'node:crypto'
import Iyzipay from 'iyzipay'
import {
  IYZICO_SUBSCRIPTION_PRODUCT_NAME,
  iyzicoSubscriptionProvisioningPlans,
} from '../lib/billing/iyzico-subscription-provisioning'
import { verifyIyzicoSubscriptionPlanResponse } from '../lib/billing/iyzico-subscription-plan-verification'

type ProviderResponse = Record<string, unknown>
type ProviderCallback = (error: Error | null, response: ProviderResponse) => void
type ProviderMethod = (request: Record<string, unknown>, callback: ProviderCallback) => void
type ProvisioningClient = {
  subscriptionProduct: { create: ProviderMethod; retrieveList: ProviderMethod }
  subscriptionPricingPlan: { create: ProviderMethod; retrieveList: ProviderMethod }
}

const LIVE_URL = 'https://api.iyzipay.com'
const TIMEOUT_MS = 15_000
const PAGE_SIZE = 100

function required(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`${name}_missing`)
  return value
}

function vatRate(): number {
  const raw = required('INVOICE_VAT_RATE')
  const value = Number(raw)
  if (!/^\d+$/.test(raw) || !Number.isInteger(value) || value < 0 || value > 100) {
    throw new Error('INVOICE_VAT_RATE_invalid')
  }
  return value
}

function object(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

function items(response: ProviderResponse): Record<string, unknown>[] {
  const data = object(response.data)
  return Array.isArray(data?.items) ? data.items.map(object).filter((item) => item !== null) : []
}

function reference(data: Record<string, unknown> | null): string | null {
  const value = data?.referenceCode
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function providerErrorCode(response: ProviderResponse): string {
  const value = response.errorCode
  return typeof value === 'string' && /^[A-Za-z0-9._-]{1,100}$/.test(value)
    ? value
    : 'unknown'
}

function invoke(method: ProviderMethod, request: Record<string, unknown>): Promise<ProviderResponse> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('provider_timeout')), TIMEOUT_MS)
    method(request, (error, response) => {
      clearTimeout(timeout)
      if (error) reject(new Error('provider_request_failed'))
      else resolve(response)
    })
  })
}

async function listAll(method: ProviderMethod, base: Record<string, unknown>): Promise<Record<string, unknown>[]> {
  const result: Record<string, unknown>[] = []
  for (let page = 1; page <= 50; page += 1) {
    const response = await invoke(method, { ...base, locale: 'tr', conversationId: randomUUID(), page, count: PAGE_SIZE })
    if (response.status !== 'success') throw new Error(`provider_list_failed:${providerErrorCode(response)}`)
    const batch = items(response)
    result.push(...batch)
    if (batch.length < PAGE_SIZE) return result
  }
  throw new Error('provider_list_limit_exceeded')
}

async function main() {
  const apply = process.argv.includes('--apply')
  const rate = vatRate()
  const plans = iyzicoSubscriptionProvisioningPlans(rate)
  if (!apply) {
    console.log(`DRY RUN ${IYZICO_SUBSCRIPTION_PRODUCT_NAME}`)
    for (const plan of plans) {
      console.log(`${plan.name}: ${(plan.amountMinor / 100).toFixed(2)} TRY / ${plan.request.paymentInterval}`)
    }
    console.log('No provider changes made. Re-run with --apply after reviewing the catalogue.')
    return
  }

  const baseUrl = required('IYZICO_BILLING_BASE_URL')
  if (baseUrl !== LIVE_URL) throw new Error('IYZICO_BILLING_BASE_URL_not_live')
  const client = new Iyzipay({
    apiKey: required('IYZICO_BILLING_API_KEY'),
    secretKey: required('IYZICO_BILLING_SECRET_KEY'),
    uri: baseUrl,
  }) as unknown as ProvisioningClient

  const products = await listAll(client.subscriptionProduct.retrieveList.bind(client.subscriptionProduct), {})
  const matches = products.filter((product) => product.name === IYZICO_SUBSCRIPTION_PRODUCT_NAME)
  if (matches.length > 1) throw new Error('duplicate_subscription_product')
  let productReferenceCode = reference(matches[0] ?? null)
  if (!productReferenceCode) {
    const created = await invoke(client.subscriptionProduct.create.bind(client.subscriptionProduct), {
      locale: 'tr', conversationId: randomUUID(), name: IYZICO_SUBSCRIPTION_PRODUCT_NAME,
      description: 'Masabu restoran yazılımı aylık ve yıllık SaaS abonelikleri',
    })
    if (created.status !== 'success') {
      throw new Error(`subscription_product_create_failed:${providerErrorCode(created)}`)
    }
    productReferenceCode = reference(object(created.data))
  }
  if (!productReferenceCode) throw new Error('subscription_product_reference_missing')

  const existing = await listAll(
    client.subscriptionPricingPlan.retrieveList.bind(client.subscriptionPricingPlan),
    { productReferenceCode },
  )
  const envLines: string[] = []
  for (const plan of plans) {
    const matches = existing.filter((item) => item.name === plan.name)
    if (matches.length > 1) throw new Error(`${plan.plan}_${plan.interval}_duplicate`)
    let response: ProviderResponse
    if (matches.length === 1) {
      response = { status: 'success', data: matches[0] }
    } else {
      response = await invoke(client.subscriptionPricingPlan.create.bind(client.subscriptionPricingPlan), {
        ...plan.request,
        conversationId: randomUUID(),
        productReferenceCode,
      })
    }
    if (response.status !== 'success') {
      throw new Error(`${plan.plan}_${plan.interval}_create_failed:${providerErrorCode(response)}`)
    }
    const planReferenceCode = reference(object(response.data))
    if (!planReferenceCode) throw new Error(`${plan.plan}_${plan.interval}_reference_missing`)
    const verified = verifyIyzicoSubscriptionPlanResponse(response, {
      referenceCode: planReferenceCode,
      amountMinor: plan.amountMinor,
      interval: plan.interval,
    })
    if (!verified.ok) throw new Error(`${plan.plan}_${plan.interval}_contract_mismatch`)
    envLines.push(`${plan.envReferenceKey}=${planReferenceCode}`)
    envLines.push(`${plan.envAmountKey}=${plan.amountMinor}`)
    console.log(`PASS ${plan.plan}/${plan.interval}`)
  }
  console.log('\nCopy these non-secret provider references into .env.production:')
  console.log(envLines.join('\n'))
}

main().catch((cause: unknown) => {
  const message = cause instanceof Error ? cause.message : 'unknown_failure'
  console.error(`FAIL iyzico subscription provisioning: ${message}`)
  process.exitCode = 1
})
