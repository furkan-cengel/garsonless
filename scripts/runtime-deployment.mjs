import { createHash } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SPEC_PATH = 'config/production-runtime.json'
const SUPABASE_CONFIG_PATH = 'packages/db/supabase/config.toml'
const DEV_PROJECT_REF = 'yxsegwkzyiscrxiwdeuf'
const MAX_EVIDENCE_AGE_MS = 24 * 60 * 60 * 1000
const MAX_FUTURE_SKEW_MS = 5 * 60 * 1000

const sha256 = (value) => createHash('sha256').update(value).digest('hex')
const normalizeSql = (value) => value.replace(/\s+/g, ' ').trim().toLowerCase()
const issue = (code, subject, message) => ({ code, subject, message })
const template = (value, projectRef) => value.replaceAll('{projectRef}', projectRef)

function assertProjectRef(projectRef) {
  if (!projectRef || !/^[a-z0-9]{20}$/.test(projectRef) || projectRef === DEV_PROJECT_REF) {
    const error = new Error('Production project ref geçersiz veya DEV projesine ait.')
    error.code = 'MAS-DEP-004'
    throw error
  }
}

export function loadRuntimeSpec(root = ROOT) {
  const raw = readFileSync(resolve(root, SPEC_PATH), 'utf8')
  return { spec: JSON.parse(raw), sha256: sha256(raw) }
}

function functionConfig(config, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = config.match(new RegExp(`\\[functions\\.${escaped}\\]([\\s\\S]*?)(?=\\n\\[|$)`))
  if (!match) return null
  const block = match[1]
  const value = (key) => block.match(new RegExp(`^${key}\\s*=\\s*(.+)$`, 'm'))?.[1]?.trim()
  return {
    verifyJwt: value('verify_jwt') === 'true',
    entrypoint: value('entrypoint')?.replaceAll('"', ''),
    importMap: value('import_map')?.replaceAll('"', ''),
  }
}

function uniqueNames(items) {
  const names = items.map((item) => item.name)
  return names.length === new Set(names).size
}

export function validateRuntimeSource({ spec, root = ROOT }) {
  const errors = []
  if (spec.schemaVersion !== 1) errors.push(issue('MAS-DEP-018', 'schemaVersion', 'Runtime sözleşme sürümü desteklenmiyor.'))
  for (const group of ['edgeFunctions', 'authHooks', 'vaultSecrets', 'cronJobs', 'postDeployProbes']) {
    if (!Array.isArray(spec[group]) || !uniqueNames(spec[group])) {
      errors.push(issue('MAS-DEP-018', group, 'Liste eksik veya isimler benzersiz değil.'))
    }
  }

  let supabaseConfig = ''
  try {
    supabaseConfig = readFileSync(resolve(root, SUPABASE_CONFIG_PATH), 'utf8')
  } catch {
    errors.push(issue('MAS-DEP-015', 'supabase-config', `Dosya bulunamadı: ${SUPABASE_CONFIG_PATH}`))
  }

  for (const fn of spec.edgeFunctions ?? []) {
    for (const path of [fn.entrypoint, fn.importMap]) {
      if (!existsSync(resolve(root, path))) errors.push(issue('MAS-DEP-015', fn.name, `Function kaynağı bulunamadı: ${path}`))
    }
    const actual = functionConfig(supabaseConfig, fn.name)
    const expectedEntrypoint = `./functions/${fn.name}/index.ts`
    const expectedImportMap = `./functions/${fn.name}/deno.json`
    if (!actual) errors.push(issue('MAS-DEP-018', fn.name, 'supabase/config.toml function bölümü bulunamadı.'))
    else {
      if (actual.verifyJwt !== fn.verifyJwt) errors.push(issue('MAS-DEP-020', fn.name, 'verify_jwt runtime sözleşmesiyle uyuşmuyor.'))
      if (actual.entrypoint !== expectedEntrypoint || actual.importMap !== expectedImportMap) {
        errors.push(issue('MAS-DEP-020', fn.name, 'Entrypoint veya import map runtime sözleşmesiyle uyuşmuyor.'))
      }
    }
    if (existsSync(resolve(root, fn.entrypoint))) {
      const source = readFileSync(resolve(root, fn.entrypoint), 'utf8')
      for (const secretName of fn.requiredSecrets) {
        if (!source.includes(`'${secretName}'`) && !source.includes(`"${secretName}"`)) {
          errors.push(issue('MAS-DEP-018', `${fn.name}:${secretName}`, 'Tanımlı environment bağı function kaynağında kullanılmıyor.'))
        }
      }
    }
  }

  for (const job of spec.cronJobs ?? []) {
    const file = resolve(root, job.sourceMigration)
    if (!existsSync(file)) {
      errors.push(issue('MAS-DEP-015', job.name, `Cron migration kaynağı bulunamadı: ${job.sourceMigration}`))
      continue
    }
    const migration = normalizeSql(readFileSync(file, 'utf8'))
    for (const expected of [job.name, job.schedule, normalizeSql(job.command)]) {
      if (!migration.includes(expected.toLowerCase())) {
        errors.push(issue('MAS-DEP-021', job.name, 'Cron adı, schedule veya command migration kaynağıyla uyuşmuyor.'))
        break
      }
    }
  }

  for (const capability of spec.capabilitySources ?? []) {
    const file = resolve(root, capability.sourceMigration)
    if (!existsSync(file)) {
      errors.push(issue('MAS-DEP-015', `${capability.kind}:${capability.name}`, `Capability migration kaynağı bulunamadı: ${capability.sourceMigration}`))
    } else if (!readFileSync(file, 'utf8').toLowerCase().includes(capability.name.toLowerCase())) {
      errors.push(issue('MAS-DEP-018', `${capability.kind}:${capability.name}`, 'Capability migration kaynağında bulunamadı.'))
    }
  }

  for (const secret of spec.vaultSecrets ?? []) {
    const file = resolve(root, secret.sourceMigration)
    if (!existsSync(file)) {
      errors.push(issue('MAS-DEP-015', secret.name, `Vault migration kaynağı bulunamadı: ${secret.sourceMigration}`))
    } else if (!readFileSync(file, 'utf8').includes(secret.name)) {
      errors.push(issue('MAS-DEP-018', secret.name, 'Vault adı migration kaynağında bulunamadı.'))
    }
  }

  const functionNames = new Set((spec.edgeFunctions ?? []).map((fn) => fn.name))
  for (const hook of spec.authHooks ?? []) {
    if (!functionNames.has(hook.function)) errors.push(issue('MAS-DEP-018', hook.name, 'Auth hook bilinmeyen function’a bağlı.'))
  }
  for (const probe of spec.postDeployProbes ?? []) {
    if (!functionNames.has(probe.function)) errors.push(issue('MAS-DEP-018', probe.name, 'Probe bilinmeyen function’a bağlı.'))
  }
  return { ok: errors.length === 0, errors }
}

export function buildRuntimeManifest({ spec, specSha256, projectRef, root = ROOT }) {
  assertProjectRef(projectRef)
  const source = validateRuntimeSource({ spec, root })
  if (!source.ok) {
    const error = new Error(source.errors.map((item) => `${item.subject}: ${item.message}`).join('; '))
    error.code = 'MAS-DEP-018'
    throw error
  }
  const manifest = {
    schemaVersion: 1,
    projectRef,
    runtimeSpecSha256: specSha256,
    supabaseConfigSha256: sha256(readFileSync(resolve(root, SUPABASE_CONFIG_PATH))),
    capabilities: spec.requiredCapabilities,
    edgeFunctions: spec.edgeFunctions.map((fn) => ({
      name: fn.name,
      verifyJwt: fn.verifyJwt,
      url: template(fn.urlTemplate, projectRef),
      entrypoint: fn.entrypoint,
      sourceSha256: sha256(readFileSync(resolve(root, fn.entrypoint))),
      importMapSha256: sha256(readFileSync(resolve(root, fn.importMap))),
      requiredSecretNames: [...fn.requiredSecrets].sort(),
    })),
    authHooks: spec.authHooks.map((hook) => ({ ...hook, url: template(hook.urlTemplate, projectRef), urlTemplate: undefined })),
    vaultSecrets: spec.vaultSecrets.map((secret) => ({
      name: secret.name,
      kind: secret.kind,
      expectedUrl: secret.expectedTemplate ? template(secret.expectedTemplate, projectRef) : undefined,
      sourceMigration: secret.sourceMigration,
      sourceSha256: sha256(readFileSync(resolve(root, secret.sourceMigration))),
    })),
    cronJobs: spec.cronJobs.map(({ sourceMigration, ...job }) => ({
      ...job,
      sourceMigration,
      sourceSha256: sha256(readFileSync(resolve(root, sourceMigration))),
    })),
    postDeployProbes: spec.postDeployProbes,
  }
  return { ...manifest, artifactSha256: sha256(JSON.stringify(manifest)) }
}

function containsForbiddenEvidenceField(value, path = '') {
  if (!value || typeof value !== 'object') return null
  for (const [key, child] of Object.entries(value)) {
    const childPath = path ? `${path}.${key}` : key
    const normalizedKey = key.replaceAll('-', '').replaceAll('_', '').toLowerCase()
    if (['value', 'secret', 'token', 'authorization', 'apikey', 'servicerolekey', 'password', 'privatekey', 'credential', 'headers', 'body'].includes(normalizedKey)) return childPath
    const nested = containsForbiddenEvidenceField(child, childPath)
    if (nested) return nested
  }
  return null
}

function compare(mode, errors, warnings, code, subject, message) {
  const target = mode === 'post-deploy' ? errors : warnings
  target.push(issue(mode === 'post-deploy' ? code : 'MAS-DEP-W04', subject, message))
}

export function validateRuntimeEvidence({ manifest, evidence, mode = 'post-deploy', now = new Date() }) {
  const errors = []
  const warnings = []
  if (!['pre-deploy', 'post-deploy'].includes(mode)) errors.push(issue('MAS-DEP-006', 'mode', 'Mode pre-deploy veya post-deploy olmalı.'))
  if (evidence?.schemaVersion !== 1 || evidence?.projectRef !== manifest.projectRef) {
    errors.push(issue('MAS-DEP-019', 'evidence', 'Runtime kanıtı sürümü veya project ref eşleşmiyor.'))
  }
  const capturedAt = Date.parse(evidence?.capturedAt ?? '')
  const age = now.getTime() - capturedAt
  if (!Number.isFinite(capturedAt) || age > MAX_EVIDENCE_AGE_MS || age < -MAX_FUTURE_SKEW_MS) {
    errors.push(issue('MAS-DEP-019', 'capturedAt', 'Runtime kanıtı eksik, gelecekte veya 24 saatten eski.'))
  }
  const forbiddenField = containsForbiddenEvidenceField(evidence)
  if (forbiddenField) errors.push(issue('MAS-DEP-022', forbiddenField, 'Runtime kanıtı credential değeri içeremez; yalnız ad/configured metadata kabul edilir.'))

  for (const [kind, required] of Object.entries(manifest.capabilities)) {
    const actual = new Set(evidence?.capabilities?.[kind] ?? [])
    for (const name of required) if (!actual.has(name)) compare(mode, errors, warnings, 'MAS-DEP-022', `${kind}:${name}`, 'Gerekli database capability görünmüyor.')
  }

  const functions = new Map((evidence?.edgeFunctions ?? []).map((item) => [item.name, item]))
  for (const expected of manifest.edgeFunctions) {
    const actual = functions.get(expected.name)
    if (!actual || actual.active !== true || actual.verifyJwt !== expected.verifyJwt || actual.url !== expected.url) {
      compare(mode, errors, warnings, 'MAS-DEP-020', expected.name, 'Edge Function aktif değil veya URL/verifyJwt sözleşmesi uyuşmuyor.')
      continue
    }
    const secretNames = new Set(actual.configuredSecretNames ?? [])
    for (const name of expected.requiredSecretNames) {
      if (!secretNames.has(name)) compare(mode, errors, warnings, 'MAS-DEP-022', `${expected.name}:${name}`, 'Function secret metadata’sı eksik.')
    }
  }

  const hooks = new Map((evidence?.authHooks ?? []).map((item) => [item.name, item]))
  for (const expected of manifest.authHooks) {
    const actual = hooks.get(expected.name)
    if (!actual || actual.enabled !== expected.enabled || actual.url !== expected.url) {
      compare(mode, errors, warnings, 'MAS-DEP-020', expected.name, 'Auth hook etkinliği veya URL’si uyuşmuyor.')
    }
  }

  const vault = new Map((evidence?.vaultSecrets ?? []).map((item) => [item.name, item]))
  for (const expected of manifest.vaultSecrets) {
    const actual = vault.get(expected.name)
    if (!actual || actual.configured !== true || (expected.expectedUrl && actual.url !== expected.expectedUrl)) {
      compare(mode, errors, warnings, 'MAS-DEP-022', expected.name, 'Vault secret metadata’sı eksik veya worker URL’si uyuşmuyor.')
    }
  }

  const jobs = new Map((evidence?.cronJobs ?? []).map((item) => [item.name, item]))
  for (const expected of manifest.cronJobs) {
    const actual = jobs.get(expected.name)
    if (!actual || actual.active !== true || actual.schedule !== expected.schedule || normalizeSql(actual.command ?? '') !== normalizeSql(expected.command)) {
      compare(mode, errors, warnings, 'MAS-DEP-021', expected.name, 'Cron aktif değil veya schedule/command sözleşmesi uyuşmuyor.')
    }
  }

  const probes = new Map((evidence?.probes ?? []).map((item) => [item.name, item]))
  for (const expected of manifest.postDeployProbes) {
    const actual = probes.get(expected.name)
    if (!actual || actual.status !== expected.expectedStatus) {
      compare(mode, errors, warnings, 'MAS-DEP-023', expected.name, 'Güvenli post-deploy probe sonucu beklenen HTTP durumunu vermedi.')
    }
  }
  return { ok: errors.length === 0, mode, errors, warnings, projectRef: manifest.projectRef, runtimeArtifactSha256: manifest.artifactSha256 }
}

function parseArguments(argv) {
  const args = argv.filter((arg) => arg !== '--')
  const command = args.shift()
  const options = { command, mode: 'post-deploy' }
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    if (arg === '--project-ref') options.projectRef = args[++index]
    else if (arg === '--evidence') options.evidence = args[++index]
    else if (arg === '--output') options.output = args[++index]
    else if (arg === '--mode') options.mode = args[++index]
    else throw Object.assign(new Error(`Bilinmeyen argüman: ${arg}`), { code: 'MAS-DEP-006' })
  }
  return options
}

function writeJson(path, value, root) {
  writeFileSync(resolve(root, path), `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 })
}

export function runCli(argv = process.argv.slice(2), root = ROOT) {
  try {
    const options = parseArguments(argv)
    if (!options.projectRef || !['manifest', 'verify'].includes(options.command)) throw Object.assign(new Error('Komut ve --project-ref zorunlu.'), { code: 'MAS-DEP-006' })
    const { spec, sha256: specSha256 } = loadRuntimeSpec(root)
    const manifest = buildRuntimeManifest({ spec, specSha256, projectRef: options.projectRef, root })
    if (options.command === 'manifest') {
      if (!options.output) throw Object.assign(new Error('manifest için --output zorunlu.'), { code: 'MAS-DEP-006' })
      writeJson(options.output, manifest, root)
      console.log('Masabu runtime manifest: PASS')
      console.log(`Runtime SHA-256: ${manifest.artifactSha256}`)
      console.log(`Edge Functions: ${manifest.edgeFunctions.length}; cron jobs: ${manifest.cronJobs.length}`)
      console.log(`Output: ${options.output}`)
      return 0
    }
    if (!options.evidence) throw Object.assign(new Error('verify için --evidence zorunlu.'), { code: 'MAS-DEP-006' })
    const evidence = JSON.parse(readFileSync(resolve(root, options.evidence), 'utf8'))
    const result = validateRuntimeEvidence({ manifest, evidence, mode: options.mode })
    if (options.output) writeJson(options.output, result, root)
    console.log(`Masabu runtime verification (${options.mode}): ${result.ok ? 'PASS' : 'FAIL'}`)
    console.log(`Runtime SHA-256: ${result.runtimeArtifactSha256}`)
    for (const item of result.errors) console.error(`ERROR ${item.code} ${item.subject}: ${item.message}`)
    for (const item of result.warnings) console.warn(`WARN  ${item.code} ${item.subject}: ${item.message}`)
    return result.ok ? 0 : 1
  } catch (error) {
    console.error(`${error.code ?? 'MAS-DEP-006'} runtime-deployment: ${error.message}`)
    return 1
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  process.exitCode = runCli()
}
