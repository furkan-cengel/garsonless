import assert from 'node:assert/strict'
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
  buildBackupRestoreEvidenceTemplate,
  buildHandoffVerification,
  runCli,
  validateBackupRestoreEvidence,
} from './production-release-handoff.mjs'

const ROOT = new URL('..', import.meta.url).pathname
const PROD_REF = 'svxvloeosiksqfadgkvo'
const NOW = new Date('2026-07-23T12:30:00.000Z')

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
  return { projectRef: PROD_REF, releaseEvidence, rehearsal }
}

function completedEvidence(capturedAt = '2026-07-23T12:20:00.000Z') {
  const input = releaseFixture()
  const evidence = buildBackupRestoreEvidenceTemplate(input)
  evidence.status = 'passed'
  evidence.capturedAt = capturedAt
  for (const group of ['backup', 'restoreDrill', 'rollbackReadiness']) {
    for (const key of Object.keys(evidence[group])) evidence[group][key] = true
  }
  return { ...input, evidence, evidenceRaw: `${JSON.stringify(evidence, null, 2)}\n` }
}

test('template is release-bound, mutation-free and cannot pass by default', () => {
  const input = releaseFixture()
  const template = buildBackupRestoreEvidenceTemplate(input)
  assert.equal(template.status, 'pending')
  assert.equal(template.capturedAt, null)
  assert.equal(template.productionMutationPerformed, false)
  assert.ok(Object.values(template.backup).every((value) => value === false))
  assert.ok(Object.values(template.restoreDrill).every((value) => value === false))
  assert.equal(validateBackupRestoreEvidence({ ...input, evidence: template, evidenceRaw: JSON.stringify(template), now: NOW }).ok, false)
})

test('completed safe evidence verifies and produces a deterministic handoff artifact', () => {
  const input = completedEvidence()
  const result = validateBackupRestoreEvidence({ ...input, now: NOW })
  assert.deepEqual(result.errors, [])
  assert.equal(result.ok, true)
  const first = buildHandoffVerification({ ...input, now: NOW })
  const second = buildHandoffVerification({ ...input, now: NOW })
  assert.deepEqual(first, second)
  assert.equal(first.status, 'verified')
  assert.equal(first.productionMutationPerformed, false)
  assert.match(first.artifactSha256, /^[a-f0-9]{64}$/)
})

test('stale, incomplete and production-mutating evidence fails closed', () => {
  const input = completedEvidence('2026-07-21T10:00:00.000Z')
  input.evidence.backup.pitrEnabled = false
  input.evidence.productionMutationPerformed = true
  input.evidenceRaw = JSON.stringify(input.evidence)
  const result = validateBackupRestoreEvidence({ ...input, now: NOW })
  assert.equal(result.ok, false)
  assert.ok(result.errors.every((item) => ['MAS-DEP-035', 'MAS-DEP-036'].includes(item.code)))
  assert.ok(result.errors.some((item) => item.subject === 'backup'))
  assert.ok(result.errors.some((item) => item.subject === 'capturedAt'))
})

test('expanded evidence and wrong release bindings are rejected without echoing unsafe values', () => {
  const input = completedEvidence()
  input.evidence.operatorEmail = 'must-not-leak@example.com'
  input.evidence.commitSha = 'b'.repeat(40)
  input.evidenceRaw = JSON.stringify(input.evidence)
  const result = validateBackupRestoreEvidence({ ...input, now: NOW })
  assert.equal(result.ok, false)
  assert.ok(result.errors.some((item) => item.code === 'MAS-DEP-036'))
  assert.ok(result.errors.some((item) => item.code === 'MAS-DEP-035'))
  assert.doesNotMatch(JSON.stringify(result), /must-not-leak/)
})

test('DEV project ref and tampered release artifacts are rejected', () => {
  const input = releaseFixture()
  assert.throws(() => buildBackupRestoreEvidenceTemplate({ ...input, projectRef: 'yxsegwkzyiscrxiwdeuf' }), { code: 'MAS-DEP-004' })
  input.releaseEvidence.commitSha = 'b'.repeat(40)
  assert.throws(() => buildBackupRestoreEvidenceTemplate(input), { code: 'MAS-DEP-035' })
})

test('CLI writes restrictive template and verified artifacts without production mutation', () => {
  const directory = mkdtempSync(join(tmpdir(), 'masabu-handoff-'))
  const input = completedEvidence(new Date().toISOString())
  try {
    const releasePath = join(directory, 'release.json')
    const rehearsalPath = join(directory, 'rehearsal.json')
    const evidencePath = join(directory, 'backup-restore.json')
    writeFileSync(releasePath, `${JSON.stringify(input.releaseEvidence, null, 2)}\n`)
    writeFileSync(rehearsalPath, `${JSON.stringify(input.rehearsal, null, 2)}\n`)
    writeFileSync(evidencePath, `${JSON.stringify(input.evidence, null, 2)}\n`)
    const templatePath = join(directory, 'template.json')
    assert.equal(runCli([
      'template', '--project-ref', PROD_REF, '--release-evidence', releasePath,
      '--rehearsal', rehearsalPath, '--output', templatePath,
    ], ROOT), 0)
    assert.equal(statSync(templatePath).mode & 0o777, 0o600)
    const output = join(directory, 'verification.json')
    assert.equal(runCli([
      'verify', '--project-ref', PROD_REF, '--release-evidence', releasePath,
      '--rehearsal', rehearsalPath, '--evidence', evidencePath, '--output', output,
    ], ROOT), 0)
    assert.equal(JSON.parse(readFileSync(output, 'utf8')).status, 'verified')
    assert.equal(statSync(output).mode & 0o777, 0o600)
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})
