import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { createParasutInvoiceProvider, readParasutConfig } from '../lib/accounting/parasut-invoice-provider'
import { createParasutRefreshTokenStore } from '../lib/accounting/parasut-refresh-token-store'

async function main() {
  const config = readParasutConfig()
  const workerId = `parasut-verify-${randomUUID()}`
  const provider = createParasutInvoiceProvider(
    config,
    fetch,
    createParasutRefreshTokenStore(workerId, config.refreshToken),
  )
  const result = await provider.verifyAccess()
  assert.equal(result.productRef, config.productId)
  console.log(`PASS Paraşüt access (company ${config.companyId}, product ${result.productRef})`)
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Paraşüt access verification failed')
  process.exitCode = 1
})
