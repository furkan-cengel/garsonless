import { createHash } from 'node:crypto'
import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import {
  RELEASE_EXECUTION_STEPS,
  evaluateExecutionReceipts,
  validateReleaseExecutionPlan,
} from './production-release-execution.mjs'
import {
  RELEASE_APPLICATIONS,
  RELEASE_EDGE_FUNCTIONS,
} from './production-release-contract.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const MAX_FUTURE_SKEW_MS = 5 * 60 * 1000
const PLAN_FILE = 'recovery-plan.json'
const RECEIPTS_DIRECTORY = 'receipts'
const SOURCE_DIRECTORY = 'source'
const SOURCE_EXECUTION_DIRECTORY = 'execution'
const SOURCE_CANDIDATE_FILE = 'release-candidate-evidence.json'
const sha256 = (value) => createHash('sha256').update(value).digest('hex')
const issue = (code, subject, message) => ({ code, subject, message })

const REQUIRED_STEPS = Object.freeze({
  abort: Object.freeze({ key: 'release-abort-declared', label: 'Release iptalini ilan et', mutatesProduction: false, evidenceKind: 'operator-abort-decision' }),
  incidentOpen: Object.freeze({ key: 'incident-opened', label: 'Incident kaydını aç', mutatesProduction: false, evidenceKind: 'incident-record' }),
  traffic: Object.freeze({ key: 'production-traffic-contained', label: 'Production trafiğini güvenli moda al', mutatesProduction: true, evidenceKind: 'traffic-containment' }),
  applications: Object.freeze({ key: 'applications-restored', label: 'Önceki uygulama artifactlarını geri yükle', mutatesProduction: true, evidenceKind: 'application-rollback' }),
  edge: Object.freeze({ key: 'edge-runtime-restored', label: 'Önceki Edge runtime artifactlarını geri yükle', mutatesProduction: true, evidenceKind: 'edge-rollback' }),
  database: Object.freeze({ key: 'database-recovery-completed', label: 'Veritabanı recovery kararını uygula', mutatesProduction: true, evidenceKind: 'database-recovery' }),
  runtime: Object.freeze({ key: 'runtime-health-reverified', label: 'Runtime sağlığını yeniden doğrula', mutatesProduction: false, evidenceKind: 'runtime-recovery-verification' }),
  smoke: Object.freeze({ key: 'business-smoke-reverified', label: 'İş-kritik smoke matrisini yeniden doğrula', mutatesProduction: false, evidenceKind: 'smoke-recovery-verification' }),
  incidentClose: Object.freeze({ key: 'incident-closed', label: 'Incident kaydını kanıtla ve kapat', mutatesProduction: false, evidenceKind: 'incident-closure' }),
  windowClose: Object.freeze({ key: 'change-window-closed', label: 'Değişiklik penceresini kapat', mutatesProduction: false, evidenceKind: 'operator-window-closure' }),
})

function recoveryError(code, message) {
  return Object.assign(new Error(message), { code })
}

function hasExactKeys(value, expected) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const actual = Object.keys(value).sort()
  const wanted = [...expected].sort()
  return actual.length === wanted.length && actual.every((key, index) => key === wanted[index])
}

function isSha256(value) {
  return /^[a-f0-9]{64}$/.test(value ?? '')
}

function verifySelfHash(value, hashKey, code, subject, errors) {
  if (!value || !isSha256(value[hashKey])) {
    errors.push(issue(code, subject, 'SHA-256 kimliği eksik veya geçersiz.'))
    return false
  }
  const { [hashKey]: artifactSha256, ...contents } = value
  if (sha256(JSON.stringify(contents)) !== artifactSha256) {
    errors.push(issue(code, subject, 'İçerik SHA-256 kimliğiyle uyuşmuyor.'))
    return false
  }
  return true
}

function validateRollbackArtifactMap({ value, names, candidateCommitSha, subject, errors }) {
  if (!hasExactKeys(value, names)) {
    errors.push(issue('MAS-DEP-042', subject, 'Rollback artifact envanteri exact sözleşmeyle uyuşmuyor.'))
    return
  }
  const keys = ['sourceCommitSha', 'artifactSha256', 'available', 'restoreProcedureVerified']
  for (const name of names) {
    const artifact = value[name]
    if (
      !hasExactKeys(artifact, keys)
      || !/^[a-f0-9]{40}$/.test(artifact?.sourceCommitSha ?? '')
      || artifact?.sourceCommitSha === candidateCommitSha
      || !isSha256(artifact?.artifactSha256)
      || artifact?.available !== true
      || artifact?.restoreProcedureVerified !== true
    ) errors.push(issue('MAS-DEP-042', `${subject}:${name}`, 'Önceki immutable artifact ve restore prosedürü doğrulanmalı.'))
  }
}

function validateCandidateForRecovery({ candidate, candidateRaw, executionPlan }) {
  const errors = []
  const keys = [
    'schemaVersion', 'kind', 'environment', 'status', 'projectRef', 'capturedAt',
    'commitSha', 'releaseArtifactSha256', 'rehearsalArtifactSha256',
    'bundleManifestSha256', 'freeze', 'rollbackArtifacts',
    'productionMutationPerformed',
  ]
  if (!hasExactKeys(candidate, keys)) errors.push(issue('MAS-DEP-042', 'release-candidate-evidence', 'Candidate kanıtı yalnız izin verilen alanları içerebilir.'))
  const freezeKeys = ['sourceCommitPushed', 'changeSetFrozen', 'bundleIntegrityVerified', 'rollbackArtifactsCaptured']
  if (!hasExactKeys(candidate?.freeze, freezeKeys) || freezeKeys.some((key) => candidate?.freeze?.[key] !== true)) {
    errors.push(issue('MAS-DEP-042', 'release-freeze', 'Recovery yalnız doğrulanmış frozen candidate ile başlatılabilir.'))
  }
  if (!hasExactKeys(candidate?.rollbackArtifacts, ['applications', 'edgeFunctions'])) {
    errors.push(issue('MAS-DEP-042', 'rollback-artifacts', 'Rollback artifact grupları eksik.'))
  } else {
    validateRollbackArtifactMap({ value: candidate.rollbackArtifacts.applications, names: RELEASE_APPLICATIONS, candidateCommitSha: executionPlan?.commitSha, subject: 'applications', errors })
    validateRollbackArtifactMap({ value: candidate.rollbackArtifacts.edgeFunctions, names: RELEASE_EDGE_FUNCTIONS, candidateCommitSha: executionPlan?.commitSha, subject: 'edge-functions', errors })
  }
  if (
    candidate?.schemaVersion !== 1
    || candidate?.kind !== 'masabu-production-release-candidate-evidence'
    || candidate?.environment !== 'production'
    || candidate?.status !== 'frozen'
    || candidate?.projectRef !== executionPlan?.projectRef
    || candidate?.commitSha !== executionPlan?.commitSha
    || candidate?.releaseArtifactSha256 !== executionPlan?.releaseArtifactSha256
    || candidate?.rehearsalArtifactSha256 !== executionPlan?.rehearsalArtifactSha256
    || candidate?.bundleManifestSha256 !== executionPlan?.bundleManifestSha256
    || candidate?.productionMutationPerformed !== false
    || typeof candidateRaw !== 'string'
    || sha256(typeof candidateRaw === 'string' ? candidateRaw : '') !== executionPlan?.releaseCandidateEvidenceSha256
  ) errors.push(issue('MAS-DEP-042', 'release-candidate-bindings', 'Candidate kanıtı başarısız execution release kimliğiyle uyuşmuyor.'))
  return { ok: errors.length === 0, errors }
}

function buildRecoverySteps({ attemptedStepKeys }) {
  const attempted = new Set(attemptedStepKeys)
  const databaseTouched = attempted.has('migrations-applied')
  const edgeTouched = attempted.has('edge-runtime-deployed')
  const applicationsTouched = attempted.has('applications-deployed')
  const mutationRiskDetected = databaseTouched || edgeTouched || applicationsTouched
  const steps = [REQUIRED_STEPS.abort, REQUIRED_STEPS.incidentOpen]
  if (mutationRiskDetected) steps.push(REQUIRED_STEPS.traffic)
  if (applicationsTouched) steps.push(REQUIRED_STEPS.applications)
  if (edgeTouched) steps.push(REQUIRED_STEPS.edge)
  if (databaseTouched) steps.push(REQUIRED_STEPS.database)
  steps.push(REQUIRED_STEPS.runtime, REQUIRED_STEPS.smoke, REQUIRED_STEPS.incidentClose, REQUIRED_STEPS.windowClose)
  return steps.map((step, index) => ({ position: index + 1, ...step }))
}

function validateFailedExecutionSource({ executionPlan, executionReceipts, now }) {
  const errors = [...validateReleaseExecutionPlan(executionPlan).errors]
  const evaluation = evaluateExecutionReceipts({
    plan: executionPlan,
    receipts: executionReceipts,
    now,
    maxDurationMinutes: Number.MAX_SAFE_INTEGER,
  })
  errors.push(...evaluation.errors.filter((item) => item.code !== 'MAS-DEP-041'))
  const lastReceipt = executionReceipts.at(-1)
  if (
    evaluation.complete
    || executionReceipts.length === 0
    || lastReceipt?.status !== 'failed'
    || !isSha256(lastReceipt?.receiptSha256)
  ) errors.push(issue('MAS-DEP-042', 'failed-execution-source', 'Recovery yalnız son receipt’i failed olan tamamlanmamış execution üzerinden başlatılabilir.'))
  return { ok: errors.length === 0, errors, evaluation, lastReceipt }
}

export function buildReleaseRecoveryPlan({
  executionPlan,
  executionReceipts,
  releaseCandidateEvidence,
  releaseCandidateEvidenceRaw,
  now = new Date(),
}) {
  const source = validateFailedExecutionSource({ executionPlan, executionReceipts, now })
  if (!source.ok) throw recoveryError(source.errors[0].code, source.errors[0].message)
  const candidate = validateCandidateForRecovery({
    candidate: releaseCandidateEvidence,
    candidateRaw: releaseCandidateEvidenceRaw,
    executionPlan,
  })
  if (!candidate.ok) throw recoveryError(candidate.errors[0].code, candidate.errors[0].message)
  const attemptedStepKeys = [...new Set(executionReceipts.map((receipt) => receipt.stepKey))]
  const steps = buildRecoverySteps({ attemptedStepKeys })
  const mutationRiskDetected = steps.some((step) => step.mutatesProduction)
  const contents = {
    schemaVersion: 1,
    kind: 'masabu-production-release-recovery-plan',
    environment: 'production',
    projectRef: executionPlan.projectRef,
    createdAt: now.toISOString(),
    commitSha: executionPlan.commitSha,
    releaseArtifactSha256: executionPlan.releaseArtifactSha256,
    bundleManifestSha256: executionPlan.bundleManifestSha256,
    preDeployDecisionSha256: executionPlan.preDeployDecisionSha256,
    sourceExecutionPlanSha256: executionPlan.artifactSha256,
    sourceExecutionLastReceiptSha256: source.lastReceipt.receiptSha256,
    sourceExecutionFailureEvidenceSha256: source.lastReceipt.evidenceArtifactSha256,
    releaseCandidateEvidenceSha256: executionPlan.releaseCandidateEvidenceSha256,
    failureStepKey: source.lastReceipt.stepKey,
    recoveryMode: mutationRiskDetected ? 'rollback-required' : 'abort-only',
    productionMutationRiskDetected: mutationRiskDetected,
    attemptedExecutionSteps: attemptedStepKeys,
    steps,
    toolProductionMutationPerformed: false,
  }
  return { ...contents, artifactSha256: sha256(JSON.stringify(contents)) }
}

export function validateReleaseRecoveryPlan(plan) {
  const errors = []
  const keys = [
    'schemaVersion', 'kind', 'environment', 'projectRef', 'createdAt', 'commitSha',
    'releaseArtifactSha256', 'bundleManifestSha256', 'preDeployDecisionSha256',
    'sourceExecutionPlanSha256', 'sourceExecutionLastReceiptSha256',
    'sourceExecutionFailureEvidenceSha256', 'releaseCandidateEvidenceSha256',
    'failureStepKey', 'recoveryMode', 'productionMutationRiskDetected',
    'attemptedExecutionSteps', 'steps', 'toolProductionMutationPerformed',
    'artifactSha256',
  ]
  if (!hasExactKeys(plan, keys)) errors.push(issue('MAS-DEP-042', 'recovery-plan', 'Recovery planı yalnız izin verilen alanları içerebilir.'))
  verifySelfHash(plan, 'artifactSha256', 'MAS-DEP-042', 'recovery-plan', errors)
  const expectedSteps = buildRecoverySteps({ attemptedStepKeys: plan?.attemptedExecutionSteps ?? [] })
  const expectedMode = expectedSteps.some((step) => step.mutatesProduction) ? 'rollback-required' : 'abort-only'
  if (
    plan?.schemaVersion !== 1
    || plan?.kind !== 'masabu-production-release-recovery-plan'
    || plan?.environment !== 'production'
    || !/^[a-z0-9]{20}$/.test(plan?.projectRef ?? '')
    || !Number.isFinite(Date.parse(plan?.createdAt ?? ''))
    || !/^[a-f0-9]{40}$/.test(plan?.commitSha ?? '')
    || !isSha256(plan?.releaseArtifactSha256)
    || !isSha256(plan?.bundleManifestSha256)
    || !isSha256(plan?.preDeployDecisionSha256)
    || !isSha256(plan?.sourceExecutionPlanSha256)
    || !isSha256(plan?.sourceExecutionLastReceiptSha256)
    || !isSha256(plan?.sourceExecutionFailureEvidenceSha256)
    || !isSha256(plan?.releaseCandidateEvidenceSha256)
    || !RELEASE_EXECUTION_STEPS.some((step) => step.key === plan?.failureStepKey)
    || !Array.isArray(plan?.attemptedExecutionSteps)
    || new Set(plan?.attemptedExecutionSteps ?? []).size !== plan?.attemptedExecutionSteps?.length
    || plan?.attemptedExecutionSteps?.some((key) => !RELEASE_EXECUTION_STEPS.some((step) => step.key === key))
    || plan?.recoveryMode !== expectedMode
    || plan?.productionMutationRiskDetected !== (expectedMode === 'rollback-required')
    || JSON.stringify(plan?.steps) !== JSON.stringify(expectedSteps)
    || plan?.toolProductionMutationPerformed !== false
  ) errors.push(issue('MAS-DEP-042', 'recovery-plan-bindings', 'Recovery plan kimliği veya conditional adım sözleşmesi geçersiz.'))
  return { ok: errors.length === 0, errors }
}

export function validateRecoverySourceBinding({
  plan,
  executionPlan,
  executionReceipts,
  releaseCandidateEvidence,
  releaseCandidateEvidenceRaw,
}) {
  const errors = []
  try {
    const expected = buildReleaseRecoveryPlan({
      executionPlan,
      executionReceipts,
      releaseCandidateEvidence,
      releaseCandidateEvidenceRaw,
      now: new Date(plan?.createdAt),
    })
    if (JSON.stringify(plan) !== JSON.stringify(expected)) {
      errors.push(issue('MAS-DEP-042', 'recovery-source-bindings', 'Recovery planı write-once kaynak artifact’larından yeniden üretilemiyor.'))
    }
  } catch (error) {
    errors.push(issue(error.code ?? 'MAS-DEP-042', 'recovery-source-bindings', error.message))
  }
  return { ok: errors.length === 0, errors }
}

export function buildReleaseRecoveryReceipt({ plan, sequence, step, attempt, status, capturedAt, evidenceArtifactSha256, previousReceiptSha256 }) {
  const contents = {
    schemaVersion: 1,
    kind: 'masabu-production-release-recovery-step-receipt',
    projectRef: plan.projectRef,
    planArtifactSha256: plan.artifactSha256,
    sequence,
    stepPosition: step.position,
    stepKey: step.key,
    attempt,
    status,
    capturedAt,
    evidenceArtifactSha256,
    previousReceiptSha256,
    productionMutationPerformed: step.mutatesProduction,
  }
  return { ...contents, receiptSha256: sha256(JSON.stringify(contents)) }
}

function validateReceiptShape(receipt, plan, errors) {
  const keys = [
    'schemaVersion', 'kind', 'projectRef', 'planArtifactSha256', 'sequence',
    'stepPosition', 'stepKey', 'attempt', 'status', 'capturedAt',
    'evidenceArtifactSha256', 'previousReceiptSha256',
    'productionMutationPerformed', 'receiptSha256',
  ]
  if (!hasExactKeys(receipt, keys)) errors.push(issue('MAS-DEP-043', `receipt:${receipt?.sequence ?? 'unknown'}`, 'Recovery receipt’i yalnız izin verilen alanları içerebilir.'))
  verifySelfHash(receipt, 'receiptSha256', 'MAS-DEP-043', `receipt:${receipt?.sequence ?? 'unknown'}`, errors)
  const step = plan?.steps?.[receipt?.stepPosition - 1]
  if (
    receipt?.schemaVersion !== 1
    || receipt?.kind !== 'masabu-production-release-recovery-step-receipt'
    || receipt?.projectRef !== plan?.projectRef
    || receipt?.planArtifactSha256 !== plan?.artifactSha256
    || !Number.isInteger(receipt?.sequence) || receipt.sequence < 1
    || !Number.isInteger(receipt?.attempt) || receipt.attempt < 1
    || !['succeeded', 'failed'].includes(receipt?.status)
    || !Number.isFinite(Date.parse(receipt?.capturedAt ?? ''))
    || !isSha256(receipt?.evidenceArtifactSha256)
    || !(receipt?.previousReceiptSha256 === null || isSha256(receipt.previousReceiptSha256))
    || !step || receipt?.stepKey !== step.key
    || receipt?.productionMutationPerformed !== step?.mutatesProduction
  ) errors.push(issue('MAS-DEP-043', `receipt:${receipt?.sequence ?? 'unknown'}`, 'Recovery receipt kimliği veya durum sözleşmesi geçersiz.'))
}

export function evaluateRecoveryReceipts({ plan, receipts, now = new Date(), maxDurationMinutes = 120 }) {
  const errors = [...validateReleaseRecoveryPlan(plan).errors]
  if (!Array.isArray(receipts)) errors.push(issue('MAS-DEP-043', 'receipts', 'Recovery receipt listesi geçersiz.'))
  const safeReceipts = Array.isArray(receipts) ? receipts : []
  safeReceipts.forEach((receipt) => validateReceiptShape(receipt, plan, errors))
  let nextStepIndex = 0
  let expectedAttempt = 1
  let previousHash = null
  let previousTime = Date.parse(plan?.createdAt ?? '')
  const evidenceHashes = new Set()
  const completedSteps = []
  let recordedRecoveryMutationPerformed = false
  let pausedAfterFailure = false

  for (let index = 0; index < safeReceipts.length; index += 1) {
    const receipt = safeReceipts[index]
    const expectedStep = plan?.steps?.[nextStepIndex]
    const capturedAt = Date.parse(receipt?.capturedAt ?? '')
    if (receipt?.sequence !== index + 1) errors.push(issue('MAS-DEP-043', `receipt:${index + 1}`, 'Recovery receipt sequence zinciri kesintisiz değil.'))
    if (receipt?.previousReceiptSha256 !== previousHash) errors.push(issue('MAS-DEP-043', `receipt:${index + 1}`, 'Recovery receipt önceki hash zinciriyle uyuşmuyor.'))
    if (receipt?.stepKey !== expectedStep?.key || receipt?.stepPosition !== expectedStep?.position || receipt?.attempt !== expectedAttempt) {
      errors.push(issue('MAS-DEP-043', `receipt:${index + 1}`, 'Receipt beklenen sonraki recovery adımı/attempt ile uyuşmuyor.'))
    }
    if (!Number.isFinite(capturedAt) || capturedAt < previousTime || capturedAt > now.getTime() + MAX_FUTURE_SKEW_MS) {
      errors.push(issue('MAS-DEP-043', `receipt:${index + 1}`, 'Recovery receipt zamanı monoton değil veya gelecekte.'))
    }
    if (evidenceHashes.has(receipt?.evidenceArtifactSha256)) errors.push(issue('MAS-DEP-043', `receipt:${index + 1}`, 'Aynı dış kanıt birden fazla recovery receipt’inde kullanılamaz.'))
    evidenceHashes.add(receipt?.evidenceArtifactSha256)
    recordedRecoveryMutationPerformed ||= receipt?.productionMutationPerformed === true
    previousHash = receipt?.receiptSha256 ?? null
    previousTime = capturedAt
    if (receipt?.status === 'succeeded') {
      if (expectedStep) completedSteps.push(expectedStep.key)
      nextStepIndex += 1
      expectedAttempt = 1
      pausedAfterFailure = false
    } else {
      expectedAttempt += 1
      pausedAfterFailure = true
    }
  }

  const startedAt = safeReceipts[0]?.capturedAt ?? null
  const completedAt = nextStepIndex === plan?.steps?.length && !pausedAfterFailure
    ? safeReceipts.at(-1)?.capturedAt ?? null
    : null
  const duration = startedAt ? now.getTime() - Date.parse(startedAt) : 0
  const completedDuration = startedAt && completedAt ? Date.parse(completedAt) - Date.parse(startedAt) : 0
  if ((startedAt && !completedAt && duration > maxDurationMinutes * 60_000)
    || (completedAt && completedDuration > maxDurationMinutes * 60_000)) {
    errors.push(issue('MAS-DEP-044', 'recovery-duration', `Recovery ${maxDurationMinutes} dakikalık izin verilen pencereyi aştı.`))
  }
  const complete = nextStepIndex === plan?.steps?.length && !pausedAfterFailure && errors.length === 0
  return {
    ok: errors.length === 0,
    complete,
    errors,
    nextStep: complete ? null : plan?.steps?.[nextStepIndex] ?? null,
    nextAttempt: complete ? null : expectedAttempt,
    pausedAfterFailure,
    completedSteps,
    startedAt,
    completedAt,
    lastReceiptSha256: previousHash,
    recordedRecoveryMutationPerformed,
  }
}

export function buildRecoveryVerification({ plan, receipts, now = new Date(), maxDurationMinutes = 120 }) {
  const evaluation = evaluateRecoveryReceipts({ plan, receipts, now, maxDurationMinutes })
  const status = evaluation.complete
    ? plan.recoveryMode === 'rollback-required' ? 'rolled-back' : 'aborted-no-mutation'
    : evaluation.errors.length > 0 ? 'invalid' : 'incomplete'
  const incidentReceipt = receipts?.find((receipt) => receipt.stepKey === 'incident-opened' && receipt.status === 'succeeded')
  const closureReceipt = receipts?.find((receipt) => receipt.stepKey === 'incident-closed' && receipt.status === 'succeeded')
  const contents = {
    schemaVersion: 1,
    kind: 'masabu-production-release-recovery-evidence',
    status,
    projectRef: plan?.projectRef ?? null,
    commitSha: plan?.commitSha ?? null,
    plan: plan ? { ...plan } : null,
    startedAt: evaluation.startedAt,
    completedAt: evaluation.completedAt,
    receiptCount: receipts?.length ?? 0,
    lastReceiptSha256: evaluation.lastReceiptSha256,
    completedSteps: evaluation.completedSteps,
    receipts: (receipts ?? []).map((receipt) => ({ ...receipt })),
    incidentEvidenceSha256: incidentReceipt?.evidenceArtifactSha256 ?? null,
    incidentClosureEvidenceSha256: closureReceipt?.evidenceArtifactSha256 ?? null,
    releaseAccepted: false,
    recordedRecoveryMutationPerformed: evaluation.recordedRecoveryMutationPerformed,
    toolProductionMutationPerformed: false,
    errors: evaluation.errors.map(({ code, subject }) => ({ code, subject })),
  }
  return { ...contents, artifactSha256: sha256(JSON.stringify(contents)) }
}

export function validateReleaseRecoveryEvidence({
  evidence,
  evidenceRaw,
  executionPlan,
  executionReceipts,
  releaseCandidateEvidence,
  releaseCandidateEvidenceRaw,
  now = new Date(),
  maxDurationMinutes = 120,
}) {
  const errors = []
  const keys = [
    'schemaVersion', 'kind', 'status', 'projectRef', 'commitSha', 'plan',
    'startedAt', 'completedAt', 'receiptCount', 'lastReceiptSha256',
    'completedSteps', 'receipts', 'incidentEvidenceSha256',
    'incidentClosureEvidenceSha256', 'releaseAccepted',
    'recordedRecoveryMutationPerformed', 'toolProductionMutationPerformed',
    'errors', 'artifactSha256',
  ]
  if (!hasExactKeys(evidence, keys)) errors.push(issue('MAS-DEP-044', 'release-recovery-evidence', 'Recovery kanıtı yalnız izin verilen alanları içerebilir.'))
  verifySelfHash(evidence, 'artifactSha256', 'MAS-DEP-044', 'release-recovery-evidence', errors)
  errors.push(...validateRecoverySourceBinding({
    plan: evidence?.plan,
    executionPlan,
    executionReceipts,
    releaseCandidateEvidence,
    releaseCandidateEvidenceRaw,
  }).errors)
  const evaluation = evaluateRecoveryReceipts({
    plan: evidence?.plan,
    receipts: evidence?.receipts,
    now,
    maxDurationMinutes,
  })
  const expectedStatus = evidence?.plan?.recoveryMode === 'rollback-required' ? 'rolled-back' : 'aborted-no-mutation'
  const incidentReceipt = evidence?.receipts?.find((receipt) => receipt.stepKey === 'incident-opened' && receipt.status === 'succeeded')
  const closureReceipt = evidence?.receipts?.find((receipt) => receipt.stepKey === 'incident-closed' && receipt.status === 'succeeded')
  if (
    evidence?.schemaVersion !== 1
    || evidence?.kind !== 'masabu-production-release-recovery-evidence'
    || evidence?.status !== expectedStatus
    || !evaluation.complete
    || evidence?.projectRef !== evidence?.plan?.projectRef
    || evidence?.commitSha !== evidence?.plan?.commitSha
    || evidence?.startedAt !== evaluation.startedAt
    || evidence?.completedAt !== evaluation.completedAt
    || evidence?.receiptCount !== evidence?.receipts?.length
    || evidence?.lastReceiptSha256 !== evaluation.lastReceiptSha256
    || JSON.stringify(evidence?.completedSteps) !== JSON.stringify(evaluation.completedSteps)
    || evidence?.incidentEvidenceSha256 !== incidentReceipt?.evidenceArtifactSha256
    || evidence?.incidentClosureEvidenceSha256 !== closureReceipt?.evidenceArtifactSha256
    || !isSha256(evidence?.incidentEvidenceSha256)
    || !isSha256(evidence?.incidentClosureEvidenceSha256)
    || evidence?.releaseAccepted !== false
    || evidence?.recordedRecoveryMutationPerformed !== evaluation.recordedRecoveryMutationPerformed
    || evidence?.toolProductionMutationPerformed !== false
    || !Array.isArray(evidence?.errors) || evidence.errors.length !== 0
    || typeof evidenceRaw !== 'string'
  ) errors.push(issue('MAS-DEP-044', 'release-recovery-bindings', 'Recovery kanıtı tamamlanmış incident/rollback zinciriyle uyuşmuyor.'))
  return { ok: errors.length === 0, errors, sha256: sha256(typeof evidenceRaw === 'string' ? evidenceRaw : '') }
}

function readJson(path, subject) {
  if (!path || !existsSync(path)) throw recoveryError('MAS-DEP-001', `${subject} dosyası eksik veya okunamıyor.`)
  return JSON.parse(readFileSync(path, 'utf8'))
}

function readJournal(input, planName) {
  const plan = readJson(resolve(input, planName), planName)
  const receiptsPath = resolve(input, RECEIPTS_DIRECTORY)
  const names = existsSync(receiptsPath) ? readdirSync(receiptsPath).sort() : []
  if (names.some((name) => !/^\d{4}\.json$/.test(name))) throw recoveryError('MAS-DEP-043', 'Receipts dizini tanımsız dosya içeriyor.')
  const receipts = names.map((name) => readJson(resolve(receiptsPath, name), `Receipt ${name}`))
  return { plan, receipts, receiptsPath }
}

function readRecoveryJournal(input) {
  const recovery = readJournal(input, PLAN_FILE)
  const sourceRoot = resolve(input, SOURCE_DIRECTORY)
  const execution = readJournal(resolve(sourceRoot, SOURCE_EXECUTION_DIRECTORY), 'execution-plan.json')
  const candidatePath = resolve(sourceRoot, SOURCE_CANDIDATE_FILE)
  const releaseCandidateEvidenceRaw = readFileSync(candidatePath, 'utf8')
  const source = {
    executionPlan: execution.plan,
    executionReceipts: execution.receipts,
    releaseCandidateEvidence: JSON.parse(releaseCandidateEvidenceRaw),
    releaseCandidateEvidenceRaw,
  }
  const binding = validateRecoverySourceBinding({ plan: recovery.plan, ...source })
  if (!binding.ok) throw recoveryError(binding.errors[0].code, binding.errors[0].message)
  return { ...recovery, source }
}

function parseArguments(argv) {
  const args = argv.filter((arg) => arg !== '--')
  const command = args.shift()
  const options = {}
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    if (arg === '--execution-journal') options.executionJournal = args[++index]
    else if (arg === '--release-candidate-evidence') options.releaseCandidateEvidence = args[++index]
    else if (arg === '--input') options.input = args[++index]
    else if (arg === '--output') options.output = args[++index]
    else if (arg === '--step') options.step = args[++index]
    else if (arg === '--status') options.status = args[++index]
    else if (arg === '--captured-at') options.capturedAt = args[++index]
    else if (arg === '--evidence-sha256') options.evidenceSha256 = args[++index]
    else if (arg === '--max-duration-minutes') options.maxDurationMinutes = Number(args[++index])
    else throw recoveryError('MAS-DEP-006', `Bilinmeyen argüman: ${arg}`)
  }
  return { command, options }
}

export function runCli(argv = process.argv.slice(2), root = ROOT) {
  try {
    const { command, options } = parseArguments(argv)
    const maxDurationMinutes = options.maxDurationMinutes ?? 120
    if (command === 'init') {
      for (const name of ['executionJournal', 'releaseCandidateEvidence', 'output']) {
        if (!options[name]) throw recoveryError('MAS-DEP-006', `init için --${name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)} zorunlu.`)
      }
      const source = readJournal(resolve(root, options.executionJournal), 'execution-plan.json')
      const candidatePath = resolve(root, options.releaseCandidateEvidence)
      const candidateRaw = readFileSync(candidatePath, 'utf8')
      const plan = buildReleaseRecoveryPlan({
        executionPlan: source.plan,
        executionReceipts: source.receipts,
        releaseCandidateEvidence: JSON.parse(candidateRaw),
        releaseCandidateEvidenceRaw: candidateRaw,
      })
      const output = resolve(root, options.output)
      mkdirSync(output, { mode: 0o700 })
      chmodSync(output, 0o700)
      mkdirSync(resolve(output, RECEIPTS_DIRECTORY), { mode: 0o700 })
      const sourceRoot = resolve(output, SOURCE_DIRECTORY)
      const sourceExecutionRoot = resolve(sourceRoot, SOURCE_EXECUTION_DIRECTORY)
      const sourceExecutionReceipts = resolve(sourceExecutionRoot, RECEIPTS_DIRECTORY)
      mkdirSync(sourceExecutionReceipts, { recursive: true, mode: 0o700 })
      chmodSync(sourceRoot, 0o700)
      chmodSync(sourceExecutionRoot, 0o700)
      chmodSync(sourceExecutionReceipts, 0o700)
      writeFileSync(resolve(output, PLAN_FILE), `${JSON.stringify(plan, null, 2)}\n`, { mode: 0o600, flag: 'wx' })
      writeFileSync(resolve(sourceExecutionRoot, 'execution-plan.json'), `${JSON.stringify(source.plan, null, 2)}\n`, { mode: 0o600, flag: 'wx' })
      source.receipts.forEach((receipt, index) => {
        writeFileSync(resolve(sourceExecutionReceipts, `${String(index + 1).padStart(4, '0')}.json`), `${JSON.stringify(receipt, null, 2)}\n`, { mode: 0o600, flag: 'wx' })
      })
      writeFileSync(resolve(sourceRoot, SOURCE_CANDIDATE_FILE), candidateRaw, { mode: 0o600, flag: 'wx' })
      console.log('Masabu production release recovery journal: INITIALIZED')
      console.log(`Mode: ${plan.recoveryMode}`)
      console.log(`Next step: ${plan.steps[0].key}`)
      console.log('Production mutation: none (journal tooling only)')
      return 0
    }
    if (!options.input) throw recoveryError('MAS-DEP-006', `${command ?? 'command'} için --input zorunlu.`)
    const input = resolve(root, options.input)
    const { plan, receipts, receiptsPath, source } = readRecoveryJournal(input)
    const evaluation = evaluateRecoveryReceipts({ plan, receipts, maxDurationMinutes })
    if (command === 'status') {
      console.log(`Masabu production release recovery: ${evaluation.complete ? 'COMPLETE' : evaluation.pausedAfterFailure ? 'PAUSED' : 'IN PROGRESS'}`)
      console.log(`Receipts: ${receipts.length}`)
      console.log(`Next step: ${evaluation.nextStep?.key ?? 'none'}`)
      console.log(`Next attempt: ${evaluation.nextAttempt ?? 'none'}`)
      for (const item of evaluation.errors) console.error(`ERROR ${item.code} ${item.subject}`)
      return evaluation.errors.length > 0 ? 1 : 0
    }
    if (command === 'record') {
      if (!options.step || !options.status || !options.evidenceSha256) throw recoveryError('MAS-DEP-006', 'record için --step, --status ve --evidence-sha256 zorunlu.')
      if (!evaluation.ok || evaluation.complete) throw recoveryError('MAS-DEP-043', evaluation.complete ? 'Recovery zaten tamamlandı.' : 'Mevcut recovery receipt zinciri geçersiz.')
      if (options.step !== evaluation.nextStep?.key) throw recoveryError('MAS-DEP-043', `Beklenen sonraki adım: ${evaluation.nextStep?.key}.`)
      if (!['succeeded', 'failed'].includes(options.status) || !isSha256(options.evidenceSha256)) throw recoveryError('MAS-DEP-043', 'Receipt status veya evidence SHA-256 geçersiz.')
      const sequence = receipts.length + 1
      const receipt = buildReleaseRecoveryReceipt({
        plan,
        sequence,
        step: evaluation.nextStep,
        attempt: evaluation.nextAttempt,
        status: options.status,
        capturedAt: options.capturedAt ?? new Date().toISOString(),
        evidenceArtifactSha256: options.evidenceSha256,
        previousReceiptSha256: evaluation.lastReceiptSha256,
      })
      writeFileSync(resolve(receiptsPath, `${String(sequence).padStart(4, '0')}.json`), `${JSON.stringify(receipt, null, 2)}\n`, { mode: 0o600, flag: 'wx' })
      console.log(`Masabu production recovery step receipt: ${options.status.toUpperCase()}`)
      console.log(`Step: ${options.step}`)
      console.log(`Sequence: ${sequence}`)
      console.log(`Receipt SHA-256: ${receipt.receiptSha256}`)
      console.log('Tool production mutation: none')
      return options.status === 'succeeded' ? 0 : 1
    }
    if (command === 'verify') {
      if (!options.output) throw recoveryError('MAS-DEP-006', 'verify için --output zorunlu.')
      const verification = buildRecoveryVerification({ plan, receipts, maxDurationMinutes })
      const sourceValidation = validateReleaseRecoveryEvidence({
        evidence: verification,
        evidenceRaw: `${JSON.stringify(verification, null, 2)}\n`,
        ...source,
        maxDurationMinutes,
      })
      if (verification.status === 'rolled-back' || verification.status === 'aborted-no-mutation') {
        if (!sourceValidation.ok) throw recoveryError(sourceValidation.errors[0].code, sourceValidation.errors[0].message)
      }
      writeFileSync(resolve(root, options.output), `${JSON.stringify(verification, null, 2)}\n`, { mode: 0o600, flag: 'wx' })
      console.log(`Masabu production release recovery: ${verification.status.toUpperCase()}`)
      console.log(`Receipts: ${verification.receiptCount}`)
      console.log(`Recovery evidence SHA-256: ${verification.artifactSha256}`)
      console.log('Tool production mutation: none')
      for (const item of verification.errors) console.error(`ERROR ${item.code} ${item.subject}`)
      return ['rolled-back', 'aborted-no-mutation'].includes(verification.status) ? 0 : 1
    }
    throw recoveryError('MAS-DEP-006', 'Komut init, status, record veya verify olmalı.')
  } catch (error) {
    console.error(`${error.code ?? 'MAS-DEP-042'} release-recovery: ${error.message}`)
    return 2
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  process.exitCode = runCli()
}
