import { addOnLabel } from '@garsonless/domain/add-on-purchases'
import type { AccountingInvoiceJob } from '@garsonless/db/server'
import {
  providerError,
  type FiscalDocumentType,
  type FormalizedDocument,
  type InvoiceProvider,
} from './invoice-provider'

type Fetch = typeof fetch
type Json = Record<string, unknown>
type PartyInfo = {
  TaxNumber: string
  Name: string
  TaxOffice?: string
  Address: string
  District: string
  City: string
  Country: string
  PostalCode?: string
  Phone?: string
  Mail?: string
  WebSite?: string
}

const REQUEST_TIMEOUT_MS = 15_000
const MAX_PDF_BYTES = 10 * 1024 * 1024
const MAX_ENCODED_PDF_BYTES = Math.ceil(MAX_PDF_BYTES * 4 / 3) + 4
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const ALLOWED_API_HOSTS = new Set(['api.nilvera.com', 'apitest.nilvera.com'])
const ALLOWED_VAT_RATES = new Set([1, 8, 10, 18, 20])
const NILVERA_SANDBOX_RECEIVER_ALIAS = 'urn:mail:defaultpk@nilvera.com'

export type NilveraConfig = {
  apiBaseUrl: string
  apiKey: string
  sellerTaxNumber: string
  eInvoiceSeries: string
  eArchiveSeries: string
  internetSaleUrl: string
  vatRate: number
  serviceName: string
}

export type NilveraInvoiceProvider = InvoiceProvider & {
  verifyAccess(): Promise<{ sellerTaxNumber: string; eInvoiceSeries: string; eArchiveSeries: string }>
  previewInvoice(job: AccountingInvoiceJob, type: FiscalDocumentType): Promise<{ type: FiscalDocumentType; responseBytes: number }>
}

function secureUrl(value: string, code: string, allowedHosts?: ReadonlySet<string>): URL {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw providerError(code, false)
  }
  if (url.protocol !== 'https:' || url.username || url.password
    || (allowedHosts && !allowedHosts.has(url.hostname))) throw providerError(code, false)
  return url
}

export function readNilveraConfig(env: Readonly<Record<string, string | undefined>> = process.env): NilveraConfig {
  const required = (name: string) => {
    const value = env[name]?.trim()
    if (!value) throw providerError(`NILVERA_CONFIG_${name}`, false)
    return value
  }
  const apiBaseUrl = secureUrl(
    env['NILVERA_API_BASE_URL']?.trim() || 'https://api.nilvera.com',
    'NILVERA_CONFIG_API_URL',
    ALLOWED_API_HOSTS,
  )
  const internetSaleUrl = secureUrl(
    required('NILVERA_INTERNET_SALE_URL'),
    'NILVERA_CONFIG_INTERNET_SALE_URL',
  )
  const apiKey = required('NILVERA_API_KEY')
  if (apiKey.length < 20 || apiKey.length > 4000) throw providerError('NILVERA_CONFIG_API_KEY', false)
  const sellerTaxNumber = required('NILVERA_SELLER_TAX_NUMBER')
  if (!/^\d{10,11}$/.test(sellerTaxNumber)) throw providerError('NILVERA_CONFIG_SELLER_TAX_NUMBER', false)
  const readSeries = (name: string) => {
    const value = required(name).toUpperCase()
    if (!/^[A-Z0-9]{3}$/.test(value)) throw providerError(`NILVERA_CONFIG_${name}`, false)
    return value
  }
  const vatRate = Number(required('INVOICE_VAT_RATE'))
  if (!Number.isInteger(vatRate) || !ALLOWED_VAT_RATES.has(vatRate)) {
    throw providerError('NILVERA_CONFIG_INVOICE_VAT_RATE', false)
  }
  return {
    apiBaseUrl: apiBaseUrl.toString().replace(/\/$/, ''),
    apiKey,
    sellerTaxNumber,
    eInvoiceSeries: readSeries('NILVERA_EINVOICE_SERIES'),
    eArchiveSeries: readSeries('NILVERA_EARCHIVE_SERIES'),
    internetSaleUrl: internetSaleUrl.toString(),
    vatRate,
    serviceName: required('INVOICE_SERVICE_NAME'),
  }
}

function object(value: unknown): Json | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Json : null
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function requiredText(row: Json, name: string, code: string): string {
  const value = text(row[name])
  if (!value) throw providerError(code, false)
  return value
}

function address(job: AccountingInvoiceJob): { address: string; city: string; district: string; country: string; postalCode?: string } {
  const source = job.profile.billingAddress
  const street = text(source['address'])
  const city = text(source['city'])
  const district = text(source['district'])
  if (!street || !city || !district) throw providerError('NILVERA_PROFILE_ADDRESS', false)
  return {
    address: street,
    city,
    district,
    country: text(source['country']) || 'Türkiye',
    ...(text(source['postalCode']) ? { postalCode: text(source['postalCode'])! } : {}),
  }
}

function money(minor: number): number {
  return Number((minor / 100).toFixed(2))
}

function amountBreakdown(amountMinor: number, vatRate: number): { gross: number; net: number; vat: number } {
  const netMinor = Math.round((amountMinor * 100) / (100 + vatRate))
  return { gross: money(amountMinor), net: money(netMinor), vat: money(amountMinor - netMinor) }
}

function pdfBytes(responseBytes: Uint8Array): Uint8Array {
  if (new TextDecoder().decode(responseBytes.slice(0, 5)) === '%PDF-') return responseBytes
  if (responseBytes.byteLength > MAX_ENCODED_PDF_BYTES) throw providerError('NILVERA_PDF_TOO_LARGE', false)

  let encoded: unknown
  try {
    encoded = JSON.parse(new TextDecoder().decode(responseBytes)) as unknown
  } catch {
    throw providerError('NILVERA_PDF_RESPONSE', false)
  }
  if (typeof encoded !== 'string' || encoded.length === 0 || encoded.length % 4 !== 0
    || !/^[A-Za-z0-9+/]*={0,2}$/.test(encoded)) {
    throw providerError('NILVERA_PDF_RESPONSE', false)
  }
  return new Uint8Array(Buffer.from(encoded, 'base64'))
}

function taskIdentity(type: FiscalDocumentType, invoiceRef: string): string {
  if (!UUID_PATTERN.test(invoiceRef)) throw providerError('NILVERA_INVOICE_IDENTITY', false)
  return `${type}:${invoiceRef}`
}

function parseTaskIdentity(value: string): { type: FiscalDocumentType; invoiceRef: string } {
  const match = /^(e_fatura|e_arsiv):(.+)$/.exec(value)
  if (!match || !UUID_PATTERN.test(match[2]!)) throw providerError('NILVERA_TASK_IDENTITY', false)
  return { type: match[1] as FiscalDocumentType, invoiceRef: match[2]! }
}

export function createNilveraInvoiceProvider(
  config: NilveraConfig = readNilveraConfig(),
  fetcher: Fetch = fetch,
): NilveraInvoiceProvider {
  let companyPromise: Promise<PartyInfo> | null = null
  const aliasByTaxNumber = new Map<string, string | null>()

  async function request(path: string, init?: RequestInit, acceptedStatuses: readonly number[] = []): Promise<Response> {
    let response: Response
    try {
      response = await fetcher(`${config.apiBaseUrl}${path}`, {
        ...init,
        headers: {
          accept: init?.headers && new Headers(init.headers).get('accept') || 'application/json',
          authorization: `Bearer ${config.apiKey}`,
          ...(init?.body ? { 'content-type': 'application/json' } : {}),
          ...init?.headers,
        },
        signal: init?.signal ?? AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      })
    } catch {
      throw providerError('NILVERA_API_NETWORK', true)
    }
    if (!response.ok && !acceptedStatuses.includes(response.status)) {
      const retryable = [408, 425, 429].includes(response.status) || response.status >= 500
      throw providerError(retryable ? 'NILVERA_API_TEMPORARY' : `NILVERA_API_REJECTED_${response.status}`, retryable)
    }
    return response
  }

  async function json(path: string, init?: RequestInit, acceptedStatuses: readonly number[] = []): Promise<{ status: number; payload: unknown }> {
    const response = await request(path, init, acceptedStatuses)
    if (response.status === 204 || response.status === 404 || response.status === 409) {
      return { status: response.status, payload: null }
    }
    try {
      return { status: response.status, payload: JSON.parse(await response.text()) as unknown }
    } catch {
      throw providerError('NILVERA_API_RESPONSE', true)
    }
  }

  async function company(): Promise<PartyInfo> {
    companyPromise ??= (async () => {
      const row = object((await json('/general/Company')).payload)
      if (!row) throw providerError('NILVERA_COMPANY_RESPONSE', false)
      const taxNumber = requiredText(row, 'TaxNumber', 'NILVERA_COMPANY_TAX_NUMBER')
      if (taxNumber !== config.sellerTaxNumber) throw providerError('NILVERA_COMPANY_MISMATCH', false)
      return {
        TaxNumber: taxNumber,
        Name: requiredText(row, 'Name', 'NILVERA_COMPANY_NAME'),
        ...(text(row['TaxOffice']) ? { TaxOffice: text(row['TaxOffice'])! } : {}),
        Address: requiredText(row, 'Address', 'NILVERA_COMPANY_ADDRESS'),
        District: requiredText(row, 'District', 'NILVERA_COMPANY_DISTRICT'),
        City: requiredText(row, 'City', 'NILVERA_COMPANY_CITY'),
        Country: requiredText(row, 'Country', 'NILVERA_COMPANY_COUNTRY'),
        ...(text(row['PostalCode']) ? { PostalCode: text(row['PostalCode'])! } : {}),
        ...(text(row['PhoneNumber']) ? { Phone: text(row['PhoneNumber'])! } : {}),
        ...(text(row['Email']) ? { Mail: text(row['Email'])! } : {}),
        ...(text(row['WebSite']) ? { WebSite: text(row['WebSite'])! } : {}),
      }
    })()
    return companyPromise
  }

  async function invoiceAlias(taxNumber: string): Promise<string | null> {
    if (aliasByTaxNumber.has(taxNumber)) return aliasByTaxNumber.get(taxNumber) ?? null
    const payload = (await json(
      `/general/GlobalCompany/Check/TaxNumber/${encodeURIComponent(taxNumber)}?globalUserType=Invoice`,
    )).payload
    if (!Array.isArray(payload)) throw providerError('NILVERA_TAXPAYER_RESPONSE', true)
    const aliases = payload.flatMap((entry) => {
      const row = object(entry)
      const entryTaxNumber = text(row?.['TaxNumber'])
      const documentType = text(row?.['DocumentType'])?.toLowerCase()
      const name = text(row?.['Name'])
      const belongsToCustomer = !entryTaxNumber || entryTaxNumber === taxNumber
      const isInvoiceAlias = !documentType || documentType === 'invoice'
      return belongsToCustomer && isInvoiceAlias && name?.startsWith('urn:mail:') ? [name] : []
    })
    const alias = aliases.find((candidate) => candidate.toLowerCase() === NILVERA_SANDBOX_RECEIVER_ALIAS)
      ?? aliases[0]
      ?? null
    aliasByTaxNumber.set(taxNumber, alias)
    return alias
  }

  async function configuredSeries(path: string, expected: string): Promise<string> {
    const payload = (await json(
      `${path}?Search=${encodeURIComponent(expected)}&PageSize=20&Page=1&IsActive=true`,
    )).payload
    const content = object(payload)?.['Content']
    if (!Array.isArray(content)) throw providerError('NILVERA_SERIES_RESPONSE', true)
    const found = content.some((entry) => {
      const row = object(entry)
      return text(row?.['Name'])?.toUpperCase() === expected && row?.['IsActive'] === true
    })
    if (!found) throw providerError('NILVERA_SERIES_NOT_FOUND', false)
    return expected
  }

  function customer(job: AccountingInvoiceJob): PartyInfo {
    const location = address(job)
    return {
      TaxNumber: job.profile.identityNumber,
      Name: job.profile.legalName,
      TaxOffice: job.profile.taxOffice,
      Address: location.address,
      District: location.district,
      City: location.city,
      Country: location.country,
      ...(location.postalCode ? { PostalCode: location.postalCode } : {}),
      Mail: job.profile.email,
    }
  }

  function invoiceModel(job: AccountingInvoiceJob, type: FiscalDocumentType, companyInfo: PartyInfo): Json {
    if (!UUID_PATTERN.test(job.id)) throw providerError('NILVERA_JOB_IDENTITY', false)
    const vatRate = job.profile.kind === 'add_on' ? job.profile.vatRate : config.vatRate
    const reference = job.addOnPurchaseId ?? job.subscriptionInvoiceId
    const amounts = job.profile.kind === 'add_on'
      ? { net: job.profile.netAmountMinor / 100, vat: (job.amountMinor - job.profile.netAmountMinor) / 100, gross: job.amountMinor / 100 }
      : amountBreakdown(job.amountMinor, vatRate)
    const vatTotals = {
      GeneralKDV1Total: 0,
      GeneralKDV8Total: 0,
      GeneralKDV10Total: 0,
      GeneralKDV18Total: 0,
      GeneralKDV20Total: 0,
    }
    vatTotals[`GeneralKDV${vatRate}Total` as keyof typeof vatTotals] = amounts.vat
    const addOns = job.profile.kind !== 'add_on' && job.profile.addOns.length ? ` + ${job.profile.addOns.join(', ')}` : ''
    const description = job.profile.kind === 'add_on' ? `${addOnLabel(job.profile.addOn)} · Tek seferlik · ${reference}` : `${config.serviceName} · ${job.profile.plan}${addOns} · ${job.profile.billingInterval} · ${job.subscriptionInvoiceId}`
    const invoiceInfo: Json = {
      UUID: job.id,
      InvoiceType: 'SATIS',
      InvoiceSerieOrNumber: type === 'e_fatura' ? config.eInvoiceSeries : config.eArchiveSeries,
      IssueDate: new Date(job.profile.paidAt).toISOString(),
      CurrencyCode: 'TRY',
      ExchangeRate: 1,
      OrderReference: { IssueDate: new Date(job.profile.paidAt).toISOString(), Value: reference },
      ...(job.profile.kind === 'add_on' ? {} : { InvoicePeriod: {
        StartDate: new Date(job.profile.periodStart).toISOString(),
        EndDate: new Date(job.profile.periodEnd).toISOString(),
        Description: `${job.profile.billingInterval} subscription period`,
      } }),
      ...vatTotals,
      GeneralAllowanceTotal: 0,
      LineExtensionAmount: amounts.net,
      KdvTotal: amounts.vat,
      PayableAmount: amounts.gross,
      ...(type === 'e_fatura' ? { InvoiceProfile: 'TEMELFATURA' } : {
        ISDespatch: false,
        SalesPlatform: 'INTERNET',
        SendType: 'ELEKTRONIK',
        InternetInfo: {
          WebSite: config.internetSaleUrl,
          PaymentMethod: 'ODEMEARACISI',
          PaymentAgentName: 'iyzico',
          PaymentDate: new Date(job.profile.paidAt).toISOString(),
        },
      }),
    }
    const invoice = {
      InvoiceInfo: invoiceInfo,
      CompanyInfo: companyInfo,
      CustomerInfo: customer(job),
      InvoiceLines: [{
        Index: '1',
        Name: job.profile.kind === 'add_on' ? addOnLabel(job.profile.addOn) : config.serviceName,
        Description: description,
        Quantity: 1,
        UnitType: 'C62',
        Price: amounts.net,
        AllowanceTotal: 0,
        KDVPercent: vatRate,
        KDVTotal: amounts.vat,
      }],
      Notes: [description],
    }
    return type === 'e_fatura' ? { EInvoice: invoice } : { ArchiveInvoice: invoice }
  }

  async function modelCommand(job: AccountingInvoiceJob, type: FiscalDocumentType): Promise<Json> {
    const body = invoiceModel(job, type, await company())
    if (type === 'e_fatura') {
      const alias = await invoiceAlias(job.profile.identityNumber)
      if (!alias) throw providerError('NILVERA_CUSTOMER_ALIAS_MISSING', false)
      body['CustomerAlias'] = alias
    }
    return body
  }

  async function documentStatus(type: FiscalDocumentType, invoiceRef: string): Promise<'pending' | 'succeeded'> {
    const endpoint = type === 'e_fatura' ? 'einvoice/Sale' : 'earchive/Invoices'
    const result = await json(`/${endpoint}/${encodeURIComponent(invoiceRef)}/Status`, undefined, [404])
    if (result.status === 404) return 'pending'
    const row = object(result.payload)
    const code = type === 'e_fatura'
      ? text(object(row?.['InvoiceStatus'])?.['Code'])
      : text(row?.['StatusCode'])
    if (code === 'succeed') return 'succeeded'
    if (code === 'waiting' || code === 'unknown') return 'pending'
    if (code === 'error') throw providerError('NILVERA_DOCUMENT_FAILED', false)
    throw providerError('NILVERA_STATUS_RESPONSE', true)
  }

  return {
    async verifyAccess() {
      const companyInfo = await company()
      const [eInvoiceSeries, eArchiveSeries] = await Promise.all([
        configuredSeries('/einvoice/Series', config.eInvoiceSeries),
        configuredSeries('/earchive/Series', config.eArchiveSeries),
      ])
      return { sellerTaxNumber: companyInfo.TaxNumber, eInvoiceSeries, eArchiveSeries }
    },

    async previewInvoice(job, type) {
      const endpoint = type === 'e_fatura' ? '/einvoice/Send/Model/Preview' : '/earchive/Send/Model/Preview'
      const response = await request(endpoint, {
        method: 'POST',
        body: JSON.stringify(await modelCommand(job, type)),
        headers: { accept: 'text/plain' },
      })
      const result = await response.text()
      if (!result.trim()) throw providerError('NILVERA_PREVIEW_RESPONSE', true)
      return { type, responseBytes: Buffer.byteLength(result) }
    },

    async ensureContact(job) {
      if (!/^\d{10,11}$/.test(job.profile.identityNumber)) throw providerError('NILVERA_PROFILE_TAX_NUMBER', false)
      address(job)
      if (job.providerContactRef && job.providerContactRef !== job.profile.identityNumber) {
        throw providerError('NILVERA_CONTACT_IDENTITY_MISMATCH', false)
      }
      return job.profile.identityNumber
    },

    async resolveDocumentType(job) {
      if (job.fiscalDocumentType) return job.fiscalDocumentType
      return await invoiceAlias(job.profile.identityNumber) ? 'e_fatura' : 'e_arsiv'
    },

    async createSalesInvoice(job, contactRef, type) {
      if (job.providerInvoiceRef) {
        if (!UUID_PATTERN.test(job.providerInvoiceRef)) throw providerError('NILVERA_INVOICE_IDENTITY_MISMATCH', false)
        return job.providerInvoiceRef
      }
      if (contactRef !== job.profile.identityNumber) throw providerError('NILVERA_CONTACT_IDENTITY_MISMATCH', false)
      const body = await modelCommand(job, type)
      const endpoint = type === 'e_fatura' ? '/einvoice/Send/Model' : '/earchive/Send/Model'
      const result = await json(endpoint, { method: 'POST', body: JSON.stringify(body) }, [409])
      if (result.status === 409) return job.id
      const ref = text(object(result.payload)?.['UUID'])
      if (!ref || !UUID_PATTERN.test(ref) || ref.toLowerCase() !== job.id.toLowerCase()) {
        throw providerError('NILVERA_INVOICE_RESPONSE', true)
      }
      return ref
    },

    async formalize(_job, invoiceRef, type) {
      // Nilvera Send/Model creates the fiscal document directly. The encoded
      // task identity lets the shared worker poll its asynchronous GIB status.
      return taskIdentity(type, invoiceRef)
    },

    async readTask(taskRef) {
      const task = parseTaskIdentity(taskRef)
      return documentStatus(task.type, task.invoiceRef)
    },

    async resolveFormalizedDocument(invoiceRef, expectedType) {
      if (!UUID_PATTERN.test(invoiceRef)) throw providerError('NILVERA_INVOICE_IDENTITY', false)
      return await documentStatus(expectedType, invoiceRef) === 'succeeded'
        ? { ref: invoiceRef, type: expectedType }
        : null
    },

    async downloadPdf(document: FormalizedDocument) {
      if (!UUID_PATTERN.test(document.ref)) throw providerError('NILVERA_DOCUMENT_IDENTITY', false)
      const endpoint = document.type === 'e_fatura' ? 'einvoice/Sale' : 'earchive/Invoices'
      const response = await request(`/${endpoint}/${encodeURIComponent(document.ref)}/pdf`, {
        headers: { accept: 'application/pdf' },
      })
      const contentLength = Number(response.headers.get('content-length') || '0')
      if (contentLength > MAX_ENCODED_PDF_BYTES) throw providerError('NILVERA_PDF_TOO_LARGE', false)
      if (response.url) {
        const pdfUrl = secureUrl(response.url, 'NILVERA_PDF_REDIRECT')
        if (pdfUrl.hostname !== 'nilvera.com' && !pdfUrl.hostname.endsWith('.nilvera.com')) {
          throw providerError('NILVERA_PDF_REDIRECT', false)
        }
      }
      const result = pdfBytes(new Uint8Array(await response.arrayBuffer()))
      if (result.byteLength === 0 || result.byteLength > MAX_PDF_BYTES
        || new TextDecoder().decode(result.slice(0, 5)) !== '%PDF-') {
        throw providerError('NILVERA_PDF_RESPONSE', false)
      }
      return result
    },
  }
}
