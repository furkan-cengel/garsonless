import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import type { AccountingInvoiceJob } from '@garsonless/db/server'
import { createNilveraInvoiceProvider, readNilveraConfig } from '../lib/accounting/nilvera-invoice-provider'

function previewJob(identityNumber: string, legalName: string): AccountingInvoiceJob {
  const paidAt = new Date()
  const periodStart = new Date(paidAt)
  periodStart.setUTCMonth(periodStart.getUTCMonth() - 1)

  return {
    id: randomUUID(),
    restaurantId: randomUUID(),
    subscriptionInvoiceId: randomUUID(),
    amountMinor: 12_000,
    currency: 'TRY',
    attempts: 1,
    providerName: 'nilvera',
    providerContactRef: null,
    providerInvoiceRef: null,
    providerTaskRef: null,
    providerDocumentRef: null,
    fiscalDocumentType: null,
    profile: {
      legalName,
      name: 'Nilvera',
      surname: 'Test',
      identityNumber,
      taxOffice: 'Nilvera Test',
      email: 'test02@nilvera.com',
      billingAddress: {
        address: 'Test Caddesi No: 2',
        city: 'İstanbul',
        district: 'Maltepe',
        postalCode: '34840',
        country: 'Türkiye',
      },
      periodStart: periodStart.toISOString(),
      periodEnd: paidAt.toISOString(),
      paidAt: paidAt.toISOString(),
      plan: 'starter',
      addOns: [],
      billingInterval: 'monthly',
    },
  }
}

async function main() {
  const config = readNilveraConfig()
  assert.equal(new URL(config.apiBaseUrl).hostname, 'apitest.nilvera.com', 'Sandbox preview requires the Nilvera test API')

  const provider = createNilveraInvoiceProvider(config)
  const eInvoiceJob = previewJob('1234567802', 'Test Kurum 2')
  const eArchiveJob = previewJob('11111111110', 'Nilvera Test Müşteri')

  const eInvoiceType = await provider.resolveDocumentType(eInvoiceJob)
  assert.equal(eInvoiceType, 'e_fatura', 'Nilvera test receiver 1234567802 must route to e-Invoice')
  const eInvoice = await provider.previewInvoice(eInvoiceJob, eInvoiceType)

  const eArchiveType = await provider.resolveDocumentType(eArchiveJob)
  assert.equal(eArchiveType, 'e_arsiv', 'The e-Archive preview identity unexpectedly routes to e-Invoice')
  const eArchive = await provider.previewInvoice(eArchiveJob, eArchiveType)

  console.log(
    `PASS Nilvera sandbox previews (e-Invoice ${eInvoice.responseBytes} bytes, e-Archive ${eArchive.responseBytes} bytes; no documents created)`,
  )
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Nilvera sandbox preview failed')
  process.exitCode = 1
})
