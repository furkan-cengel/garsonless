import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import {
  RELEASE_EXECUTION_STEPS,
  buildExecutionVerification,
  buildReleaseExecutionPlan,
  evaluateExecutionReceipts,
  runCli,
  validateReleaseExecutionEvidence,
} from './production-release-execution.mjs'

const ROOT = new URL('..', import.meta.url).pathname
const PROD_REF = 'svxvloeosiksqfadgkvo'
const sha256 = (value) => createHash('sha256').update(value).digest('hex')

function hashed(value, key = 'artifactSha256') {
  return { ...value, [key]: sha256(JSON.stringify(value)) }
}

function fixture() {
  const bundleManifest = hashed({
    schemaVersion: 1,
    kind: 'masabu-production-release-bundle',
    projectRef: PROD_REF,
    commitSha: 'a'.repeat(40),
    releaseArtifactSha256: 'b'.repeat(64),
    rehearsalArtifactSha256: 'c'.repeat(64),
    policySha256: 'd'.repeat(64),
    productionMutationPerformed: false,
    artifacts: [],
    requiredOperatorEvidence: [],
  })
  const preDeployDecision = hashed({
    schemaVersion: 1,
    mode: 'pre-deploy',
    decision: 'go-to-deploy',
    projectRef: PROD_REF,
    commitSha: bundleManifest.commitSha,
    releaseArtifactSha256: bundleManifest.releaseArtifactSha256,
    rehearsalArtifactSha256: bundleManifest.rehearsalArtifactSha256,
    policySha256: bundleManifest.policySha256,
    attestationSha256: 'e'.repeat(64),
    backupRestoreEvidenceSha256: 'f'.repeat(64),
    releaseCandidateEvidenceSha256: '1'.repeat(64),
    enabledCapabilities: {},
    gates: { sourcePolicy: true, releaseBindings: true, preflight: true, topology: true, migrations: true, runtime: true, smoke: true, backupRestore: true, releaseCandidate: true, operatorAttestation: true },
    preflightScopes: [],
    migration: { mode: 'pre-deploy', localCount: 1, remoteCount: 0, pendingCount: 1 },
    warningCodes: [],
    warnings: [],
    errors: [],
    productionMutationPerformed: false,
  })
  return { projectRef: PROD_REF, bundleManifest, preDeployDecision }
}

function writeFixture(directory) {
  const input = fixture()
  const bundlePath = join(directory, 'bundle.json')
  const decisionPath = join(directory, 'decision.json')
  writeFileSync(bundlePath, `${JSON.stringify(input.bundleManifest, null, 2)}\n`)
  writeFileSync(decisionPath, `${JSON.stringify(input.preDeployDecision, null, 2)}\n`)
  return { ...input, bundlePath, decisionPath }
}

function initJournal(directory) {
  const input = writeFixture(directory)
  const journal = join(directory, 'journal')
  assert.equal(runCli([
    'init', '--project-ref', PROD_REF,
    '--bundle-manifest', input.bundlePath,
    '--pre-deploy-decision', input.decisionPath,
    '--output', journal,
  ], ROOT), 0)
  return { ...input, journal }
}

function record(journal, step, status = 'succeeded', seed = step.position) {
  return runCli([
    'record', '--input', journal, '--step', step.key, '--status', status,
    '--evidence-sha256', String(seed).repeat(64),
  ], ROOT)
}

test('execution plan is source-bound, ordered and tooling-only', () => {
  const input = fixture()
  const plan = buildReleaseExecutionPlan({ ...input, now: new Date('2026-07-23T17:00:00.000Z') })
  assert.equal(plan.kind, 'masabu-production-release-execution-plan')
  assert.equal(plan.preDeployDecisionSha256, input.preDeployDecision.artifactSha256)
  assert.deepEqual(plan.steps.map((step) => step.key), RELEASE_EXECUTION_STEPS.map((step) => step.key))
  assert.equal(plan.toolProductionMutationPerformed, false)
  assert.throws(() => buildReleaseExecutionPlan({ ...input, projectRef: 'yxsegwkzyiscrxiwdeuf' }), { code: 'MAS-DEP-004' })
})

test('write-once journal resumes through a failed attempt and verifies complete', () => {
  const directory = mkdtempSync(join(tmpdir(), 'masabu-execution-'))
  try {
    const input = initJournal(directory)
    assert.equal(statSync(input.journal).mode & 0o777, 0o700)
    assert.equal(statSync(join(input.journal, 'execution-plan.json')).mode & 0o777, 0o600)
    assert.equal(record(input.journal, RELEASE_EXECUTION_STEPS[0]), 0)
    assert.equal(record(input.journal, RELEASE_EXECUTION_STEPS[1], 'failed', 8), 1)
    assert.equal(runCli(['status', '--input', input.journal], ROOT), 0)
    assert.equal(record(input.journal, RELEASE_EXECUTION_STEPS[1], 'succeeded', 9), 0)
    for (const step of RELEASE_EXECUTION_STEPS.slice(2)) assert.equal(record(input.journal, step, 'succeeded', step.position), 0)
    const output = join(directory, 'execution-evidence.json')
    assert.equal(runCli(['verify', '--input', input.journal, '--output', output], ROOT), 0)
    const evidenceRaw = readFileSync(output, 'utf8')
    const evidence = JSON.parse(evidenceRaw)
    assert.equal(evidence.status, 'completed')
    assert.equal(evidence.receiptCount, RELEASE_EXECUTION_STEPS.length + 1)
    assert.equal(evidence.recordedProductionMutationPerformed, true)
    assert.equal(evidence.toolProductionMutationPerformed, false)
    assert.equal(statSync(output).mode & 0o777, 0o600)
    const releaseEvidence = { commitSha: input.bundleManifest.commitSha, artifactSha256: input.bundleManifest.releaseArtifactSha256 }
    const rehearsal = { artifactSha256: input.bundleManifest.rehearsalArtifactSha256 }
    const result = validateReleaseExecutionEvidence({
      evidence, evidenceRaw, projectRef: PROD_REF, releaseEvidence, rehearsal,
      bundleManifest: input.bundleManifest, preDeployDecision: input.preDeployDecision,
    })
    assert.deepEqual(result.errors, [])
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

test('out-of-order and duplicate completion attempts fail closed', () => {
  const directory = mkdtempSync(join(tmpdir(), 'masabu-execution-order-'))
  try {
    const { journal } = initJournal(directory)
    assert.equal(record(journal, RELEASE_EXECUTION_STEPS[1]), 2)
    for (const step of RELEASE_EXECUTION_STEPS) assert.equal(record(journal, step), 0)
    assert.equal(record(journal, RELEASE_EXECUTION_STEPS.at(-1), 'succeeded', 8), 2)
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

test('tampered receipt and broken hash chain are detected', () => {
  const directory = mkdtempSync(join(tmpdir(), 'masabu-execution-tamper-'))
  try {
    const { journal } = initJournal(directory)
    assert.equal(record(journal, RELEASE_EXECUTION_STEPS[0]), 0)
    const path = join(journal, 'receipts', '0001.json')
    const receipt = JSON.parse(readFileSync(path, 'utf8'))
    receipt.stepKey = 'migrations-applied'
    writeFileSync(path, `${JSON.stringify(receipt, null, 2)}\n`)
    assert.equal(runCli(['status', '--input', journal], ROOT), 1)
    const output = join(directory, 'invalid.json')
    assert.equal(runCli(['verify', '--input', journal, '--output', output], ROOT), 1)
    assert.equal(JSON.parse(readFileSync(output, 'utf8')).status, 'invalid')
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

test('incomplete and overlong execution cannot become acceptance evidence', () => {
  const input = fixture()
  const plan = buildReleaseExecutionPlan({ ...input, now: new Date('2026-07-23T10:00:00.000Z') })
  const verification = buildExecutionVerification({ plan, receipts: [], now: new Date('2026-07-23T14:00:00.000Z'), maxDurationMinutes: 180 })
  assert.equal(verification.status, 'incomplete')
  const result = validateReleaseExecutionEvidence({
    evidence: verification,
    evidenceRaw: JSON.stringify(verification),
    projectRef: PROD_REF,
    releaseEvidence: { commitSha: plan.commitSha, artifactSha256: plan.releaseArtifactSha256 },
    rehearsal: { artifactSha256: plan.rehearsalArtifactSha256 },
    bundleManifest: input.bundleManifest,
    preDeployDecision: input.preDeployDecision,
  })
  assert.equal(result.ok, false)
  assert.ok(result.errors.some((item) => item.code === 'MAS-DEP-041'))
})

test('receipt evaluator exposes exactly the resumable next step and attempt', () => {
  const input = fixture()
  const plan = buildReleaseExecutionPlan(input)
  const result = evaluateExecutionReceipts({ plan, receipts: [] })
  assert.equal(result.ok, true)
  assert.equal(result.complete, false)
  assert.equal(result.nextStep.key, 'change-window-open')
  assert.equal(result.nextAttempt, 1)
  assert.equal(result.recordedProductionMutationPerformed, false)
})
