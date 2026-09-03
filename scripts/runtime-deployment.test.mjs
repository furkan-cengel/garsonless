import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { loadTopologySpec } from './deployment-topology.mjs'
import { createMigrationManifest } from './migration-release.mjs'
import { buildReleaseEvidence } from './release-evidence.mjs'
import { buildReleaseRehearsal } from './release-rehearsal.mjs'
import {
  buildRuntimeManifest,
  loadRuntimeSpec,
  runCli,
  validateRuntimeEvidence,
  validateRuntimeSource,
} from './runtime-deployment.mjs'
import { buildSmokeManifest, loadSmokeSpec } from './business-smoke.mjs'

const PROD_REF = 'svxvloeosiksqfadgkvo'
const NOW = new Date('2026-07-23T12:00:00Z')

function runtimeFixture() {
  const loaded = loadRuntimeSpec()
  return {
    ...loaded,
    manifest: buildRuntimeManifest({ spec: loaded.spec, specSha256: loaded.sha256, projectRef: PROD_REF }),
  }
}

function validEvidence(manifest, capturedAt = NOW.toISOString()) {
  const enabledCapabilities = Object.fromEntries(manifest.runtimeCapabilities.map((name) => [name, false]))
  const required = (item) => !item.capability || enabledCapabilities[item.capability]
  return {
    schemaVersion: 1,
    projectRef: PROD_REF,
    capturedAt,
    enabledCapabilities,
    capabilities: manifest.capabilities,
    edgeFunctions: manifest.edgeFunctions.filter(required).map((fn) => ({
      name: fn.name,
      active: true,
      verifyJwt: fn.verifyJwt,
      url: fn.url,
      configuredSecretNames: fn.requiredSecretNames,
    })),
    authHooks: manifest.authHooks.filter(required).map((hook) => ({ name: hook.name, enabled: hook.enabled, url: hook.url })),
    vaultSecrets: manifest.vaultSecrets.filter(required).map((secret) => ({
      name: secret.name,
      configured: true,
      ...(secret.expectedUrl ? { url: secret.expectedUrl } : {}),
    })),
    cronJobs: manifest.cronJobs.filter(required).map((job) => ({ name: job.name, active: true, schedule: job.schedule, command: job.command })),
    probes: manifest.postDeployProbes.filter(required).map((probe) => ({ name: probe.name, status: probe.expectedStatus })),
  }
}

function releaseFixture(runtimeManifest) {
  const migrationManifest = createMigrationManifest()
  const { spec: topologySpec, sha256: topologySha256 } = loadTopologySpec()
  const { spec: smokeSpec, sha256: smokeSpecSha256 } = loadSmokeSpec()
  const smokeManifest = buildSmokeManifest({ spec: smokeSpec, specSha256: smokeSpecSha256, topologySpec, topologySha256, projectRef: PROD_REF })
  return buildReleaseEvidence({
    projectRef: PROD_REF,
    commitSha: 'a'.repeat(40),
    packageManager: 'pnpm@9.15.4',
    lockfileContents: 'lockfileVersion: 9\n',
    migrationManifest,
    topologySpec,
    topologySha256,
    runtimeManifest,
    smokeManifest,
  })
}

test('runtime source contract matches Supabase config, function env usage and canonical cron migrations', () => {
  const { spec } = runtimeFixture()
  assert.deepEqual(validateRuntimeSource({ spec }), { ok: true, errors: [] })
})

test('source drift in verifyJwt, cron command or declared environment dependency fails closed', () => {
  const { spec } = runtimeFixture()
  const broken = structuredClone(spec)
  broken.edgeFunctions[0].verifyJwt = true
  broken.edgeFunctions[0].requiredSecrets.push('UNUSED_RUNTIME_SECRET')
  broken.cronJobs[1].command = 'select sweep_fully_paid_idle_sessions(30);'
  const result = validateRuntimeSource({ spec: broken })
  assert.equal(result.ok, false)
  assert.ok(result.errors.some((item) => item.code === 'MAS-DEP-020'))
  assert.ok(result.errors.some((item) => item.subject.endsWith('UNUSED_RUNTIME_SECRET')))
  assert.ok(result.errors.some((item) => item.code === 'MAS-DEP-021'))
})

test('runtime manifest is deterministic and contains hashes plus names but no credential values', () => {
  const first = runtimeFixture().manifest
  const second = runtimeFixture().manifest
  assert.deepEqual(first, second)
  assert.equal(first.edgeFunctions.length, 3)
  assert.equal(first.cronJobs.length, 5)
  assert.equal(first.vaultSecrets.length, 5)
  assert.deepEqual(first.runtimeCapabilities, ['accounting', 'customer-phone-auth'])
  assert.match(first.artifactSha256, /^[a-f0-9]{64}$/)
  const serialized = JSON.stringify(first)
  assert.match(serialized, /OUTBOX_WORKER_SECRET/)
  assert.doesNotMatch(serialized, /service-value|worker-value|resend-value/)
})

test('fresh exact post-deploy evidence passes every Edge, Vault, cron, hook and probe gate', () => {
  const { manifest } = runtimeFixture()
  const result = validateRuntimeEvidence({ manifest, evidence: validEvidence(manifest), now: NOW })
  assert.equal(result.ok, true)
  assert.deepEqual(result.errors, [])
  assert.deepEqual(result.warnings, [])
})

test('enabled optional runtime capabilities require their functions, hooks, Vault, cron and probes', () => {
  const { manifest } = runtimeFixture()
  const evidence = validEvidence(manifest)
  evidence.enabledCapabilities.accounting = true
  evidence.enabledCapabilities['customer-phone-auth'] = true
  const missing = validateRuntimeEvidence({ manifest, evidence, now: NOW })
  assert.equal(missing.ok, false)
  assert.ok(missing.errors.some((item) => item.subject === 'send-sms-hook'))
  assert.ok(missing.errors.some((item) => item.subject === 'accounting_worker_url'))
  assert.ok(missing.errors.some((item) => item.subject === 'accounting-invoice-worker-every-minute'))
})

test('post-deploy mismatches fail closed with stable public deploy codes', () => {
  const { manifest } = runtimeFixture()
  const evidence = validEvidence(manifest)
  evidence.edgeFunctions[0].verifyJwt = true
  evidence.vaultSecrets[0].url = 'https://wrong.example/functions/v1/outbox-worker'
  evidence.cronJobs[1].command = 'select sweep_fully_paid_idle_sessions(30);'
  evidence.probes[0].status = 500
  const result = validateRuntimeEvidence({ manifest, evidence, now: NOW })
  assert.equal(result.ok, false)
  assert.ok(result.errors.some((item) => item.code === 'MAS-DEP-020'))
  assert.ok(result.errors.some((item) => item.code === 'MAS-DEP-021'))
  assert.ok(result.errors.some((item) => item.code === 'MAS-DEP-022'))
  assert.ok(result.errors.some((item) => item.code === 'MAS-DEP-023'))
})

test('pre-deploy records expected runtime drift as warnings without claiming deployment success', () => {
  const { manifest } = runtimeFixture()
  const evidence = validEvidence(manifest)
  evidence.edgeFunctions = []
  evidence.cronJobs = []
  evidence.probes = []
  const result = validateRuntimeEvidence({ manifest, evidence, mode: 'pre-deploy', now: NOW })
  assert.equal(result.ok, true)
  assert.ok(result.warnings.length >= 2)
  assert.ok(result.warnings.every((item) => item.code === 'MAS-DEP-W04'))
})

test('wrong, stale and credential-bearing runtime evidence is rejected', () => {
  const { manifest } = runtimeFixture()
  const wrong = validEvidence(manifest)
  wrong.projectRef = 'aaaaaaaaaaaaaaaaaaaa'
  wrong.raw = { secret: 'must-not-be-stored' }
  const result = validateRuntimeEvidence({ manifest, evidence: wrong, now: new Date('2026-07-25T12:00:00Z') })
  assert.ok(result.errors.some((item) => item.code === 'MAS-DEP-019'))
  assert.ok(result.errors.some((item) => item.code === 'MAS-DEP-022'))
  assert.throws(
    () => buildRuntimeManifest({ ...runtimeFixture(), projectRef: 'yxsegwkzyiscrxiwdeuf' }),
    { code: 'MAS-DEP-004' },
  )
})

test('runtime CLI writes secretless 0600 manifest and verifies a safe evidence file', () => {
  const directory = mkdtempSync(join(tmpdir(), 'masabu-runtime-'))
  const manifestPath = join(directory, 'manifest.json')
  const evidencePath = join(directory, 'evidence.json')
  try {
    assert.equal(runCli(['manifest', '--project-ref', PROD_REF, '--output', manifestPath]), 0)
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
    writeFileSync(evidencePath, `${JSON.stringify(validEvidence(manifest, new Date().toISOString()), null, 2)}\n`)
    assert.equal(runCli(['verify', '--project-ref', PROD_REF, '--evidence', evidencePath, '--mode', 'post-deploy']), 0)
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

test('local rehearsal is deterministic, mutation-free and carries explicit forward-fix rollback decisions', () => {
  const { spec, manifest } = runtimeFixture()
  const releaseEvidence = releaseFixture(manifest)
  const { spec: topologySpec, sha256: topologySha256 } = loadTopologySpec()
  const { spec: smokeSpec, sha256: smokeSpecSha256 } = loadSmokeSpec()
  const smokeManifest = buildSmokeManifest({ spec: smokeSpec, specSha256: smokeSpecSha256, topologySpec, topologySha256, projectRef: PROD_REF })
  const first = buildReleaseRehearsal({ projectRef: PROD_REF, releaseEvidence, runtimeManifest: manifest, runtimeSpec: spec, smokeManifest })
  const second = buildReleaseRehearsal({ projectRef: PROD_REF, releaseEvidence, runtimeManifest: manifest, runtimeSpec: spec, smokeManifest })
  assert.deepEqual(first, second)
  assert.equal(first.status, 'local-dry-run')
  assert.equal(first.productionMutationPerformed, false)
  assert.equal(first.steps.length, 9)
  assert.ok(first.rollbackDecisions.some((item) => item.database === 'never-run-down-migration'))
  assert.ok(first.requiredProductionEvidence.includes('runtime-post-deploy-evidence-and-probes'))
  assert.equal(first.smokeArtifactSha256, smokeManifest.artifactSha256)
})

test('tampered release identity or a different runtime manifest cannot be rehearsed', () => {
  const { spec, manifest } = runtimeFixture()
  const { spec: topologySpec, sha256: topologySha256 } = loadTopologySpec()
  const { spec: smokeSpec, sha256: smokeSpecSha256 } = loadSmokeSpec()
  const smokeManifest = buildSmokeManifest({ spec: smokeSpec, specSha256: smokeSpecSha256, topologySpec, topologySha256, projectRef: PROD_REF })
  const tampered = releaseFixture(manifest)
  tampered.commitSha = 'b'.repeat(40)
  assert.throws(
    () => buildReleaseRehearsal({ projectRef: PROD_REF, releaseEvidence: tampered, runtimeManifest: manifest, runtimeSpec: spec, smokeManifest }),
    { code: 'MAS-DEP-019' },
  )
  const releaseEvidence = releaseFixture(manifest)
  assert.throws(
    () => buildReleaseRehearsal({
      projectRef: PROD_REF,
      releaseEvidence,
      runtimeManifest: { ...manifest, artifactSha256: 'f'.repeat(64) },
      runtimeSpec: spec,
      smokeManifest,
    }),
    { code: 'MAS-DEP-024' },
  )
})
