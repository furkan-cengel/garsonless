import assert from 'node:assert/strict'
import { createNilveraInvoiceProvider, readNilveraConfig } from '../lib/accounting/nilvera-invoice-provider'

async function main() {
  const config = readNilveraConfig()
  assert.equal(new URL(config.apiBaseUrl).hostname, 'apitest.nilvera.com', 'Sandbox verification requires the Nilvera test API')
  const result = await createNilveraInvoiceProvider(config).verifyAccess()
  assert.equal(result.sellerTaxNumber, config.sellerTaxNumber)
  assert.equal(result.eInvoiceSeries, config.eInvoiceSeries)
  assert.equal(result.eArchiveSeries, config.eArchiveSeries)
  console.log(
    `PASS Nilvera sandbox provider (seller ${result.sellerTaxNumber}, e-Invoice ${result.eInvoiceSeries}, e-Archive ${result.eArchiveSeries})`,
  )
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Nilvera sandbox access verification failed')
  process.exitCode = 1
})
