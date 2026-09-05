import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import {
  SUPABASE_TARGETS,
  acquireTargetLock,
  formatMigrationEvidence,
  normalizeGeneratedTypes,
  parseArguments,
  parseMigrationList,
  supabaseProcessEnv,
  verifyMigrationHistory,
} from './supabase-target.mjs'

function generatedFunctionContract(source, functionName) {
  const marker = `      ${functionName}: {`
  const start = source.indexOf(marker)
  assert.notEqual(start, -1, `missing generated contract: ${functionName}`)
  const next = source.slice(start + marker.length).search(/\n {6}[a-z0-9_]+: \{/)
  return source.slice(start, next === -1 ? source.length : start + marker.length + next)
}

test('target is mandatory and only known targets are accepted', () => {
  assert.throws(() => parseArguments(['status']), { code: 'MAS-DB-003' })
  assert.throws(() => parseArguments(['status', '--target', 'staging']), { code: 'MAS-DB-003' })
  assert.equal(parseArguments(['status', '--target', 'dev']).target, 'dev')
})

test('target lock serializes linked operations and never replaces a stale-looking owner', (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'masabu-target-lock-test-'))
  const lockFile = join(directory, 'target.lock')
  t.after(() => rmSync(directory, { recursive: true, force: true }))

  const release = acquireTargetLock({ lockFile, pid: process.pid })
  assert.equal(existsSync(lockFile), true)
  assert.throws(() => acquireTargetLock({ lockFile, pid: process.pid }), { code: 'MAS-DB-021' })
  release()
  assert.equal(existsSync(lockFile), false)

  writeFileSync(lockFile, JSON.stringify({ schemaVersion: 1, pid: 424242, acquiredAt: '2026-09-03T00:00:00Z' }))
  assert.throws(() => acquireTargetLock({ lockFile, pid: process.pid }), { code: 'MAS-DB-021' })
  assert.equal(JSON.parse(readFileSync(lockFile, 'utf8')).pid, 424242)
})

test('schema pull and generated types are DEV-only and require a synchronized migration history', () => {
  assert.equal(parseArguments(['pull', '--target', 'dev']).command, 'pull')
  assert.equal(parseArguments(['types', '--target', 'dev']).command, 'types')
  assert.throws(
    () => parseArguments([
      'pull',
      '--target', 'prod',
      '--confirm-prod', SUPABASE_TARGETS.prod,
    ]),
    { code: 'MAS-DB-018' },
  )
  assert.throws(
    () => parseArguments(['types', '--target', 'dev', '--expect-pending', 'none']),
    { code: 'MAS-DB-002' },
  )
  assert.throws(
    () => parseArguments(['pull', '--target', 'dev', '--evidence-output', '/tmp/pull.txt']),
    { code: 'MAS-DB-002' },
  )
})

test('push requires an exact pending migration allow-list', () => {
  assert.throws(() => parseArguments(['push', '--target', 'dev']), { code: 'MAS-DB-004' })
  assert.deepEqual(
    parseArguments(['push', '--', '--target', 'dev', '--expect-pending', '20260831040000,20260831041000']).expectedPending,
    ['20260831040000', '20260831041000'],
  )
})

test('logical backup is restricted to a confirmed production target and explicit directory', () => {
  assert.throws(
    () => parseArguments(['backup', '--target', 'dev', '--backup-directory', '/tmp/backup']),
    { code: 'MAS-DB-016' },
  )
  assert.throws(
    () => parseArguments(['backup', '--target', 'prod', '--confirm-prod', SUPABASE_TARGETS.prod]),
    { code: 'MAS-DB-016' },
  )
  assert.equal(parseArguments([
    'backup',
    '--target', 'prod',
    '--confirm-prod', SUPABASE_TARGETS.prod,
    '--backup-directory', '/tmp/backup',
  ]).backupDirectory, '/tmp/backup')
})

test('production requires the exact project-ref confirmation', () => {
  assert.throws(() => parseArguments(['status', '--target', 'prod']), { code: 'MAS-DB-005' })
  assert.throws(
    () => parseArguments(['status', '--target', 'prod', '--confirm-prod', SUPABASE_TARGETS.dev]),
    { code: 'MAS-DB-005' },
  )
  assert.equal(
    parseArguments(['status', '--target', 'prod', '--confirm-prod', SUPABASE_TARGETS.prod]).target,
    'prod',
  )
})

test('status can create an operator evidence artifact', () => {
  assert.equal(
    parseArguments(['status', '--target', 'dev', '--evidence-output', '/tmp/migrations.txt']).evidenceOutput,
    '/tmp/migrations.txt',
  )
  assert.throws(
    () => parseArguments(['status', '--target', 'dev', '--evidence-output', '']),
    { code: 'MAS-DB-002' },
  )

  const evidence = formatMigrationEvidence({
    projectRef: SUPABASE_TARGETS.prod,
    capturedAt: '2026-09-03T12:00:00.000Z',
    migrationList: ' Local | Remote | Time\n 1 | 1 | now\n',
  })
  assert.equal(evidence, [
    `# masabu-project-ref: ${SUPABASE_TARGETS.prod}`,
    '# masabu-captured-at: 2026-09-03T12:00:00.000Z',
    ' Local | Remote | Time',
    ' 1 | 1 | now',
    '',
  ].join('\n'))
})

test('CLI config validation uses a non-secret placeholder without replacing a supplied hook secret', () => {
  const fallback = supabaseProcessEnv({ PATH: '/bin' })
  assert.match(fallback.SEND_SMS_HOOK_SECRETS, /^v1,whsec_[A-Za-z0-9+/]+=*$/)
  assert.equal(Buffer.from(fallback.SEND_SMS_HOOK_SECRETS.slice('v1,whsec_'.length), 'base64').length, 32)

  const configured = supabaseProcessEnv({ SEND_SMS_HOOK_SECRETS: 'configured-value' })
  assert.equal(configured.SEND_SMS_HOOK_SECRETS, 'configured-value')
})

test('generated types retain runtime-nullable RPC inputs and public projection fields', () => {
  const generated = readFileSync(new URL('../src/types.gen.ts', import.meta.url), 'utf8')
  const normalized = normalizeGeneratedTypes(generated)
  assert.equal(generated, normalized)
  assert.equal(normalizeGeneratedTypes(normalized), normalized)
  assert.match(generatedFunctionContract(normalized, 'create_split_share_guarded'), /p_assigned_items: Json \| null/)
  assert.match(generatedFunctionContract(normalized, 'hydrate_subscription_invoice_with_payment_identity'), /p_provider_payment_id: string \| null/)
  assert.match(generatedFunctionContract(normalized, 'read_analytics_payment_aggregate'), /p_source: string \| null/)
  assert.match(generatedFunctionContract(normalized, 'read_public_restaurant_by_slug'), /logo_url: string \| null/)
  assert.doesNotMatch(generatedFunctionContract(normalized, 'attach_order_provider_payment'), /p_provider_payment_id: string \| null/)
})

test('DEV pull is non-interactive and re-verifies target plus migration parity', () => {
  const source = readFileSync(new URL('./supabase-target.mjs', import.meta.url), 'utf8')
  const pullBranch = source.slice(
    source.indexOf("options.command === 'pull'"),
    source.indexOf("options.command === 'types'"),
  )
  assert.match(pullBranch, /\['db', 'pull', '--linked', '--yes'\]/)
  assert.match(pullBranch, /verifyLinkedTarget\(projectRef\)/)
  assert.match(pullBranch, /migrationState\(\[\], projectRef\)/)
})

test('DEV type generation pins the verified project instead of relying on shared link state', () => {
  const source = readFileSync(new URL('./supabase-target.mjs', import.meta.url), 'utf8')
  const typesFunction = source.slice(
    source.indexOf('function writeDevTypes'),
    source.indexOf('function restoreSafeDefaultTarget'),
  )
  assert.match(typesFunction, /\['gen', 'types', 'typescript', '--project-id', projectRef, '--schema', 'public'\]/)
  assert.doesNotMatch(typesFunction, /--linked/)
})

test('migration list parser separates local and remote versions', () => {
  const parsed = parseMigrationList(`
    Local          | Remote         | Time (UTC)
    20260831030000 | 20260831030000 | 2026-08-31
    20260831040000 |                |
  `)
  assert.deepEqual(parsed.localVersions, ['20260831030000', '20260831040000'])
  assert.deepEqual(parsed.remoteVersions, ['20260831030000'])
})

test('history verification rejects drift and unexpected pending migrations', () => {
  const input = {
    manifestVersions: ['20260831030000', '20260831040000', '20260831041000'],
    listedLocal: ['20260831030000', '20260831040000', '20260831041000'],
  }
  assert.deepEqual(verifyMigrationHistory({
    ...input,
    remoteVersions: ['20260831030000'],
    expectedPending: ['20260831040000', '20260831041000'],
  }), ['20260831040000', '20260831041000'])
  assert.throws(() => verifyMigrationHistory({
    ...input,
    remoteVersions: ['20260831030000'],
    expectedPending: ['20260831040000'],
  }), { code: 'MAS-DB-010' })
  assert.throws(() => verifyMigrationHistory({
    ...input,
    remoteVersions: ['20260831030000', '20260831039999'],
    expectedPending: null,
  }), { code: 'MAS-DB-009' })
})
