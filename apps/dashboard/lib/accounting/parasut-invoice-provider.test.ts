import assert from 'node:assert/strict'
import test from 'node:test'
import type { AccountingInvoiceJob } from '@garsonless/db/server'
import { createParasutInvoiceProvider, readParasutConfig } from './parasut-invoice-provider'
import type { ParasutRefreshTokenStore } from './invoice-provider'

const config = {
  apiBaseUrl: 'https://api.parasut.test',
  clientId: 'client',
  clientSecret: 'secret',
  refreshToken: 'refresh-token-at-least-twenty-characters',
  companyId: '123',
  productId: 'product-1',
  internetSaleUrl: 'https://sandbox.masabu.co/',
  vatRate: 20,
  serviceName: 'Masabu SaaS aboneliği',
}
const job: AccountingInvoiceJob = {
  id: '1',
  restaurantId: '2',
  subscriptionInvoiceId: '3',
  amountMinor: 119900,
  currency: 'TRY',
  attempts: 1,
  providerContactRef: null,
  providerInvoiceRef: null,
  providerTaskRef: null,
  providerDocumentRef: null,
  fiscalDocumentType: null,
  profile: {
    legalName: 'Test İşletmesi',
    name: 'Test',
    surname: 'Sahibi',
    identityNumber: '11111111111',
    taxOffice: 'Kartal',
    email: 'test@example.com',
    billingAddress: { city: 'İstanbul', district: 'Maltepe', address: 'Test adresi' },
    periodStart: '2026-08-15T00:00:00.000Z',
    periodEnd: '2026-09-15T00:00:00.000Z',
    paidAt: '2026-08-16T12:30:00.000Z',
    plan: 'pro',
    addOns: ['iyzico_online_payments'],
    billingInterval: 'monthly',
  },
}

function response(value: unknown, status = 200): Response {
  return new Response(status === 204 ? null : JSON.stringify(value), {
    status,
    headers: status === 204 ? undefined : { 'content-type': 'application/vnd.api+json' },
  })
}

function tokenResponse(): Response {
  return response({
    access_token: 'access-token',
    refresh_token: 'rotated-refresh-token-at-least-twenty-characters',
    expires_in: 7200,
  })
}

test('Paraşüt config requires fiscal product, internet sale URL, VAT and service description', () => {
  assert.throws(() => readParasutConfig({}), /PARASUT_CONFIG_INVOICE_VAT_RATE/)
  assert.equal(readParasutConfig({
    PARASUT_CLIENT_ID: 'a',
    PARASUT_CLIENT_SECRET: 'b',
    PARASUT_REFRESH_TOKEN: 'refresh-token-at-least-twenty-characters',
    PARASUT_COMPANY_ID: 'd',
    PARASUT_PRODUCT_ID: 'product-1',
    PARASUT_INTERNET_SALE_URL: 'https://masabu.co',
    INVOICE_VAT_RATE: '20',
    INVOICE_SERVICE_NAME: 'Masabu aboneliği',
  }).productId, 'product-1')
  assert.equal(readParasutConfig({
    PARASUT_CLIENT_ID: 'a',
    PARASUT_CLIENT_SECRET: 'b',
    PARASUT_COMPANY_ID: 'd',
    PARASUT_PRODUCT_ID: 'product-1',
    PARASUT_INTERNET_SALE_URL: 'https://masabu.co',
    INVOICE_VAT_RATE: '20',
    INVOICE_SERVICE_NAME: 'Masabu aboneliği',
  }).refreshToken, null)
  assert.throws(() => readParasutConfig({
    PARASUT_CLIENT_ID: 'a',
    PARASUT_CLIENT_SECRET: 'b',
    PARASUT_REFRESH_TOKEN: 'refresh-token-at-least-twenty-characters',
    PARASUT_COMPANY_ID: 'd',
    PARASUT_PRODUCT_ID: 'product-1',
    PARASUT_INTERNET_SALE_URL: 'http://masabu.co',
    INVOICE_VAT_RATE: '20',
    INVOICE_SERVICE_NAME: 'Masabu aboneliği',
  }), /PARASUT_CONFIG_INTERNET_SALE_URL/)
})

test('provider verifies the configured Paraşüt product without a write', async () => {
  const fetcher = async (input: string | URL | Request) => {
    const url = input.toString()
    if (url.endsWith('/oauth/token')) return tokenResponse()
    if (url.endsWith('/products/product-1')) return response({ data: { id: 'product-1' } })
    throw new Error(`unexpected ${url}`)
  }
  const provider = createParasutInvoiceProvider(config, fetcher as typeof fetch)
  assert.deepEqual(await provider.verifyAccess(), { productRef: 'product-1' })
})

test('provider rotates OAuth token and creates product-bound gross-consistent invoice detail', async () => {
  const requests: Array<{ url: string; body: string }> = []
  const rotations: string[] = []
  const tokenStore: ParasutRefreshTokenStore = {
    async claim() {
      return { refreshToken: config.refreshToken, version: 4 }
    },
    async rotate(_lease, nextRefreshToken) {
      rotations.push(nextRefreshToken)
    },
    async release() {},
  }
  const fetcher = async (input: string | URL | Request, init?: RequestInit) => {
    const url = input.toString()
    requests.push({ url, body: String(init?.body ?? '') })
    if (url.endsWith('/oauth/token')) return tokenResponse()
    if (url.includes('/contacts?')) return response({ data: [{ id: 'contact-1' }] })
    if (url.includes('/e_invoice_inboxes?')) return response({ data: [{ id: 'inbox-1' }] })
    if (url.endsWith('/sales_invoices')) return response({ data: { id: 'invoice-1' } }, 201)
    throw new Error(`unexpected ${url}`)
  }
  const provider = createParasutInvoiceProvider(config, fetcher as typeof fetch, tokenStore)
  const contact = await provider.ensureContact(job)
  assert.equal(await provider.resolveDocumentType(job), 'e_fatura')
  assert.equal(await provider.createSalesInvoice(job, contact), 'invoice-1')
  assert.deepEqual(rotations, ['rotated-refresh-token-at-least-twenty-characters'])
  const invoiceBody = JSON.parse(requests.find((entry) => entry.url.endsWith('/sales_invoices'))!.body)
  assert.equal(invoiceBody.data.attributes.issue_date, '2026-08-16')
  assert.equal(invoiceBody.data.relationships.details.data[0].attributes.unit_price, 999.17)
  assert.equal(invoiceBody.data.relationships.details.data[0].relationships.product.data.id, 'product-1')
  assert.match(invoiceBody.data.attributes.description, /iyzico_online_payments.*· 3$/)
})

test('e-Archive formalization uses sales_invoice and mandatory internet-sale payment data', async () => {
  const requests: Array<{ url: string; body: string }> = []
  const fetcher = async (input: string | URL | Request, init?: RequestInit) => {
    const url = input.toString()
    requests.push({ url, body: String(init?.body ?? '') })
    if (url.endsWith('/oauth/token')) return tokenResponse()
    if (url.endsWith('/e_archives')) return response({ data: { id: 'task-1' } }, 201)
    throw new Error(`unexpected ${url}`)
  }
  const provider = createParasutInvoiceProvider(config, fetcher as typeof fetch)
  assert.equal(await provider.formalize(job, 'invoice-1', 'e_arsiv'), 'task-1')
  const body = JSON.parse(requests.find((entry) => entry.url.endsWith('/e_archives'))!.body)
  assert.equal(body.data.relationships.sales_invoice.data.id, 'invoice-1')
  assert.equal(body.data.relationships.invoice, undefined)
  assert.deepEqual(body.data.attributes.internet_sale, {
    url: 'https://sandbox.masabu.co/',
    payment_type: 'ODEMEARACISI',
    payment_platform: 'iyzico',
    payment_date: '2026-08-16',
  })
})

test('provider resolves the active fiscal document and downloads the expiring PDF URL itself', async () => {
  const pdf = new TextEncoder().encode('%PDF-test')
  const fetcher = async (input: string | URL | Request) => {
    const url = input.toString()
    if (url.endsWith('/oauth/token')) return tokenResponse()
    if (url.includes('/sales_invoices/invoice-1?include=active_e_document')) return response({
      data: { relationships: { active_e_document: { data: { id: 'document-1', type: 'e_invoices' } } } },
    })
    if (url.endsWith('/e_invoices/document-1/pdf')) return response({
      data: { attributes: { url: 'https://files.parasut.test/document-1.pdf' } },
    })
    if (url === 'https://files.parasut.test/document-1.pdf') return new Response(pdf, {
      status: 200,
      headers: { 'content-type': 'application/pdf', 'content-length': String(pdf.byteLength) },
    })
    throw new Error(`unexpected ${url}`)
  }
  const provider = createParasutInvoiceProvider(config, fetcher as typeof fetch)
  const document = await provider.resolveFormalizedDocument('invoice-1', 'e_fatura')
  assert.deepEqual(document, { ref: 'document-1', type: 'e_fatura' })
  assert.deepEqual(await provider.downloadPdf(document!), pdf)
})

test('provider treats a 204 PDF response as retryable generation delay', async () => {
  const fetcher = async (input: string | URL | Request) => {
    const url = input.toString()
    if (url.endsWith('/oauth/token')) return tokenResponse()
    if (url.endsWith('/e_archives/document-1/pdf')) return response(null, 204)
    throw new Error(`unexpected ${url}`)
  }
  const provider = createParasutInvoiceProvider(config, fetcher as typeof fetch)
  await assert.rejects(
    provider.downloadPdf({ ref: 'document-1', type: 'e_arsiv' }),
    (error: unknown) => error instanceof Error
      && error.message === 'PARASUT_PDF_PENDING'
      && (error as Error & { retryable?: boolean }).retryable === true,
  )
})
