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

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const DEV_PROJECT_REF = 'yxsegwkzyiscrxiwdeuf'
const MAX_FUTURE_SKEW_MS = 5 * 60 * 1000
const PLAN_FILE = 'execution-plan.json'
const RECEIPTS_DIRECTORY = 'receipts'
const sha256 = (value) => createHash('sha256').update(value).digest('hex')
const issue = (code, subject, message) => ({ code, subject, message })

export const RELEASE_EXECUTION_STEPS = Object.freeze([
  Object.freeze({ position: 1, key: 'change-window-open', label: 'Değişiklik penceresini aç', mutatesProduction: false, evidenceKind: 'operator-approval' }),
  Object.freeze({ position: 2, key: 'migrations-applied', label: 'Migration zincirini uygula', mutatesProduction: true, evidenceKind: 'migration-post-deploy' }),
  Object.freeze({ position: 3, key: 'edge-runtime-deployed', label: 'Edge runtime bileşenlerini yayımla', mutatesProduction: true, evidenceKind: 'runtime-deployment' }),
  Object.freeze({ position: 4, key: 'applications-deployed', label: 'Uygulamaları aynı release kimliğiyle yayımla', mutatesProduction: true, evidenceKind: 'application-deployment' }),
  Object.freeze({ position: 5, key: 'runtime-health-verified', label: 'Runtime sağlığını doğrula', mutatesProduction: false, evidenceKind: 'runtime-post-deploy' }),
  Object.freeze({ position: 6, key: 'business-smoke-verified', label: 'İş-kritik smoke matrisini doğrula', mutatesProduction: false, evidenceKind: 'smoke-post-deploy' }),
  Object.freeze({ position: 7, key: 'rollback-readiness-reconfirmed', label: 'Rollback hazırlığını tekrar doğrula', mutatesProduction: false, evidenceKind: 'rollback-readiness' }),
])

function executionError(code, message) {
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

function assertProductionProjectRef(projectRef) {
  if (!/^[a-z0-9]{20}$/.test(projectRef ?? '') || projectRef === DEV_PROJECT_REF) {
    throw executionError('MAS-DEP-004', 'Production project ref geçersiz veya DEV projesine ait.')
  }
}

function verifyBundleAndDecision({ projectRef, bundleManifest, preDeployDecision }) {
  const errors = []
  verifySelfHash(bundleManifest, 'artifactSha256', 'MAS-DEP-039', 'bundle-manifest', errors)
  verifySelfHash(preDeployDecision, 'artifactSha256', 'MAS-DEP-039', 'pre-deploy-decision', errors)
  if (
    bundleManifest?.kind !== 'masabu-production-release-bundle'
    || bundleManifest?.projectRef !== projectRef
    || bundleManifest?.productionMutationPerformed !== false
  ) errors.push(issue('MAS-DEP-039', 'bundle-bindings', 'Bundle production release kimliğiyle uyuşmuyor.'))
  if (
    preDeployDecision?.schemaVersion !== 1
    || preDeployDecision?.mode !== 'pre-deploy'
    || preDeployDecision?.decision !== 'go-to-deploy'
    || preDeployDecision?.projectRef !== projectRef
    || preDeployDecision?.commitSha !== bundleManifest?.commitSha
    || preDeployDecision?.releaseArtifactSha256 !== bundleManifest?.releaseArtifactSha256
    || preDeployDecision?.rehearsalArtifactSha256 !== bundleManifest?.rehearsalArtifactSha256
    || preDeployDecision?.productionMutationPerformed !== false
    || Object.values(preDeployDecision?.gates ?? {}).some((value) => value !== true)
  ) errors.push(issue('MAS-DEP-039', 'pre-deploy-decision-bindings', 'Execution yalnız bütün kapıları geçen exact go-to-deploy kararından başlatılabilir.'))
  if (errors.length > 0) throw executionError(errors[0].code, errors[0].message)
}

export function buildReleaseExecutionPlan({ projectRef, bundleManifest, preDeployDecision, now = new Date() }) {
  assertProductionProjectRef(projectRef)
  verifyBundleAndDecision({ projectRef, bundleManifest, preDeployDecision })
  const createdAt = now.toISOString()
  const plan = {
    schemaVersion: 1,
    kind: 'masabu-production-release-execution-plan',
    environment: 'production',
    projectRef,
    createdAt,
    commitSha: bundleManifest.commitSha,
    releaseArtifactSha256: bundleManifest.releaseArtifactSha256,
    rehearsalArtifactSha256: bundleManifest.rehearsalArtifactSha256,
    bundleManifestSha256: bundleManifest.artifactSha256,
    preDeployDecisionSha256: preDeployDecision.artifactSha256,
    backupRestoreEvidenceSha256: preDeployDecision.backupRestoreEvidenceSha256,
    releaseCandidateEvidenceSha256: preDeployDecision.releaseCandidateEvidenceSha256,
    steps: RELEASE_EXECUTION_STEPS.map((step) => ({ ...step })),
    toolProductionMutationPerformed: false,
  }
  return { ...plan, artifactSha256: sha256(JSON.stringify(plan)) }
}

export function validateReleaseExecutionPlan(plan) {
  const errors = []
  const topKeys = [
    'schemaVersion', 'kind', 'environment', 'projectRef', 'createdAt', 'commitSha',
    'releaseArtifactSha256', 'rehearsalArtifactSha256', 'bundleManifestSha256',
    'preDeployDecisionSha256', 'backupRestoreEvidenceSha256',
    'releaseCandidateEvidenceSha256', 'steps', 'toolProductionMutationPerformed',
    'artifactSha256',
  ]
  if (!hasExactKeys(plan, topKeys)) errors.push(issue('MAS-DEP-039', 'execution-plan', 'Execution planı yalnız izin verilen alanları içerebilir.'))
  verifySelfHash(plan, 'artifactSha256', 'MAS-DEP-039', 'execution-plan', errors)
  const expectedSteps = RELEASE_EXECUTION_STEPS.map((step) => ({ ...step }))
  if (
    plan?.schemaVersion !== 1
    || plan?.kind !== 'masabu-production-release-execution-plan'
    || plan?.environment !== 'production'
    || !/^[a-z0-9]{20}$/.test(plan?.projectRef ?? '')
    || plan?.projectRef === DEV_PROJECT_REF
    || !Number.isFinite(Date.parse(plan?.createdAt ?? ''))
    || !/^[a-f0-9]{40}$/.test(plan?.commitSha ?? '')
    || !isSha256(plan?.releaseArtifactSha256)
    || !isSha256(plan?.rehearsalArtifactSha256)
    || !isSha256(plan?.bundleManifestSha256)
    || !isSha256(plan?.preDeployDecisionSha256)
    || !isSha256(plan?.backupRestoreEvidenceSha256)
    || !isSha256(plan?.releaseCandidateEvidenceSha256)
    || JSON.stringify(plan?.steps) !== JSON.stringify(expectedSteps)
    || plan?.toolProductionMutationPerformed !== false
  ) errors.push(issue('MAS-DEP-039', 'execution-plan-bindings', 'Execution plan kimliği veya sıralı adım sözleşmesi geçersiz.'))
  return { ok: errors.length === 0, errors }
}

export function buildReleaseExecutionReceipt({ plan, sequence, step, attempt, status, capturedAt, evidenceArtifactSha256, previousReceiptSha256 }) {
  const contents = {
    schemaVersion: 1,
    kind: 'masabu-production-release-step-receipt',
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
  if (!hasExactKeys(receipt, keys)) errors.push(issue('MAS-DEP-040', `receipt:${receipt?.sequence ?? 'unknown'}`, 'Adım makbuzu yalnız izin verilen alanları içerebilir.'))
  verifySelfHash(receipt, 'receiptSha256', 'MAS-DEP-040', `receipt:${receipt?.sequence ?? 'unknown'}`, errors)
  const step = RELEASE_EXECUTION_STEPS[receipt?.stepPosition - 1]
  if (
    receipt?.schemaVersion !== 1
    || receipt?.kind !== 'masabu-production-release-step-receipt'
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
  ) errors.push(issue('MAS-DEP-040', `receipt:${receipt?.sequence ?? 'unknown'}`, 'Adım makbuzu kimliği, durum veya mutation sözleşmesi geçersiz.'))
}

export function evaluateExecutionReceipts({ plan, receipts, now = new Date(), maxDurationMinutes = 180 }) {
  const errors = []
  errors.push(...validateReleaseExecutionPlan(plan).errors)
  if (!Array.isArray(receipts)) errors.push(issue('MAS-DEP-040', 'receipts', 'Makbuz listesi geçersiz.'))
  const safeReceipts = Array.isArray(receipts) ? receipts : []
  safeReceipts.forEach((receipt) => validateReceiptShape(receipt, plan, errors))
  let nextStepIndex = 0
  let expectedAttempt = 1
  let previousHash = null
  let previousTime = Date.parse(plan?.createdAt ?? '')
  const evidenceHashes = new Set()
  const completedSteps = []
  let recordedProductionMutationPerformed = false
  let pausedAfterFailure = false

  for (let index = 0; index < safeReceipts.length; index += 1) {
    const receipt = safeReceipts[index]
    const expectedStep = RELEASE_EXECUTION_STEPS[nextStepIndex]
    const capturedAt = Date.parse(receipt?.capturedAt ?? '')
    if (receipt?.sequence !== index + 1) errors.push(issue('MAS-DEP-040', `receipt:${index + 1}`, 'Makbuz sequence zinciri kesintisiz değil.'))
    if (receipt?.previousReceiptSha256 !== previousHash) errors.push(issue('MAS-DEP-040', `receipt:${index + 1}`, 'Makbuz önceki hash zinciriyle uyuşmuyor.'))
    if (receipt?.stepKey !== expectedStep?.key || receipt?.stepPosition !== expectedStep?.position || receipt?.attempt !== expectedAttempt) {
      errors.push(issue('MAS-DEP-040', `receipt:${index + 1}`, 'Makbuz beklenen sonraki adım/attempt ile uyuşmuyor.'))
    }
    if (!Number.isFinite(capturedAt) || capturedAt < previousTime || capturedAt > now.getTime() + MAX_FUTURE_SKEW_MS) {
      errors.push(issue('MAS-DEP-040', `receipt:${index + 1}`, 'Makbuz zamanı monoton değil veya gelecekte.'))
    }
    if (evidenceHashes.has(receipt?.evidenceArtifactSha256)) errors.push(issue('MAS-DEP-040', `receipt:${index + 1}`, 'Aynı dış kanıt SHA-256 değeri birden fazla makbuzda kullanılamaz.'))
    evidenceHashes.add(receipt?.evidenceArtifactSha256)
    recordedProductionMutationPerformed ||= receipt?.productionMutationPerformed === true
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
  const completedAt = nextStepIndex === RELEASE_EXECUTION_STEPS.length && !pausedAfterFailure
    ? safeReceipts.at(-1)?.capturedAt ?? null
    : null
  if (startedAt && now.getTime() - Date.parse(startedAt) > maxDurationMinutes * 60_000 && !completedAt) {
    errors.push(issue('MAS-DEP-041', 'execution-duration', `Execution ${maxDurationMinutes} dakikalık izin verilen pencereyi aştı.`))
  }
  if (startedAt && completedAt && Date.parse(completedAt) - Date.parse(startedAt) > maxDurationMinutes * 60_000) {
    errors.push(issue('MAS-DEP-041', 'execution-duration', `Tamamlanan execution ${maxDurationMinutes} dakikalık izin verilen pencereyi aştı.`))
  }
  const complete = nextStepIndex === RELEASE_EXECUTION_STEPS.length && !pausedAfterFailure && errors.length === 0
  return {
    ok: errors.length === 0,
    complete,
    errors,
    nextStep: complete ? null : RELEASE_EXECUTION_STEPS[nextStepIndex] ?? null,
    nextAttempt: complete ? null : expectedAttempt,
    pausedAfterFailure,
    completedSteps,
    startedAt,
    completedAt,
    lastReceiptSha256: previousHash,
    recordedProductionMutationPerformed,
  }
}

export function buildExecutionVerification({ plan, receipts, now = new Date(), maxDurationMinutes = 180 }) {
  const evaluation = evaluateExecutionReceipts({ plan, receipts, now, maxDurationMinutes })
  const result = {
    schemaVersion: 1,
    kind: 'masabu-production-release-execution-evidence',
    status: evaluation.complete ? 'completed' : evaluation.errors.length > 0 ? 'invalid' : 'incomplete',
    projectRef: plan?.projectRef ?? null,
    commitSha: plan?.commitSha ?? null,
    releaseArtifactSha256: plan?.releaseArtifactSha256 ?? null,
    rehearsalArtifactSha256: plan?.rehearsalArtifactSha256 ?? null,
    bundleManifestSha256: plan?.bundleManifestSha256 ?? null,
    preDeployDecisionSha256: plan?.preDeployDecisionSha256 ?? null,
    backupRestoreEvidenceSha256: plan?.backupRestoreEvidenceSha256 ?? null,
    releaseCandidateEvidenceSha256: plan?.releaseCandidateEvidenceSha256 ?? null,
    planArtifactSha256: plan?.artifactSha256 ?? null,
    startedAt: evaluation.startedAt,
    completedAt: evaluation.completedAt,
    receiptCount: receipts?.length ?? 0,
    lastReceiptSha256: evaluation.lastReceiptSha256,
    completedSteps: evaluation.completedSteps,
    receipts: (receipts ?? []).map((receipt) => ({ ...receipt })),
    recordedProductionMutationPerformed: evaluation.recordedProductionMutationPerformed,
    toolProductionMutationPerformed: false,
    errors: evaluation.errors.map(({ code, subject }) => ({ code, subject })),
  }
  return { ...result, artifactSha256: sha256(JSON.stringify(result)) }
}

export function validateReleaseExecutionEvidence({
  evidence,
  evidenceRaw,
  projectRef,
  releaseEvidence,
  rehearsal,
  bundleManifest,
  preDeployDecision,
  now = new Date(),
  maxDurationMinutes = 180,
}) {
  const errors = []
  const keys = [
    'schemaVersion', 'kind', 'status', 'projectRef', 'commitSha',
    'releaseArtifactSha256', 'rehearsalArtifactSha256', 'bundleManifestSha256',
    'preDeployDecisionSha256', 'backupRestoreEvidenceSha256',
    'releaseCandidateEvidenceSha256', 'planArtifactSha256', 'startedAt',
    'completedAt', 'receiptCount', 'lastReceiptSha256', 'completedSteps',
    'receipts', 'recordedProductionMutationPerformed',
    'toolProductionMutationPerformed', 'errors', 'artifactSha256',
  ]
  if (!hasExactKeys(evidence, keys)) errors.push(issue('MAS-DEP-041', 'release-execution-evidence', 'Execution kanıtı yalnız izin verilen alanları içerebilir.'))
  verifySelfHash(evidence, 'artifactSha256', 'MAS-DEP-041', 'release-execution-evidence', errors)
  const receiptKeys = [
    'schemaVersion', 'kind', 'projectRef', 'planArtifactSha256', 'sequence',
    'stepPosition', 'stepKey', 'attempt', 'status', 'capturedAt',
    'evidenceArtifactSha256', 'previousReceiptSha256',
    'productionMutationPerformed', 'receiptSha256',
  ]
  let nextStepIndex = 0
  let expectedAttempt = 1
  let previousReceiptSha256 = null
  let previousReceiptTime = Number.NEGATIVE_INFINITY
  const embeddedEvidenceHashes = new Set()
  let receiptSummariesValid = Array.isArray(evidence?.receipts)
  for (const [index, receipt] of (evidence?.receipts ?? []).entries()) {
    const step = RELEASE_EXECUTION_STEPS[nextStepIndex]
    const capturedAt = Date.parse(receipt?.capturedAt ?? '')
    const { receiptSha256, ...contents } = receipt ?? {}
    const valid = hasExactKeys(receipt, receiptKeys)
      && isSha256(receiptSha256)
      && sha256(JSON.stringify(contents)) === receiptSha256
      && receipt.schemaVersion === 1
      && receipt.kind === 'masabu-production-release-step-receipt'
      && receipt.projectRef === projectRef
      && receipt.planArtifactSha256 === evidence?.planArtifactSha256
      && receipt.sequence === index + 1
      && receipt.stepPosition === step?.position
      && receipt.stepKey === step?.key
      && receipt.attempt === expectedAttempt
      && ['succeeded', 'failed'].includes(receipt.status)
      && Number.isFinite(capturedAt) && capturedAt >= previousReceiptTime
      && isSha256(receipt.evidenceArtifactSha256)
      && !embeddedEvidenceHashes.has(receipt.evidenceArtifactSha256)
      && receipt.previousReceiptSha256 === previousReceiptSha256
      && receipt.productionMutationPerformed === step?.mutatesProduction
    receiptSummariesValid &&= valid
    embeddedEvidenceHashes.add(receipt?.evidenceArtifactSha256)
    previousReceiptSha256 = receipt?.receiptSha256 ?? null
    previousReceiptTime = capturedAt
    if (receipt?.status === 'succeeded') {
      nextStepIndex += 1
      expectedAttempt = 1
    } else {
      expectedAttempt += 1
    }
  }
  const duration = Date.parse(evidence?.completedAt ?? '') - Date.parse(evidence?.startedAt ?? '')
  if (
    evidence?.schemaVersion !== 1
    || evidence?.kind !== 'masabu-production-release-execution-evidence'
    || evidence?.status !== 'completed'
    || evidence?.projectRef !== projectRef
    || evidence?.commitSha !== releaseEvidence?.commitSha
    || evidence?.releaseArtifactSha256 !== releaseEvidence?.artifactSha256
    || evidence?.rehearsalArtifactSha256 !== rehearsal?.artifactSha256
    || evidence?.bundleManifestSha256 !== bundleManifest?.artifactSha256
    || evidence?.preDeployDecisionSha256 !== preDeployDecision?.artifactSha256
    || evidence?.backupRestoreEvidenceSha256 !== preDeployDecision?.backupRestoreEvidenceSha256
    || evidence?.releaseCandidateEvidenceSha256 !== preDeployDecision?.releaseCandidateEvidenceSha256
    || !Number.isInteger(evidence?.receiptCount)
    || evidence.receiptCount < RELEASE_EXECUTION_STEPS.length
    || evidence.receiptCount !== evidence?.receipts?.length
    || !receiptSummariesValid
    || nextStepIndex !== RELEASE_EXECUTION_STEPS.length
    || evidence?.receipts?.at(-1)?.status !== 'succeeded'
    || evidence?.startedAt !== evidence?.receipts?.[0]?.capturedAt
    || evidence?.completedAt !== evidence?.receipts?.at(-1)?.capturedAt
    || evidence?.lastReceiptSha256 !== evidence?.receipts?.at(-1)?.receiptSha256
    || evidence?.completedSteps?.length !== RELEASE_EXECUTION_STEPS.length
    || JSON.stringify(evidence?.completedSteps) !== JSON.stringify(RELEASE_EXECUTION_STEPS.map((step) => step.key))
    || !isSha256(evidence?.lastReceiptSha256)
    || !Number.isFinite(duration) || duration < 0 || duration > maxDurationMinutes * 60_000
    || Date.parse(evidence?.completedAt ?? '') > now.getTime() + MAX_FUTURE_SKEW_MS
    || evidence?.recordedProductionMutationPerformed !== true
    || evidence?.toolProductionMutationPerformed !== false
    || !Array.isArray(evidence?.errors) || evidence.errors.length !== 0
  ) errors.push(issue('MAS-DEP-041', 'release-execution-bindings', 'Execution kanıtı tamamlanmış exact release zinciriyle uyuşmuyor.'))
  if (typeof evidenceRaw !== 'string') errors.push(issue('MAS-DEP-041', 'release-execution-evidence', 'Execution kanıtının ham JSON girdisi eksik.'))
  return { ok: errors.length === 0, errors, sha256: sha256(typeof evidenceRaw === 'string' ? evidenceRaw : '') }
}

function readJson(path, subject) {
  if (!path || !existsSync(path)) throw executionError('MAS-DEP-001', `${subject} dosyası eksik veya okunamıyor.`)
  return JSON.parse(readFileSync(path, 'utf8'))
}

function readExecutionDirectory(input) {
  const plan = readJson(resolve(input, PLAN_FILE), 'Execution plan')
  const receiptsPath = resolve(input, RECEIPTS_DIRECTORY)
  const names = existsSync(receiptsPath) ? readdirSync(receiptsPath).sort() : []
  if (names.some((name) => !/^\d{4}\.json$/.test(name))) throw executionError('MAS-DEP-040', 'Receipts dizini tanımsız dosya içeriyor.')
  const receipts = names.map((name) => readJson(resolve(receiptsPath, name), `Receipt ${name}`))
  return { plan, receipts, receiptsPath }
}

function parseArguments(argv) {
  const args = argv.filter((arg) => arg !== '--')
  const command = args.shift()
  const options = {}
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    if (arg === '--project-ref') options.projectRef = args[++index]
    else if (arg === '--bundle-manifest') options.bundleManifest = args[++index]
    else if (arg === '--pre-deploy-decision') options.preDeployDecision = args[++index]
    else if (arg === '--input') options.input = args[++index]
    else if (arg === '--output') options.output = args[++index]
    else if (arg === '--step') options.step = args[++index]
    else if (arg === '--status') options.status = args[++index]
    else if (arg === '--captured-at') options.capturedAt = args[++index]
    else if (arg === '--evidence-sha256') options.evidenceSha256 = args[++index]
    else if (arg === '--max-duration-minutes') options.maxDurationMinutes = Number(args[++index])
    else throw executionError('MAS-DEP-006', `Bilinmeyen argüman: ${arg}`)
  }
  return { command, options }
}

export function runCli(argv = process.argv.slice(2), root = ROOT) {
  try {
    const { command, options } = parseArguments(argv)
    const maxDurationMinutes = options.maxDurationMinutes ?? 180
    if (command === 'init') {
      for (const name of ['projectRef', 'bundleManifest', 'preDeployDecision', 'output']) {
        if (!options[name]) throw executionError('MAS-DEP-006', `init için --${name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)} zorunlu.`)
      }
      const output = resolve(root, options.output)
      const plan = buildReleaseExecutionPlan({
        projectRef: options.projectRef,
        bundleManifest: readJson(resolve(root, options.bundleManifest), 'Bundle manifest'),
        preDeployDecision: readJson(resolve(root, options.preDeployDecision), 'Pre-deploy decision'),
      })
      mkdirSync(output, { mode: 0o700 })
      chmodSync(output, 0o700)
      mkdirSync(resolve(output, RECEIPTS_DIRECTORY), { mode: 0o700 })
      writeFileSync(resolve(output, PLAN_FILE), `${JSON.stringify(plan, null, 2)}\n`, { mode: 0o600, flag: 'wx' })
      console.log('Masabu production release execution journal: INITIALIZED')
      console.log(`Next step: ${RELEASE_EXECUTION_STEPS[0].key}`)
      console.log('Production mutation: none (journal tooling only)')
      return 0
    }
    if (!options.input) throw executionError('MAS-DEP-006', `${command ?? 'command'} için --input zorunlu.`)
    const input = resolve(root, options.input)
    const { plan, receipts, receiptsPath } = readExecutionDirectory(input)
    const evaluation = evaluateExecutionReceipts({ plan, receipts, maxDurationMinutes })
    if (command === 'status') {
      console.log(`Masabu production release execution: ${evaluation.complete ? 'COMPLETE' : evaluation.pausedAfterFailure ? 'PAUSED' : 'IN PROGRESS'}`)
      console.log(`Receipts: ${receipts.length}`)
      console.log(`Next step: ${evaluation.nextStep?.key ?? 'none'}`)
      console.log(`Next attempt: ${evaluation.nextAttempt ?? 'none'}`)
      for (const item of evaluation.errors) console.error(`ERROR ${item.code} ${item.subject}`)
      return evaluation.errors.length > 0 ? 1 : 0
    }
    if (command === 'record') {
      if (!options.step || !options.status || !options.evidenceSha256) throw executionError('MAS-DEP-006', 'record için --step, --status ve --evidence-sha256 zorunlu.')
      if (!evaluation.ok || evaluation.complete) throw executionError('MAS-DEP-040', evaluation.complete ? 'Execution zaten tamamlandı.' : 'Mevcut makbuz zinciri geçersiz.')
      if (options.step !== evaluation.nextStep?.key) throw executionError('MAS-DEP-040', `Beklenen sonraki adım: ${evaluation.nextStep?.key}.`)
      if (!['succeeded', 'failed'].includes(options.status) || !isSha256(options.evidenceSha256)) throw executionError('MAS-DEP-040', 'Receipt status veya evidence SHA-256 geçersiz.')
      const sequence = receipts.length + 1
      const receipt = buildReleaseExecutionReceipt({
        plan,
        sequence,
        step: evaluation.nextStep,
        attempt: evaluation.nextAttempt,
        status: options.status,
        capturedAt: options.capturedAt ?? new Date().toISOString(),
        evidenceArtifactSha256: options.evidenceSha256,
        previousReceiptSha256: evaluation.lastReceiptSha256,
      })
      const file = resolve(receiptsPath, `${String(sequence).padStart(4, '0')}.json`)
      writeFileSync(file, `${JSON.stringify(receipt, null, 2)}\n`, { mode: 0o600, flag: 'wx' })
      console.log(`Masabu production release step receipt: ${options.status.toUpperCase()}`)
      console.log(`Step: ${options.step}`)
      console.log(`Sequence: ${sequence}`)
      console.log(`Receipt SHA-256: ${receipt.receiptSha256}`)
      console.log('Tool production mutation: none')
      return options.status === 'succeeded' ? 0 : 1
    }
    if (command === 'verify') {
      if (!options.output) throw executionError('MAS-DEP-006', 'verify için --output zorunlu.')
      const verification = buildExecutionVerification({ plan, receipts, maxDurationMinutes })
      writeFileSync(resolve(root, options.output), `${JSON.stringify(verification, null, 2)}\n`, { mode: 0o600, flag: 'wx' })
      console.log(`Masabu production release execution: ${verification.status.toUpperCase()}`)
      console.log(`Receipts: ${verification.receiptCount}`)
      console.log(`Execution evidence SHA-256: ${verification.artifactSha256}`)
      console.log('Tool production mutation: none')
      for (const item of verification.errors) console.error(`ERROR ${item.code} ${item.subject}`)
      return verification.status === 'completed' ? 0 : 1
    }
    throw executionError('MAS-DEP-006', 'Komut init, status, record veya verify olmalı.')
  } catch (error) {
    console.error(`${error.code ?? 'MAS-DEP-039'} release-execution: ${error.message}`)
    return 2
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  process.exitCode = runCli()
}
