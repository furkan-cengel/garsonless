import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import {
  RELEASE_EXECUTION_STEPS,
  buildReleaseExecutionPlan,
  buildReleaseExecutionReceipt,
} from './production-release-execution.mjs'
import {
  buildReleaseRecoveryPlan,
  buildRecoveryVerification,
  evaluateRecoveryReceipts,
  runCli,
  validateReleaseRecoveryEvidence,
} from './production-release-recovery.mjs'
import { RELEASE_APPLICATIONS, RELEASE_EDGE_FUNCTIONS } from './production-release-contract.mjs'

const ROOT = new URL('..', import.meta.url).pathname
const PROD_REF = 'svxvloeosiksqfadgkvo'
const sha256 = (value) => createHash('sha256').update(value).digest('hex')

function hashed(value, key = 'artifactSha256') {
  return { ...value, [key]: sha256(JSON.stringify(value)) }
}

function artifactMap(names, seed) {
  return Object.fromEntries(names.map((name, index) => [name, {
    sourceCommitSha: 'b'.repeat(40),
    artifactSha256: String((seed + index) % 10).repeat(64),
    available: true,
    restoreProcedureVerified: true,
  }]))
}

function fixture({ failureStepIndex = 2 } = {}) {
  const bundleManifest = hashed({
    schemaVersion: 1,
    kind: 'masabu-production-release-bundle',
    projectRef: PROD_REF,
    commitSha: 'a'.repeat(40),
    releaseArtifactSha256: 'c'.repeat(64),
    rehearsalArtifactSha256: 'd'.repeat(64),
    policySha256: 'e'.repeat(64),
    productionMutationPerformed: false,
    artifacts: [],
    requiredOperatorEvidence: [],
    conditionalOperatorEvidence: [],
  })
  const candidate = {
    schemaVersion: 1,
    kind: 'masabu-production-release-candidate-evidence',
    environment: 'production',
    status: 'frozen',
    projectRef: PROD_REF,
    capturedAt: '2026-07-23T10:00:00.000Z',
    commitSha: bundleManifest.commitSha,
    releaseArtifactSha256: bundleManifest.releaseArtifactSha256,
    rehearsalArtifactSha256: bundleManifest.rehearsalArtifactSha256,
    bundleManifestSha256: bundleManifest.artifactSha256,
    freeze: {
      sourceCommitPushed: true,
      changeSetFrozen: true,
      bundleIntegrityVerified: true,
      rollbackArtifactsCaptured: true,
    },
    rollbackArtifacts: {
      applications: artifactMap(RELEASE_APPLICATIONS, 1),
      edgeFunctions: artifactMap(RELEASE_EDGE_FUNCTIONS, 7),
    },
    productionMutationPerformed: false,
  }
  const candidateRaw = `${JSON.stringify(candidate, null, 2)}\n`
  const preDeployDecision = hashed({
    schemaVersion: 1,
    mode: 'pre-deploy',
    decision: 'go-to-deploy',
    projectRef: PROD_REF,
    commitSha: bundleManifest.commitSha,
    releaseArtifactSha256: bundleManifest.releaseArtifactSha256,
    rehearsalArtifactSha256: bundleManifest.rehearsalArtifactSha256,
    policySha256: bundleManifest.policySha256,
    attestationSha256: 'f'.repeat(64),
    backupRestoreEvidenceSha256: '1'.repeat(64),
    releaseCandidateEvidenceSha256: sha256(candidateRaw),
    enabledCapabilities: {},
    gates: { sourcePolicy: true, releaseBindings: true, preflight: true, topology: true, migrations: true, runtime: true, smoke: true, backupRestore: true, releaseCandidate: true, operatorAttestation: true },
    preflightScopes: [],
    migration: { mode: 'pre-deploy', localCount: 1, remoteCount: 0, pendingCount: 1 },
    warningCodes: [],
    warnings: [],
    errors: [],
    productionMutationPerformed: false,
  })
  const executionPlan = buildReleaseExecutionPlan({
    projectRef: PROD_REF,
    bundleManifest,
    preDeployDecision,
    now: new Date('2026-07-23T10:01:00.000Z'),
  })
  const executionReceipts = []
  let previousReceiptSha256 = null
  for (let index = 0; index <= failureStepIndex; index += 1) {
    const step = RELEASE_EXECUTION_STEPS[index]
    const receipt = buildReleaseExecutionReceipt({
      plan: executionPlan,
      sequence: index + 1,
      step,
      attempt: 1,
      status: index === failureStepIndex ? 'failed' : 'succeeded',
      capturedAt: `2026-07-23T10:${String(index + 2).padStart(2, '0')}:00.000Z`,
      evidenceArtifactSha256: String(index + 1).repeat(64),
      previousReceiptSha256,
    })
    executionReceipts.push(receipt)
    previousReceiptSha256 = receipt.receiptSha256
  }
  return { bundleManifest, candidate, candidateRaw, preDeployDecision, executionPlan, executionReceipts }
}

function writeSource(directory, input) {
  const executionJournal = join(directory, 'execution')
  mkdirSync(join(executionJournal, 'receipts'), { recursive: true })
  writeFileSync(join(executionJournal, 'execution-plan.json'), `${JSON.stringify(input.executionPlan, null, 2)}\n`)
  input.executionReceipts.forEach((receipt, index) => {
    writeFileSync(join(executionJournal, 'receipts', `${String(index + 1).padStart(4, '0')}.json`), `${JSON.stringify(receipt, null, 2)}\n`)
  })
  const candidatePath = join(directory, 'candidate.json')
  writeFileSync(candidatePath, input.candidateRaw)
  return { executionJournal, candidatePath }
}

function recordAll(journal, { failFirstStepOnce = false } = {}) {
  const plan = JSON.parse(readFileSync(join(journal, 'recovery-plan.json'), 'utf8'))
  let seed = 1
  if (failFirstStepOnce) {
    assert.equal(runCli(['record', '--input', journal, '--step', plan.steps[0].key, '--status', 'failed', '--evidence-sha256', 'a'.repeat(64)], ROOT), 1)
    seed += 1
  }
  for (const step of plan.steps) {
    assert.equal(runCli(['record', '--input', journal, '--step', step.key, '--status', 'succeeded', '--evidence-sha256', sha256(`recovery-${seed++}`)], ROOT), 0)
  }
  return plan
}

test('pre-mutation failure creates an honest abort-only plan', () => {
  const input = fixture({ failureStepIndex: 0 })
  const plan = buildReleaseRecoveryPlan({
    executionPlan: input.executionPlan,
    executionReceipts: input.executionReceipts,
    releaseCandidateEvidence: input.candidate,
    releaseCandidateEvidenceRaw: input.candidateRaw,
    now: new Date('2026-07-23T10:10:00.000Z'),
  })
  assert.equal(plan.recoveryMode, 'abort-only')
  assert.equal(plan.productionMutationRiskDetected, false)
  assert.deepEqual(plan.steps.map((step) => step.key), [
    'release-abort-declared', 'incident-opened', 'runtime-health-reverified',
    'business-smoke-reverified', 'incident-closed', 'change-window-closed',
  ])
  assert.equal(plan.toolProductionMutationPerformed, false)
})

test('failed edge deployment derives only the required reverse-order recovery steps', () => {
  const input = fixture({ failureStepIndex: 2 })
  const plan = buildReleaseRecoveryPlan({
    executionPlan: input.executionPlan,
    executionReceipts: input.executionReceipts,
    releaseCandidateEvidence: input.candidate,
    releaseCandidateEvidenceRaw: input.candidateRaw,
    now: new Date('2026-07-23T10:10:00.000Z'),
  })
  assert.equal(plan.recoveryMode, 'rollback-required')
  assert.equal(plan.steps.some((step) => step.key === 'applications-restored'), false)
  assert.ok(plan.steps.findIndex((step) => step.key === 'edge-runtime-restored') < plan.steps.findIndex((step) => step.key === 'database-recovery-completed'))
})

test('write-once recovery journal resumes, closes incident and verifies rollback evidence', () => {
  const directory = mkdtempSync(join(tmpdir(), 'masabu-recovery-'))
  try {
    const input = fixture({ failureStepIndex: 3 })
    const paths = writeSource(directory, input)
    const journal = join(directory, 'recovery')
    assert.equal(runCli(['init', '--execution-journal', paths.executionJournal, '--release-candidate-evidence', paths.candidatePath, '--output', journal], ROOT), 0)
    assert.equal(statSync(journal).mode & 0o777, 0o700)
    assert.equal(statSync(join(journal, 'recovery-plan.json')).mode & 0o777, 0o600)
    const plan = recordAll(journal, { failFirstStepOnce: true })
    const output = join(directory, 'recovery-evidence.json')
    assert.equal(runCli(['verify', '--input', journal, '--output', output], ROOT), 0)
    const raw = readFileSync(output, 'utf8')
    const evidence = JSON.parse(raw)
    assert.equal(evidence.status, 'rolled-back')
    assert.equal(evidence.releaseAccepted, false)
    assert.equal(evidence.recordedRecoveryMutationPerformed, true)
    assert.equal(evidence.toolProductionMutationPerformed, false)
    assert.equal(evidence.receiptCount, plan.steps.length + 1)
    assert.ok(evidence.incidentEvidenceSha256)
    assert.ok(evidence.incidentClosureEvidenceSha256)
    assert.equal(validateReleaseRecoveryEvidence({
      evidence,
      evidenceRaw: raw,
      executionPlan: input.executionPlan,
      executionReceipts: input.executionReceipts,
      releaseCandidateEvidence: input.candidate,
      releaseCandidateEvidenceRaw: input.candidateRaw,
    }).ok, true)
    assert.equal(statSync(output).mode & 0o777, 0o600)
    assert.equal(statSync(join(journal, 'source', 'release-candidate-evidence.json')).mode & 0o777, 0o600)
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

test('completed execution, missing failure and candidate hash mismatch fail closed', () => {
  const input = fixture({ failureStepIndex: 1 })
  const completedReceipts = []
  let previousReceiptSha256 = null
  for (const [index, step] of RELEASE_EXECUTION_STEPS.entries()) {
    const receipt = buildReleaseExecutionReceipt({
      plan: input.executionPlan,
      sequence: completedReceipts.length + 1,
      step,
      attempt: 1,
      status: 'succeeded',
      capturedAt: `2026-07-23T11:${String(index + 1).padStart(2, '0')}:00.000Z`,
      evidenceArtifactSha256: sha256(`execution-complete-${index}`),
      previousReceiptSha256,
    })
    completedReceipts.push(receipt)
    previousReceiptSha256 = receipt.receiptSha256
  }
  assert.throws(() => buildReleaseRecoveryPlan({
    executionPlan: input.executionPlan,
    executionReceipts: completedReceipts,
    releaseCandidateEvidence: input.candidate,
    releaseCandidateEvidenceRaw: input.candidateRaw,
  }), { code: 'MAS-DEP-042' })
  assert.throws(() => buildReleaseRecoveryPlan({
    executionPlan: input.executionPlan,
    executionReceipts: input.executionReceipts,
    releaseCandidateEvidence: input.candidate,
    releaseCandidateEvidenceRaw: `${input.candidateRaw} `,
  }), { code: 'MAS-DEP-042' })
})

test('tampered and overlong recovery journals cannot become closure evidence', () => {
  const input = fixture({ failureStepIndex: 2 })
  const plan = buildReleaseRecoveryPlan({
    executionPlan: input.executionPlan,
    executionReceipts: input.executionReceipts,
    releaseCandidateEvidence: input.candidate,
    releaseCandidateEvidenceRaw: input.candidateRaw,
    now: new Date('2026-07-23T10:10:00.000Z'),
  })
  const evaluation = evaluateRecoveryReceipts({ plan, receipts: [], now: new Date('2026-07-23T14:00:00.000Z'), maxDurationMinutes: 120 })
  assert.equal(evaluation.complete, false)
  const evidence = buildRecoveryVerification({ plan, receipts: [], now: new Date('2026-07-23T14:00:00.000Z'), maxDurationMinutes: 120 })
  assert.equal(evidence.status, 'incomplete')
  const tampered = { ...evidence, status: 'rolled-back' }
  assert.equal(validateReleaseRecoveryEvidence({ evidence: tampered, evidenceRaw: JSON.stringify(tampered) }).ok, false)
})

test('write-once source copies are revalidated before any recovery command', () => {
  const directory = mkdtempSync(join(tmpdir(), 'masabu-recovery-source-'))
  try {
    const input = fixture({ failureStepIndex: 2 })
    const paths = writeSource(directory, input)
    const journal = join(directory, 'recovery')
    assert.equal(runCli(['init', '--execution-journal', paths.executionJournal, '--release-candidate-evidence', paths.candidatePath, '--output', journal], ROOT), 0)
    const sourceCandidate = join(journal, 'source', 'release-candidate-evidence.json')
    writeFileSync(sourceCandidate, `${readFileSync(sourceCandidate, 'utf8')} `)
    assert.equal(runCli(['status', '--input', journal], ROOT), 2)
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})
