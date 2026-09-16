import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import type { AccountingInvoiceJob } from '@garsonless/db/server'
import {
  createNilveraInvoiceProvider,
  readNilveraConfig,
} from '../lib/accounting/nilvera-invoice-provider'

const config = readNilveraConfig()
assert.equal(
  new URL(config.apiBaseUrl).hostname,
  'apitest.nilvera.com',
  'Sandbox only',
)
const { purchase } = JSON.parse(
  readFileSync('/private/tmp/masabu-addon-sandbox/session.json', 'utf8'),
)
const evidence = JSON.parse(
  readFileSync('/private/tmp/masabu-addon-sandbox/evidence.json', 'utf8'),
)
assert.equal(evidence.status, 'paid')
assert.equal(evidence.basketId, purchase.id)
const hash = createHash('sha256')
  .update(`one-time-invoice:${purchase.id}`)
  .digest('hex')
const id = `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-8${hash.slice(17, 20)}-${hash.slice(20, 32)}`
// Nilvera's registered sandbox recipient; no invoice email worker is invoked.
const job: AccountingInvoiceJob = {
  id,
  restaurantId: purchase.restaurantId,
  subscriptionInvoiceId: null,
  addOnPurchaseId: purchase.id,
  amountMinor: evidence.totalAmountMinor,
  currency: 'TRY',
  attempts: 1,
  providerName: 'nilvera',
  providerContactRef: null,
  providerInvoiceRef: null,
  providerTaskRef: null,
  providerDocumentRef: null,
  fiscalDocumentType: null,
  profile: {
    kind: 'add_on',
    addOn: purchase.addOn,
    netAmountMinor: purchase.netAmountMinor,
    vatRate: purchase.vatRate,
    paidAt: new Date().toISOString(),
    legalName: 'Test Kurum 2',
    name: 'Test',
    surname: 'Kurum 2',
    identityNumber: '1234567802',
    taxOffice: 'Nilvera Test',
    email: 'test02@nilvera.com',
    billingAddress: {
      address: 'Test Caddesi No: 2',
      city: 'İstanbul',
      district: 'Maltepe',
      postalCode: '34840',
      country: 'Türkiye',
    },
  },
}
const provider = createNilveraInvoiceProvider(config)
const contact = await provider.ensureContact(job)
const type = await provider.resolveDocumentType(job)
const invoice = await provider.createSalesInvoice(job, contact, type)
const task = await provider.formalize(job, invoice, type)
for (let attempt = 0; attempt < 10; attempt++) {
  if ((await provider.readTask(task)) === 'succeeded') break
  await new Promise((resolve) => setTimeout(resolve, 2000))
}
const document = await provider.resolveFormalizedDocument(invoice, type)
assert(document, 'Sandbox fiscal document is still pending')
const pdf = await provider.downloadPdf(document)
assert.equal(Buffer.from(pdf).subarray(0, 4).toString(), '%PDF')
writeFileSync('/private/tmp/masabu-addon-sandbox/invoice.pdf', pdf, {
  mode: 0o600,
})
console.log(
  JSON.stringify({
    verified: true,
    type,
    amountMinor: job.amountMinor,
    pdfBytes: pdf.length,
    subscriptionPeriod: false,
    emailWorkerInvoked: false,
  }),
)
