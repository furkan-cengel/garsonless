import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { buildSmokeManifest, loadSmokeSpec, runCli, validateSmokeEvidence, validateSmokeSource } from './business-smoke.mjs'
import { loadTopologySpec } from './deployment-topology.mjs'
import { createMigrationManifest } from './migration-release.mjs'
import { buildReleaseEvidence } from './release-evidence.mjs'
import { buildRuntimeManifest, loadRuntimeSpec } from './runtime-deployment.mjs'

const PROD_REF = 'svxvloeosiksqfadgkvo'
const NOW = new Date('2026-07-23T12:00:00Z')

function fixture() {
  const { spec, sha256: specSha256 } = loadSmokeSpec()
  const { spec: topologySpec, sha256: topologySha256 } = loadTopologySpec()
  const manifest = buildSmokeManifest({ spec, specSha256, topologySpec, topologySha256, projectRef: PROD_REF })
  return { spec, topologySpec, topologySha256, manifest }
}

function releaseFixture(smokeManifest) {
  const migrationManifest = createMigrationManifest()
  const { spec: topologySpec, sha256: topologySha256 } = loadTopologySpec()
  const { spec: runtimeSpec, sha256: runtimeSpecSha256 } = loadRuntimeSpec()
  const runtimeManifest = buildRuntimeManifest({ spec: runtimeSpec, specSha256: runtimeSpecSha256, projectRef: PROD_REF })
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

function validEvidence(manifest, releaseEvidence, capturedAt = NOW.toISOString()) {
  return {
    schemaVersion: 1,
    environment: 'production',
    projectRef: PROD_REF,
    capturedAt,
    commitSha: releaseEvidence.commitSha,
    releaseArtifactSha256: releaseEvidence.artifactSha256,
    runtimeArtifactSha256: releaseEvidence.runtime.sha256,
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
          durationMs: 120,
          assertions: Object.fromEntries(check.assertions.map((name) => [name, true])),
        }
      : {
          name: check.name,
          status: 'deferred',
          durationMs: 0,
          assertions: {},
          reasonCode: 'CAPABILITY_DISABLED',
        }),
  }
}

test('smoke source contract matches topology and every referenced implementation file', () => {
  const { spec, topologySpec } = fixture()
  assert.deepEqual(validateSmokeSource({ spec, topologySpec }), { ok: true, errors: [] })
})

test('unknown capability, duplicate assertion, invalid target and missing source fail closed', () => {
  const { spec, topologySpec } = fixture()
  const broken = structuredClone(spec)
  broken.checks[0].capability = 'unknown'
  broken.checks[0].assertions.push(broken.checks[0].assertions[0])
  broken.checks[0].target.origin = 'unknown'
  broken.checks[0].sourcePaths.push('apps/missing/route.ts')
  const result = validateSmokeSource({ spec: broken, topologySpec })
  assert.equal(result.ok, false)
  assert.ok(result.errors.some((item) => item.code === 'MAS-DEP-015'))
  assert.ok(result.errors.some((item) => item.code === 'MAS-DEP-025'))
  assert.ok(result.errors.some((item) => item.code === 'MAS-DEP-027'))
})

test('smoke manifest is deterministic, source-bound and secretless', () => {
  const first = fixture().manifest
  const second = fixture().manifest
  assert.deepEqual(first, second)
  assert.equal(first.checks.length, 14)
  assert.equal(first.capabilities.length, 6)
  assert.ok(first.checks.every((check) => check.sources.every((source) => /^[a-f0-9]{64}$/.test(source.sha256))))
  assert.doesNotMatch(JSON.stringify(first), /service-role|authorization|tableTokenValue|api-key/i)
})

test('fresh post-deploy core evidence passes while disabled payment capabilities are explicit', () => {
  const { manifest } = fixture()
  const releaseEvidence = releaseFixture(manifest)
  const result = validateSmokeEvidence({ manifest, releaseEvidence, evidence: validEvidence(manifest, releaseEvidence), now: NOW })
  assert.equal(result.ok, true)
  assert.deepEqual(result.errors, [])
  assert.deepEqual(result.warnings, [])
})

test('disabled capabilities cannot claim runtime duration or partial assertions', () => {
  const { manifest } = fixture()
  const releaseEvidence = releaseFixture(manifest)
  const evidence = validEvidence(manifest, releaseEvidence)
  const deferred = evidence.checks.find((check) => check.status === 'deferred')
  deferred.durationMs = 1
  const result = validateSmokeEvidence({ manifest, releaseEvidence, evidence, now: NOW })
  assert.equal(result.ok, false)
  assert.ok(result.errors.some((item) => item.code === 'MAS-DEP-026'))
})

test('enabled optional capabilities require their complete passing checks', () => {
  const { manifest } = fixture()
  const releaseEvidence = releaseFixture(manifest)
  const evidence = validEvidence(manifest, releaseEvidence)
  for (const capability of manifest.capabilities) evidence.enabledCapabilities[capability] = true
  for (const check of evidence.checks) {
    const expected = manifest.checks.find((item) => item.name === check.name)
    if (expected.capability !== 'core') {
      check.status = 'passed'
      check.durationMs = 500
      check.assertions = Object.fromEntries(expected.assertions.map((name) => [name, true]))
      delete check.reasonCode
    }
  }
  assert.equal(validateSmokeEvidence({ manifest, releaseEvidence, evidence, now: NOW }).ok, true)
})

test('missing, failed and incomplete required checks use stable deploy error codes', () => {
  const { manifest } = fixture()
  const releaseEvidence = releaseFixture(manifest)
  const evidence = validEvidence(manifest, releaseEvidence)
  evidence.checks.shift()
  evidence.checks[0].status = 'failed'
  evidence.checks[1].assertions[Object.keys(evidence.checks[1].assertions)[0]] = false
  const result = validateSmokeEvidence({ manifest, releaseEvidence, evidence, now: NOW })
  assert.equal(result.ok, false)
  assert.ok(result.errors.some((item) => item.code === 'MAS-DEP-026'))
  assert.ok(result.errors.some((item) => item.code === 'MAS-DEP-027'))
})

test('wrong release binding, stale evidence and extra unsafe fields are rejected', () => {
  const { manifest } = fixture()
  const releaseEvidence = releaseFixture(manifest)
  const evidence = validEvidence(manifest, releaseEvidence, '2026-07-23T01:00:00Z')
  evidence.commitSha = 'b'.repeat(40)
  evidence.token = 'must-never-be-captured'
  const result = validateSmokeEvidence({ manifest, releaseEvidence, evidence, now: NOW })
  assert.ok(result.errors.some((item) => item.code === 'MAS-DEP-024'))
  assert.ok(result.errors.some((item) => item.code === 'MAS-DEP-025'))
  assert.ok(result.errors.some((item) => item.code === 'MAS-DEP-028'))
})

test('tampered release evidence or a release bound to another smoke manifest is rejected', () => {
  const { manifest } = fixture()
  const releaseEvidence = releaseFixture(manifest)
  const evidence = validEvidence(manifest, releaseEvidence)
  releaseEvidence.commitSha = 'b'.repeat(40)
  releaseEvidence.smoke.sha256 = 'c'.repeat(64)
  const result = validateSmokeEvidence({ manifest, releaseEvidence, evidence, now: NOW })
  assert.ok(result.errors.some((item) => item.code === 'MAS-DEP-025'))
  assert.ok(result.errors.some((item) => item.code === 'MAS-DEP-024'))
})

test('pre-deploy mode reports pending effective checks as warnings without claiming smoke success', () => {
  const { manifest } = fixture()
  const releaseEvidence = releaseFixture(manifest)
  const evidence = validEvidence(manifest, releaseEvidence)
  evidence.checks = evidence.checks.filter((check) => check.status === 'deferred')
  const result = validateSmokeEvidence({ manifest, releaseEvidence, evidence, mode: 'pre-deploy', now: NOW })
  assert.equal(result.ok, true)
  assert.equal(result.warnings.length, manifest.checks.filter((check) => check.capability === 'core').length)
  assert.ok(result.warnings.every((item) => item.code === 'MAS-DEP-W05'))
})

test('duplicate and unknown checks plus malformed capability states fail closed', () => {
  const { manifest } = fixture()
  const releaseEvidence = releaseFixture(manifest)
  const evidence = validEvidence(manifest, releaseEvidence)
  evidence.checks.push(structuredClone(evidence.checks[0]))
  evidence.checks.push({ name: 'unknown', status: 'passed', durationMs: 1, assertions: {} })
  evidence.enabledCapabilities.core = 'yes'
  const result = validateSmokeEvidence({ manifest, releaseEvidence, evidence, now: NOW })
  assert.ok(result.errors.some((item) => item.code === 'MAS-DEP-025'))
  assert.ok(result.errors.some((item) => item.code === 'MAS-DEP-028'))
})

test('CLI writes a 0600 manifest and verifies a safe release-bound evidence file', () => {
  const directory = mkdtempSync(join(tmpdir(), 'masabu-smoke-'))
  const manifestPath = join(directory, 'manifest.json')
  const releasePath = join(directory, 'release.json')
  const evidencePath = join(directory, 'evidence.json')
  try {
    assert.equal(runCli(['manifest', '--project-ref', PROD_REF, '--output', manifestPath]), 0)
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
    const releaseEvidence = releaseFixture(manifest)
    writeFileSync(releasePath, `${JSON.stringify(releaseEvidence, null, 2)}\n`)
    writeFileSync(evidencePath, `${JSON.stringify(validEvidence(manifest, releaseEvidence, new Date().toISOString()), null, 2)}\n`)
    assert.equal(runCli(['verify', '--project-ref', PROD_REF, '--release-evidence', releasePath, '--evidence', evidencePath]), 0)
    assert.equal(statSync(manifestPath).mode & 0o777, 0o600)
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})
