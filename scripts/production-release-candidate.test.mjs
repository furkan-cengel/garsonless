import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { buildReleaseEvidence } from './release-evidence.mjs'
import { buildReleaseRehearsal } from './release-rehearsal.mjs'
import { createMigrationManifest } from './migration-release.mjs'
import { loadTopologySpec } from './deployment-topology.mjs'
import { buildRuntimeManifest, loadRuntimeSpec } from './runtime-deployment.mjs'
import { buildSmokeManifest, loadSmokeSpec } from './business-smoke.mjs'
import {
  buildCandidateVerification,
  buildReleaseCandidateEvidenceTemplate,
  runCli,
  validateReleaseCandidateEvidence,
} from './production-release-candidate.mjs'

const ROOT = new URL('..', import.meta.url).pathname
const PROD_REF = 'svxvloeosiksqfadgkvo'
const NOW = new Date('2026-07-23T16:00:00.000Z')
const sha256 = (value) => createHash('sha256').update(value).digest('hex')

function releaseFixture() {
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
  const bundle = {
    schemaVersion: 1,
    kind: 'masabu-production-release-bundle',
    projectRef: PROD_REF,
    commitSha: releaseEvidence.commitSha,
    releaseArtifactSha256: releaseEvidence.artifactSha256,
    rehearsalArtifactSha256: rehearsal.artifactSha256,
    policySha256: 'd'.repeat(64),
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
  const bundleManifest = { ...bundle, artifactSha256: sha256(JSON.stringify(bundle)) }
  return { projectRef: PROD_REF, releaseEvidence, rehearsal, bundleManifest }
}

function completedEvidence(capturedAt = '2026-07-23T15:50:00.000Z') {
  const input = releaseFixture()
  const evidence = buildReleaseCandidateEvidenceTemplate(input)
  evidence.status = 'frozen'
  evidence.capturedAt = capturedAt
  for (const key of Object.keys(evidence.freeze)) evidence.freeze[key] = true
  let index = 1
  for (const group of Object.values(evidence.rollbackArtifacts)) {
    for (const artifact of Object.values(group)) {
      artifact.sourceCommitSha = String(index).repeat(40)
      artifact.artifactSha256 = String(index).repeat(64)
      artifact.available = true
      artifact.restoreProcedureVerified = true
      index += 1
    }
  }
  return { ...input, evidence, evidenceRaw: `${JSON.stringify(evidence, null, 2)}\n` }
}

test('candidate template is exact, release-bound and fail-closed by default', () => {
  const input = releaseFixture()
  const template = buildReleaseCandidateEvidenceTemplate(input)
  assert.equal(template.status, 'pending')
  assert.equal(template.capturedAt, null)
  assert.equal(template.bundleManifestSha256, input.bundleManifest.artifactSha256)
  assert.equal(template.productionMutationPerformed, false)
  assert.ok(Object.values(template.freeze).every((value) => value === false))
  assert.equal(validateReleaseCandidateEvidence({ ...input, evidence: template, evidenceRaw: JSON.stringify(template), now: NOW }).ok, false)
})

test('frozen candidate with immutable rollback provenance verifies deterministically', () => {
  const input = completedEvidence()
  const result = validateReleaseCandidateEvidence({ ...input, now: NOW })
  assert.deepEqual(result.errors, [])
  assert.equal(result.ok, true)
  const first = buildCandidateVerification({ ...input, now: NOW })
  const second = buildCandidateVerification({ ...input, now: NOW })
  assert.deepEqual(first, second)
  assert.equal(first.status, 'verified')
  assert.equal(first.productionMutationPerformed, false)
  assert.match(first.artifactSha256, /^[a-f0-9]{64}$/)
})

test('missing, candidate-equal and unverified rollback artifacts fail closed', () => {
  const input = completedEvidence()
  const app = input.evidence.rollbackArtifacts.applications.dashboard
  app.sourceCommitSha = input.releaseEvidence.commitSha
  app.available = false
  input.evidence.rollbackArtifacts.edgeFunctions['outbox-worker'].restoreProcedureVerified = false
  input.evidenceRaw = JSON.stringify(input.evidence)
  const result = validateReleaseCandidateEvidence({ ...input, now: NOW })
  assert.equal(result.ok, false)
  assert.ok(result.errors.some((item) => item.subject === 'applications:dashboard'))
  assert.ok(result.errors.some((item) => item.subject === 'edge-functions:outbox-worker'))
})

test('stale, expanded, mutating and bundle-mismatched evidence is rejected safely', () => {
  const input = completedEvidence('2026-07-22T10:00:00.000Z')
  input.evidence.operatorEmail = 'must-not-leak@example.com'
  input.evidence.bundleManifestSha256 = 'e'.repeat(64)
  input.evidence.productionMutationPerformed = true
  input.evidenceRaw = JSON.stringify(input.evidence)
  const result = validateReleaseCandidateEvidence({ ...input, now: NOW })
  assert.equal(result.ok, false)
  assert.ok(result.errors.some((item) => item.code === 'MAS-DEP-037'))
  assert.ok(result.errors.some((item) => item.code === 'MAS-DEP-038'))
  assert.doesNotMatch(JSON.stringify(result), /must-not-leak/)
})

test('DEV ref and tampered source artifacts are rejected', () => {
  const input = releaseFixture()
  assert.throws(() => buildReleaseCandidateEvidenceTemplate({ ...input, projectRef: 'yxsegwkzyiscrxiwdeuf' }), { code: 'MAS-DEP-004' })
  input.bundleManifest.commitSha = 'b'.repeat(40)
  assert.throws(() => buildReleaseCandidateEvidenceTemplate(input), { code: 'MAS-DEP-037' })

  const malformed = releaseFixture()
  const bundleContents = { ...malformed.bundleManifest }
  delete bundleContents.artifactSha256
  bundleContents.artifacts = {}
  malformed.bundleManifest = { ...bundleContents, artifactSha256: sha256(JSON.stringify(bundleContents)) }
  assert.throws(() => buildReleaseCandidateEvidenceTemplate(malformed), { code: 'MAS-DEP-037' })
})

test('CLI writes restrictive template and verification artifacts', () => {
  const directory = mkdtempSync(join(tmpdir(), 'masabu-candidate-'))
  const input = completedEvidence(new Date().toISOString())
  try {
    const releasePath = join(directory, 'release.json')
    const rehearsalPath = join(directory, 'rehearsal.json')
    const bundlePath = join(directory, 'bundle.json')
    const evidencePath = join(directory, 'candidate.json')
    writeFileSync(releasePath, `${JSON.stringify(input.releaseEvidence, null, 2)}\n`)
    writeFileSync(rehearsalPath, `${JSON.stringify(input.rehearsal, null, 2)}\n`)
    writeFileSync(bundlePath, `${JSON.stringify(input.bundleManifest, null, 2)}\n`)
    writeFileSync(evidencePath, input.evidenceRaw)
    const templatePath = join(directory, 'template.json')
    assert.equal(runCli([
      'template', '--project-ref', PROD_REF, '--release-evidence', releasePath,
      '--rehearsal', rehearsalPath, '--bundle-manifest', bundlePath, '--output', templatePath,
    ], ROOT), 0)
    assert.equal(statSync(templatePath).mode & 0o777, 0o600)
    const output = join(directory, 'verification.json')
    assert.equal(runCli([
      'verify', '--project-ref', PROD_REF, '--release-evidence', releasePath,
      '--rehearsal', rehearsalPath, '--bundle-manifest', bundlePath,
      '--evidence', evidencePath, '--output', output,
    ], ROOT), 0)
    assert.equal(JSON.parse(readFileSync(output, 'utf8')).status, 'verified')
    assert.equal(statSync(output).mode & 0o777, 0o600)
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})
