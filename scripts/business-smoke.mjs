import { createHash } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { loadTopologySpec } from './deployment-topology.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SPEC_PATH = 'config/production-smoke.json'
const DEV_PROJECT_REF = 'yxsegwkzyiscrxiwdeuf'
const MAX_FUTURE_SKEW_MS = 5 * 60 * 1000
const sha256 = (value) => createHash('sha256').update(value).digest('hex')
const issue = (code, subject, message) => ({ code, subject, message })

function smokeError(code, message) {
  const error = new Error(message)
  error.code = code
  return error
}

function assertProjectRef(projectRef) {
  if (!projectRef || !/^[a-z0-9]{20}$/.test(projectRef) || projectRef === DEV_PROJECT_REF) {
    throw smokeError('MAS-DEP-004', 'Production project ref geçersiz veya DEV projesine ait.')
  }
}

function hasUniqueStrings(values) {
  return Array.isArray(values) && values.every((value) => typeof value === 'string' && value.length > 0) && new Set(values).size === values.length
}

export function loadSmokeSpec(root = ROOT) {
  const raw = readFileSync(resolve(root, SPEC_PATH), 'utf8')
  return { spec: JSON.parse(raw), sha256: sha256(raw) }
}

export function validateSmokeSource({ spec, topologySpec, root = ROOT }) {
  const errors = []
  if (spec.schemaVersion !== 1 || !Number.isInteger(spec.maxEvidenceAgeMinutes) || spec.maxEvidenceAgeMinutes < 5) {
    errors.push(issue('MAS-DEP-025', 'smoke-spec', 'Smoke sözleşme sürümü veya kanıt ömrü geçersiz.'))
  }
  if (!hasUniqueStrings(spec.capabilities) || !spec.capabilities.includes('core')) {
    errors.push(issue('MAS-DEP-025', 'capabilities', 'Capability listesi benzersiz olmalı ve core içermeli.'))
  }
  const checks = spec.checks ?? []
  if (!Array.isArray(checks) || !hasUniqueStrings(checks.map((check) => check.name))) {
    errors.push(issue('MAS-DEP-025', 'checks', 'Smoke kontrol isimleri eksik veya tekrarlı.'))
    return { ok: false, errors }
  }
  const knownOrigins = new Set(Object.keys(topologySpec.origins ?? {}))
  const capabilities = new Set(spec.capabilities)
  for (const check of checks) {
    if (!capabilities.has(check.capability)) {
      errors.push(issue('MAS-DEP-025', check.name, `Bilinmeyen capability: ${check.capability}`))
    }
    if (!hasUniqueStrings(check.assertions)) {
      errors.push(issue('MAS-DEP-027', check.name, 'Assertion isimleri eksik veya tekrarlı.'))
    }
    if (!hasUniqueStrings(check.sourcePaths)) {
      errors.push(issue('MAS-DEP-025', check.name, 'Kaynak dosya listesi eksik veya tekrarlı.'))
    } else {
      for (const path of check.sourcePaths) {
        if (!existsSync(resolve(root, path))) errors.push(issue('MAS-DEP-015', check.name, `Smoke kaynağı bulunamadı: ${path}`))
      }
    }
    if (check.target) {
      if (!knownOrigins.has(check.target.origin) || typeof check.target.path !== 'string' || !check.target.path.startsWith('/')) {
        errors.push(issue('MAS-DEP-025', check.name, 'Smoke hedef origin/path topolojiyle uyuşmuyor.'))
      }
    }
  }
  return { ok: errors.length === 0, errors }
}

export function buildSmokeManifest({ spec, specSha256, topologySpec, topologySha256, projectRef, root = ROOT }) {
  assertProjectRef(projectRef)
  const validation = validateSmokeSource({ spec, topologySpec, root })
  if (!validation.ok) throw smokeError('MAS-DEP-025', validation.errors.map((item) => `${item.subject}: ${item.message}`).join('; '))
  const manifest = {
    schemaVersion: 1,
    projectRef,
    smokeSpecSha256: specSha256,
    topologySha256,
    maxEvidenceAgeMinutes: spec.maxEvidenceAgeMinutes,
    capabilities: spec.capabilities,
    checks: spec.checks.map((check) => ({
      name: check.name,
      category: check.category,
      capability: check.capability,
      target: check.target
        ? { origin: check.target.origin, path: check.target.path, baseUrl: topologySpec.origins[check.target.origin] }
        : undefined,
      assertions: check.assertions,
      sources: check.sourcePaths.map((path) => ({ path, sha256: sha256(readFileSync(resolve(root, path))) })),
    })),
  }
  return { ...manifest, artifactSha256: sha256(JSON.stringify(manifest)) }
}

function hasExactKeys(value, expected) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const actual = Object.keys(value).sort()
  return actual.length === expected.length && actual.every((key, index) => key === [...expected].sort()[index])
}

function validateEvidenceShape(evidence) {
  const errors = []
  const topLevelKeys = ['schemaVersion', 'environment', 'projectRef', 'capturedAt', 'commitSha', 'releaseArtifactSha256', 'runtimeArtifactSha256', 'smokeArtifactSha256', 'enabledCapabilities', 'checks']
  if (!hasExactKeys(evidence, topLevelKeys)) errors.push(issue('MAS-DEP-028', 'evidence', 'Smoke kanıtı yalnız izin verilen üst seviye alanları içerebilir.'))
  if (Array.isArray(evidence?.checks)) {
    for (const check of evidence.checks) {
      const base = ['name', 'status', 'durationMs', 'assertions']
      const expected = check?.status === 'deferred' ? [...base, 'reasonCode'] : base
      if (!hasExactKeys(check, expected)) errors.push(issue('MAS-DEP-028', check?.name ?? 'unknown-check', 'Kontrol kanıtı izin verilmeyen alan içeriyor.'))
      if (!hasExactKeys(check?.assertions, Object.keys(check?.assertions ?? {}))) errors.push(issue('MAS-DEP-028', check?.name ?? 'unknown-check', 'Assertions nesne olmalı.'))
    }
  }
  return errors
}

function addOutcome(mode, errors, warnings, code, subject, message) {
  if (mode === 'pre-deploy') warnings.push(issue('MAS-DEP-W05', subject, message))
  else errors.push(issue(code, subject, message))
}

export function validateSmokeEvidence({ manifest, evidence, releaseEvidence, mode = 'post-deploy', now = new Date() }) {
  const errors = []
  const warnings = []
  if (!['pre-deploy', 'post-deploy'].includes(mode)) errors.push(issue('MAS-DEP-006', 'mode', 'Mode pre-deploy veya post-deploy olmalı.'))
  errors.push(...validateEvidenceShape(evidence))
  const { artifactSha256: releaseArtifactSha256, ...releaseIdentity } = releaseEvidence ?? {}
  if (
    releaseEvidence?.schemaVersion !== 1
    || releaseEvidence?.projectRef !== manifest.projectRef
    || !/^[a-f0-9]{64}$/.test(releaseArtifactSha256 ?? '')
    || sha256(JSON.stringify(releaseIdentity)) !== releaseArtifactSha256
  ) {
    errors.push(issue('MAS-DEP-025', 'release-evidence', 'Release evidence eksik veya artifact bütünlüğü bozuk.'))
  }
  if (releaseEvidence?.smoke?.sha256 !== manifest.artifactSha256) {
    errors.push(issue('MAS-DEP-024', 'smoke-release-binding', 'Release identity bu smoke manifestine bağlı değil.'))
  }
  if (evidence?.schemaVersion !== 1 || evidence?.environment !== 'production' || evidence?.projectRef !== manifest.projectRef) {
    errors.push(issue('MAS-DEP-025', 'evidence', 'Smoke kanıtı sürümü, environment veya project ref eşleşmiyor.'))
  }
  const capturedAt = Date.parse(evidence?.capturedAt ?? '')
  const age = now.getTime() - capturedAt
  if (!Number.isFinite(capturedAt) || age > manifest.maxEvidenceAgeMinutes * 60_000 || age < -MAX_FUTURE_SKEW_MS) {
    errors.push(issue('MAS-DEP-025', 'capturedAt', `Smoke kanıtı gelecekte veya ${manifest.maxEvidenceAgeMinutes} dakikadan eski.`))
  }
  const bindingsMatch = evidence?.commitSha === releaseEvidence?.commitSha
    && evidence?.releaseArtifactSha256 === releaseArtifactSha256
    && evidence?.runtimeArtifactSha256 === releaseEvidence?.runtime?.sha256
    && evidence?.smokeArtifactSha256 === manifest.artifactSha256
  if (!bindingsMatch) errors.push(issue('MAS-DEP-024', 'release-bindings', 'Smoke kanıtı release/runtime/smoke kimlikleriyle aynı yayına bağlı değil.'))

  const capabilityState = evidence?.enabledCapabilities
  if (!capabilityState || typeof capabilityState !== 'object' || Array.isArray(capabilityState)) {
    errors.push(issue('MAS-DEP-025', 'enabledCapabilities', 'Capability durumları eksik.'))
  } else {
    const expectedCapabilities = [...manifest.capabilities].sort()
    if (!hasExactKeys(capabilityState, expectedCapabilities) || capabilityState.core !== true || Object.values(capabilityState).some((value) => typeof value !== 'boolean')) {
      errors.push(issue('MAS-DEP-025', 'enabledCapabilities', 'Capability anahtarları tam olmalı, boolean taşımalı ve core etkin olmalı.'))
    }
  }

  const evidenceChecks = Array.isArray(evidence?.checks) ? evidence.checks : []
  const names = evidenceChecks.map((check) => check?.name)
  if (names.length !== new Set(names).size) errors.push(issue('MAS-DEP-028', 'checks', 'Tekrarlanan smoke kontrolü var.'))
  const expectedNames = new Set(manifest.checks.map((check) => check.name))
  for (const name of names) if (!expectedNames.has(name)) errors.push(issue('MAS-DEP-028', name ?? 'unknown-check', 'Sözleşmede olmayan smoke kontrolü kanıta eklenmiş.'))
  const byName = new Map(evidenceChecks.map((check) => [check.name, check]))

  for (const expected of manifest.checks) {
    const actual = byName.get(expected.name)
    const capabilityEnabled = expected.capability === 'core' || capabilityState?.[expected.capability] === true
    if (!actual) {
      addOutcome(mode, errors, warnings, 'MAS-DEP-026', expected.name, 'Zorunlu smoke kontrolü kanıtta yok.')
      continue
    }
    if (!Number.isInteger(actual.durationMs) || actual.durationMs < 0 || actual.durationMs > 3_600_000) {
      errors.push(issue('MAS-DEP-028', expected.name, 'Kontrol süresi 0–3600000 ms aralığında integer olmalı.'))
    }
    if (!capabilityEnabled) {
      if (
        actual.status !== 'deferred'
        || actual.reasonCode !== 'CAPABILITY_DISABLED'
        || actual.durationMs !== 0
        || Object.keys(actual.assertions ?? {}).length !== 0
      ) {
        errors.push(issue('MAS-DEP-026', expected.name, 'Kapalı capability kontrolü yalnız CAPABILITY_DISABLED gerekçesiyle deferred olabilir.'))
      }
      continue
    }
    if (actual.status !== 'passed') {
      addOutcome(mode, errors, warnings, 'MAS-DEP-026', expected.name, 'Etkin capability smoke kontrolü geçmedi.')
      continue
    }
    const assertionNames = Object.keys(actual.assertions ?? {})
    if (!hasExactKeys(actual.assertions, expected.assertions) || assertionNames.some((name) => actual.assertions[name] !== true)) {
      addOutcome(mode, errors, warnings, 'MAS-DEP-027', expected.name, 'Assertion seti eksik, fazla veya false sonuç içeriyor.')
    }
  }
  return {
    ok: errors.length === 0,
    mode,
    projectRef: manifest.projectRef,
    commitSha: releaseEvidence?.commitSha,
    smokeArtifactSha256: manifest.artifactSha256,
    errors,
    warnings,
  }
}

function parseArguments(argv) {
  const args = argv.filter((arg) => arg !== '--')
  const command = args.shift()
  const options = { command, mode: 'post-deploy' }
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    if (arg === '--project-ref') options.projectRef = args[++index]
    else if (arg === '--release-evidence') options.releaseEvidence = args[++index]
    else if (arg === '--evidence') options.evidence = args[++index]
    else if (arg === '--output') options.output = args[++index]
    else if (arg === '--mode') options.mode = args[++index]
    else throw smokeError('MAS-DEP-006', `Bilinmeyen argüman: ${arg}`)
  }
  return options
}

function writeJson(path, value, root) {
  writeFileSync(resolve(root, path), `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 })
}

export function runCli(argv = process.argv.slice(2), root = ROOT) {
  try {
    const options = parseArguments(argv)
    if (!options.projectRef || !['manifest', 'verify'].includes(options.command)) throw smokeError('MAS-DEP-006', 'Komut ve --project-ref zorunlu.')
    const { spec, sha256: specSha256 } = loadSmokeSpec(root)
    const { spec: topologySpec, sha256: topologySha256 } = loadTopologySpec(root)
    const manifest = buildSmokeManifest({ spec, specSha256, topologySpec, topologySha256, projectRef: options.projectRef, root })
    if (options.command === 'manifest') {
      if (!options.output) throw smokeError('MAS-DEP-006', 'manifest için --output zorunlu.')
      writeJson(options.output, manifest, root)
      console.log('Masabu business-critical smoke manifest: PASS')
      console.log(`Smoke SHA-256: ${manifest.artifactSha256}`)
      console.log(`Checks: ${manifest.checks.length}; capabilities: ${manifest.capabilities.length}`)
      console.log(`Output: ${options.output}`)
      return 0
    }
    if (!options.releaseEvidence || !options.evidence) throw smokeError('MAS-DEP-006', 'verify için --release-evidence ve --evidence zorunlu.')
    const releaseEvidence = JSON.parse(readFileSync(resolve(root, options.releaseEvidence), 'utf8'))
    const evidence = JSON.parse(readFileSync(resolve(root, options.evidence), 'utf8'))
    const result = validateSmokeEvidence({ manifest, evidence, releaseEvidence, mode: options.mode })
    if (options.output) writeJson(options.output, result, root)
    console.log(`Masabu business-critical smoke verification (${options.mode}): ${result.ok ? 'PASS' : 'FAIL'}`)
    console.log(`Smoke SHA-256: ${result.smokeArtifactSha256}`)
    for (const item of result.errors) console.error(`ERROR ${item.code} ${item.subject}: ${item.message}`)
    for (const item of result.warnings) console.warn(`WARN  ${item.code} ${item.subject}: ${item.message}`)
    return result.ok ? 0 : 1
  } catch (error) {
    console.error(`${error.code ?? 'MAS-DEP-006'} business-smoke: ${error.message}`)
    return 1
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  process.exitCode = runCli()
}
