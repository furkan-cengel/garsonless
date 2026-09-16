import assert from 'node:assert/strict'
import test from 'node:test'
import type { AccountingInvoiceJob } from '@garsonless/db/server'
import { createNilveraInvoiceProvider, readNilveraConfig, type NilveraConfig } from './nilvera-invoice-provider'

const invoiceUuid = '11111111-1111-4111-8111-111111111111'
const config: NilveraConfig = {
  apiBaseUrl: 'https://apitest.nilvera.com',
  apiKey: 'test-api-key-at-least-twenty-characters',
  sellerTaxNumber: '1234567801',
  eInvoiceSeries: 'FAV',
  eArchiveSeries: 'EAT',
  internetSaleUrl: 'https://masabu.co/',
  vatRate: 20,
  serviceName: 'masabu abonelik hizmeti',
}
const job: AccountingInvoiceJob = {
  id: invoiceUuid,
  restaurantId: '22222222-2222-4222-8222-222222222222',
  subscriptionInvoiceId: '33333333-3333-4333-8333-333333333333',
  amountMinor: 119900,
  currency: 'TRY',
  attempts: 1,
  providerName: 'nilvera',
  providerContactRef: null,
  providerInvoiceRef: null,
  providerTaskRef: null,
  providerDocumentRef: null,
  fiscalDocumentType: null,
  profile: {
    legalName: 'Test Kurum 2',
    name: 'Test',
    surname: 'Kurum',
    identityNumber: '1234567802',
    taxOffice: 'Kartal',
    email: 'test@example.com',
    billingAddress: {
      address: 'Test Caddesi No: 2', city: 'İstanbul', district: 'Maltepe', postalCode: '34840',
    },
    periodStart: '2026-08-15T00:00:00.000Z',
    periodEnd: '2026-09-15T00:00:00.000Z',
    paidAt: '2026-08-16T12:30:00.000Z',
    plan: 'pro',
    addOns: ['iyzico_online_payments'],
    billingInterval: 'monthly',
  },
}

const company = {
  Name: 'Test Kurum 1',
  TaxNumber: '1234567801',
  TaxOffice: 'Kartal',
  Address: 'Test Caddesi No: 1',
  District: 'Maltepe',
  City: 'İstanbul',
  Country: 'Türkiye',
  PostalCode: '34840',
  PhoneNumber: '08500000000',
  Email: 'test01@nilvera.com',
  WebSite: 'https://masabu.co',
}

function jsonResponse(value: unknown, status = 200): Response {
  return new Response(status === 204 ? null : JSON.stringify(value), {
    status,
    headers: status === 204 ? undefined : { 'content-type': 'application/json' },
  })
}

test('Nilvera config restricts credentials to official HTTPS hosts and validates fiscal settings', () => {
  const env = {
    NILVERA_API_BASE_URL: 'https://apitest.nilvera.com',
    NILVERA_API_KEY: config.apiKey,
    NILVERA_SELLER_TAX_NUMBER: config.sellerTaxNumber,
    NILVERA_EINVOICE_SERIES: config.eInvoiceSeries,
    NILVERA_EARCHIVE_SERIES: config.eArchiveSeries,
    NILVERA_INTERNET_SALE_URL: config.internetSaleUrl,
    INVOICE_VAT_RATE: '20',
    INVOICE_SERVICE_NAME: config.serviceName,
  }
  assert.equal(readNilveraConfig(env).eInvoiceSeries, 'FAV')
  assert.throws(() => readNilveraConfig({ ...env, NILVERA_API_BASE_URL: 'https://example.com' }), /NILVERA_CONFIG_API_URL/)
  assert.throws(() => readNilveraConfig({ ...env, NILVERA_EARCHIVE_SERIES: 'TOO-LONG' }), /NILVERA_CONFIG_NILVERA_EARCHIVE_SERIES/)
  assert.throws(() => readNilveraConfig({ ...env, INVOICE_VAT_RATE: '7' }), /NILVERA_CONFIG_INVOICE_VAT_RATE/)
})

test('provider verifies the key company and configured active series without a write', async () => {
  const methods: string[] = []
  const fetcher = async (input: string | URL | Request, init?: RequestInit) => {
    const url = input.toString()
    methods.push(init?.method ?? 'GET')
    if (url.endsWith('/general/Company')) return jsonResponse(company)
    if (url.includes('/einvoice/Series?')) return jsonResponse({ Content: [{ Name: 'FAV', IsActive: true }] })
    if (url.includes('/earchive/Series?')) return jsonResponse({ Content: [{ Name: 'EAT', IsActive: true }] })
    throw new Error(`unexpected ${url}`)
  }
  const provider = createNilveraInvoiceProvider(config, fetcher as typeof fetch)
  assert.deepEqual(await provider.verifyAccess(), {
    sellerTaxNumber: '1234567801', eInvoiceSeries: 'FAV', eArchiveSeries: 'EAT',
  })
  assert.deepEqual(methods, ['GET', 'GET', 'GET'])
})

test('provider routes a registered taxpayer to e-Invoice and sends a gross-consistent idempotent model', async () => {
  const requests: Array<{ url: string; init?: RequestInit }> = []
  const pdf = new TextEncoder().encode('%PDF-nilvera')
  const fetcher = async (input: string | URL | Request, init?: RequestInit) => {
    const url = input.toString()
    requests.push({ url, init })
    if (url.includes('/GlobalCompany/Check/TaxNumber/1234567802')) {
      return jsonResponse([{
        TaxNumber: '1234567802', DocumentType: 'Invoice', Type: 'OZEL', Name: 'urn:mail:defaultpk@nilvera.com',
      }])
    }
    if (url.endsWith('/general/Company')) return jsonResponse(company)
    if (url.endsWith('/einvoice/Send/Model')) return jsonResponse({ UUID: invoiceUuid, InvoiceNumber: 'FAV2026000000001' })
    if (url.endsWith(`/einvoice/Sale/${invoiceUuid}/Status`)) {
      return jsonResponse({ InvoiceStatus: { Code: 'succeed' } })
    }
    if (url.endsWith(`/einvoice/Sale/${invoiceUuid}/pdf`)) {
      return new Response(pdf, { status: 200, headers: { 'content-type': 'application/pdf' } })
    }
    throw new Error(`unexpected ${url}`)
  }
  const provider = createNilveraInvoiceProvider(config, fetcher as typeof fetch)
  const contact = await provider.ensureContact(job)
  const type = await provider.resolveDocumentType(job)
  assert.equal(type, 'e_fatura')
  assert.equal(await provider.createSalesInvoice(job, contact, type), invoiceUuid)
  assert.deepEqual(await provider.resolveFormalizedDocument(invoiceUuid, type), { ref: invoiceUuid, type })
  assert.deepEqual(await provider.downloadPdf({ ref: invoiceUuid, type }), pdf)

  const sent = requests.find((entry) => entry.url.endsWith('/einvoice/Send/Model'))
  assert.equal(new Headers(sent?.init?.headers).get('authorization'), `Bearer ${config.apiKey}`)
  const body = JSON.parse(String(sent?.init?.body))
  assert.equal(body.CustomerAlias, 'urn:mail:defaultpk@nilvera.com')
  assert.equal(body.EInvoice.InvoiceInfo.UUID, invoiceUuid)
  assert.equal(body.EInvoice.InvoiceInfo.InvoiceSerieOrNumber, 'FAV')
  assert.equal(body.EInvoice.InvoiceInfo.LineExtensionAmount, 999.17)
  assert.equal(body.EInvoice.InvoiceInfo.GeneralKDV20Total, 199.83)
  assert.equal(body.EInvoice.InvoiceInfo.PayableAmount, 1199)
  assert.equal(body.EInvoice.InvoiceLines[0].UnitType, 'C62')
})

test('provider routes a non-taxpayer to internet e-Archive with iyzico payment evidence', async () => {
  let sentBody: Record<string, unknown> | null = null
  const archiveJob = {
    ...job,
    profile: { ...job.profile, identityNumber: '11111111111', legalName: 'Test Müşteri' },
  }
  const fetcher = async (input: string | URL | Request, init?: RequestInit) => {
    const url = input.toString()
    if (url.includes('/GlobalCompany/Check/TaxNumber/11111111111')) return jsonResponse([])
    if (url.endsWith('/general/Company')) return jsonResponse(company)
    if (url.endsWith('/earchive/Send/Model')) {
      sentBody = JSON.parse(String(init?.body)) as Record<string, unknown>
      return jsonResponse({ UUID: invoiceUuid, InvoiceNumber: 'EAT2026000000001' })
    }
    throw new Error(`unexpected ${url}`)
  }
  const provider = createNilveraInvoiceProvider(config, fetcher as typeof fetch)
  const contact = await provider.ensureContact(archiveJob)
  const type = await provider.resolveDocumentType(archiveJob)
  assert.equal(type, 'e_arsiv')
  assert.equal(await provider.createSalesInvoice(archiveJob, contact, type), invoiceUuid)
  const archive = (sentBody as { ArchiveInvoice: { InvoiceInfo: Record<string, unknown> } } | null)?.ArchiveInvoice
  assert.equal(archive?.InvoiceInfo['InvoiceSerieOrNumber'], 'EAT')
  assert.equal(archive?.InvoiceInfo['SalesPlatform'], 'INTERNET')
  assert.equal(archive?.InvoiceInfo['SendType'], 'ELEKTRONIK')
  assert.deepEqual(archive?.InvoiceInfo['InternetInfo'], {
    WebSite: 'https://masabu.co/',
    PaymentMethod: 'ODEMEARACISI',
    PaymentAgentName: 'iyzico',
    PaymentDate: '2026-08-16T12:30:00.000Z',
  })
})

test('provider treats deterministic UUID conflicts as idempotent and polls encoded tasks', async () => {
  const fetcher = async (input: string | URL | Request) => {
    const url = input.toString()
    if (url.endsWith('/general/Company')) return jsonResponse(company)
    if (url.endsWith('/earchive/Send/Model')) return jsonResponse(null, 409)
    if (url.endsWith(`/earchive/Invoices/${invoiceUuid}/Status`)) return jsonResponse({ StatusCode: 'waiting' })
    throw new Error(`unexpected ${url}`)
  }
  const provider = createNilveraInvoiceProvider(config, fetcher as typeof fetch)
  assert.equal(await provider.createSalesInvoice(job, job.profile.identityNumber, 'e_arsiv'), invoiceUuid)
  const taskRef = await provider.formalize(job, invoiceUuid, 'e_arsiv')
  assert.equal(taskRef, `e_arsiv:${invoiceUuid}`)
  assert.equal(await provider.readTask(taskRef), 'pending')
})

test('provider validates an e-Invoice model through preview without sending it', async () => {
  const methods: string[] = []
  let previewBody: Record<string, unknown> | null = null
  const fetcher = async (input: string | URL | Request, init?: RequestInit) => {
    const url = input.toString()
    methods.push(`${init?.method ?? 'GET'} ${new URL(url).pathname}`)
    if (url.endsWith('/general/Company')) return jsonResponse(company)
    if (url.includes('/GlobalCompany/Check/TaxNumber/1234567802')) {
      return jsonResponse([
        { TaxNumber: '1234567802', DocumentType: 'Invoice', Type: 'OZEL', Name: 'urn:mail:another@provider.test' },
        { TaxNumber: '1234567802', DocumentType: 'Invoice', Type: 'OZEL', Name: 'urn:mail:defaultpk@nilvera.com' },
      ])
    }
    if (url.endsWith('/einvoice/Send/Model/Preview')) {
      previewBody = JSON.parse(String(init?.body)) as Record<string, unknown>
      return new Response('<html>preview</html>', { status: 200 })
    }
    throw new Error(`unexpected ${url}`)
  }
  const provider = createNilveraInvoiceProvider(config, fetcher as typeof fetch)
  assert.deepEqual(await provider.previewInvoice(job, 'e_fatura'), { type: 'e_fatura', responseBytes: 20 })
  assert.deepEqual(methods, [
    'GET /general/Company',
    'GET /general/GlobalCompany/Check/TaxNumber/1234567802',
    'POST /einvoice/Send/Model/Preview',
  ])
  assert.equal((previewBody as { CustomerAlias?: string } | null)?.CustomerAlias, 'urn:mail:defaultpk@nilvera.com')
})

test('provider decodes Nilvera PDF responses wrapped as a Base64 JSON string', async () => {
  const expected = new TextEncoder().encode('%PDF-nilvera-base64')
  const encoded = Buffer.from(expected).toString('base64')
  const fetcher = async () => jsonResponse(encoded)
  const provider = createNilveraInvoiceProvider(config, fetcher as typeof fetch)

  assert.deepEqual(await provider.downloadPdf({ ref: invoiceUuid, type: 'e_fatura' }), expected)
})

test('one-time add-on fiscal document uses snapshot VAT and omits InvoicePeriod', async () => {
  let sent: Record<string, unknown> = {}
  const { periodStart: _start, periodEnd: _end, plan: _plan, addOns: _addons, billingInterval: _interval, ...profile } = job.profile as Extract<AccountingInvoiceJob['profile'], { plan: string }>
  const oneTime: AccountingInvoiceJob = { ...job, subscriptionInvoiceId:null, addOnPurchaseId:'44444444-4444-4444-8444-444444444444', amountMinor:42900,
    profile:{...profile,kind:'add_on',addOn:'storefront_video_hero',netAmountMinor:39000,vatRate:10} }
  const fetcher = async (input:string|URL|Request,init?:RequestInit) => {
    if(input.toString().endsWith('/general/Company')) return jsonResponse(company)
    if(input.toString().endsWith('/earchive/Send/Model')) {sent=JSON.parse(String(init?.body));return jsonResponse({UUID:invoiceUuid})}
    throw new Error('Unexpected fiscal request')
  }
  const provider=createNilveraInvoiceProvider(config,fetcher as typeof fetch)
  await provider.createSalesInvoice(oneTime,oneTime.profile.identityNumber,'e_arsiv')
  const invoice=sent.ArchiveInvoice as {InvoiceInfo:Record<string,unknown>;InvoiceLines:Array<Record<string,unknown>>}
  assert.equal(invoice.InvoiceInfo.InvoicePeriod,undefined)
  assert.equal(invoice.InvoiceInfo.PayableAmount,429)
  assert.equal(invoice.InvoiceLines[0]?.KDVPercent,10)
  assert.match(String(invoice.InvoiceLines[0]?.Description),/Video Hero · Tek seferlik/)
})
