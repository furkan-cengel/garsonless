#!/usr/bin/env node

import { createHash } from 'node:crypto'
import {
  chmodSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'

const PACKAGE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const MIGRATIONS_ROOT = resolve(PACKAGE_ROOT, 'supabase/migrations')
const LINKED_PROJECT_FILE = resolve(PACKAGE_ROOT, 'supabase/.temp/project-ref')
const GENERATED_TYPES_FILE = resolve(PACKAGE_ROOT, 'src/types.gen.ts')
const TARGET_LOCK_FILE = resolve(
  tmpdir(),
  `masabu-supabase-target-${createHash('sha256').update(PACKAGE_ROOT).digest('hex').slice(0, 16)}.lock`,
)

export const SUPABASE_TARGETS = Object.freeze({
  dev: 'yxsegwkzyiscrxiwdeuf',
  prod: 'svxvloeosiksqfadgkvo',
})

const CONFIG_VALIDATION_SMS_HOOK_SECRET = `v1,whsec_${Buffer.alloc(32).toString('base64')}`

function targetError(code, message) {
  return Object.assign(new Error(message), { code })
}

export function acquireTargetLock({
  lockFile = TARGET_LOCK_FILE,
  pid = process.pid,
  now = () => new Date().toISOString(),
} = {}) {
  mkdirSync(dirname(lockFile), { recursive: true })
  const owner = { schemaVersion: 1, pid, acquiredAt: now() }
  try {
    writeFileSync(lockFile, `${JSON.stringify(owner)}\n`, { flag: 'wx', mode: 0o600 })
    chmodSync(lockFile, 0o600)
  } catch (error) {
    if (error?.code !== 'EEXIST') throw error
    let existingPid = 'unknown'
    try {
      const existing = JSON.parse(readFileSync(lockFile, 'utf8'))
      if (Number.isSafeInteger(existing?.pid) && existing.pid > 0) existingPid = String(existing.pid)
    } catch {
      // A malformed lock is still treated as owned; never replace it automatically.
    }
    throw targetError(
      'MAS-DB-021',
      `Supabase target kilidi mevcut (pid=${existingPid}). Çalışan işlem olmadığını doğruladıktan sonra kilidi operatör olarak kaldırın: ${lockFile}`,
    )
  }
  let released = false
  return () => {
    if (released) return
    let current
    try {
      current = JSON.parse(readFileSync(lockFile, 'utf8'))
    } catch {
      throw targetError('MAS-DB-021', 'Supabase target kilidi release öncesi doğrulanamadı.')
    }
    if (current?.pid !== pid) {
      throw targetError('MAS-DB-021', 'Supabase target kilidinin sahibi işlem sırasında değişti.')
    }
    unlinkSync(lockFile)
    released = true
  }
}

function parseExpectedVersions(value) {
  if (value === 'none') return []
  const versions = value.split(',').map((item) => item.trim()).filter(Boolean)
  if (versions.length === 0 || versions.some((version) => !/^\d{14}$/.test(version))) {
    throw targetError('MAS-DB-002', '--expect-pending virgülle ayrılmış 14 haneli migration sürümleri veya "none" olmalı.')
  }
  return versions
}

export function parseArguments(argv) {
  const [command, ...rest] = argv.filter((argument) => argument !== '--')
  if (!['status', 'push', 'backup', 'pull', 'types'].includes(command)) {
    throw targetError('MAS-DB-001', 'Komut status, push, backup, pull veya types olmalı.')
  }

  const options = {
    command,
    target: null,
    confirmProd: null,
    expectedPending: null,
    evidenceOutput: null,
    backupDirectory: null,
  }
  for (let index = 0; index < rest.length; index += 1) {
    const argument = rest[index]
    if (argument === '--target') options.target = rest[++index] ?? null
    else if (argument === '--confirm-prod') options.confirmProd = rest[++index] ?? null
    else if (argument === '--expect-pending') options.expectedPending = parseExpectedVersions(rest[++index] ?? '')
    else if (argument === '--evidence-output') options.evidenceOutput = rest[++index] ?? null
    else if (argument === '--backup-directory') options.backupDirectory = rest[++index] ?? null
    else throw targetError('MAS-DB-002', `Bilinmeyen argüman: ${argument}`)
  }

  if (!options.target || !(options.target in SUPABASE_TARGETS)) {
    throw targetError('MAS-DB-003', '--target dev veya --target prod zorunludur.')
  }
  if (command === 'push' && options.expectedPending === null) {
    throw targetError('MAS-DB-004', 'Push için --expect-pending zorunludur.')
  }
  if (options.evidenceOutput !== null && options.evidenceOutput.trim() === '') {
    throw targetError('MAS-DB-002', '--evidence-output boş olamaz.')
  }
  if (command === 'backup' && (options.target !== 'prod' || !options.backupDirectory?.trim())) {
    throw targetError('MAS-DB-016', 'Backup yalnız PROD için ve --backup-directory ile çalıştırılabilir.')
  }
  if (['pull', 'types'].includes(command) && options.target !== 'dev') {
    throw targetError('MAS-DB-018', `${command} yalnız açıkça seçilmiş DEV hedefinde çalıştırılabilir.`)
  }
  if (command !== 'push' && options.expectedPending !== null) {
    throw targetError('MAS-DB-002', '--expect-pending yalnız push ile kullanılabilir.')
  }
  if (command !== 'backup' && options.backupDirectory !== null) {
    throw targetError('MAS-DB-002', '--backup-directory yalnız backup ile kullanılabilir.')
  }
  if (['pull', 'types'].includes(command) && options.evidenceOutput !== null) {
    throw targetError('MAS-DB-002', '--evidence-output pull/types ile kullanılamaz.')
  }
  assertProductionConfirmation(options.target, options.confirmProd)
  return options
}

export function assertProductionConfirmation(target, confirmation) {
  if (target === 'prod' && confirmation !== SUPABASE_TARGETS.prod) {
    throw targetError('MAS-DB-005', `Tüm PROD işlemleri için --confirm-prod ${SUPABASE_TARGETS.prod} zorunludur.`)
  }
}

export function parseMigrationList(text) {
  const rows = []
  for (const rawLine of text.split(/\r?\n/)) {
    if (!rawLine.includes('|')) continue
    const [localCell = '', remoteCell = ''] = rawLine.split('|')
    const local = localCell.trim()
    const remote = remoteCell.trim()
    if (!/^\d{14}$/.test(local) && !/^\d{14}$/.test(remote)) continue
    rows.push({
      local: /^\d{14}$/.test(local) ? local : null,
      remote: /^\d{14}$/.test(remote) ? remote : null,
    })
  }
  return {
    localVersions: rows.flatMap((row) => row.local ? [row.local] : []),
    remoteVersions: rows.flatMap((row) => row.remote ? [row.remote] : []),
  }
}

function duplicate(values) {
  const seen = new Set()
  for (const value of values) {
    if (seen.has(value)) return value
    seen.add(value)
  }
  return null
}

function strictlyOrdered(values) {
  return values.every((value, index) => index === 0 || values[index - 1] < value)
}

export function verifyMigrationHistory({ manifestVersions, listedLocal, remoteVersions, expectedPending }) {
  const repeated = duplicate(listedLocal) ?? duplicate(remoteVersions)
  if (repeated) throw targetError('MAS-DB-006', `Migration geçmişinde tekrarlanan sürüm var: ${repeated}`)
  if (!strictlyOrdered(listedLocal) || !strictlyOrdered(remoteVersions)) {
    throw targetError('MAS-DB-007', 'Migration geçmişi sıralı ve append-only değil.')
  }
  if (JSON.stringify(listedLocal) !== JSON.stringify(manifestVersions)) {
    throw targetError('MAS-DB-008', 'CLI local migration listesi repo manifestiyle eşleşmiyor.')
  }
  if (!remoteVersions.every((version, index) => manifestVersions[index] === version)) {
    throw targetError('MAS-DB-009', 'Remote migration geçmişi local zincirin append-only prefix’i değil.')
  }

  const pending = manifestVersions.slice(remoteVersions.length)
  if (expectedPending !== null && JSON.stringify(pending) !== JSON.stringify(expectedPending)) {
    throw targetError(
      'MAS-DB-010',
      `Bekleyen migration listesi onaylanan listeyle eşleşmiyor. Beklenen=${expectedPending.join(',') || 'none'} Gerçek=${pending.join(',') || 'none'}`,
    )
  }
  return pending
}

export function supabaseProcessEnv(env = process.env) {
  return {
    ...env,
    // The CLI parses the local hook config for link/list/push even though these
    // commands neither deploy nor call the hook. Keep a real operator-provided
    // value when present; otherwise use a parse-only non-secret placeholder.
    SEND_SMS_HOOK_SECRETS: env.SEND_SMS_HOOK_SECRETS || CONFIG_VALIDATION_SMS_HOOK_SECRET,
  }
}

const NULLABLE_GENERATED_FUNCTION_FIELDS = Object.freeze({
  create_split_share_guarded: Object.freeze({
    p_assigned_items: 'Json',
    p_customer_id: 'string',
    p_label: 'string',
  }),
  hydrate_subscription_invoice_with_payment_identity: Object.freeze({
    p_provider_payment_id: 'string',
  }),
  read_analytics_cancellation_aggregate: Object.freeze({
    p_payment_method: 'string',
    p_source: 'string',
  }),
  read_analytics_core_metrics: Object.freeze({
    p_payment_method: 'string',
    p_source: 'string',
    p_status: 'string',
  }),
  read_analytics_payment_aggregate: Object.freeze({
    p_payment_method: 'string',
    p_source: 'string',
    p_status: 'string',
  }),
  read_analytics_staff_settlement_aggregate: Object.freeze({
    p_payment_method: 'string',
    p_source: 'string',
    p_status: 'string',
  }),
  read_analytics_table_performance: Object.freeze({
    p_payment_method: 'string',
    p_source: 'string',
    p_status: 'string',
  }),
  read_public_restaurant_by_slug: Object.freeze({
    logo_url: 'string',
  }),
})

function generatedContractRange(source, functionName) {
  const marker = `      ${functionName}: {`
  const start = source.indexOf(marker)
  if (start === -1) {
    throw targetError('MAS-DB-020', `Generated type sözleşmesi bulunamadı: ${functionName}`)
  }
  const nextContract = source.slice(start + marker.length).search(/\n {6}[a-z0-9_]+: \{/)
  return {
    start,
    end: nextContract === -1 ? source.length : start + marker.length + nextContract,
  }
}

export function normalizeGeneratedTypes(source) {
  let normalized = source
  for (const [functionName, fields] of Object.entries(NULLABLE_GENERATED_FUNCTION_FIELDS)) {
    const { start, end } = generatedContractRange(normalized, functionName)
    let contract = normalized.slice(start, end)
    for (const [field, baseType] of Object.entries(fields)) {
      const raw = `${field}: ${baseType}`
      const nullable = `${raw} | null`
      const rawCount = contract.split(raw).length - 1
      const nullableCount = contract.split(nullable).length - 1
      if (nullableCount === 0 && rawCount !== 1) {
        throw targetError(
          'MAS-DB-020',
          `Generated type nullable alanı tekil değil: ${functionName}.${field}`,
        )
      }
      if (nullableCount > 1) {
        throw targetError(
          'MAS-DB-020',
          `Generated type nullable alanı tekrarlı: ${functionName}.${field}`,
        )
      }
      if (nullableCount === 0) contract = contract.replace(raw, nullable)
    }
    normalized = `${normalized.slice(0, start)}${contract}${normalized.slice(end)}`
  }
  return normalized
}

function localMigrationVersions() {
  return readdirSync(MIGRATIONS_ROOT)
    .filter((name) => /^\d{14}_.+\.sql$/.test(name))
    .sort()
    .map((name) => name.slice(0, 14))
}

function runSupabaseCaptured(args, label) {
  const result = spawnSync('supabase', args, {
    cwd: PACKAGE_ROOT,
    encoding: 'utf8',
    env: supabaseProcessEnv(),
  })
  if (result.status !== 0) {
    const detail = [result.stdout, result.stderr].filter(Boolean).join('\n').trim()
    if (detail) console.error(detail)
    throw targetError('MAS-DB-011', `Supabase ${label} adımı başarısız oldu.`)
  }
  return { stdout: result.stdout ?? '', stderr: result.stderr ?? '' }
}

function runSupabase(args, label) {
  const result = runSupabaseCaptured(args, label)
  return [result.stdout, result.stderr].filter(Boolean).join('\n')
}

function verifyLinkedTarget(expectedProjectRef) {
  let linkedProjectRef
  try {
    linkedProjectRef = readFileSync(LINKED_PROJECT_FILE, 'utf8').trim()
  } catch {
    throw targetError('MAS-DB-012', 'Supabase linked project-ref dosyası okunamadı.')
  }
  if (linkedProjectRef !== expectedProjectRef) {
    throw targetError('MAS-DB-013', `Linked project hedefi uyuşmuyor. Beklenen=${expectedProjectRef} Gerçek=${linkedProjectRef || 'missing'}`)
  }
}

function migrationState(expectedPending, expectedProjectRef) {
  verifyLinkedTarget(expectedProjectRef)
  const output = runSupabase(['migration', 'list'], 'migration-list')
  const parsed = parseMigrationList(output)
  const pending = verifyMigrationHistory({
    manifestVersions: localMigrationVersions(),
    listedLocal: parsed.localVersions,
    remoteVersions: parsed.remoteVersions,
    expectedPending,
  })
  return { output, pending }
}

export function formatMigrationEvidence({ projectRef, capturedAt, migrationList }) {
  return [
    `# masabu-project-ref: ${projectRef}`,
    `# masabu-captured-at: ${capturedAt}`,
    migrationList.trimEnd(),
    '',
  ].join('\n')
}

function writeMigrationEvidence(outputPath, projectRef, migrationList) {
  const resolvedPath = resolve(PACKAGE_ROOT, outputPath)
  const temporaryPath = `${resolvedPath}.tmp-${process.pid}`
  const contents = formatMigrationEvidence({
    projectRef,
    capturedAt: new Date().toISOString(),
    migrationList,
  })
  writeFileSync(temporaryPath, contents, { mode: 0o600 })
  renameSync(temporaryPath, resolvedPath)
  chmodSync(resolvedPath, 0o600)
  console.log(`Migration evidence: ${resolvedPath}`)
}

function sha256File(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex')
}

function createProductionLogicalBackup(outputDirectory, projectRef) {
  const directory = resolve(PACKAGE_ROOT, outputDirectory)
  if (existsSync(directory)) {
    if (readdirSync(directory).length !== 0) {
      throw targetError('MAS-DB-017', `Backup dizini boş olmalı: ${directory}`)
    }
    chmodSync(directory, 0o700)
  } else {
    mkdirSync(directory, { mode: 0o700 })
  }

  const files = [
    { name: 'schema.sql', args: ['db', 'dump', '--linked', '--schema', 'public'] },
    { name: 'roles.sql', args: ['db', 'dump', '--linked', '--role-only'] },
    { name: 'data.sql', args: ['db', 'dump', '--linked', '--data-only', '--use-copy', '--schema', 'public'] },
  ]
  for (const file of files) {
    verifyLinkedTarget(projectRef)
    const path = resolve(directory, file.name)
    runSupabase([...file.args, '--file', path], `backup-${file.name}`)
    chmodSync(path, 0o600)
  }

  const manifestPath = resolve(directory, 'manifest.json')
  const manifest = {
    schemaVersion: 1,
    projectRef,
    capturedAt: new Date().toISOString(),
    scope: 'public-schema-roles-and-data',
    files: files.map(({ name }) => {
      const path = resolve(directory, name)
      return { name, bytes: statSync(path).size, sha256: sha256File(path) }
    }),
  }
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600 })
  chmodSync(manifestPath, 0o600)
  console.log(`Logical backup: ${directory}`)
}

function writeDevTypes(projectRef) {
  const result = runSupabaseCaptured(
    ['gen', 'types', 'typescript', '--project-id', projectRef, '--schema', 'public'],
    'types',
  )
  if (result.stderr.trim()) console.error(result.stderr.trim())
  if (!result.stdout.includes('export type Database =')) {
    throw targetError('MAS-DB-019', 'Supabase types çıktısı beklenen Database sözleşmesini içermiyor.')
  }
  const normalizedTypes = normalizeGeneratedTypes(result.stdout)

  const temporaryPath = `${GENERATED_TYPES_FILE}.tmp-${process.pid}`
  writeFileSync(temporaryPath, normalizedTypes, { mode: 0o644 })
  renameSync(temporaryPath, GENERATED_TYPES_FILE)
  chmodSync(GENERATED_TYPES_FILE, 0o644)
  console.log(`Generated DEV database types: ${GENERATED_TYPES_FILE}`)
}

function restoreSafeDefaultTarget() {
  let currentProjectRef = null
  try {
    currentProjectRef = readFileSync(LINKED_PROJECT_FILE, 'utf8').trim()
  } catch {
    // A missing or incomplete link is repaired to DEV below.
  }
  if (currentProjectRef === SUPABASE_TARGETS.dev) return
  runSupabase(['link', '--project-ref', SUPABASE_TARGETS.dev, '--yes'], 'safe-default-link')
  verifyLinkedTarget(SUPABASE_TARGETS.dev)
  console.log(`Supabase link restored to dev (${SUPABASE_TARGETS.dev})`)
}

export function runCli(argv = process.argv.slice(2)) {
  let options = null
  let releaseLock = null
  let exitCode = 0
  try {
    options = parseArguments(argv)
    releaseLock = acquireTargetLock()
    const projectRef = SUPABASE_TARGETS[options.target]

    runSupabase(['link', '--project-ref', projectRef, '--yes'], 'link')
    verifyLinkedTarget(projectRef)

    const expectedPending = options.command === 'push'
      ? options.expectedPending
      : ['pull', 'types'].includes(options.command)
        ? []
        : null
    const before = migrationState(expectedPending, projectRef)
    console.log(`Masabu Supabase target: ${options.target} (${projectRef})`)
    console.log(`Pending migrations: ${before.pending.join(', ') || 'none'}`)
    if (options.command === 'status') {
      if (options.evidenceOutput) writeMigrationEvidence(options.evidenceOutput, projectRef, before.output)
    } else if (options.command === 'backup') {
      createProductionLogicalBackup(options.backupDirectory, projectRef)
      if (options.evidenceOutput) writeMigrationEvidence(options.evidenceOutput, projectRef, before.output)
    } else if (options.command === 'pull') {
      const output = runSupabase(['db', 'pull', '--linked', '--yes'], 'pull')
      if (output.trim()) console.log(output.trim())
      verifyLinkedTarget(projectRef)
      migrationState([], projectRef)
      console.log('DEV schema pull: PASS')
    } else if (options.command === 'types') {
      writeDevTypes(projectRef)
    } else {
      verifyLinkedTarget(projectRef)
      const dryRun = runSupabase(['db', 'push', '--linked', '--dry-run'], 'push-dry-run')
      if (dryRun.trim()) console.log(dryRun.trim())
      verifyLinkedTarget(projectRef)
      runSupabase(['db', 'push', '--linked', '--yes'], 'push')

      verifyLinkedTarget(projectRef)
      const after = migrationState([], projectRef)
      if (after.pending.length !== 0) throw targetError('MAS-DB-014', 'Push sonrasında bekleyen migration kaldı.')
      if (options.evidenceOutput) writeMigrationEvidence(options.evidenceOutput, projectRef, after.output)
      console.log('Migration push and post-check: PASS')
    }
  } catch (error) {
    const code = error?.code ?? 'MAS-DB-000'
    const message = error instanceof Error ? error.message : 'Bilinmeyen migration hedefleme hatası.'
    console.error(`${code}: ${message}`)
    exitCode = 1
  }

  if (options && releaseLock) {
    try {
      restoreSafeDefaultTarget()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Bilinmeyen güvenli hedef geri yükleme hatası.'
      console.error(`MAS-DB-015: DEV Supabase link geri yüklenemedi. ${message}`)
      exitCode = 1
    }
  }
  if (releaseLock) {
    try {
      releaseLock()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Bilinmeyen target kilidi hatası.'
      console.error(`MAS-DB-021: ${message}`)
      exitCode = 1
    }
  }
  return exitCode
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  process.exitCode = runCli()
}
