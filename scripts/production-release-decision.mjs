import { createHash } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { validateProductionConfig, parseEnv, DEV_PROJECT_REF } from './production-readiness.mjs'
import { loadTopologySpec, validateDeploymentTopology } from './deployment-topology.mjs'
import { createMigrationManifest, parseMigrationListEvidence, verifyMigrationEvidence } from './migration-release.mjs'
import { buildRuntimeManifest, loadRuntimeSpec, validateRuntimeEvidence } from './runtime-deployment.mjs'
import { buildSmokeManifest, loadSmokeSpec, validateSmokeEvidence } from './business-smoke.mjs'
import { validateBackupRestoreEvidence } from './production-release-handoff.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const POLICY_PATH = 'config/production-release-policy.json'
const MAX_FUTURE_SKEW_MS = 5 * 60 * 1000
const sha256 = (value) => createHash('sha256').update(value).digest('hex')
const issue = (code, subject, message) => ({ code, subject, message })

function decisionError(code, message) {
  return Object.assign(new Error(message), { code })
}

function uniqueStrings(value) {
  return Array.isArray(value)
    && value.length > 0
    && value.every((item) => typeof item === 'string' && item.length > 0)
    && new Set(value).size === value.length
}

function hasExactKeys(value, expected) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const actual = Object.keys(value).sort()
  const sortedExpected = [...expected].sort()
  return actual.length === sortedExpected.length && actual.every((key, index) => key === sortedExpected[index])
}

function verifyHashedArtifact(value, code, subject, errors) {
  if (!value || typeof value !== 'object' || !/^[a-f0-9]{64}$/.test(value.artifactSha256 ?? '')) {
    errors.push(issue(code, subject, 'Artifact eksik veya SHA-256 kimliği geçersiz.'))
    return false
  }
  const { artifactSha256, ...contents } = value
  if (sha256(JSON.stringify(contents)) !== artifactSha256) {
    errors.push(issue(code, subject, 'Artifact içeriği SHA-256 kimliğiyle uyuşmuyor.'))
    return false
  }
  return true
}

export function loadReleasePolicy(root = ROOT) {
  const raw = readFileSync(resolve(root, POLICY_PATH), 'utf8')
  return { policy: JSON.parse(raw), sha256: sha256(raw) }
}

export function validateReleasePolicy(policy) {
  const errors = []
  if (policy?.schemaVersion !== 1 || !Number.isInteger(policy?.maxAttestationAgeMinutes) || policy.maxAttestationAgeMinutes < 5) {
    errors.push(issue('MAS-DEP-029', 'release-policy', 'Policy sürümü veya attestation ömrü geçersiz.'))
  }
  if (!Number.isInteger(policy?.maxBackupRestoreEvidenceAgeHours) || policy.maxBackupRestoreEvidenceAgeHours < 1) {
    errors.push(issue('MAS-DEP-029', 'backup-restore-evidence-age', 'Backup/restore kanıt ömrü geçersiz.'))
  }
  if (!uniqueStrings(policy?.requiredScopes) || !uniqueStrings(policy?.requiredApprovals)) {
    errors.push(issue('MAS-DEP-029', 'release-policy', 'Zorunlu scope ve approval listeleri benzersiz olmalı.'))
  }
  const capabilityNames = Object.keys(policy?.capabilityScopes ?? {})
  if (!uniqueStrings(capabilityNames)) errors.push(issue('MAS-DEP-029', 'capabilityScopes', 'Capability sözleşmesi boş veya geçersiz.'))
  for (const [name, scopes] of Object.entries(policy?.capabilityScopes ?? {})) {
    if (!uniqueStrings(scopes) || scopes.some((scope) => !policy.requiredScopes?.includes(scope))) {
      errors.push(issue('MAS-DEP-029', name, 'Capability scope listesi zorunlu scope sözleşmesiyle uyuşmuyor.'))
    }
  }
  const smokeBindings = policy?.smokeCapabilityBindings
  if (!smokeBindings || typeof smokeBindings !== 'object' || Array.isArray(smokeBindings)) {
    errors.push(issue('MAS-DEP-029', 'smokeCapabilityBindings', 'Smoke capability bağları geçersiz.'))
  } else {
    for (const [releaseCapability, smokeCapability] of Object.entries(smokeBindings)) {
      if (!capabilityNames.includes(releaseCapability) || typeof smokeCapability !== 'string' || smokeCapability.length === 0) {
        errors.push(issue('MAS-DEP-029', releaseCapability, 'Smoke capability bağı release capability sözleşmesiyle uyuşmuyor.'))
      }
    }
  }
  if (!hasExactKeys(policy?.allowedWarningCodes, ['pre-deploy', 'post-deploy'])) {
    errors.push(issue('MAS-DEP-029', 'allowedWarningCodes', 'Her release modu için exact warning allowlist gerekli.'))
  }
  for (const [mode, codes] of Object.entries(policy?.allowedWarningCodes ?? {})) {
    if (!['pre-deploy', 'post-deploy'].includes(mode) || !uniqueStrings(codes)) {
      errors.push(issue('MAS-DEP-029', `warnings:${mode}`, 'Warning allowlist geçersiz.'))
    }
  }
  if (!Number.isInteger(policy?.minimumRollbackDecisions) || policy.minimumRollbackDecisions < 1) {
    errors.push(issue('MAS-DEP-029', 'minimumRollbackDecisions', 'Rollback karar eşiği geçersiz.'))
  }
  return { ok: errors.length === 0, errors }
}

function validateAttestation({ attestation, attestationRaw, policy, projectRef, releaseEvidence, rehearsal, now }) {
  const errors = []
  const topKeys = [
    'schemaVersion', 'environment', 'projectRef', 'capturedAt', 'commitSha',
    'releaseArtifactSha256', 'rehearsalArtifactSha256', 'backupRestoreEvidenceSha256',
    'enabledCapabilities', 'approvals',
  ]
  if (!hasExactKeys(attestation, topKeys)) {
    errors.push(issue('MAS-DEP-031', 'attestation', 'Operatör onayı yalnız izin verilen alanları içerebilir.'))
  }
  const capabilityNames = Object.keys(policy.capabilityScopes)
  if (!hasExactKeys(attestation?.enabledCapabilities, capabilityNames)
    || Object.values(attestation?.enabledCapabilities ?? {}).some((value) => typeof value !== 'boolean')) {
    errors.push(issue('MAS-DEP-031', 'enabledCapabilities', 'Capability durumu exact boolean sözleşmesini taşımalı.'))
  }
  if (!hasExactKeys(attestation?.approvals, policy.requiredApprovals)
    || policy.requiredApprovals.some((name) => attestation?.approvals?.[name] !== true)) {
    errors.push(issue('MAS-DEP-031', 'approvals', 'Bütün zorunlu operatör onayları true olmalı.'))
  }
  const capturedAt = Date.parse(attestation?.capturedAt ?? '')
  const age = now.getTime() - capturedAt
  if (!Number.isFinite(capturedAt) || age > policy.maxAttestationAgeMinutes * 60_000 || age < -MAX_FUTURE_SKEW_MS) {
    errors.push(issue('MAS-DEP-031', 'capturedAt', `Operatör onayı gelecekte veya ${policy.maxAttestationAgeMinutes} dakikadan eski.`))
  }
  if (
    attestation?.schemaVersion !== 1
    || attestation?.environment !== 'production'
    || attestation?.projectRef !== projectRef
    || attestation?.commitSha !== releaseEvidence?.commitSha
    || attestation?.releaseArtifactSha256 !== releaseEvidence?.artifactSha256
    || attestation?.rehearsalArtifactSha256 !== rehearsal?.artifactSha256
    || !/^[a-f0-9]{64}$/.test(attestation?.backupRestoreEvidenceSha256 ?? '')
  ) {
    errors.push(issue('MAS-DEP-030', 'attestation-bindings', 'Operatör onayı bu project/release/rehearsal kimliğine bağlı değil.'))
  }
  if (typeof attestationRaw !== 'string') errors.push(issue('MAS-DEP-031', 'attestation', 'Operatör onayının ham JSON kanıtı eksik.'))
  return { ok: errors.length === 0, errors, sha256: sha256(typeof attestationRaw === 'string' ? attestationRaw : '') }
}

function validateReleaseBindings({
  projectRef,
  releaseEvidence,
  rehearsal,
  migrationManifest,
  topologySha256,
  runtimeManifest,
  smokeManifest,
  policy,
}) {
  const errors = []
  const releaseIntegrity = verifyHashedArtifact(releaseEvidence, 'MAS-DEP-029', 'release-evidence', errors)
  const rehearsalIntegrity = verifyHashedArtifact(rehearsal, 'MAS-DEP-029', 'release-rehearsal', errors)
  if (releaseIntegrity && (
    releaseEvidence.schemaVersion !== 1
    || releaseEvidence.projectRef !== projectRef
    || releaseEvidence.migrations?.sha256 !== migrationManifest.sha256
    || releaseEvidence.topology?.sha256 !== topologySha256
    || releaseEvidence.runtime?.sha256 !== runtimeManifest.artifactSha256
    || releaseEvidence.smoke?.sha256 !== smokeManifest.artifactSha256
  )) {
    errors.push(issue('MAS-DEP-030', 'release-bindings', 'Release identity mevcut migration/topology/runtime/smoke kaynaklarıyla uyuşmuyor.'))
  }
  if (rehearsalIntegrity && (
    rehearsal.schemaVersion !== 1
    || rehearsal.status !== 'local-dry-run'
    || rehearsal.projectRef !== projectRef
    || rehearsal.commitSha !== releaseEvidence?.commitSha
    || rehearsal.releaseArtifactSha256 !== releaseEvidence?.artifactSha256
    || rehearsal.runtimeArtifactSha256 !== runtimeManifest.artifactSha256
    || rehearsal.smokeArtifactSha256 !== smokeManifest.artifactSha256
    || rehearsal.productionMutationPerformed !== false
    || !Array.isArray(rehearsal.rollbackDecisions)
    || rehearsal.rollbackDecisions.length < policy.minimumRollbackDecisions
  )) {
    errors.push(issue('MAS-DEP-030', 'rehearsal-bindings', 'Local prova release kimliği veya rollback sözleşmesiyle uyuşmuyor.'))
  }
  return { ok: errors.length === 0, errors }
}

function safeWarnings(items) {
  return items.map(({ code, subject }) => ({ code, subject }))
}

export function evaluateReleaseDecision({
  mode,
  projectRef,
  policy,
  policySha256,
  releaseEvidence,
  rehearsal,
  envByScope,
  migrationEvidence,
  runtimeEvidence,
  smokeEvidence,
  backupRestoreEvidence,
  backupRestoreEvidenceRaw,
  attestation,
  attestationRaw,
  now = new Date(),
  root = ROOT,
}) {
  const errors = []
  const warnings = []
  if (!['pre-deploy', 'post-deploy'].includes(mode)) errors.push(issue('MAS-DEP-006', 'mode', 'Mode pre-deploy veya post-deploy olmalı.'))
  if (!/^[a-z0-9]{20}$/.test(projectRef ?? '') || projectRef === DEV_PROJECT_REF) {
    errors.push(issue('MAS-DEP-004', 'project-ref', 'Production project ref geçersiz veya DEV projesine ait.'))
  }
  const policyResult = validateReleasePolicy(policy)
  errors.push(...policyResult.errors)

  const { spec: topologySpec, sha256: topologySha256 } = loadTopologySpec(root)
  const { spec: runtimeSpec, sha256: runtimeSpecSha256 } = loadRuntimeSpec(root)
  const { spec: smokeSpec, sha256: smokeSpecSha256 } = loadSmokeSpec(root)
  let runtimeManifest
  let smokeManifest
  try {
    runtimeManifest = buildRuntimeManifest({ spec: runtimeSpec, specSha256: runtimeSpecSha256, projectRef, root })
    smokeManifest = buildSmokeManifest({ spec: smokeSpec, specSha256: smokeSpecSha256, topologySpec, topologySha256, projectRef, root })
  } catch (error) {
    errors.push(issue(error.code ?? 'MAS-DEP-029', 'source-manifests', error.message))
  }
  const migrationManifest = createMigrationManifest(root)

  const capabilities = attestation?.enabledCapabilities ?? {}
  const preflightResults = []
  for (const scope of policy.requiredScopes ?? []) {
    const env = envByScope?.[scope]
    if (!env) {
      errors.push(issue('MAS-DEP-001', `preflight:${scope}`, 'Zorunlu production env scope kanıtı eksik.'))
      continue
    }
    const enabledForScope = Object.entries(policy.capabilityScopes ?? {})
      .filter(([name, scopes]) => capabilities[name] === true && scopes.includes(scope))
      .map(([name]) => name)
    const result = validateProductionConfig({ env, scopes: [scope], capabilities: enabledForScope, projectRef })
    preflightResults.push({ scope, capabilities: enabledForScope, passed: result.ok, warningCodes: result.warnings.map((item) => item.code) })
    errors.push(...result.errors.map((item) => issue(item.code, `preflight:${scope}:${item.key}`, item.message)))
    warnings.push(...result.warnings.map((item) => issue(item.code, `preflight:${scope}:${item.key}`, item.message)))
  }

  const topology = validateDeploymentTopology({ spec: topologySpec, envByScope, projectRef, root })
  errors.push(...topology.errors)
  warnings.push(...topology.warnings)

  const migration = verifyMigrationEvidence({ manifest: migrationManifest, evidence: migrationEvidence, expectedProjectRef: projectRef, mode })
  errors.push(...migration.errors)
  warnings.push(...migration.warnings)

  const runtime = runtimeManifest
    ? validateRuntimeEvidence({ manifest: runtimeManifest, evidence: runtimeEvidence, mode, now })
    : { ok: false, errors: [], warnings: [] }
  errors.push(...runtime.errors)
  warnings.push(...runtime.warnings)

  const smoke = smokeManifest
    ? validateSmokeEvidence({ manifest: smokeManifest, evidence: smokeEvidence, releaseEvidence, mode, now })
    : { ok: false, errors: [], warnings: [] }
  errors.push(...smoke.errors)
  warnings.push(...smoke.warnings)

  const backupRestore = validateBackupRestoreEvidence({
    evidence: backupRestoreEvidence,
    evidenceRaw: backupRestoreEvidenceRaw,
    projectRef,
    releaseEvidence,
    rehearsal,
    now,
    maxAgeHours: policy.maxBackupRestoreEvidenceAgeHours,
  })
  errors.push(...backupRestore.errors)
  if (attestation?.backupRestoreEvidenceSha256 !== backupRestore.sha256) {
    errors.push(issue('MAS-DEP-035', 'backup-restore-attestation-binding', 'Operatör onayı exact backup/restore kanıtına bağlı değil.'))
  }

  for (const [releaseCapability, smokeCapability] of Object.entries(policy.smokeCapabilityBindings ?? {})) {
    if (smokeEvidence?.enabledCapabilities?.[smokeCapability] !== capabilities[releaseCapability]) {
      errors.push(issue('MAS-DEP-030', `capability:${releaseCapability}`, 'Operatör, env preflight ve smoke capability durumları uyuşmuyor.'))
    }
  }

  if (runtimeManifest && smokeManifest) {
    const bindings = validateReleaseBindings({
      projectRef,
      releaseEvidence,
      rehearsal,
      migrationManifest,
      topologySha256,
      runtimeManifest,
      smokeManifest,
      policy,
    })
    errors.push(...bindings.errors)
  }
  const approval = validateAttestation({ attestation, attestationRaw, policy, projectRef, releaseEvidence, rehearsal, now })
  errors.push(...approval.errors)

  const allowedWarnings = new Set(policy.allowedWarningCodes?.[mode] ?? [])
  for (const warning of warnings) {
    if (!allowedWarnings.has(warning.code)) errors.push(issue('MAS-DEP-032', warning.subject, `Allowlist dışı release uyarısı: ${warning.code}`))
  }

  const decision = errors.length > 0
    ? 'no-go'
    : mode === 'pre-deploy' ? 'go-to-deploy' : 'release-accepted'
  const result = {
    schemaVersion: 1,
    mode,
    decision,
    projectRef,
    commitSha: releaseEvidence?.commitSha ?? null,
    releaseArtifactSha256: releaseEvidence?.artifactSha256 ?? null,
    rehearsalArtifactSha256: rehearsal?.artifactSha256 ?? null,
    policySha256,
    attestationSha256: approval.sha256,
    backupRestoreEvidenceSha256: backupRestore.sha256,
    enabledCapabilities: capabilities,
    gates: {
      sourcePolicy: policyResult.ok,
      releaseBindings: Boolean(runtimeManifest && smokeManifest)
        && !errors.some((item) => ['release-bindings', 'rehearsal-bindings', 'release-evidence', 'release-rehearsal'].includes(item.subject)),
      preflight: preflightResults.length === policy.requiredScopes?.length && preflightResults.every((item) => item.passed),
      topology: topology.ok,
      migrations: migration.ok,
      runtime: runtime.ok,
      smoke: smoke.ok,
      backupRestore: backupRestore.ok && attestation?.backupRestoreEvidenceSha256 === backupRestore.sha256,
      operatorAttestation: approval.ok,
    },
    preflightScopes: preflightResults,
    migration: { mode: migration.mode, localCount: migration.localCount, remoteCount: migration.remoteCount, pendingCount: migration.pending.length },
    warningCodes: [...new Set(warnings.map((item) => item.code))].sort(),
    warnings: safeWarnings(warnings),
    errors: safeWarnings(errors),
    productionMutationPerformed: false,
  }
  return { ...result, artifactSha256: sha256(JSON.stringify(result)) }
}

function parseArguments(argv) {
  const options = { envFiles: {}, mode: 'pre-deploy' }
  const args = argv.filter((arg) => arg !== '--')
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    if (arg === '--mode') options.mode = args[++index]
    else if (arg === '--project-ref') options.projectRef = args[++index]
    else if (arg === '--release-evidence') options.releaseEvidence = args[++index]
    else if (arg === '--rehearsal') options.rehearsal = args[++index]
    else if (arg === '--migration-evidence') options.migrationEvidence = args[++index]
    else if (arg === '--runtime-evidence') options.runtimeEvidence = args[++index]
    else if (arg === '--smoke-evidence') options.smokeEvidence = args[++index]
    else if (arg === '--backup-restore-evidence') options.backupRestoreEvidence = args[++index]
    else if (arg === '--attestation') options.attestation = args[++index]
    else if (arg === '--output') options.output = args[++index]
    else if (arg === '--env') {
      const binding = args[++index] ?? ''
      const separator = binding.indexOf('=')
      if (separator < 1) throw decisionError('MAS-DEP-006', '--env scope=path biçiminde olmalı.')
      options.envFiles[binding.slice(0, separator)] = binding.slice(separator + 1)
    } else throw decisionError('MAS-DEP-006', `Bilinmeyen argüman: ${arg}`)
  }
  return options
}

function readJson(root, path, subject) {
  if (!path || !existsSync(resolve(root, path))) throw decisionError('MAS-DEP-001', `${subject} dosyası eksik veya okunamıyor.`)
  return JSON.parse(readFileSync(resolve(root, path), 'utf8'))
}

export function runCli(argv = process.argv.slice(2), root = ROOT) {
  try {
    const options = parseArguments(argv)
    for (const name of ['projectRef', 'releaseEvidence', 'rehearsal', 'migrationEvidence', 'runtimeEvidence', 'smokeEvidence', 'backupRestoreEvidence', 'attestation', 'output']) {
      if (!options[name]) throw decisionError('MAS-DEP-006', `--${name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)} zorunlu.`)
    }
    const { policy, sha256: policySha256 } = loadReleasePolicy(root)
    const envByScope = {}
    for (const [scope, path] of Object.entries(options.envFiles)) {
      envByScope[scope] = parseEnv(readFileSync(resolve(root, path), 'utf8'))
    }
    const attestationPath = resolve(root, options.attestation)
    const attestationRaw = readFileSync(attestationPath, 'utf8')
    const backupRestorePath = resolve(root, options.backupRestoreEvidence)
    const backupRestoreEvidenceRaw = readFileSync(backupRestorePath, 'utf8')
    const result = evaluateReleaseDecision({
      mode: options.mode,
      projectRef: options.projectRef,
      policy,
      policySha256,
      releaseEvidence: readJson(root, options.releaseEvidence, 'Release evidence'),
      rehearsal: readJson(root, options.rehearsal, 'Release rehearsal'),
      envByScope,
      migrationEvidence: parseMigrationListEvidence(readFileSync(resolve(root, options.migrationEvidence), 'utf8')),
      runtimeEvidence: readJson(root, options.runtimeEvidence, 'Runtime evidence'),
      smokeEvidence: readJson(root, options.smokeEvidence, 'Smoke evidence'),
      backupRestoreEvidence: JSON.parse(backupRestoreEvidenceRaw),
      backupRestoreEvidenceRaw,
      attestation: JSON.parse(attestationRaw),
      attestationRaw,
      root,
    })
    writeFileSync(resolve(root, options.output), `${JSON.stringify(result, null, 2)}\n`, { mode: 0o600 })
    console.log(`Masabu production release decision (${result.mode}): ${result.decision.toUpperCase()}`)
    console.log(`Commit: ${result.commitSha ?? 'missing'}`)
    console.log(`Decision SHA-256: ${result.artifactSha256}`)
    console.log('Production mutation: none')
    for (const item of result.errors) console.error(`ERROR ${item.code} ${item.subject}`)
    for (const item of result.warnings) console.warn(`WARN  ${item.code} ${item.subject}`)
    console.log(`Output: ${options.output}`)
    return result.decision === 'no-go' ? 1 : 0
  } catch (error) {
    console.error(`${error.code ?? 'MAS-DEP-029'} release-decision: ${error.message}`)
    return 2
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  process.exitCode = runCli()
}
