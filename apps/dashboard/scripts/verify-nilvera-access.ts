import assert from 'node:assert/strict'
import { createNilveraInvoiceProvider, readNilveraConfig } from '../lib/accounting/nilvera-invoice-provider'

async function main() {
  const target = process.argv.find((argument) => argument.startsWith('--target='))?.slice('--target='.length)
  assert.ok(target === 'sandbox' || target === 'live', 'Nilvera verification requires --target=sandbox or --target=live')
  const expectedOrigin = target === 'live' ? 'https://api.nilvera.com' : 'https://apitest.nilvera.com'
  assert.equal(process.env['NILVERA_API_BASE_URL']?.trim(), expectedOrigin, 'Nilvera verification target and API origin must match')
  const config = readNilveraConfig()
  const result = await createNilveraInvoiceProvider(config).verifyAccess()
  assert.equal(result.sellerTaxNumber, config.sellerTaxNumber)
  assert.equal(result.eInvoiceSeries, config.eInvoiceSeries)
  assert.equal(result.eArchiveSeries, config.eArchiveSeries)
  console.log(
    `PASS Nilvera ${target} provider (company and both invoice series verified; no documents created)`,
  )
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Nilvera access verification failed')
  process.exitCode = 1
})
