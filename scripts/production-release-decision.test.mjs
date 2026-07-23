import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { buildReleaseEvidence } from './release-evidence.mjs'
import { buildReleaseRehearsal } from './release-rehearsal.mjs'
import { createMigrationManifest, parseMigrationListEvidence } from './migration-release.mjs'
import { loadTopologySpec } from './deployment-topology.mjs'
import { buildRuntimeManifest, loadRuntimeSpec } from './runtime-deployment.mjs'
import { buildSmokeManifest, loadSmokeSpec } from './business-smoke.mjs'
import { evaluateReleaseDecision, loadReleasePolicy, runCli, validateReleasePolicy } from './production-release-decision.mjs'

const ROOT = new URL('..', import.meta.url).pathname
const PROD_REF = 'svxvloeosiksqfadgkvo'
const NOW = new Date('2026-07-23T12:30:00.000Z')
const SECRET = 'x'.repeat(32)

function validEnvByScope() {
  const supabase = `https://${PROD_REF}.supabase.co`
  return {
    dashboard: {
      NEXT_PUBLIC_SUPABASE_URL: supabase,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: `anon-${SECRET}`,
      SUPABASE_SERVICE_ROLE_KEY: `service-${SECRET}`,
      NEXT_PUBLIC_APP_URL: 'https://app.masabu.co',
      NEXT_PUBLIC_MENU_URL: 'https://menu.masabu.co',
      NEXT_PUBLIC_MENU_BASE_URL: 'https://menu.masabu.co',
      KITCHEN_URL: 'https://kitchen.masabu.co',
      NEXT_PUBLIC_KITCHEN_URL: 'https://kitchen.masabu.co',
      OUTBOX_WORKER_SECRET: `worker-${SECRET}`,
      RESEND_API_KEY: `resend-${SECRET}`,
      RESEND_FROM_EMAIL: 'Masabu <noreply@masabu.co>',
      RESEND_STANDS_TO_EMAIL: 'stands@masabu.co',
    },
    menu: {
      NEXT_PUBLIC_SUPABASE_URL: supabase,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: `anon-${SECRET}`,
      SUPABASE_SERVICE_ROLE_KEY: `service-${SECRET}`,
      NEXT_PUBLIC_APP_URL: 'https://menu.masabu.co',
      NEXT_PUBLIC_MENU_URL: 'https://menu.masabu.co',
      OUTBOX_WORKER_SECRET: `worker-${SECRET}`,
    },
    kitchen: {
      NEXT_PUBLIC_SUPABASE_URL: supabase,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: `anon-${SECRET}`,
      SUPABASE_SERVICE_ROLE_KEY: `service-${SECRET}`,
    },
    marketing: { NEXT_PUBLIC_DASHBOARD_URL: 'https://app.masabu.co' },
    'platform-admin': {
      NEXT_PUBLIC_SUPABASE_URL: supabase,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: `anon-${SECRET}`,
      SUPABASE_SERVICE_ROLE_KEY: `service-${SECRET}`,
    },
    'outbox-worker': {
      SUPABASE_URL: supabase,
      SUPABASE_SERVICE_ROLE_KEY: `service-${SECRET}`,
      OUTBOX_WORKER_SECRET: `worker-${SECRET}`,
      OUTBOX_CONSUMER_URL: 'https://app.masabu.co/api/internal/outbox',
      OUTBOX_INBOX_CONSUMER_URL: 'https://app.masabu.co/api/internal/inbox',
      OUTBOX_EMAIL_CONSUMER_URL: 'https://app.masabu.co/api/internal/notification-email',
      PAYMENT_RECONCILIATION_URL: 'https://menu.masabu.co/api/internal/payment-reconciliation',
      BILLING_MAINTENANCE_URL: 'https://app.masabu.co/api/internal/billing-maintenance',
      OUTBOX_PUSH_CONSUMER_URL: 'https://app.masabu.co/api/internal/push',
    },
    'send-email-hook': {
      SEND_EMAIL_HOOK_SECRET: `hook-${SECRET}`,
      RESEND_API_KEY: `resend-${SECRET}`,
    },
  }
}

function runtimeEvidence(manifest) {
  return {
    schemaVersion: 1,
    projectRef: PROD_REF,
    capturedAt: '2026-07-23T12:15:00.000Z',
    capabilities: manifest.capabilities,
    edgeFunctions: manifest.edgeFunctions.map((item) => ({
      name: item.name,
      active: true,
      verifyJwt: item.verifyJwt,
      url: item.url,
      configuredSecretNames: item.requiredSecretNames,
    })),
    authHooks: manifest.authHooks.map((item) => ({ name: item.name, enabled: item.enabled, url: item.url })),
    vaultSecrets: manifest.vaultSecrets.map((item) => ({ name: item.name, configured: true, ...(item.expectedUrl ? { url: item.expectedUrl } : {}) })),
    cronJobs: manifest.cronJobs.map((item) => ({ name: item.name, active: true, schedule: item.schedule, command: item.command })),
    probes: manifest.postDeployProbes.map((item) => ({ name: item.name, status: item.expectedStatus })),
  }
}

function smokeEvidence(manifest, release) {
  return {
    schemaVersion: 1,
    environment: 'production',
    projectRef: PROD_REF,
    capturedAt: '2026-07-23T12:20:00.000Z',
    commitSha: release.commitSha,
    releaseArtifactSha256: release.artifactSha256,
    runtimeArtifactSha256: release.runtime.sha256,
    smokeArtifactSha256: manifest.artifactSha256,
    enabledCapabilities: { core: true, 'order-card-payments': false, 'saas-billing': false },
    checks: manifest.checks.map((check) => check.capability === 'core'
      ? {
          name: check.name,
          status: 'passed',
          durationMs: 100,
          assertions: Object.fromEntries(check.assertions.map((name) => [name, true])),
        }
      : { name: check.name, status: 'deferred', durationMs: 0, assertions: {}, reasonCode: 'CAPABILITY_DISABLED' }),
  }
}

function migrationText(manifest) {
  const rows = manifest.migrations.map((item) => ` ${item.version} | ${item.version} |`).join('\n')
  return `# masabu-project-ref: ${PROD_REF}\n# masabu-captured-at: 2026-07-23T12:10:00.000Z\n${rows}\n`
}

function fixture() {
  const { policy, sha256: policySha256 } = loadReleasePolicy(ROOT)
  const migrationManifest = createMigrationManifest(ROOT)
  const { spec: topologySpec, sha256: topologySha256 } = loadTopologySpec(ROOT)
  const { spec: runtimeSpec, sha256: runtimeSpecSha256 } = loadRuntimeSpec(ROOT)
  const runtimeManifest = buildRuntimeManifest({ spec: runtimeSpec, specSha256: runtimeSpecSha256, projectRef: PROD_REF, root: ROOT })
  const { spec: smokeSpec, sha256: smokeSpecSha256 } = loadSmokeSpec(ROOT)
  const smokeManifest = buildSmokeManifest({ spec: smokeSpec, specSha256: smokeSpecSha256, topologySpec, topologySha256, projectRef: PROD_REF, root: ROOT })
  const releaseEvidence = buildReleaseEvidence({
    projectRef: PROD_REF,
    commitSha: 'a'.repeat(40),
    packageManager: 'pnpm@9.15.4',
    lockfileContents: readFileSync(join(ROOT, 'pnpm-lock.yaml')),
    migrationManifest,
    topologySpec,
    topologySha256,
    runtimeManifest,
    smokeManifest,
  })
  const rehearsal = buildReleaseRehearsal({ projectRef: PROD_REF, releaseEvidence, runtimeManifest, runtimeSpec, smokeManifest })
  const attestation = {
    schemaVersion: 1,
    environment: 'production',
    projectRef: PROD_REF,
    capturedAt: '2026-07-23T12:25:00.000Z',
    commitSha: releaseEvidence.commitSha,
    releaseArtifactSha256: releaseEvidence.artifactSha256,
    rehearsalArtifactSha256: rehearsal.artifactSha256,
    enabledCapabilities: { 'order-card-payments': false, 'saas-billing': false, 'web-push': false, sms: false },
    approvals: Object.fromEntries(policy.requiredApprovals.map((name) => [name, true])),
  }
  return {
    projectRef: PROD_REF,
    policy,
    policySha256,
    releaseEvidence,
    rehearsal,
    envByScope: validEnvByScope(),
    migrationEvidence: parseMigrationListEvidence(migrationText(migrationManifest)),
    runtimeEvidence: runtimeEvidence(runtimeManifest),
    smokeEvidence: smokeEvidence(smokeManifest, releaseEvidence),
    attestation,
    attestationRaw: `${JSON.stringify(attestation, null, 2)}\n`,
    now: NOW,
    root: ROOT,
  }
}

test('release policy is closed, internally consistent and source controlled', () => {
  const { policy } = fixture()
  assert.deepEqual(validateReleasePolicy(policy), { ok: true, errors: [] })
  assert.equal(policy.requiredScopes.length, 7)
  assert.equal(policy.requiredApprovals.length, 6)
})

test('release policy rejects missing warning modes and unknown smoke capability bindings', () => {
  const { policy } = fixture()
  delete policy.allowedWarningCodes['post-deploy']
  policy.smokeCapabilityBindings['unknown-capability'] = 'unknown-smoke'
  const result = validateReleasePolicy(policy)
  assert.equal(result.ok, false)
  assert.ok(result.errors.every((item) => item.code === 'MAS-DEP-029'))
  assert.ok(result.errors.some((item) => item.subject === 'allowedWarningCodes'))
  assert.ok(result.errors.some((item) => item.subject === 'unknown-capability'))
})

test('complete pre-deploy evidence produces go-to-deploy without claiming a deployment', () => {
  const result = evaluateReleaseDecision({ ...fixture(), mode: 'pre-deploy' })
  assert.equal(result.decision, 'go-to-deploy')
  assert.equal(result.productionMutationPerformed, false)
  assert.ok(Object.values(result.gates).every(Boolean))
  assert.ok(result.warningCodes.every((code) => ['MAS-DEP-W01', 'MAS-DEP-W02'].includes(code)))
})

test('complete post-deploy evidence produces release-accepted', () => {
  const result = evaluateReleaseDecision({ ...fixture(), mode: 'post-deploy' })
  assert.equal(result.decision, 'release-accepted')
  assert.deepEqual(result.errors, [])
})

test('tampered release and rehearsal artifacts fail closed', () => {
  const input = fixture()
  input.releaseEvidence.commitSha = 'b'.repeat(40)
  input.rehearsal.productionMutationPerformed = true
  const result = evaluateReleaseDecision({ ...input, mode: 'post-deploy' })
  assert.equal(result.decision, 'no-go')
  assert.ok(result.errors.some((item) => item.code === 'MAS-DEP-029'))
})

test('missing scope and cross-app topology drift produce no-go without exposing values', () => {
  const input = fixture()
  delete input.envByScope['send-email-hook']
  input.envByScope.menu.NEXT_PUBLIC_SUPABASE_URL = 'https://wrong.supabase.co'
  const result = evaluateReleaseDecision({ ...input, mode: 'post-deploy' })
  assert.equal(result.decision, 'no-go')
  assert.ok(result.errors.some((item) => item.code === 'MAS-DEP-001'))
  assert.ok(result.errors.some((item) => item.code === 'MAS-DEP-013'))
  assert.doesNotMatch(JSON.stringify(result), /service-x{10}|anon-x{10}|worker-x{10}/)
})

test('post-deploy migration, runtime and smoke failures cannot be accepted', () => {
  const input = fixture()
  input.migrationEvidence.remoteVersions.pop()
  input.runtimeEvidence.edgeFunctions[0].active = false
  input.smokeEvidence.checks.find((item) => item.status === 'passed').status = 'failed'
  const result = evaluateReleaseDecision({ ...input, mode: 'post-deploy' })
  assert.equal(result.decision, 'no-go')
  assert.ok(result.errors.some((item) => item.code === 'MAS-DEP-009'))
  assert.ok(result.errors.some((item) => item.code === 'MAS-DEP-020'))
  assert.ok(result.errors.some((item) => item.code === 'MAS-DEP-026'))
})

test('stale, incomplete or expanded operator attestation fails closed', () => {
  const input = fixture()
  input.attestation.capturedAt = '2026-07-23T10:00:00.000Z'
  input.attestation.approvals.changeWindowApproved = false
  input.attestation.operatorEmail = 'must-not-be-collected@example.com'
  input.attestationRaw = JSON.stringify(input.attestation)
  const result = evaluateReleaseDecision({ ...input, mode: 'post-deploy' })
  assert.equal(result.decision, 'no-go')
  assert.ok(result.errors.some((item) => item.code === 'MAS-DEP-031'))
  assert.doesNotMatch(JSON.stringify(result), /must-not-be-collected/)
})

test('operator and smoke capability states must agree', () => {
  const input = fixture()
  input.attestation.enabledCapabilities['order-card-payments'] = true
  input.attestationRaw = JSON.stringify(input.attestation)
  const result = evaluateReleaseDecision({ ...input, mode: 'post-deploy' })
  assert.equal(result.decision, 'no-go')
  assert.ok(result.errors.some((item) => item.code === 'MAS-DEP-030' && item.subject === 'capability:order-card-payments'))
})

test('decision artifact is deterministic for the same bound evidence', () => {
  const input = fixture()
  const first = evaluateReleaseDecision({ ...input, mode: 'post-deploy' })
  const second = evaluateReleaseDecision({ ...input, mode: 'post-deploy' })
  assert.deepEqual(first, second)
  assert.match(first.artifactSha256, /^[a-f0-9]{64}$/)
})

test('CLI writes a safe 0600 post-deploy decision artifact', () => {
  const directory = mkdtempSync(join(tmpdir(), 'masabu-release-decision-'))
  const input = fixture()
  try {
    const paths = {}
    const writeJson = (name, value) => {
      const path = join(directory, `${name}.json`)
      writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`)
      paths[name] = path
    }
    writeJson('release', input.releaseEvidence)
    writeJson('rehearsal', input.rehearsal)
    writeJson('runtime', input.runtimeEvidence)
    writeJson('smoke', input.smokeEvidence)
    writeJson('attestation', input.attestation)
    paths.migrations = join(directory, 'migrations.txt')
    writeFileSync(paths.migrations, migrationText(createMigrationManifest(ROOT)))
    const args = [
      '--mode', 'post-deploy', '--project-ref', PROD_REF,
      '--release-evidence', paths.release, '--rehearsal', paths.rehearsal,
      '--migration-evidence', paths.migrations, '--runtime-evidence', paths.runtime,
      '--smoke-evidence', paths.smoke, '--attestation', paths.attestation,
    ]
    for (const [scope, env] of Object.entries(input.envByScope)) {
      const path = join(directory, `${scope}.env`)
      writeFileSync(path, Object.entries(env).map(([key, value]) => `${key}=${value}`).join('\n'))
      args.push('--env', `${scope}=${path}`)
    }
    const output = join(directory, 'decision.json')
    args.push('--output', output)
    assert.equal(runCli(args, ROOT), 0)
    assert.equal(JSON.parse(readFileSync(output, 'utf8')).decision, 'release-accepted')
    assert.equal(statSync(output).mode & 0o777, 0o600)
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})
