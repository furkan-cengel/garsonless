import { createHash } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const DEV_PROJECT_REF = 'yxsegwkzyiscrxiwdeuf'
const MAX_FUTURE_SKEW_MS = 5 * 60 * 1000
const BACKUP_KEYS = ['pitrEnabled', 'latestRecoveryPointVerified', 'retentionPolicyVerified']
const RESTORE_KEYS = [
  'isolatedTarget',
  'completed',
  'schemaIntegrityVerified',
  'tenantIsolationVerified',
  'criticalReadPathsVerified',
  'cleanupVerified',
]
const ROLLBACK_KEYS = [
  'previousAppArtifactAvailable',
  'previousEdgeFunctionArtifactAvailable',
  'schedulerStopProcedureVerified',
  'forwardFixProcedureVerified',
]
const sha256 = (value) => createHash('sha256').update(value).digest('hex')
const issue = (code, subject, message) => ({ code, subject, message })

function handoffError(code, message) {
  return Object.assign(new Error(message), { code })
}

function hasExactKeys(value, expected) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const actual = Object.keys(value).sort()
  const wanted = [...expected].sort()
  return actual.length === wanted.length && actual.every((key, index) => key === wanted[index])
}

function allBoolean(value, keys, expected) {
  return hasExactKeys(value, keys) && keys.every((key) => value[key] === expected)
}

function verifyHashedArtifact(value, label) {
  if (!value || !/^[a-f0-9]{64}$/.test(value.artifactSha256 ?? '')) {
    throw handoffError('MAS-DEP-035', `${label} artifact kimliği geçersiz.`)
  }
  const { artifactSha256, ...contents } = value
  if (sha256(JSON.stringify(contents)) !== artifactSha256) {
    throw handoffError('MAS-DEP-035', `${label} artifact bütünlüğü bozuk.`)
  }
}

function verifyReleaseBindings({ projectRef, releaseEvidence, rehearsal }) {
  if (!/^[a-z0-9]{20}$/.test(projectRef ?? '') || projectRef === DEV_PROJECT_REF) {
    throw handoffError('MAS-DEP-004', 'Production project ref geçersiz veya DEV projesine ait.')
  }
  verifyHashedArtifact(releaseEvidence, 'Release evidence')
  verifyHashedArtifact(rehearsal, 'Release rehearsal')
  if (
    releaseEvidence.schemaVersion !== 1
    || !/^[a-f0-9]{40}$/.test(releaseEvidence.commitSha ?? '')
    || rehearsal.schemaVersion !== 1
    || rehearsal.status !== 'local-dry-run'
    || releaseEvidence.projectRef !== projectRef
    || rehearsal.projectRef !== projectRef
    || rehearsal.commitSha !== releaseEvidence.commitSha
    || rehearsal.releaseArtifactSha256 !== releaseEvidence.artifactSha256
    || rehearsal.productionMutationPerformed !== false
  ) {
    throw handoffError('MAS-DEP-035', 'Release ve rehearsal handoff bağları uyuşmuyor.')
  }
}

export function buildBackupRestoreEvidenceTemplate({ projectRef, releaseEvidence, rehearsal }) {
  verifyReleaseBindings({ projectRef, releaseEvidence, rehearsal })
  return {
    schemaVersion: 1,
    environment: 'production',
    status: 'pending',
    projectRef,
    capturedAt: null,
    commitSha: releaseEvidence.commitSha,
    releaseArtifactSha256: releaseEvidence.artifactSha256,
    rehearsalArtifactSha256: rehearsal.artifactSha256,
    backup: Object.fromEntries(BACKUP_KEYS.map((name) => [name, false])),
    restoreDrill: Object.fromEntries(RESTORE_KEYS.map((name) => [name, false])),
    rollbackReadiness: Object.fromEntries(ROLLBACK_KEYS.map((name) => [name, false])),
    productionMutationPerformed: false,
  }
}

export function validateBackupRestoreEvidence({
  evidence,
  evidenceRaw,
  projectRef,
  releaseEvidence,
  rehearsal,
  now = new Date(),
  maxAgeHours = 24,
}) {
  const errors = []
  const topKeys = [
    'schemaVersion', 'environment', 'status', 'projectRef', 'capturedAt', 'commitSha',
    'releaseArtifactSha256', 'rehearsalArtifactSha256', 'backup', 'restoreDrill',
    'rollbackReadiness', 'productionMutationPerformed',
  ]
  try {
    verifyReleaseBindings({ projectRef, releaseEvidence, rehearsal })
  } catch (error) {
    errors.push(issue(error.code ?? 'MAS-DEP-035', 'release-bindings', error.message))
  }
  if (!hasExactKeys(evidence, topKeys)) {
    errors.push(issue('MAS-DEP-036', 'backup-restore-evidence', 'Kanıt yalnız izin verilen güvenli alanları içerebilir.'))
  }
  if (!allBoolean(evidence?.backup, BACKUP_KEYS, true)) {
    errors.push(issue('MAS-DEP-036', 'backup', 'PITR, recovery point ve retention doğrulamaları tamamlanmalı.'))
  }
  if (!allBoolean(evidence?.restoreDrill, RESTORE_KEYS, true)) {
    errors.push(issue('MAS-DEP-036', 'restore-drill', 'İzole restore, bütünlük, tenant sınırı ve cleanup doğrulamaları tamamlanmalı.'))
  }
  if (!allBoolean(evidence?.rollbackReadiness, ROLLBACK_KEYS, true)) {
    errors.push(issue('MAS-DEP-036', 'rollback-readiness', 'App/function artifact ve scheduler/forward-fix hazırlığı tamamlanmalı.'))
  }
  const capturedAt = Date.parse(evidence?.capturedAt ?? '')
  const age = now.getTime() - capturedAt
  if (
    !Number.isFinite(capturedAt)
    || !Number.isInteger(maxAgeHours)
    || maxAgeHours < 1
    || age > maxAgeHours * 60 * 60 * 1000
    || age < -MAX_FUTURE_SKEW_MS
  ) {
    errors.push(issue('MAS-DEP-036', 'capturedAt', `Backup/restore kanıtı gelecekte veya ${maxAgeHours} saatten eski.`))
  }
  if (
    evidence?.schemaVersion !== 1
    || evidence?.environment !== 'production'
    || evidence?.status !== 'passed'
    || evidence?.projectRef !== projectRef
    || evidence?.commitSha !== releaseEvidence?.commitSha
    || evidence?.releaseArtifactSha256 !== releaseEvidence?.artifactSha256
    || evidence?.rehearsalArtifactSha256 !== rehearsal?.artifactSha256
    || evidence?.productionMutationPerformed !== false
  ) {
    errors.push(issue('MAS-DEP-035', 'backup-restore-bindings', 'Backup/restore kanıtı exact release kimliği ve güvenli mutation sözleşmesiyle uyuşmuyor.'))
  }
  if (typeof evidenceRaw !== 'string') {
    errors.push(issue('MAS-DEP-036', 'backup-restore-evidence', 'Backup/restore kanıtının ham JSON içeriği eksik.'))
  }
  return {
    ok: errors.length === 0,
    errors,
    sha256: sha256(typeof evidenceRaw === 'string' ? evidenceRaw : ''),
  }
}

export function buildHandoffVerification({ projectRef, releaseEvidence, rehearsal, evidence, evidenceRaw, now, maxAgeHours }) {
  const result = validateBackupRestoreEvidence({ projectRef, releaseEvidence, rehearsal, evidence, evidenceRaw, now, maxAgeHours })
  const verification = {
    schemaVersion: 1,
    kind: 'masabu-production-handoff-verification',
    status: result.ok ? 'verified' : 'rejected',
    projectRef,
    commitSha: releaseEvidence?.commitSha ?? null,
    releaseArtifactSha256: releaseEvidence?.artifactSha256 ?? null,
    rehearsalArtifactSha256: rehearsal?.artifactSha256 ?? null,
    backupRestoreEvidenceSha256: result.sha256,
    errorCodes: [...new Set(result.errors.map((item) => item.code))].sort(),
    errors: result.errors.map(({ code, subject }) => ({ code, subject })),
    productionMutationPerformed: false,
  }
  return { ...verification, artifactSha256: sha256(JSON.stringify(verification)) }
}

function parseArguments(argv) {
  const args = argv.filter((arg) => arg !== '--')
  const command = args.shift()
  const options = {}
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    if (arg === '--project-ref') options.projectRef = args[++index]
    else if (arg === '--release-evidence') options.releaseEvidence = args[++index]
    else if (arg === '--rehearsal') options.rehearsal = args[++index]
    else if (arg === '--evidence') options.evidence = args[++index]
    else if (arg === '--output') options.output = args[++index]
    else throw handoffError('MAS-DEP-006', `Bilinmeyen argüman: ${arg}`)
  }
  return { command, options }
}

function readJson(path, subject) {
  if (!path || !existsSync(path)) throw handoffError('MAS-DEP-001', `${subject} dosyası eksik veya okunamıyor.`)
  return JSON.parse(readFileSync(path, 'utf8'))
}

export function runCli(argv = process.argv.slice(2), root = ROOT) {
  try {
    const { command, options } = parseArguments(argv)
    for (const name of ['projectRef', 'releaseEvidence', 'rehearsal', 'output']) {
      if (!options[name]) throw handoffError('MAS-DEP-006', `--${name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)} zorunlu.`)
    }
    const projectRef = options.projectRef
    const releaseEvidence = readJson(resolve(root, options.releaseEvidence), 'Release evidence')
    const rehearsal = readJson(resolve(root, options.rehearsal), 'Release rehearsal')
    const output = resolve(root, options.output)
    if (command === 'template') {
      const template = buildBackupRestoreEvidenceTemplate({ projectRef, releaseEvidence, rehearsal })
      writeFileSync(output, `${JSON.stringify(template, null, 2)}\n`, { mode: 0o600, flag: 'wx' })
      console.log('Masabu production handoff template: PASS')
      console.log(`Commit: ${template.commitSha}`)
      console.log('Production mutation: none')
      console.log(`Output: ${options.output}`)
      return 0
    }
    if (command === 'verify') {
      if (!options.evidence) throw handoffError('MAS-DEP-006', 'verify için --evidence zorunlu.')
      const evidencePath = resolve(root, options.evidence)
      const evidenceRaw = readFileSync(evidencePath, 'utf8')
      const evidence = JSON.parse(evidenceRaw)
      const verification = buildHandoffVerification({ projectRef, releaseEvidence, rehearsal, evidence, evidenceRaw })
      writeFileSync(output, `${JSON.stringify(verification, null, 2)}\n`, { mode: 0o600, flag: 'wx' })
      console.log(`Masabu production handoff: ${verification.status.toUpperCase()}`)
      console.log(`Commit: ${verification.commitSha ?? 'missing'}`)
      console.log(`Handoff SHA-256: ${verification.artifactSha256}`)
      console.log('Production mutation: none')
      for (const item of verification.errors) console.error(`ERROR ${item.code} ${item.subject}`)
      console.log(`Output: ${options.output}`)
      return verification.status === 'verified' ? 0 : 1
    }
    throw handoffError('MAS-DEP-006', 'Komut template veya verify olmalı.')
  } catch (error) {
    console.error(`${error.code ?? 'MAS-DEP-035'} release-handoff: ${error.message}`)
    return 2
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  process.exitCode = runCli()
}
