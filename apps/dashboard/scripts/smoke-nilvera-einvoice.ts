import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import type { AccountingInvoiceJob } from '@garsonless/db/server'
import type { FiscalDocumentType } from '../lib/accounting/invoice-provider'
import { createNilveraInvoiceProvider, readNilveraConfig } from '../lib/accounting/nilvera-invoice-provider'

const POLL_ATTEMPTS = 10
const POLL_INTERVAL_MS = 2_000

function deterministicUuid(seed: string): string {
  const hash = createHash('sha256').update(seed).digest('hex')
  const variant = ((Number.parseInt(hash.slice(16, 18), 16) & 0x3f) | 0x80).toString(16).padStart(2, '0')
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-${variant}${hash.slice(18, 20)}-${hash.slice(20, 32)}`
}

function istanbulDate(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Istanbul', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date())
}

function smokeJob(type: FiscalDocumentType): AccountingInvoiceJob {
  const date = istanbulDate()
  const paidAt = new Date()
  const periodStart = new Date(paidAt)
  periodStart.setUTCMonth(periodStart.getUTCMonth() - 1)
  const identity = `masabu:nilvera:sandbox:${type}:${date}`
  const isEInvoice = type === 'e_fatura'

  return {
    id: deterministicUuid(`${identity}:document`),
    restaurantId: deterministicUuid(`${identity}:restaurant`),
    subscriptionInvoiceId: deterministicUuid(`${identity}:subscription-invoice`),
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
      legalName: isEInvoice ? 'Test Kurum 2' : 'Nilvera Test Müşteri',
      name: isEInvoice ? 'Test' : 'Nilvera',
      surname: isEInvoice ? 'Kurum 2' : 'Test',
      identityNumber: isEInvoice ? '1234567802' : '11111111110',
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
  const args = new Set(process.argv.slice(2))
  const type = args.has('--type=e_arsiv') ? 'e_arsiv' : 'e_fatura'
  const label = type === 'e_fatura' ? 'e-Invoice' : 'e-Archive'
  const unknown = [...args].filter((arg) => !['--apply', '--type=e_fatura', '--type=e_arsiv'].includes(arg))
  assert.deepEqual(unknown, [], `Unknown arguments: ${unknown.join(', ')}`)
  assert.equal(args.has('--type=e_fatura') && args.has('--type=e_arsiv'), false, 'Only one fiscal document type may be selected')

  const config = readNilveraConfig()
  assert.equal(new URL(config.apiBaseUrl).hostname, 'apitest.nilvera.com', 'Smoke test requires the Nilvera test API')
  if (!args.has('--apply')) {
    console.log(`DRY RUN Nilvera sandbox ${label} smoke test; add --apply to create one test document`)
    return
  }

  const provider = createNilveraInvoiceProvider(config)
  const job = smokeJob(type)
  console.log(`APPLY Nilvera sandbox ${label} smoke test (UUID ${job.id})`)

  const resolvedType = await provider.resolveDocumentType(job)
  assert.equal(resolvedType, type, `Nilvera test receiver must route to ${label}`)
  await provider.previewInvoice({ ...job, id: deterministicUuid(`${job.id}:preview`) }, type)
  const contactRef = await provider.ensureContact(job)
  const invoiceRef = await provider.createSalesInvoice(job, contactRef, type)
  const taskRef = await provider.formalize(job, invoiceRef, type)

  for (let attempt = 0; attempt < POLL_ATTEMPTS; attempt += 1) {
    if (await provider.readTask(taskRef) === 'succeeded') {
      const pdf = await provider.downloadPdf({ ref: invoiceRef, type })
      console.log(`PASS Nilvera sandbox ${label} created (UUID ${invoiceRef}, PDF ${pdf.byteLength} bytes)`)
      return
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS))
  }

  if (type === 'e_arsiv') {
    const pdf = await provider.downloadPdf({ ref: invoiceRef, type })
    console.log(
      `PASS Nilvera sandbox ${label} created (UUID ${invoiceRef}, PDF ${pdf.byteLength} bytes, GIB report pending)`,
    )
    return
  }
  console.log(`PASS Nilvera sandbox ${label} submitted and pending (UUID ${invoiceRef})`)
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Nilvera sandbox invoice smoke test failed')
  process.exitCode = 1
})
