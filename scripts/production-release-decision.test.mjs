import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
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
import { buildBackupRestoreEvidenceTemplate } from './production-release-handoff.mjs'
import { buildReleaseCandidateEvidenceTemplate } from './production-release-candidate.mjs'
import {
  RELEASE_EXECUTION_STEPS,
  buildExecutionVerification,
  buildReleaseExecutionPlan,
  buildReleaseExecutionReceipt,
  evaluateExecutionReceipts,
} from './production-release-execution.mjs'

const ROOT = new URL('..', import.meta.url).pathname
const PROD_REF = 'svxvloeosiksqfadgkvo'
const NOW = new Date('2026-07-23T12:30:00.000Z')
const SECRET = 'x'.repeat(32)
const sha256 = (value) => createHash('sha256').update(value).digest('hex')

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
      KITCHEN_URL: 'https://kds.masabu.co',
      NEXT_PUBLIC_KITCHEN_URL: 'https://kds.masabu.co',
      OUTBOX_WORKER_SECRET: `worker-${SECRET}`,
      RESEND_API_KEY: `resend-${SECRET}`,
      RESEND_FROM_EMAIL: 'Masabu <noreply@masabu.co>',
      RESEND_STANDS_TO_EMAIL: 'stands@masabu.co',
      SAAS_BILLING_ENABLED: 'false',
      SAAS_BILLING_SALES_ENABLED: 'false',
      ACCOUNTING_DISPATCH_ENABLED: 'false',
      ACCOUNTING_WORKER_URL: 'https://app.masabu.co/api/internal/accounting-invoices',
    },
    menu: {
      NEXT_PUBLIC_SUPABASE_URL: supabase,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: `anon-${SECRET}`,
      SUPABASE_SERVICE_ROLE_KEY: `service-${SECRET}`,
      NEXT_PUBLIC_APP_URL: 'https://menu.masabu.co',
      NEXT_PUBLIC_MENU_URL: 'https://menu.masabu.co',
      OUTBOX_WORKER_SECRET: `worker-${SECRET}`,
      CUSTOMER_AUTH_PHONE_OTP_ENABLED: 'false',
    },
    kitchen: {
      NEXT_PUBLIC_SUPABASE_URL: supabase,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: `anon-${SECRET}`,
      SUPABASE_SERVICE_ROLE_KEY: `service-${SECRET}`,
    },
    marketing: {
      NEXT_PUBLIC_SUPABASE_URL: supabase,
      SUPABASE_SERVICE_ROLE_KEY: `service-${SECRET}`,
      NEXT_PUBLIC_DASHBOARD_URL: 'https://app.masabu.co',
      NEXT_PUBLIC_SITE_URL: 'https://masabu.co',
    },
    'platform-admin': {
      NEXT_PUBLIC_SUPABASE_URL: supabase,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: `anon-${SECRET}`,
      SUPABASE_SERVICE_ROLE_KEY: `service-${SECRET}`,
      NEXT_PUBLIC_ADMIN_URL: 'https://admin.masabu.co',
      SAAS_BILLING_FINANCIAL_OPS_ENABLED: 'false',
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
    'send-sms-hook': {
      SEND_SMS_HOOK_SECRETS: `v1,whsec_${SECRET}`,
      NETGSM_USERCODE: '8500000000',
      NETGSM_PASSWORD: `netgsm-${SECRET}`,
      NETGSM_MSGHEADER: 'MASABU',
    },
  }
}

function runtimeEvidence(manifest) {
  const enabledCapabilities = Object.fromEntries(manifest.runtimeCapabilities.map((name) => [name, false]))
  const required = (item) => !item.capability || enabledCapabilities[item.capability]
  return {
    schemaVersion: 1,
    projectRef: PROD_REF,
    capturedAt: '2026-07-23T12:15:00.000Z',
    enabledCapabilities,
    capabilities: manifest.capabilities,
    edgeFunctions: manifest.edgeFunctions.filter(required).map((item) => ({
      name: item.name,
      active: true,
      verifyJwt: item.verifyJwt,
      url: item.url,
      configuredSecretNames: item.requiredSecretNames,
    })),
    authHooks: manifest.authHooks.filter(required).map((item) => ({ name: item.name, enabled: item.enabled, url: item.url })),
    vaultSecrets: manifest.vaultSecrets.filter(required).map((item) => ({ name: item.name, configured: true, ...(item.expectedUrl ? { url: item.expectedUrl } : {}) })),
    cronJobs: manifest.cronJobs.filter(required).map((item) => ({ name: item.name, active: true, schedule: item.schedule, command: item.command })),
    probes: manifest.postDeployProbes.filter(required).map((item) => ({ name: item.name, status: item.expectedStatus })),
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
    enabledCapabilities: {
      core: true,
      'order-card-payments': false,
      'saas-billing': false,
      'subscription-refunds': false,
      accounting: false,
      'customer-phone-auth': false,
    },
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
  const backupRestoreEvidence = buildBackupRestoreEvidenceTemplate({ projectRef: PROD_REF, releaseEvidence, rehearsal })
  backupRestoreEvidence.status = 'passed'
  backupRestoreEvidence.capturedAt = '2026-07-23T12:22:00.000Z'
  for (const group of ['backup', 'restoreDrill', 'rollbackReadiness']) {
    for (const key of Object.keys(backupRestoreEvidence[group])) backupRestoreEvidence[group][key] = true
  }
  const backupRestoreEvidenceRaw = `${JSON.stringify(backupRestoreEvidence, null, 2)}\n`
  const bundleContents = {
    schemaVersion: 1,
    kind: 'masabu-production-release-bundle',
    projectRef: PROD_REF,
    commitSha: releaseEvidence.commitSha,
    releaseArtifactSha256: releaseEvidence.artifactSha256,
    rehearsalArtifactSha256: rehearsal.artifactSha256,
    policySha256,
    productionMutationPerformed: false,
    artifacts: [
      'migration-manifest.json', 'release-evidence.json', 'release-rehearsal.json',
      'runtime-manifest.json', 'smoke-manifest.json',
      'backup-restore-evidence.template.json', 'release-attestation.template.json',
    ].map((name, index) => ({ name, sha256: String(index + 1).repeat(64), bytes: index + 1 })),
    requiredOperatorEvidence: [
      'prod-migration-list.txt', 'prod-runtime-evidence.json', 'prod-smoke-evidence.json',
      'prod-backup-restore-evidence.json', 'prod-release-candidate-evidence.json',
      'prod-release-execution-evidence.json',
      'prod-release-attestation.json',
    ],
    conditionalOperatorEvidence: ['prod-release-recovery-evidence.json'],
  }
  const bundleManifest = { ...bundleContents, artifactSha256: sha256(JSON.stringify(bundleContents)) }
  const releaseCandidateEvidence = buildReleaseCandidateEvidenceTemplate({
    projectRef: PROD_REF,
    releaseEvidence,
    rehearsal,
    bundleManifest,
  })
  releaseCandidateEvidence.status = 'frozen'
  releaseCandidateEvidence.capturedAt = '2026-07-23T12:23:00.000Z'
  for (const key of Object.keys(releaseCandidateEvidence.freeze)) releaseCandidateEvidence.freeze[key] = true
  const artifactSeeds = ['b', 'c', 'd', 'e', 'f', '0', '1']
  let artifactIndex = 0
  for (const group of Object.values(releaseCandidateEvidence.rollbackArtifacts)) {
    for (const artifact of Object.values(group)) {
      const seed = artifactSeeds[artifactIndex++]
      artifact.sourceCommitSha = seed.repeat(40)
      artifact.artifactSha256 = seed.repeat(64)
      artifact.available = true
      artifact.restoreProcedureVerified = true
    }
  }
  const releaseCandidateEvidenceRaw = `${JSON.stringify(releaseCandidateEvidence, null, 2)}\n`
  const attestation = {
    schemaVersion: 1,
    environment: 'production',
    projectRef: PROD_REF,
    capturedAt: '2026-07-23T12:25:00.000Z',
    commitSha: releaseEvidence.commitSha,
    releaseArtifactSha256: releaseEvidence.artifactSha256,
    rehearsalArtifactSha256: rehearsal.artifactSha256,
    backupRestoreEvidenceSha256: sha256(backupRestoreEvidenceRaw),
    releaseCandidateEvidenceSha256: sha256(releaseCandidateEvidenceRaw),
    releaseExecutionEvidenceSha256: null,
    enabledCapabilities: {
      'order-card-payments': false,
      'saas-billing': false,
      'subscription-refunds': false,
      accounting: false,
      'customer-phone-auth': false,
      'web-push': false,
      sms: false,
    },
    approvals: Object.fromEntries(policy.requiredApprovals.map((name) => [name, true])),
  }
  const base = {
    projectRef: PROD_REF,
    policy,
    policySha256,
    releaseEvidence,
    rehearsal,
    envByScope: validEnvByScope(),
    migrationEvidence: parseMigrationListEvidence(migrationText(migrationManifest)),
    runtimeEvidence: runtimeEvidence(runtimeManifest),
    smokeEvidence: smokeEvidence(smokeManifest, releaseEvidence),
    backupRestoreEvidence,
    backupRestoreEvidenceRaw,
    bundleManifest,
    releaseCandidateEvidence,
    releaseCandidateEvidenceRaw,
    attestation,
    attestationRaw: `${JSON.stringify(attestation, null, 2)}\n`,
    now: NOW,
    root: ROOT,
  }
  const preDeployDecision = evaluateReleaseDecision({ ...base, mode: 'pre-deploy' })
  assert.equal(
    preDeployDecision.decision,
    'go-to-deploy',
    JSON.stringify(preDeployDecision.errors, null, 2),
  )
  const executionPlan = buildReleaseExecutionPlan({
    projectRef: PROD_REF,
    bundleManifest,
    preDeployDecision,
    now: new Date('2026-07-23T12:25:30.000Z'),
  })
  const executionReceipts = []
  for (const [index, step] of RELEASE_EXECUTION_STEPS.entries()) {
    const evaluation = evaluateExecutionReceipts({ plan: executionPlan, receipts: executionReceipts, now: NOW })
    executionReceipts.push(buildReleaseExecutionReceipt({
      plan: executionPlan,
      sequence: index + 1,
      step,
      attempt: evaluation.nextAttempt,
      status: 'succeeded',
      capturedAt: new Date(Date.parse('2026-07-23T12:26:00.000Z') + index * 30_000).toISOString(),
      evidenceArtifactSha256: String(index + 2).repeat(64),
      previousReceiptSha256: evaluation.lastReceiptSha256,
    }))
  }
  const releaseExecutionEvidence = buildExecutionVerification({ plan: executionPlan, receipts: executionReceipts, now: NOW })
  const releaseExecutionEvidenceRaw = `${JSON.stringify(releaseExecutionEvidence, null, 2)}\n`
  attestation.capturedAt = '2026-07-23T12:29:30.000Z'
  attestation.releaseExecutionEvidenceSha256 = sha256(releaseExecutionEvidenceRaw)
  return {
    ...base,
    preDeployDecision,
    releaseExecutionEvidence,
    releaseExecutionEvidenceRaw,
    attestation,
    attestationRaw: `${JSON.stringify(attestation, null, 2)}\n`,
  }
}

test('release policy is closed, internally consistent and source controlled', () => {
  const { policy } = fixture()
  assert.deepEqual(validateReleasePolicy(policy), { ok: true, errors: [] })
  assert.equal(policy.requiredScopes.length, 8)
  assert.equal(policy.requiredApprovals.length, 6)
  assert.equal(policy.maxReleaseCandidateEvidenceAgeHours, 4)
  assert.equal(policy.maxReleaseExecutionDurationMinutes, 180)
  assert.equal(policy.maxReleaseRecoveryDurationMinutes, 120)
})

test('release policy rejects missing warning modes and unknown capability bindings', () => {
  const { policy } = fixture()
  delete policy.allowedWarningCodes['post-deploy']
  policy.smokeCapabilityBindings['unknown-capability'] = 'unknown-smoke'
  policy.runtimeCapabilityBindings['unknown-runtime-capability'] = 'unknown-runtime'
  const result = validateReleasePolicy(policy)
  assert.equal(result.ok, false)
  assert.ok(result.errors.every((item) => item.code === 'MAS-DEP-029'))
  assert.ok(result.errors.some((item) => item.subject === 'allowedWarningCodes'))
  assert.ok(result.errors.some((item) => item.subject === 'unknown-capability'))
  assert.ok(result.errors.some((item) => item.subject === 'unknown-runtime-capability'))
})

test('release policy rejects an unsafe recovery duration', () => {
  const { policy } = fixture()
  policy.maxReleaseRecoveryDurationMinutes = 0
  const result = validateReleasePolicy(policy)
  assert.equal(result.ok, false)
  assert.ok(result.errors.some((item) => (
    item.code === 'MAS-DEP-029'
    && item.subject === 'release-recovery-duration'
  )))
})

test('complete pre-deploy evidence produces go-to-deploy without claiming a deployment', () => {
  const input = fixture()
  input.attestation.releaseExecutionEvidenceSha256 = null
  input.attestationRaw = `${JSON.stringify(input.attestation, null, 2)}\n`
  const result = evaluateReleaseDecision({ ...input, mode: 'pre-deploy' })
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

test('operator and runtime capability states must agree', () => {
  const input = fixture()
  input.attestation.enabledCapabilities.accounting = true
  input.attestationRaw = JSON.stringify(input.attestation)
  const result = evaluateReleaseDecision({ ...input, mode: 'post-deploy' })
  assert.equal(result.decision, 'no-go')
  assert.ok(result.errors.some((item) => item.code === 'MAS-DEP-030' && item.subject === 'capability:accounting'))
})

test('missing restore proof or mismatched attestation binding prevents release', () => {
  const input = fixture()
  input.backupRestoreEvidence.restoreDrill.tenantIsolationVerified = false
  input.backupRestoreEvidenceRaw = `${JSON.stringify(input.backupRestoreEvidence, null, 2)}\n`
  const result = evaluateReleaseDecision({ ...input, mode: 'post-deploy' })
  assert.equal(result.decision, 'no-go')
  assert.equal(result.gates.backupRestore, false)
  assert.ok(result.errors.some((item) => item.code === 'MAS-DEP-036'))
  assert.ok(result.errors.some((item) => item.subject === 'backup-restore-attestation-binding'))
})

test('unfrozen release candidate or mismatched provenance binding prevents release', () => {
  const input = fixture()
  input.releaseCandidateEvidence.freeze.changeSetFrozen = false
  input.releaseCandidateEvidenceRaw = `${JSON.stringify(input.releaseCandidateEvidence, null, 2)}\n`
  const result = evaluateReleaseDecision({ ...input, mode: 'post-deploy' })
  assert.equal(result.decision, 'no-go')
  assert.equal(result.gates.releaseCandidate, false)
  assert.ok(result.errors.some((item) => item.code === 'MAS-DEP-038'))
  assert.ok(result.errors.some((item) => item.subject === 'release-candidate-attestation-binding'))
})

test('missing, incomplete or mismatched execution journal prevents post-deploy acceptance', () => {
  const input = fixture()
  input.releaseExecutionEvidence.status = 'incomplete'
  input.releaseExecutionEvidenceRaw = `${JSON.stringify(input.releaseExecutionEvidence, null, 2)}\n`
  const result = evaluateReleaseDecision({ ...input, mode: 'post-deploy' })
  assert.equal(result.decision, 'no-go')
  assert.equal(result.gates.releaseExecution, false)
  assert.ok(result.errors.some((item) => item.code === 'MAS-DEP-041'))
})

test('post-deploy attestation cannot predate completed execution', () => {
  const input = fixture()
  input.attestation.capturedAt = '2026-07-23T12:28:00.000Z'
  input.attestationRaw = `${JSON.stringify(input.attestation, null, 2)}\n`
  const result = evaluateReleaseDecision({ ...input, mode: 'post-deploy' })
  assert.equal(result.decision, 'no-go')
  assert.ok(result.errors.some((item) => item.subject === 'release-execution-attestation-time'))
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
  const capturedAt = new Date().toISOString()
  input.runtimeEvidence.capturedAt = capturedAt
  input.smokeEvidence.capturedAt = capturedAt
  input.backupRestoreEvidence.capturedAt = capturedAt
  input.backupRestoreEvidenceRaw = `${JSON.stringify(input.backupRestoreEvidence, null, 2)}\n`
  input.releaseCandidateEvidence.capturedAt = capturedAt
  input.releaseCandidateEvidenceRaw = `${JSON.stringify(input.releaseCandidateEvidence, null, 2)}\n`
  input.attestation.capturedAt = capturedAt
  input.attestation.backupRestoreEvidenceSha256 = sha256(input.backupRestoreEvidenceRaw)
  input.attestation.releaseCandidateEvidenceSha256 = sha256(input.releaseCandidateEvidenceRaw)
  input.attestation.releaseExecutionEvidenceSha256 = null
  input.attestationRaw = `${JSON.stringify(input.attestation, null, 2)}\n`
  input.preDeployDecision = evaluateReleaseDecision({ ...input, mode: 'pre-deploy', now: new Date() })
  assert.equal(input.preDeployDecision.decision, 'go-to-deploy')
  const executionStart = Date.now() - 8_000
  const executionPlan = buildReleaseExecutionPlan({
    projectRef: PROD_REF,
    bundleManifest: input.bundleManifest,
    preDeployDecision: input.preDeployDecision,
    now: new Date(executionStart),
  })
  const executionReceipts = []
  for (const [index, step] of RELEASE_EXECUTION_STEPS.entries()) {
    const evaluation = evaluateExecutionReceipts({ plan: executionPlan, receipts: executionReceipts })
    executionReceipts.push(buildReleaseExecutionReceipt({
      plan: executionPlan,
      sequence: index + 1,
      step,
      attempt: evaluation.nextAttempt,
      status: 'succeeded',
      capturedAt: new Date(executionStart + (index + 1) * 1_000).toISOString(),
      evidenceArtifactSha256: String(index + 2).repeat(64),
      previousReceiptSha256: evaluation.lastReceiptSha256,
    }))
  }
  input.releaseExecutionEvidence = buildExecutionVerification({ plan: executionPlan, receipts: executionReceipts })
  input.releaseExecutionEvidenceRaw = `${JSON.stringify(input.releaseExecutionEvidence, null, 2)}\n`
  input.attestation.capturedAt = new Date().toISOString()
  input.attestation.releaseExecutionEvidenceSha256 = sha256(input.releaseExecutionEvidenceRaw)
  input.attestationRaw = `${JSON.stringify(input.attestation, null, 2)}\n`
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
    writeJson('backupRestore', input.backupRestoreEvidence)
    writeJson('bundleManifest', input.bundleManifest)
    writeJson('releaseCandidate', input.releaseCandidateEvidence)
    writeJson('preDeployDecision', input.preDeployDecision)
    writeJson('releaseExecution', input.releaseExecutionEvidence)
    writeJson('attestation', input.attestation)
    paths.migrations = join(directory, 'migrations.txt')
    writeFileSync(paths.migrations, migrationText(createMigrationManifest(ROOT)))
    const args = [
      '--mode', 'post-deploy', '--project-ref', PROD_REF,
      '--release-evidence', paths.release, '--rehearsal', paths.rehearsal,
      '--migration-evidence', paths.migrations, '--runtime-evidence', paths.runtime,
      '--smoke-evidence', paths.smoke, '--backup-restore-evidence', paths.backupRestore,
      '--bundle-manifest', paths.bundleManifest, '--release-candidate-evidence', paths.releaseCandidate,
      '--pre-deploy-decision', paths.preDeployDecision, '--release-execution-evidence', paths.releaseExecution,
      '--attestation', paths.attestation,
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
