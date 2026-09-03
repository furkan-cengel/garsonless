import { randomUUID } from 'node:crypto'
import Iyzipay from 'iyzipay'
import {
  IYZICO_SUBSCRIPTION_ENDPOINTS,
  validateIyzicoProvisioningTarget,
} from '../lib/billing/iyzico-subscription-provisioning'

type ProviderResponse = Record<string, unknown>
type ProviderCallback = (error: Error | null, response: ProviderResponse) => void
type AccessClient = {
  subscriptionProduct: {
    retrieveList(request: Record<string, unknown>, callback: ProviderCallback): void
  }
}

const TIMEOUT_MS = 15_000

function required(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`${name}_missing`)
  return value
}

async function retrieveOne(client: AccessClient): Promise<ProviderResponse> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('provider_timeout')), TIMEOUT_MS)
    client.subscriptionProduct.retrieveList({
      locale: 'tr', conversationId: randomUUID(), page: 1, count: 1,
    }, (error, response) => {
      clearTimeout(timeout)
      if (error) reject(new Error('provider_request_failed'))
      else resolve(response)
    })
  })
}

async function main() {
  const targetArgument = process.argv.find((argument) => argument.startsWith('--target='))
  const target = targetArgument?.slice('--target='.length) ?? null
  const baseUrl = required('IYZICO_BILLING_BASE_URL')
  const environment = validateIyzicoProvisioningTarget({
    target, baseUrl, apply: false, liveConfirmed: false,
  })
  if (baseUrl !== IYZICO_SUBSCRIPTION_ENDPOINTS[environment]) throw new Error('provider_origin_invalid')

  const client = new Iyzipay({
    apiKey: required('IYZICO_BILLING_API_KEY'),
    secretKey: required('IYZICO_BILLING_SECRET_KEY'),
    uri: baseUrl,
  }) as unknown as AccessClient
  const response = await retrieveOne(client)
  if (response.status !== 'success') {
    const errorCode = typeof response.errorCode === 'string' ? response.errorCode : 'unknown'
    throw new Error(`subscription_access_failed:${errorCode}`)
  }
  const data = response.data && typeof response.data === 'object'
    ? response.data as Record<string, unknown>
    : null
  const visibleProducts = Array.isArray(data?.items) ? data.items.length : 0
  console.log(`PASS iyzico subscription access (${environment}, visible products: ${visibleProducts})`)
}

main().catch((cause: unknown) => {
  const message = cause instanceof Error ? cause.message : 'unknown_failure'
  console.error(`FAIL iyzico subscription access: ${message}`)
  process.exitCode = 1
})
