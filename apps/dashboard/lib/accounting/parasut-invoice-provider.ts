import type { AccountingInvoiceJob } from '@garsonless/db/server'
import {
  providerError,
  type FormalizedDocument,
  type InvoiceProvider,
  type ParasutRefreshTokenLease,
  type ParasutRefreshTokenStore,
} from './invoice-provider'

type Fetch = typeof fetch
type Json = Record<string, unknown>

const REQUEST_TIMEOUT_MS = 15_000
const MAX_PDF_BYTES = 10 * 1024 * 1024

export type ParasutConfig = {
  apiBaseUrl: string
  clientId: string
  clientSecret: string
  refreshToken: string | null
  companyId: string
  productId: string
  internetSaleUrl: string
  vatRate: number
  serviceName: string
}

export function readParasutConfig(env: Readonly<Record<string, string | undefined>> = process.env): ParasutConfig {
  const required = (name: string) => {
    const value = env[name]?.trim()
    if (!value) throw providerError(`PARASUT_CONFIG_${name}`, false)
    return value
  }
  const vatRate = Number(required('INVOICE_VAT_RATE'))
  if (!Number.isInteger(vatRate) || vatRate < 0 || vatRate > 100) {
    throw providerError('PARASUT_CONFIG_INVOICE_VAT_RATE', false)
  }
  const apiBaseUrl = secureUrl(env['PARASUT_API_BASE_URL']?.trim() || 'https://api.parasut.com', 'PARASUT_CONFIG_API_URL')
  const internetSaleUrl = secureUrl(required('PARASUT_INTERNET_SALE_URL'), 'PARASUT_CONFIG_INTERNET_SALE_URL')
  return {
    apiBaseUrl: apiBaseUrl.toString().replace(/\/$/, ''),
    clientId: required('PARASUT_CLIENT_ID'),
    clientSecret: required('PARASUT_CLIENT_SECRET'),
    refreshToken: env['PARASUT_REFRESH_TOKEN']?.trim() || null,
    companyId: required('PARASUT_COMPANY_ID'),
    productId: required('PARASUT_PRODUCT_ID'),
    internetSaleUrl: internetSaleUrl.toString(),
    vatRate,
    serviceName: required('INVOICE_SERVICE_NAME'),
  }
}

function secureUrl(value: string, code: string): URL {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw providerError(code, false)
  }
  if (url.protocol !== 'https:' || url.username || url.password) throw providerError(code, false)
  return url
}

function object(value: unknown): Json | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Json : null
}

function firstDataId(value: unknown): string | null {
  const row = object(value)
  const data = Array.isArray(row?.data) ? object(row.data[0]) : object(row?.data)
  return typeof data?.id === 'string' && data.id ? data.id : null
}

function jobStatus(value: unknown): string | null {
  const row = object(value)
  const data = object(row?.data)
  const attrs = object(data?.attributes)
  return typeof attrs?.status === 'string' ? attrs.status : null
}

function activeDocument(value: unknown): FormalizedDocument | null {
  const row = object(value)
  const data = object(row?.data)
  const relationships = object(data?.relationships)
  const relation = object(relationships?.active_e_document)
  const document = object(relation?.data)
  const ref = typeof document?.id === 'string' && document.id ? document.id : null
  const type = document?.type === 'e_invoices' ? 'e_fatura'
    : document?.type === 'e_archives' ? 'e_arsiv' : null
  return ref && type ? { ref, type } : null
}

function pdfUrl(value: unknown): URL | null {
  const row = object(value)
  const data = object(row?.data)
  const attrs = object(data?.attributes)
  if (typeof attrs?.url !== 'string' || !attrs.url) return null
  return secureUrl(attrs.url, 'PARASUT_PDF_URL')
}

function cityAndDistrict(job: AccountingInvoiceJob): { city: string; district: string; address: string } {
  const value = job.profile.billingAddress
  const city = typeof value.city === 'string' ? value.city.trim() : ''
  const district = typeof value.district === 'string' ? value.district.trim() : ''
  const address = typeof value.address === 'string' ? value.address.trim() : ''
  if (!city || !district || !address) throw providerError('PARASUT_PROFILE_ADDRESS', false)
  return { city, district, address }
}

function moneyFromGross(amountMinor: number, vatRate: number): number {
  const netMinor = Math.round((amountMinor * 100) / (100 + vatRate))
  return netMinor / 100
}

function localTokenStore(initialRefreshToken: string): ParasutRefreshTokenStore {
  let refreshToken = initialRefreshToken
  let version = 0
  return {
    async claim() {
      return { refreshToken, version }
    },
    async rotate(lease, nextRefreshToken) {
      if (lease.version !== version) throw providerError('PARASUT_TOKEN_LEASE_LOST', true)
      refreshToken = nextRefreshToken
      version += 1
    },
    async release() {},
  }
}

export function createParasutInvoiceProvider(
  config: ParasutConfig = readParasutConfig(),
  fetcher: Fetch = fetch,
  refreshTokens?: ParasutRefreshTokenStore,
): InvoiceProvider & { verifyAccess(): Promise<{ productRef: string }> } {
  const tokenStore = refreshTokens ?? (config.refreshToken
    ? localTokenStore(config.refreshToken)
    : (() => { throw providerError('PARASUT_CONFIG_REFRESH_TOKEN', false) })())
  let token: { value: string; expiresAt: number } | null = null

  async function accessToken(): Promise<string> {
    if (token && token.expiresAt > Date.now() + 30_000) return token.value
    const lease = await tokenStore.claim()
    let response: Response
    try {
      const body = new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: config.clientId,
        client_secret: config.clientSecret,
        refresh_token: lease.refreshToken,
      })
      response = await fetcher(`${config.apiBaseUrl}/oauth/token`, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      })
    } catch {
      await safeRelease(tokenStore, lease)
      throw providerError('PARASUT_TOKEN_NETWORK', true)
    }
    if (!response.ok) {
      await safeRelease(tokenStore, lease)
      const retryable = response.status === 429 || response.status >= 500
      throw providerError(retryable ? 'PARASUT_TOKEN_TEMPORARY' : 'PARASUT_TOKEN_REJECTED', retryable)
    }
    let payload: Json | null
    try {
      payload = object(await response.json())
    } catch {
      await safeRelease(tokenStore, lease)
      throw providerError('PARASUT_TOKEN_RESPONSE', true)
    }
    const value = typeof payload?.access_token === 'string' ? payload.access_token : null
    const nextRefreshToken = typeof payload?.refresh_token === 'string' ? payload.refresh_token : null
    const expiresIn = typeof payload?.expires_in === 'number' ? payload.expires_in : 7200
    if (!value || !nextRefreshToken) {
      await safeRelease(tokenStore, lease)
      throw providerError('PARASUT_TOKEN_RESPONSE', true)
    }
    await tokenStore.rotate(lease, nextRefreshToken)
    token = { value, expiresAt: Date.now() + Math.max(60, expiresIn) * 1000 }
    return value
  }

  async function request(path: string, init?: RequestInit): Promise<{ status: number; payload: unknown }> {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      let response: Response
      try {
        response = await fetcher(`${config.apiBaseUrl}/v4/${encodeURIComponent(config.companyId)}${path}`, {
          ...init,
          headers: {
            accept: 'application/vnd.api+json',
            authorization: `Bearer ${await accessToken()}`,
            ...(init?.body ? { 'content-type': 'application/vnd.api+json' } : {}),
            ...init?.headers,
          },
          signal: init?.signal ?? AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        })
      } catch (cause) {
        if (cause instanceof Error && 'retryable' in cause) throw cause
        throw providerError('PARASUT_API_NETWORK', true)
      }
      if (response.status === 401 && attempt === 0) {
        token = null
        continue
      }
      if (!response.ok) {
        const retryable = response.status === 429 || response.status >= 500
        throw providerError(retryable ? 'PARASUT_API_TEMPORARY' : `PARASUT_API_REJECTED_${response.status}`, retryable)
      }
      if (response.status === 204) return { status: 204, payload: null }
      const contentType = response.headers.get('content-type') || ''
      if (!contentType.includes('json')) throw providerError('PARASUT_API_RESPONSE', true)
      try {
        return { status: response.status, payload: await response.json() }
      } catch {
        throw providerError('PARASUT_API_RESPONSE', true)
      }
    }
    throw providerError('PARASUT_API_REJECTED_401', false)
  }

  return {
    async verifyAccess() {
      const result = await request(`/products/${encodeURIComponent(config.productId)}`)
      const productRef = firstDataId(result.payload)
      if (productRef !== config.productId) throw providerError('PARASUT_PRODUCT_RESPONSE', false)
      return { productRef }
    },

    async ensureContact(job) {
      if (job.providerContactRef) return job.providerContactRef
      const taxNumber = encodeURIComponent(job.profile.identityNumber)
      const found = firstDataId((await request(`/contacts?filter[tax_number]=${taxNumber}&page[size]=1`)).payload)
      if (found) return found
      const location = cityAndDistrict(job)
      const created = await request('/contacts', {
        method: 'POST',
        body: JSON.stringify({ data: { type: 'contacts', attributes: {
          name: job.profile.legalName,
          email: job.profile.email,
          tax_number: job.profile.identityNumber,
          tax_office: job.profile.taxOffice,
          address: location.address,
          city: location.city,
          district: location.district,
          account_type: 'customer',
        } } }),
      })
      const id = firstDataId(created.payload)
      if (!id) throw providerError('PARASUT_CONTACT_RESPONSE', true)
      return id
    },

    async resolveDocumentType(job) {
      if (job.fiscalDocumentType) return job.fiscalDocumentType
      const result = await request(`/e_invoice_inboxes?filter[vkn]=${encodeURIComponent(job.profile.identityNumber)}&page[size]=1`)
      return firstDataId(result.payload) ? 'e_fatura' : 'e_arsiv'
    },

    async createSalesInvoice(job, contactRef) {
      if (job.providerInvoiceRef) return job.providerInvoiceRef
      const issueDate = job.profile.paidAt.slice(0, 10)
      const netAmount = moneyFromGross(job.amountMinor, config.vatRate)
      const addOnDescription = job.profile.addOns.length > 0 ? ` + ${job.profile.addOns.join(', ')}` : ''
      const description = `${config.serviceName} · ${job.profile.plan}${addOnDescription} · ${job.profile.billingInterval} · ${job.subscriptionInvoiceId}`
      const created = await request('/sales_invoices', {
        method: 'POST',
        body: JSON.stringify({ data: {
          type: 'sales_invoices',
          attributes: {
            item_type: 'invoice',
            description,
            issue_date: issueDate,
            due_date: issueDate,
            currency: 'TRL',
            exchange_rate: 1,
            withholding_rate: 0,
            vat_withholding_rate: 0,
          },
          relationships: {
            contact: { data: { id: contactRef, type: 'contacts' } },
            details: { data: [{
              type: 'sales_invoice_details',
              attributes: {
                quantity: 1,
                unit_price: netAmount,
                vat_rate: config.vatRate,
                description: config.serviceName,
              },
              relationships: { product: { data: { id: config.productId, type: 'products' } } },
            }] },
          },
        } }),
      })
      const id = firstDataId(created.payload)
      if (!id) throw providerError('PARASUT_INVOICE_RESPONSE', true)
      return id
    },

    async formalize(job, invoiceRef, type) {
      const endpoint = type === 'e_fatura' ? '/e_invoices' : '/e_archives'
      const attributes = type === 'e_arsiv' ? {
        internet_sale: {
          url: config.internetSaleUrl,
          payment_type: 'ODEMEARACISI',
          payment_platform: 'iyzico',
          payment_date: job.profile.paidAt.slice(0, 10),
        },
      } : undefined
      const relationshipName = type === 'e_fatura' ? 'invoice' : 'sales_invoice'
      const result = await request(endpoint, {
        method: 'POST',
        body: JSON.stringify({ data: {
          type: type === 'e_fatura' ? 'e_invoices' : 'e_archives',
          ...(attributes ? { attributes } : {}),
          relationships: {
            [relationshipName]: { data: { id: invoiceRef, type: 'sales_invoices' } },
          },
        } }),
      })
      const taskRef = firstDataId(result.payload)
      if (!taskRef) throw providerError('PARASUT_FORMALIZE_RESPONSE', true)
      return taskRef
    },

    async readTask(taskRef) {
      const status = jobStatus((await request(`/trackable_jobs/${encodeURIComponent(taskRef)}`)).payload)
      if (status === 'done') return 'succeeded'
      if (status === 'pending' || status === 'running') return 'pending'
      if (status === 'error') throw providerError('PARASUT_FORMALIZE_FAILED', false)
      throw providerError('PARASUT_FORMALIZE_RESPONSE', true)
    },

    async resolveFormalizedDocument(invoiceRef, expectedType) {
      const result = await request(`/sales_invoices/${encodeURIComponent(invoiceRef)}?include=active_e_document`)
      const document = activeDocument(result.payload)
      if (document && document.type !== expectedType) throw providerError('PARASUT_DOCUMENT_TYPE_MISMATCH', false)
      return document
    },

    async downloadPdf(document) {
      const endpoint = document.type === 'e_fatura' ? 'e_invoices' : 'e_archives'
      const metadata = await request(`/${endpoint}/${encodeURIComponent(document.ref)}/pdf`)
      if (metadata.status === 204) throw providerError('PARASUT_PDF_PENDING', true)
      const url = pdfUrl(metadata.payload)
      if (!url) throw providerError('PARASUT_PDF_RESPONSE', true)
      let response: Response
      try {
        response = await fetcher(url, {
          headers: { accept: 'application/pdf' },
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        })
      } catch {
        throw providerError('PARASUT_PDF_NETWORK', true)
      }
      if (!response.ok) throw providerError('PARASUT_PDF_DOWNLOAD', response.status === 429 || response.status >= 500)
      if (response.url) secureUrl(response.url, 'PARASUT_PDF_REDIRECT')
      const contentLength = Number(response.headers.get('content-length') || '0')
      if (contentLength > MAX_PDF_BYTES) throw providerError('PARASUT_PDF_TOO_LARGE', false)
      const result = new Uint8Array(await response.arrayBuffer())
      if (result.byteLength === 0 || result.byteLength > MAX_PDF_BYTES
        || new TextDecoder().decode(result.slice(0, 5)) !== '%PDF-') {
        throw providerError('PARASUT_PDF_RESPONSE', false)
      }
      return result
    },
  }
}

async function safeRelease(store: ParasutRefreshTokenStore, lease: ParasutRefreshTokenLease): Promise<void> {
  try {
    await store.release(lease)
  } catch {
    // Preserve the provider failure; the short database lease expires by itself.
  }
}
