import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, resolve } from 'node:path'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
export const DEV_PROJECT_REF = 'yxsegwkzyiscrxiwdeuf'

const APP_SCOPES = {
  dashboard: [
    'NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY', 'NEXT_PUBLIC_APP_URL', 'NEXT_PUBLIC_MENU_URL',
    'NEXT_PUBLIC_MENU_BASE_URL', 'KITCHEN_URL', 'NEXT_PUBLIC_KITCHEN_URL',
    'OUTBOX_WORKER_SECRET', 'RESEND_API_KEY', 'RESEND_FROM_EMAIL',
    'RESEND_STANDS_TO_EMAIL', 'SAAS_BILLING_ENABLED',
  ],
  menu: [
    'NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY', 'NEXT_PUBLIC_APP_URL', 'NEXT_PUBLIC_MENU_URL',
    'OUTBOX_WORKER_SECRET',
  ],
  kitchen: [
    'NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
  ],
  marketing: ['NEXT_PUBLIC_DASHBOARD_URL'],
  'platform-admin': [
    'NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
  ],
  'outbox-worker': [
    'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY',
    'OUTBOX_WORKER_SECRET', 'OUTBOX_CONSUMER_URL',
    'OUTBOX_INBOX_CONSUMER_URL', 'OUTBOX_EMAIL_CONSUMER_URL',
    'PAYMENT_RECONCILIATION_URL', 'BILLING_MAINTENANCE_URL',
  ],
  'send-email-hook': ['SEND_EMAIL_HOOK_SECRET', 'RESEND_API_KEY'],
}

const CAPABILITIES = {
  'order-card-payments': {
    scopes: ['menu'],
    keys: ['IYZICO_API_KEY', 'IYZICO_SECRET_KEY', 'IYZICO_BASE_URL'],
  },
  'saas-billing': {
    scopes: ['dashboard'],
    keys: [
      'IYZICO_BILLING_MERCHANT_ID', 'IYZICO_BILLING_API_KEY',
      'IYZICO_BILLING_SECRET_KEY', 'IYZICO_BILLING_BASE_URL',
      'SAAS_BILLING_ENABLED',
      'IYZICO_BILLING_STARTER_PLAN_REF', 'IYZICO_BILLING_STARTER_AMOUNT_MINOR',
      'IYZICO_BILLING_PRO_PLAN_REF', 'IYZICO_BILLING_PRO_AMOUNT_MINOR',
      'IYZICO_BILLING_ENTERPRISE_PLAN_REF',
      'IYZICO_BILLING_ENTERPRISE_AMOUNT_MINOR',
    ],
  },
  'web-push': {
    scopes: ['dashboard', 'outbox-worker'],
    keys: [
      'NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY', 'WEB_PUSH_VAPID_PRIVATE_KEY',
      'WEB_PUSH_SUBJECT', 'OUTBOX_PUSH_CONSUMER_URL',
    ],
  },
  sms: {
    scopes: ['dashboard'],
    keys: ['SMS_PROVIDER', 'NETGSM_USERCODE', 'NETGSM_PASSWORD', 'NETGSM_MSGHEADER'],
  },
}

const SECRET_KEYS = new Set([
  'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY',
  'OUTBOX_WORKER_SECRET', 'SEND_EMAIL_HOOK_SECRET', 'RESEND_API_KEY',
  'IYZICO_API_KEY', 'IYZICO_SECRET_KEY', 'IYZICO_BILLING_API_KEY',
  'IYZICO_BILLING_SECRET_KEY', 'WEB_PUSH_VAPID_PRIVATE_KEY', 'NETGSM_PASSWORD',
])

const URL_KEYS = new Set([
  'NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_URL', 'NEXT_PUBLIC_APP_URL', 'NEXT_PUBLIC_MENU_URL',
  'NEXT_PUBLIC_MENU_BASE_URL', 'KITCHEN_URL', 'NEXT_PUBLIC_KITCHEN_URL',
  'NEXT_PUBLIC_DASHBOARD_URL', 'OUTBOX_CONSUMER_URL',
  'OUTBOX_PUSH_CONSUMER_URL', 'OUTBOX_INBOX_CONSUMER_URL',
  'OUTBOX_EMAIL_CONSUMER_URL', 'PAYMENT_RECONCILIATION_URL',
  'BILLING_MAINTENANCE_URL', 'IYZICO_BASE_URL', 'IYZICO_BILLING_BASE_URL',
])

const BILLING_PLAN_REF_KEYS = [
  'IYZICO_BILLING_STARTER_PLAN_REF',
  'IYZICO_BILLING_PRO_PLAN_REF',
  'IYZICO_BILLING_ENTERPRISE_PLAN_REF',
]
const BILLING_AMOUNT_KEYS = [
  'IYZICO_BILLING_STARTER_AMOUNT_MINOR',
  'IYZICO_BILLING_PRO_AMOUNT_MINOR',
  'IYZICO_BILLING_ENTERPRISE_AMOUNT_MINOR',
]

function stripInlineComment(value) {
  if (value.startsWith('"') || value.startsWith("'")) return value
  return value.replace(/\s+#.*$/, '').trim()
}

export function parseEnv(text) {
  const result = {}
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const normalized = line.startsWith('export ') ? line.slice(7).trim() : line
    const separator = normalized.indexOf('=')
    if (separator < 1) continue
    const key = normalized.slice(0, separator).trim()
    let value = stripInlineComment(normalized.slice(separator + 1).trim())
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    result[key] = value
  }
  return result
}

function isPlaceholder(value) {
  const lower = value.toLowerCase()
  const angleValue = value.match(/<([^>]*)>/)?.[1]
  return !value || (angleValue !== undefined && !angleValue.includes('@')) || lower.includes('your-')
    || lower.includes('changeme') || lower.includes('placeholder')
    || lower.includes('example.com')
}

function issue(code, key, message) {
  return { code, key, message }
}

function validateUrl(key, value) {
  try {
    const parsed = new URL(value)
    if (parsed.protocol !== 'https:') {
      return issue('MAS-DEP-003', key, 'Production URL HTTPS kullanmalı.')
    }
    if (['localhost', '127.0.0.1', '0.0.0.0'].includes(parsed.hostname)) {
      return issue('MAS-DEP-003', key, 'Production URL localhost olamaz.')
    }
  } catch {
    return issue('MAS-DEP-006', key, 'Geçerli bir mutlak URL olmalı.')
  }
  return null
}

function validateSaasBillingContract(env) {
  const errors = []
  for (const key of BILLING_AMOUNT_KEYS) {
    const raw = env[key]?.trim() ?? ''
    if (!raw || isPlaceholder(raw)) continue
    const value = Number(raw)
    if (!/^[1-9]\d*$/.test(raw) || !Number.isSafeInteger(value)) {
      errors.push(issue('MAS-DEP-006', key, 'Pozitif ve güvenli bir TRY minor-unit tamsayısı olmalı.'))
    }
  }

  const references = []
  for (const key of BILLING_PLAN_REF_KEYS) {
    const value = env[key]?.trim() ?? ''
    if (!value || isPlaceholder(value)) continue
    if (!/^[\x21-\x7e]{1,200}$/.test(value)) {
      errors.push(issue('MAS-DEP-006', key, 'Yazdırılabilir ve en fazla 200 karakterlik provider referansı olmalı.'))
    } else {
      references.push({ key, value })
    }
  }
  if (references.length === BILLING_PLAN_REF_KEYS.length
    && new Set(references.map(({ value }) => value)).size !== references.length) {
    errors.push(issue('MAS-DEP-006', 'IYZICO_BILLING_*_PLAN_REF', 'Paid plan provider referansları benzersiz olmalı.'))
  }

  const merchantId = env.IYZICO_BILLING_MERCHANT_ID?.trim() ?? ''
  if (merchantId && !isPlaceholder(merchantId) && !/^[\x21-\x7e]{1,200}$/.test(merchantId)) {
    errors.push(issue('MAS-DEP-006', 'IYZICO_BILLING_MERCHANT_ID', 'Geçerli bir provider merchant referansı olmalı.'))
  }

  const appUrl = env.NEXT_PUBLIC_APP_URL?.trim()
  if (appUrl && !isPlaceholder(appUrl)) {
    try {
      const parsed = new URL(appUrl)
      if (parsed.username || parsed.password || parsed.pathname !== '/' || parsed.search || parsed.hash) {
        errors.push(issue('MAS-DEP-006', 'NEXT_PUBLIC_APP_URL', 'Billing callback için path, query, fragment veya credential içermeyen origin olmalı.'))
      }
    } catch {
      // The generic URL validator reports the canonical error.
    }
  }
  return errors
}

function requiredKeys(scopes, capabilities) {
  const keys = new Set()
  for (const scope of scopes) {
    for (const key of APP_SCOPES[scope] ?? []) keys.add(key)
  }
  for (const capability of capabilities) {
    const contract = CAPABILITIES[capability]
    if (!contract) continue
    if (contract.scopes.some((scope) => scopes.includes(scope))) {
      for (const key of contract.keys) keys.add(key)
    }
  }
  return [...keys]
}

export function migrationInventory(root = ROOT) {
  const directory = resolve(root, 'packages/db/supabase/migrations')
  const files = readdirSync(directory).filter((name) => /^\d{14}_.+\.sql$/.test(name)).sort()
  const timestamps = new Map()
  for (const file of files) {
    const timestamp = file.slice(0, 14)
    timestamps.set(timestamp, [...(timestamps.get(timestamp) ?? []), file])
  }
  const duplicates = [...timestamps.values()].filter((items) => items.length > 1)
  return { count: files.length, first: files[0] ?? null, latest: files.at(-1) ?? null, duplicates }
}

export function validateProductionConfig({ env, scopes, capabilities = [], projectRef }) {
  const errors = []
  const warnings = []
  const unknownScopes = scopes.filter((scope) => !APP_SCOPES[scope])
  const unknownCapabilities = capabilities.filter((capability) => !CAPABILITIES[capability])

  for (const scope of unknownScopes) errors.push(issue('MAS-DEP-006', 'scope', `Bilinmeyen scope: ${scope}`))
  for (const capability of unknownCapabilities) errors.push(issue('MAS-DEP-006', 'capability', `Bilinmeyen capability: ${capability}`))

  if (scopes.some((scope) => APP_SCOPES[scope]?.some((key) => ['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_URL'].includes(key)))) {
    if (!projectRef) errors.push(issue('MAS-DEP-001', 'project-ref', 'Supabase production project ref zorunlu.'))
    else if (!/^[a-z0-9]{20}$/.test(projectRef)) errors.push(issue('MAS-DEP-006', 'project-ref', 'Supabase project ref 20 küçük harf/rakam olmalı.'))
    else if (projectRef === DEV_PROJECT_REF) errors.push(issue('MAS-DEP-004', 'project-ref', 'DEV Supabase projesi production hedefi olamaz.'))
  }

  for (const key of requiredKeys(scopes, capabilities)) {
    const value = env[key]?.trim() ?? ''
    if (!value) {
      errors.push(issue('MAS-DEP-001', key, 'Zorunlu production değeri eksik.'))
      continue
    }
    if (isPlaceholder(value)) {
      errors.push(issue('MAS-DEP-002', key, 'Placeholder production değeri olarak kullanılamaz.'))
      continue
    }
    if (URL_KEYS.has(key)) {
      const urlError = validateUrl(key, value)
      if (urlError) errors.push(urlError)
    }
    if (SECRET_KEYS.has(key) && value.length < 24) {
      errors.push(issue('MAS-DEP-005', key, 'Secret beklenen minimum uzunluğun altında.'))
    }
  }

  const supabaseUrlKey = env.NEXT_PUBLIC_SUPABASE_URL ? 'NEXT_PUBLIC_SUPABASE_URL' : 'SUPABASE_URL'
  const supabaseUrl = env[supabaseUrlKey]
  if (projectRef && supabaseUrl && !isPlaceholder(supabaseUrl)) {
    const expected = `https://${projectRef}.supabase.co`
    if (supabaseUrl !== expected) errors.push(issue('MAS-DEP-004', supabaseUrlKey, `Project ref ile eşleşmeli: ${expected}`))
  }
  if (supabaseUrl?.includes(DEV_PROJECT_REF)) {
    errors.push(issue('MAS-DEP-004', supabaseUrlKey, 'DEV Supabase URL production yapılandırmasına taşınamaz.'))
  }
  if (env.NEXT_PUBLIC_SUPABASE_ANON_KEY && env.NEXT_PUBLIC_SUPABASE_ANON_KEY === env.SUPABASE_SERVICE_ROLE_KEY) {
    errors.push(issue('MAS-DEP-006', 'SUPABASE_SERVICE_ROLE_KEY', 'Anon ve service-role anahtarları aynı olamaz.'))
  }
  if (capabilities.includes('order-card-payments') && env.IYZICO_BASE_URL !== 'https://api.iyzipay.com') {
    errors.push(issue('MAS-DEP-006', 'IYZICO_BASE_URL', 'Canlı kart ödemesinde production İyzico origin zorunlu.'))
  }
  if (capabilities.includes('saas-billing') && env.IYZICO_BILLING_BASE_URL !== 'https://api.iyzipay.com') {
    errors.push(issue('MAS-DEP-006', 'IYZICO_BILLING_BASE_URL', 'Canlı SaaS billing için production İyzico origin zorunlu.'))
  }
  if (capabilities.includes('saas-billing')) {
    errors.push(...validateSaasBillingContract(env))
  }
  if (scopes.includes('dashboard') && env.SAAS_BILLING_ENABLED) {
    const expected = capabilities.includes('saas-billing') ? 'true' : 'false'
    if (env.SAAS_BILLING_ENABLED !== expected) {
      errors.push(issue(
        'MAS-DEP-006',
        'SAAS_BILLING_ENABLED',
        capabilities.includes('saas-billing')
          ? 'SaaS billing capability için açıkça true olmalı.'
          : 'SaaS billing capability seçili değilken fail-closed false olmalı.',
      ))
    }
  }
  if (capabilities.includes('sms') && env.SMS_PROVIDER !== 'netgsm') {
    errors.push(issue('MAS-DEP-006', 'SMS_PROVIDER', 'Production SMS capability için provider netgsm olmalı.'))
  }

  for (const capability of Object.keys(CAPABILITIES)) {
    if (!capabilities.includes(capability) && CAPABILITIES[capability].scopes.some((scope) => scopes.includes(scope))) {
      warnings.push(issue('MAS-DEP-W01', capability, 'Capability bu preflight turunda bilinçli olarak etkin değil.'))
    }
  }
  warnings.push(issue('MAS-DEP-W02', 'migrations', 'Bu komut remote migration durumunu değiştirmez veya doğrulamaz.'))
  return { ok: errors.length === 0, errors, warnings }
}

function parseArguments(argv) {
  const options = { scopes: [], capabilities: [], json: false }
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === '--') continue
    if (arg === '--scope') options.scopes.push(...(argv[++index] ?? '').split(',').filter(Boolean))
    else if (arg === '--capability') options.capabilities.push(...(argv[++index] ?? '').split(',').filter(Boolean))
    else if (arg === '--env-file') options.envFile = argv[++index]
    else if (arg === '--project-ref') options.projectRef = argv[++index]
    else if (arg === '--json') options.json = true
    else if (arg === '--list') options.list = true
    else throw new Error(`Bilinmeyen argüman: ${arg}`)
  }
  return options
}

function printHuman(result, inventory, scopes, capabilities) {
  console.log(`Masabu production preflight: ${result.ok ? 'PASS' : 'FAIL'}`)
  console.log(`Scopes: ${scopes.join(', ')}`)
  console.log(`Capabilities: ${capabilities.length ? capabilities.join(', ') : 'none'}`)
  console.log(`Local migrations: ${inventory.count} (${inventory.first} → ${inventory.latest})`)
  for (const item of result.errors) console.error(`ERROR ${item.code} ${item.key}: ${item.message}`)
  for (const item of result.warnings) console.warn(`WARN  ${item.code} ${item.key}: ${item.message}`)
}

export function runCli(argv = process.argv.slice(2)) {
  let options
  try {
    options = parseArguments(argv)
  } catch (error) {
    console.error(`MAS-DEP-006 arguments: ${error instanceof Error ? error.message : 'Geçersiz argüman'}`)
    return 2
  }
  if (options.list) {
    console.log(`Scopes: ${Object.keys(APP_SCOPES).join(', ')}`)
    console.log(`Capabilities: ${Object.keys(CAPABILITIES).join(', ')}`)
    return 0
  }
  if (!options.envFile || options.scopes.length === 0) {
    console.error('Kullanım: pnpm prod:preflight -- --env-file <path> --scope <scope[,scope]> --project-ref <ref> [--capability <name>] [--json]')
    return 2
  }

  let env
  try {
    env = parseEnv(readFileSync(resolve(ROOT, options.envFile), 'utf8'))
  } catch {
    console.error(`MAS-DEP-001 env-file: Production env dosyası okunamadı: ${options.envFile}`)
    return 2
  }
  const inventory = migrationInventory()
  const result = validateProductionConfig({ ...options, env })
  for (const duplicate of inventory.duplicates) {
    result.errors.push(issue('MAS-DEP-007', 'migrations', `Aynı migration timestamp'i: ${duplicate.join(', ')}`))
    result.ok = false
  }
  if (options.json) console.log(JSON.stringify({ ...result, scopes: options.scopes, capabilities: options.capabilities, migrations: inventory }, null, 2))
  else printHuman(result, inventory, options.scopes, options.capabilities)
  return result.ok ? 0 : 1
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  process.exitCode = runCli()
}
