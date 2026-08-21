import type { AccountingInvoiceJob } from '@garsonless/db/server'
import {
  providerError,
  type InvoiceProvider,
} from './invoice-provider'

type Fetch = typeof fetch
type Json = Record<string, unknown>

export type ParasutConfig = {
  apiBaseUrl: string
  clientId: string
  clientSecret: string
  refreshToken: string
  companyId: string
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
  const apiBaseUrl = new URL(env['PARASUT_API_BASE_URL']?.trim() || 'https://api.parasut.com')
  if (apiBaseUrl.protocol !== 'https:' || apiBaseUrl.username || apiBaseUrl.password) {
    throw providerError('PARASUT_CONFIG_API_URL', false)
  }
  return {
    apiBaseUrl: apiBaseUrl.toString().replace(/\/$/, ''),
    clientId: required('PARASUT_CLIENT_ID'), clientSecret: required('PARASUT_CLIENT_SECRET'),
    refreshToken: required('PARASUT_REFRESH_TOKEN'), companyId: required('PARASUT_COMPANY_ID'),
    vatRate, serviceName: required('INVOICE_SERVICE_NAME'),
  }
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

function cityAndDistrict(job: AccountingInvoiceJob): { city: string; district: string; address: string } {
  const value = job.profile.billingAddress
  const city = typeof value.city === 'string' ? value.city.trim() : ''
  const district = typeof value.district === 'string' ? value.district.trim() : ''
  const address = typeof value.address === 'string' ? value.address.trim() : ''
  if (!city || !address) throw providerError('PARASUT_PROFILE_ADDRESS', false)
  return { city, district, address }
}

export function createParasutInvoiceProvider(
  config: ParasutConfig = readParasutConfig(),
  fetcher: Fetch = fetch,
): InvoiceProvider {
  let token: { value: string; expiresAt: number; refreshToken: string } | null = null

  async function accessToken(): Promise<string> {
    if (token && token.expiresAt > Date.now() + 30_000) return token.value
    const body = new URLSearchParams({
      grant_type: 'refresh_token', client_id: config.clientId,
      client_secret: config.clientSecret, refresh_token: token?.refreshToken || config.refreshToken,
    })
    const response = await fetcher(`${config.apiBaseUrl}/oauth/token`, {
      method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body,
    })
    if (!response.ok) throw providerError(response.status >= 500 ? 'PARASUT_TOKEN_TEMPORARY' : 'PARASUT_TOKEN_REJECTED', response.status >= 500)
    const payload = object(await response.json())
    const value = typeof payload?.access_token === 'string' ? payload.access_token : null
    const expiresIn = typeof payload?.expires_in === 'number' ? payload.expires_in : 3600
    const refreshToken = typeof payload?.refresh_token === 'string' ? payload.refresh_token : token?.refreshToken || config.refreshToken
    if (!value) throw providerError('PARASUT_TOKEN_RESPONSE', true)
    token = { value, expiresAt: Date.now() + Math.max(60, expiresIn) * 1000, refreshToken }
    return value
  }

  async function request(path: string, init?: RequestInit): Promise<unknown> {
    const response = await fetcher(`${config.apiBaseUrl}/v4/${encodeURIComponent(config.companyId)}${path}`, {
      ...init,
      headers: {
        accept: 'application/vnd.api+json', authorization: `Bearer ${await accessToken()}`,
        ...(init?.body ? { 'content-type': 'application/vnd.api+json' } : {}), ...init?.headers,
      },
    })
    if (!response.ok) {
      const retryable = response.status === 429 || response.status >= 500
      throw providerError(retryable ? 'PARASUT_API_TEMPORARY' : 'PARASUT_API_REJECTED', retryable)
    }
    if (response.status === 204) return {}
    const contentType = response.headers.get('content-type') || ''
    return contentType.includes('json') ? response.json() : new Uint8Array(await response.arrayBuffer())
  }

  return {
    async ensureContact(job) {
      if (job.providerContactRef) return job.providerContactRef
      const taxNumber = encodeURIComponent(job.profile.identityNumber)
      const found = firstDataId(await request(`/contacts?filter[tax_number]=${taxNumber}&page[size]=1`))
      if (found) return found
      const location = cityAndDistrict(job)
      const created = await request('/contacts', {
        method: 'POST', body: JSON.stringify({ data: { type: 'contacts', attributes: {
          name: job.profile.legalName, email: job.profile.email,
          tax_number: job.profile.identityNumber, tax_office: job.profile.taxOffice,
          address: location.address, city: location.city, district: location.district,
          account_type: 'customer',
        } } }),
      })
      const id = firstDataId(created)
      if (!id) throw providerError('PARASUT_CONTACT_RESPONSE', true)
      return id
    },

    async resolveDocumentType(job) {
      if (job.fiscalDocumentType) return job.fiscalDocumentType
      const result = await request(`/e_invoice_inboxes?filter[vkn]=${encodeURIComponent(job.profile.identityNumber)}&page[size]=1`)
      return firstDataId(result) ? 'e_fatura' : 'e_arsiv'
    },

    async createSalesInvoice(job, contactRef) {
      if (job.providerInvoiceRef) return job.providerInvoiceRef
      const issueDate = job.profile.periodStart.slice(0, 10)
      const dueDate = issueDate
      const netAmount = (job.amountMinor / (100 + config.vatRate)).toFixed(2)
      const description = `${config.serviceName} · ${job.profile.plan} · ${job.profile.billingInterval} · ${job.subscriptionInvoiceId}`
      const created = await request('/sales_invoices', {
        method: 'POST', body: JSON.stringify({ data: {
          type: 'sales_invoices', attributes: {
            item_type: 'invoice', description, issue_date: issueDate, due_date: dueDate,
            currency: 'TRL', exchange_rate: 1, withholding_rate: 0, vat_withholding_rate: 0,
          }, relationships: {
            contact: { data: { id: contactRef, type: 'contacts' } },
            details: { data: [{ type: 'sales_invoice_details', attributes: {
              quantity: 1, unit_price: netAmount, vat_rate: config.vatRate, description: config.serviceName,
            } }] },
          },
        } }),
      })
      const id = firstDataId(created)
      if (!id) throw providerError('PARASUT_INVOICE_RESPONSE', true)
      return id
    },

    async formalize(invoiceRef, type) {
      const endpoint = type === 'e_fatura' ? '/e_invoices' : '/e_archives'
      const result = await request(endpoint, {
        method: 'POST', body: JSON.stringify({ data: {
          type: type === 'e_fatura' ? 'e_invoices' : 'e_archives',
          relationships: { invoice: { data: { id: invoiceRef, type: 'sales_invoices' } } },
        } }),
      })
      const taskRef = firstDataId(result)
      if (!taskRef) throw providerError('PARASUT_FORMALIZE_RESPONSE', true)
      return taskRef
    },

    async readTask(taskRef) {
      const status = jobStatus(await request(`/trackable_jobs/${encodeURIComponent(taskRef)}`))
      if (['done', 'completed', 'succeeded'].includes(status || '')) return 'succeeded'
      if (['pending', 'running', 'enqueued', 'processing'].includes(status || '')) return 'pending'
      throw providerError('PARASUT_FORMALIZE_FAILED', false)
    },

    async downloadPdf(invoiceRef) {
      const result = await request(`/sales_invoices/${encodeURIComponent(invoiceRef)}.pdf`)
      if (!(result instanceof Uint8Array) || result.byteLength === 0) throw providerError('PARASUT_PDF_RESPONSE', true)
      return result
    },
  }
}
