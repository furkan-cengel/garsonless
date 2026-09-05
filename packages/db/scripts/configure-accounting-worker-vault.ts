import assert from 'node:assert/strict'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = (process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL)?.trim()
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
const workerUrl = process.env.ACCOUNTING_WORKER_URL?.trim()
const workerSecret = process.env.ACCOUNTING_WORKER_SECRET?.trim()

assert(supabaseUrl, 'SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL is required')
assert(serviceRoleKey, 'SUPABASE_SERVICE_ROLE_KEY is required')
assert(workerUrl, 'ACCOUNTING_WORKER_URL is required')
assert(workerSecret, 'ACCOUNTING_WORKER_SECRET is required')
assert(workerSecret.length >= 32, 'ACCOUNTING_WORKER_SECRET must be at least 32 characters')

const parsedWorkerUrl = new URL(workerUrl)
assert.equal(parsedWorkerUrl.protocol, 'https:', 'ACCOUNTING_WORKER_URL must use HTTPS')
assert.match(parsedWorkerUrl.hostname, /^[a-z0-9-]+\.masabu\.co$/, 'ACCOUNTING_WORKER_URL must use a Masabu subdomain')
assert.equal(
  parsedWorkerUrl.pathname,
  '/api/internal/accounting-invoices',
  'ACCOUNTING_WORKER_URL must target /api/internal/accounting-invoices',
)
assert.equal(parsedWorkerUrl.search, '', 'ACCOUNTING_WORKER_URL must not contain a query')
assert.equal(parsedWorkerUrl.hash, '', 'ACCOUNTING_WORKER_URL must not contain a fragment')

const client = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function main() {
  const { data, error } = await client.rpc('configure_accounting_invoice_worker_vault' as never, {
    p_url: workerUrl,
    p_secret: workerSecret,
  } as never)
  assert.ifError(error)
  assert(data && typeof data === 'object', 'Accounting worker Vault provisioning returned no state')
  console.log(JSON.stringify({ workerOrigin: parsedWorkerUrl.origin, state: data }))
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Accounting worker Vault provisioning failed')
  process.exitCode = 1
})
