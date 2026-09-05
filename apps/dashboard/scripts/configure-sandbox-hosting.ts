import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { parseEnv } from 'node:util'
import { fileURLToPath } from 'node:url'

const SANDBOX_ORIGIN = 'https://sandbox.masabu.co'
const VERCEL_PROJECT = 'masabu-sandbox'
const VERCEL_SCOPE = 'furkans-projects-97f111eb'

const dashboardDirectory = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const repositoryDirectory = resolve(dashboardDirectory, '../..')

const requiredLocalKeys = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'RESEND_API_KEY',
  'RESEND_FROM_EMAIL',
] as const

const requiredSandboxKeys = [
  'SAAS_BILLING_ENABLED',
  'IYZICO_BILLING_MERCHANT_ID',
  'IYZICO_BILLING_API_KEY',
  'IYZICO_BILLING_SECRET_KEY',
  'IYZICO_BILLING_BASE_URL',
  'IYZICO_BILLING_ALLOW_SANDBOX_IN_PRODUCTION',
  'INVOICE_VAT_RATE',
  'NEXT_PUBLIC_APP_URL',
  'ACCOUNTING_DISPATCH_ENABLED',
  'ACCOUNTING_PROVIDER',
  'NILVERA_API_BASE_URL',
  'NILVERA_API_KEY',
  'NILVERA_SELLER_TAX_NUMBER',
  'NILVERA_EINVOICE_SERIES',
  'NILVERA_EARCHIVE_SERIES',
  'NILVERA_INTERNET_SALE_URL',
  'INVOICE_SERVICE_NAME',
] as const

function readEnvironment(file: string) {
  return parseEnv(readFileSync(file, 'utf8'))
}

function required(environment: Readonly<Record<string, string | undefined>>, key: string) {
  const value = environment[key]?.trim()
  assert(value, `${key} is required`)
  assert(!/^your-/i.test(value), `${key} must not contain an example placeholder`)
  return value
}

function command(
  commandName: string,
  args: string[],
  environment?: NodeJS.ProcessEnv,
  input?: string,
) {
  const result = spawnSync(commandName, args, {
    cwd: repositoryDirectory,
    encoding: 'utf8',
    env: environment ?? process.env,
    input,
    stdio: [input === undefined ? 'ignore' : 'pipe', 'pipe', 'pipe'],
  })

  if (result.status !== 0) {
    const diagnostic = `${result.stdout ?? ''}\n${result.stderr ?? ''}`
      .replace(/[A-Za-z0-9_-]{32,}/g, '[REDACTED]')
      .trim()
    throw new Error(`${commandName} failed${diagnostic ? `: ${diagnostic}` : ''}`)
  }

  return (result.stdout ?? '').trim()
}

function isSensitive(key: string) {
  if (key.startsWith('NEXT_PUBLIC_')) return false
  return /(?:KEY|SECRET|SALT|PRIVATE)/.test(key) || key === 'SUPABASE_SERVICE_ROLE_KEY'
}

function randomSecret() {
  return randomBytes(32).toString('hex')
}

const localEnvironment = readEnvironment(join(dashboardDirectory, '.env.local'))
const sandboxEnvironment = readEnvironment(join(dashboardDirectory, '.env.sandbox'))
const mergedEnvironment = { ...localEnvironment, ...sandboxEnvironment }

for (const key of requiredLocalKeys) required(localEnvironment, key)
for (const key of requiredSandboxKeys) required(sandboxEnvironment, key)

assert.equal(required(sandboxEnvironment, 'NEXT_PUBLIC_APP_URL'), SANDBOX_ORIGIN)
assert.equal(required(sandboxEnvironment, 'IYZICO_BILLING_BASE_URL'), 'https://sandbox-api.iyzipay.com')
assert.equal(required(sandboxEnvironment, 'IYZICO_BILLING_ALLOW_SANDBOX_IN_PRODUCTION'), 'true')
assert.equal(required(sandboxEnvironment, 'NILVERA_API_BASE_URL'), 'https://apitest.nilvera.com')
assert.equal(required(sandboxEnvironment, 'ACCOUNTING_PROVIDER'), 'nilvera')
assert.equal(required(sandboxEnvironment, 'ACCOUNTING_DISPATCH_ENABLED'), 'false')
assert.equal(required(sandboxEnvironment, 'SAAS_BILLING_ENABLED'), 'true')

const supabaseUrl = new URL(required(localEnvironment, 'NEXT_PUBLIC_SUPABASE_URL'))
assert.equal(supabaseUrl.protocol, 'https:', 'Sandbox Supabase URL must use HTTPS')
assert.match(supabaseUrl.hostname, /^[a-z0-9]+\.supabase\.co$/, 'Sandbox must use a hosted Supabase project')

const iyzicoPlanEnvironment = Object.fromEntries(
  Object.entries(sandboxEnvironment).flatMap(([key, value]) => (
    key.startsWith('IYZICO_BILLING_')
    && key !== 'IYZICO_BILLING_BASE_URL'
    && key !== 'IYZICO_BILLING_API_KEY'
    && key !== 'IYZICO_BILLING_SECRET_KEY'
    && key !== 'IYZICO_BILLING_MERCHANT_ID'
    && key !== 'IYZICO_BILLING_ALLOW_SANDBOX_IN_PRODUCTION'
    && value !== undefined
      ? [[key, value] as const]
      : []
  )),
)

for (const [key, value] of Object.entries(iyzicoPlanEnvironment)) {
  assert(value.trim(), `${key} is required for the provisioned sandbox catalog`)
}

const generatedSecrets = {
  OUTBOX_WORKER_SECRET: randomSecret(),
  ACCOUNTING_WORKER_SECRET: randomSecret(),
  LEGAL_ACCEPTANCE_IP_SALT: randomSecret(),
  THEME_PREVIEW_SIGNING_SECRET: randomSecret(),
}

const vercelEnvironment: Record<string, string> = {
  NEXT_PUBLIC_SUPABASE_URL: required(mergedEnvironment, 'NEXT_PUBLIC_SUPABASE_URL'),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: required(mergedEnvironment, 'NEXT_PUBLIC_SUPABASE_ANON_KEY'),
  SUPABASE_SERVICE_ROLE_KEY: required(mergedEnvironment, 'SUPABASE_SERVICE_ROLE_KEY'),
  NEXT_PUBLIC_APP_URL: SANDBOX_ORIGIN,
  NEXT_PUBLIC_MARKETING_URL: 'https://masabu.co',
  NEXT_PUBLIC_MENU_URL: 'https://menu.masabu.co',
  NEXT_PUBLIC_MENU_BASE_URL: 'https://menu.masabu.co',
  KITCHEN_URL: 'https://kds.masabu.co',
  NEXT_PUBLIC_KITCHEN_URL: 'https://kds.masabu.co',
  SAAS_BILLING_ENABLED: 'true',
  SAAS_BILLING_SALES_ENABLED: 'true',
  IYZICO_BILLING_MERCHANT_ID: required(mergedEnvironment, 'IYZICO_BILLING_MERCHANT_ID'),
  IYZICO_BILLING_API_KEY: required(mergedEnvironment, 'IYZICO_BILLING_API_KEY'),
  IYZICO_BILLING_SECRET_KEY: required(mergedEnvironment, 'IYZICO_BILLING_SECRET_KEY'),
  IYZICO_BILLING_BASE_URL: 'https://sandbox-api.iyzipay.com',
  IYZICO_BILLING_ALLOW_SANDBOX_IN_PRODUCTION: 'true',
  INVOICE_VAT_RATE: required(mergedEnvironment, 'INVOICE_VAT_RATE'),
  ACCOUNTING_PROVIDER: 'nilvera',
  ACCOUNTING_DISPATCH_ENABLED: 'false',
  ACCOUNTING_WORKER_URL: `${SANDBOX_ORIGIN}/api/internal/accounting-invoices`,
  NILVERA_API_BASE_URL: 'https://apitest.nilvera.com',
  NILVERA_API_KEY: required(mergedEnvironment, 'NILVERA_API_KEY'),
  NILVERA_SELLER_TAX_NUMBER: required(mergedEnvironment, 'NILVERA_SELLER_TAX_NUMBER'),
  NILVERA_EINVOICE_SERIES: required(mergedEnvironment, 'NILVERA_EINVOICE_SERIES'),
  NILVERA_EARCHIVE_SERIES: required(mergedEnvironment, 'NILVERA_EARCHIVE_SERIES'),
  NILVERA_INTERNET_SALE_URL: required(mergedEnvironment, 'NILVERA_INTERNET_SALE_URL'),
  INVOICE_SERVICE_NAME: required(mergedEnvironment, 'INVOICE_SERVICE_NAME'),
  INVOICE_FROM_EMAIL: mergedEnvironment.INVOICE_FROM_EMAIL?.trim()
    || required(mergedEnvironment, 'RESEND_FROM_EMAIL'),
  RESEND_API_KEY: required(mergedEnvironment, 'RESEND_API_KEY'),
  RESEND_FROM_EMAIL: required(mergedEnvironment, 'RESEND_FROM_EMAIL'),
  ...iyzicoPlanEnvironment,
  ...generatedSecrets,
}

if (mergedEnvironment.RESEND_STANDS_TO_EMAIL?.trim()) {
  vercelEnvironment.RESEND_STANDS_TO_EMAIL = mergedEnvironment.RESEND_STANDS_TO_EMAIL.trim()
}

const apply = process.argv.includes('--apply')
const confirmed = process.argv.includes('--confirm=masabu-sandbox')

console.log(`PASS sandbox hosting preflight (${Object.keys(vercelEnvironment).length} Vercel variables)`)

if (!apply) {
  console.log('DRY RUN no external configuration changed')
  process.exit(0)
}

assert(confirmed, 'Applying requires --confirm=masabu-sandbox')

const temporaryDirectory = mkdtempSync(join(tmpdir(), 'masabu-sandbox-hosting-'))

try {
  for (const [key, value] of Object.entries(vercelEnvironment)) {
    command('corepack', [
      'pnpm', 'dlx', 'vercel@latest', 'env', 'add', key, 'production',
      '--project', VERCEL_PROJECT,
      '--scope', VERCEL_SCOPE,
      '--force',
      isSensitive(key) ? '--sensitive' : '--no-sensitive',
      '--yes',
    ], undefined, `${value}\n`)
  }
  console.log('PASS Vercel sandbox environment synchronized')

  const edgeSecretsFile = join(temporaryDirectory, 'supabase-edge-secrets.env')
  writeFileSync(edgeSecretsFile, [
    `OUTBOX_WORKER_SECRET=${generatedSecrets.OUTBOX_WORKER_SECRET}`,
    `OUTBOX_CONSUMER_URL=${SANDBOX_ORIGIN}/api/internal/outbox`,
    `OUTBOX_PUSH_CONSUMER_URL=${SANDBOX_ORIGIN}/api/internal/push`,
    `OUTBOX_INBOX_CONSUMER_URL=${SANDBOX_ORIGIN}/api/internal/inbox`,
    `OUTBOX_EMAIL_CONSUMER_URL=${SANDBOX_ORIGIN}/api/internal/notification-email`,
    `BILLING_MAINTENANCE_URL=${SANDBOX_ORIGIN}/api/internal/billing-maintenance`,
    '',
  ].join('\n'), { mode: 0o600 })

  command('corepack', [
    'pnpm', '--filter', '@garsonless/db', 'exec', 'supabase', 'secrets', 'set',
    '--env-file', edgeSecretsFile,
    '--workdir', '.',
  ])
  console.log('PASS DEV Supabase outbox routes synchronized')

  const childEnvironment = {
    ...process.env,
    ...mergedEnvironment,
    ...generatedSecrets,
    OUTBOX_WORKER_URL: `${supabaseUrl.origin}/functions/v1/outbox-worker`,
    ACCOUNTING_WORKER_URL: `${SANDBOX_ORIGIN}/api/internal/accounting-invoices`,
  }

  command('corepack', [
    'pnpm', '--filter', '@garsonless/db', 'exec', 'node', '--import', 'tsx',
    'scripts/configure-outbox-worker-vault.ts',
  ], childEnvironment)
  console.log('PASS DEV Supabase outbox schedule synchronized')

  command('corepack', [
    'pnpm', '--filter', '@garsonless/db', 'exec', 'node', '--import', 'tsx',
    'scripts/configure-accounting-worker-vault.ts',
  ], childEnvironment)
  console.log('PASS DEV Supabase accounting schedule synchronized')
} finally {
  rmSync(temporaryDirectory, { recursive: true, force: true })
}
