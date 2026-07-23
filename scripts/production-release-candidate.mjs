import { createHash } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import {
  CONDITIONAL_OPERATOR_EVIDENCE,
  RELEASE_APPLICATIONS,
  RELEASE_BUNDLE_ARTIFACT_NAMES,
  RELEASE_EDGE_FUNCTIONS,
  REQUIRED_OPERATOR_EVIDENCE,
} from './production-release-contract.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const DEV_PROJECT_REF = 'yxsegwkzyiscrxiwdeuf'
const MAX_FUTURE_SKEW_MS = 5 * 60 * 1000
const APPLICATIONS = RELEASE_APPLICATIONS
const EDGE_FUNCTIONS = RELEASE_EDGE_FUNCTIONS
const ARTIFACT_KEYS = ['sourceCommitSha', 'artifactSha256', 'available', 'restoreProcedureVerified']
const sha256 = (value) => createHash('sha256').update(value).digest('hex')
const issue = (code, subject, message) => ({ code, subject, message })

function candidateError(code, message) {
  return Object.assign(new Error(message), { code })
}

function hasExactKeys(value, expected) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const actual = Object.keys(value).sort()
  const wanted = [...expected].sort()
  return actual.length === wanted.length && actual.every((key, index) => key === wanted[index])
}

function verifyHashedArtifact(value, label) {
  if (!value || !/^[a-f0-9]{64}$/.test(value.artifactSha256 ?? '')) {
    throw candidateError('MAS-DEP-037', `${label} artifact kimliği geçersiz.`)
  }
  const { artifactSha256, ...contents } = value
  if (sha256(JSON.stringify(contents)) !== artifactSha256) {
    throw candidateError('MAS-DEP-037', `${label} artifact bütünlüğü bozuk.`)
  }
}

function verifySourceBindings({ projectRef, releaseEvidence, rehearsal, bundleManifest }) {
  if (!/^[a-z0-9]{20}$/.test(projectRef ?? '') || projectRef === DEV_PROJECT_REF) {
    throw candidateError('MAS-DEP-004', 'Production project ref geçersiz veya DEV projesine ait.')
  }
  verifyHashedArtifact(releaseEvidence, 'Release evidence')
  verifyHashedArtifact(rehearsal, 'Release rehearsal')
  verifyHashedArtifact(bundleManifest, 'Release bundle')
  const bundleKeys = [
    'schemaVersion', 'kind', 'projectRef', 'commitSha', 'releaseArtifactSha256',
    'rehearsalArtifactSha256', 'policySha256', 'productionMutationPerformed',
    'artifacts', 'requiredOperatorEvidence', 'conditionalOperatorEvidence',
    'artifactSha256',
  ]
  const artifactNames = Array.isArray(bundleManifest?.artifacts)
    ? bundleManifest.artifacts.map((item) => item?.name).sort()
    : []
  const safeArtifacts = Array.isArray(bundleManifest?.artifacts)
    && bundleManifest.artifacts.every((item) => hasExactKeys(item, ['name', 'sha256', 'bytes'])
      && typeof item.name === 'string'
      && /^[a-f0-9]{64}$/.test(item.sha256 ?? '')
      && Number.isInteger(item.bytes)
      && item.bytes > 0)
  if (
    !hasExactKeys(bundleManifest, bundleKeys)
    || releaseEvidence.schemaVersion !== 1
    || rehearsal.schemaVersion !== 1
    || rehearsal.status !== 'local-dry-run'
    || bundleManifest.schemaVersion !== 1
    || bundleManifest.kind !== 'masabu-production-release-bundle'
    || releaseEvidence.projectRef !== projectRef
    || rehearsal.projectRef !== projectRef
    || bundleManifest.projectRef !== projectRef
    || rehearsal.commitSha !== releaseEvidence.commitSha
    || bundleManifest.commitSha !== releaseEvidence.commitSha
    || rehearsal.releaseArtifactSha256 !== releaseEvidence.artifactSha256
    || bundleManifest.releaseArtifactSha256 !== releaseEvidence.artifactSha256
    || bundleManifest.rehearsalArtifactSha256 !== rehearsal.artifactSha256
    || rehearsal.productionMutationPerformed !== false
    || bundleManifest.productionMutationPerformed !== false
    || !/^[a-f0-9]{64}$/.test(bundleManifest.policySha256 ?? '')
    || !safeArtifacts
    || JSON.stringify(artifactNames) !== JSON.stringify([...RELEASE_BUNDLE_ARTIFACT_NAMES].sort())
    || JSON.stringify(bundleManifest.requiredOperatorEvidence) !== JSON.stringify(REQUIRED_OPERATOR_EVIDENCE)
    || JSON.stringify(bundleManifest.conditionalOperatorEvidence) !== JSON.stringify(CONDITIONAL_OPERATOR_EVIDENCE)
  ) {
    throw candidateError('MAS-DEP-037', 'Release candidate kaynak bağları uyuşmuyor.')
  }
}

function emptyArtifactMap(names) {
  return Object.fromEntries(names.map((name) => [name, {
    sourceCommitSha: null,
    artifactSha256: null,
    available: false,
    restoreProcedureVerified: false,
  }]))
}

export function buildReleaseCandidateEvidenceTemplate({ projectRef, releaseEvidence, rehearsal, bundleManifest }) {
  verifySourceBindings({ projectRef, releaseEvidence, rehearsal, bundleManifest })
  return {
    schemaVersion: 1,
    kind: 'masabu-production-release-candidate-evidence',
    environment: 'production',
    status: 'pending',
    projectRef,
    capturedAt: null,
    commitSha: releaseEvidence.commitSha,
    releaseArtifactSha256: releaseEvidence.artifactSha256,
    rehearsalArtifactSha256: rehearsal.artifactSha256,
    bundleManifestSha256: bundleManifest.artifactSha256,
    freeze: {
      sourceCommitPushed: false,
      changeSetFrozen: false,
      bundleIntegrityVerified: false,
      rollbackArtifactsCaptured: false,
    },
    rollbackArtifacts: {
      applications: emptyArtifactMap(APPLICATIONS),
      edgeFunctions: emptyArtifactMap(EDGE_FUNCTIONS),
    },
    productionMutationPerformed: false,
  }
}

function validateArtifactMap({ value, names, candidateCommitSha, subject, errors }) {
  if (!hasExactKeys(value, names)) {
    errors.push(issue('MAS-DEP-038', subject, 'Rollback artifact envanteri exact sözleşmeyle uyuşmuyor.'))
    return
  }
  for (const name of names) {
    const artifact = value[name]
    if (!hasExactKeys(artifact, ARTIFACT_KEYS)) {
      errors.push(issue('MAS-DEP-038', `${subject}:${name}`, 'Rollback artifact yalnız izin verilen alanları içerebilir.'))
      continue
    }
    if (
      !/^[a-f0-9]{40}$/.test(artifact.sourceCommitSha ?? '')
      || artifact.sourceCommitSha === candidateCommitSha
      || !/^[a-f0-9]{64}$/.test(artifact.artifactSha256 ?? '')
      || artifact.available !== true
      || artifact.restoreProcedureVerified !== true
    ) {
      errors.push(issue('MAS-DEP-038', `${subject}:${name}`, 'Önceki immutable artifact ve restore prosedürü doğrulanmalı.'))
    }
  }
}

export function validateReleaseCandidateEvidence({
  evidence,
  evidenceRaw,
  projectRef,
  releaseEvidence,
  rehearsal,
  bundleManifest,
  now = new Date(),
  maxAgeHours = 4,
}) {
  const errors = []
  const topKeys = [
    'schemaVersion', 'kind', 'environment', 'status', 'projectRef', 'capturedAt', 'commitSha',
    'releaseArtifactSha256', 'rehearsalArtifactSha256', 'bundleManifestSha256', 'freeze',
    'rollbackArtifacts', 'productionMutationPerformed',
  ]
  try {
    verifySourceBindings({ projectRef, releaseEvidence, rehearsal, bundleManifest })
  } catch (error) {
    errors.push(issue(error.code ?? 'MAS-DEP-037', 'release-candidate-bindings', error.message))
  }
  if (!hasExactKeys(evidence, topKeys)) {
    errors.push(issue('MAS-DEP-038', 'release-candidate-evidence', 'Kanıt yalnız izin verilen güvenli alanları içerebilir.'))
  }
  const freezeKeys = ['sourceCommitPushed', 'changeSetFrozen', 'bundleIntegrityVerified', 'rollbackArtifactsCaptured']
  if (!hasExactKeys(evidence?.freeze, freezeKeys) || freezeKeys.some((key) => evidence.freeze[key] !== true)) {
    errors.push(issue('MAS-DEP-038', 'release-freeze', 'Commit, change-set, bundle ve rollback artifact freeze kontrolleri tamamlanmalı.'))
  }
  if (!hasExactKeys(evidence?.rollbackArtifacts, ['applications', 'edgeFunctions'])) {
    errors.push(issue('MAS-DEP-038', 'rollback-artifacts', 'Rollback artifact grupları exact sözleşmeyle uyuşmuyor.'))
  } else {
    validateArtifactMap({ value: evidence.rollbackArtifacts.applications, names: APPLICATIONS, candidateCommitSha: releaseEvidence?.commitSha, subject: 'applications', errors })
    validateArtifactMap({ value: evidence.rollbackArtifacts.edgeFunctions, names: EDGE_FUNCTIONS, candidateCommitSha: releaseEvidence?.commitSha, subject: 'edge-functions', errors })
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
    errors.push(issue('MAS-DEP-038', 'capturedAt', `Release candidate kanıtı gelecekte veya ${maxAgeHours} saatten eski.`))
  }
  if (
    evidence?.schemaVersion !== 1
    || evidence?.kind !== 'masabu-production-release-candidate-evidence'
    || evidence?.environment !== 'production'
    || evidence?.status !== 'frozen'
    || evidence?.projectRef !== projectRef
    || evidence?.commitSha !== releaseEvidence?.commitSha
    || evidence?.releaseArtifactSha256 !== releaseEvidence?.artifactSha256
    || evidence?.rehearsalArtifactSha256 !== rehearsal?.artifactSha256
    || evidence?.bundleManifestSha256 !== bundleManifest?.artifactSha256
    || evidence?.productionMutationPerformed !== false
  ) {
    errors.push(issue('MAS-DEP-037', 'release-candidate-bindings', 'Candidate kanıtı exact release/bundle kimliği ve mutation sözleşmesiyle uyuşmuyor.'))
  }
  if (typeof evidenceRaw !== 'string') {
    errors.push(issue('MAS-DEP-038', 'release-candidate-evidence', 'Release candidate kanıtının ham JSON içeriği eksik.'))
  }
  return { ok: errors.length === 0, errors, sha256: sha256(typeof evidenceRaw === 'string' ? evidenceRaw : '') }
}

export function buildCandidateVerification(input) {
  const result = validateReleaseCandidateEvidence(input)
  const verification = {
    schemaVersion: 1,
    kind: 'masabu-production-release-candidate-verification',
    status: result.ok ? 'verified' : 'rejected',
    projectRef: input.projectRef,
    commitSha: input.releaseEvidence?.commitSha ?? null,
    releaseArtifactSha256: input.releaseEvidence?.artifactSha256 ?? null,
    rehearsalArtifactSha256: input.rehearsal?.artifactSha256 ?? null,
    bundleManifestSha256: input.bundleManifest?.artifactSha256 ?? null,
    releaseCandidateEvidenceSha256: result.sha256,
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
    else if (arg === '--bundle-manifest') options.bundleManifest = args[++index]
    else if (arg === '--evidence') options.evidence = args[++index]
    else if (arg === '--output') options.output = args[++index]
    else throw candidateError('MAS-DEP-006', `Bilinmeyen argüman: ${arg}`)
  }
  return { command, options }
}

function readJson(path, subject) {
  if (!path || !existsSync(path)) throw candidateError('MAS-DEP-001', `${subject} dosyası eksik veya okunamıyor.`)
  return JSON.parse(readFileSync(path, 'utf8'))
}

export function runCli(argv = process.argv.slice(2), root = ROOT) {
  try {
    const { command, options } = parseArguments(argv)
    for (const name of ['projectRef', 'releaseEvidence', 'rehearsal', 'bundleManifest', 'output']) {
      if (!options[name]) throw candidateError('MAS-DEP-006', `--${name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)} zorunlu.`)
    }
    const input = {
      projectRef: options.projectRef,
      releaseEvidence: readJson(resolve(root, options.releaseEvidence), 'Release evidence'),
      rehearsal: readJson(resolve(root, options.rehearsal), 'Release rehearsal'),
      bundleManifest: readJson(resolve(root, options.bundleManifest), 'Bundle manifest'),
    }
    const output = resolve(root, options.output)
    if (command === 'template') {
      const template = buildReleaseCandidateEvidenceTemplate(input)
      writeFileSync(output, `${JSON.stringify(template, null, 2)}\n`, { mode: 0o600, flag: 'wx' })
      console.log('Masabu production release candidate template: PASS')
      console.log(`Commit: ${template.commitSha}`)
      console.log('Production mutation: none')
      console.log(`Output: ${options.output}`)
      return 0
    }
    if (command === 'verify') {
      if (!options.evidence) throw candidateError('MAS-DEP-006', 'verify için --evidence zorunlu.')
      const evidenceRaw = readFileSync(resolve(root, options.evidence), 'utf8')
      const verification = buildCandidateVerification({ ...input, evidence: JSON.parse(evidenceRaw), evidenceRaw })
      writeFileSync(output, `${JSON.stringify(verification, null, 2)}\n`, { mode: 0o600, flag: 'wx' })
      console.log(`Masabu production release candidate: ${verification.status.toUpperCase()}`)
      console.log(`Commit: ${verification.commitSha ?? 'missing'}`)
      console.log(`Verification SHA-256: ${verification.artifactSha256}`)
      console.log('Production mutation: none')
      for (const item of verification.errors) console.error(`ERROR ${item.code} ${item.subject}`)
      console.log(`Output: ${options.output}`)
      return verification.status === 'verified' ? 0 : 1
    }
    throw candidateError('MAS-DEP-006', 'Komut template veya verify olmalı.')
  } catch (error) {
    console.error(`${error.code ?? 'MAS-DEP-037'} release-candidate: ${error.message}`)
    return 2
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  process.exitCode = runCli()
}
