import assert from 'node:assert/strict'
import test from 'node:test'
import type { AccountingInvoiceJob } from '@garsonless/db/server'
import { createParasutInvoiceProvider, readParasutConfig } from './parasut-invoice-provider'

const config = {
  apiBaseUrl: 'https://api.parasut.test', clientId: 'client', clientSecret: 'secret',
  refreshToken: 'refresh', companyId: '123', vatRate: 20, serviceName: 'Masabu SaaS aboneliği',
}
const job: AccountingInvoiceJob = {
  id: '1', restaurantId: '2', subscriptionInvoiceId: '3', amountMinor: 119900,
  currency: 'TRY', attempts: 1, providerContactRef: null, providerInvoiceRef: null,
  providerTaskRef: null, fiscalDocumentType: null,
  profile: {
    legalName: 'Test İşletmesi', name: 'Test', surname: 'Sahibi', identityNumber: '11111111111',
    taxOffice: 'Kartal', email: 'test@example.com', billingAddress: { city: 'İstanbul', district: 'Maltepe', address: 'Test adresi' },
    periodStart: '2026-08-15T00:00:00.000Z', periodEnd: '2026-09-15T00:00:00.000Z', plan: 'pro', billingInterval: 'monthly',
  },
}

function response(value: unknown): Response {
  return new Response(JSON.stringify(value), { status: 200, headers: { 'content-type': 'application/json' } })
}

test('Paraşüt config requires accountant-approved VAT and service description', () => {
  assert.throws(() => readParasutConfig({}), /PARASUT_CONFIG_INVOICE_VAT_RATE/)
  assert.equal(readParasutConfig({
    PARASUT_CLIENT_ID: 'a', PARASUT_CLIENT_SECRET: 'b', PARASUT_REFRESH_TOKEN: 'c', PARASUT_COMPANY_ID: 'd',
    INVOICE_VAT_RATE: '20', INVOICE_SERVICE_NAME: 'Masabu aboneliği',
  }).vatRate, 20)
})

test('provider refreshes OAuth, detects e-Fatura and creates a gross-consistent invoice detail', async () => {
  const requests: Array<{ url: string; body: string }> = []
  const fetcher = async (input: string | URL | Request, init?: RequestInit) => {
    const url = input.toString(); requests.push({ url, body: String(init?.body ?? '') })
    if (url.endsWith('/oauth/token')) return response({ access_token: 'token', expires_in: 3600 })
    if (url.includes('/contacts?')) return response({ data: [{ id: 'contact-1' }] })
    if (url.includes('/e_invoice_inboxes?')) return response({ data: [{ id: 'inbox-1' }] })
    if (url.endsWith('/sales_invoices')) return response({ data: { id: 'invoice-1' } })
    throw new Error(`unexpected ${url}`)
  }
  const provider = createParasutInvoiceProvider(config, fetcher as typeof fetch)
  const contact = await provider.ensureContact(job)
  assert.equal(await provider.resolveDocumentType(job), 'e_fatura')
  assert.equal(await provider.createSalesInvoice(job, contact), 'invoice-1')
  const invoiceBody = JSON.parse(requests.find((entry) => entry.url.endsWith('/sales_invoices'))!.body)
  assert.equal(invoiceBody.data.relationships.details.data[0].attributes.unit_price, '999.17')
  assert.match(invoiceBody.data.attributes.description, /· 3$/)
})
