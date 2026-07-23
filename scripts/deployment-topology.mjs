import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { parseEnv } from './production-readiness.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SPEC_PATH = 'config/production-topology.json'
const DEV_PROJECT_REF = 'yxsegwkzyiscrxiwdeuf'

function sha256(value) {
  return createHash('sha256').update(value).digest('hex')
}

function topologyIssue(code, subject, message) {
  return { code, subject, message }
}

function canonicalOrigin(value) {
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) return null
    if (url.pathname !== '/' && url.pathname !== '') return null
    return url.origin
  } catch {
    return null
  }
}

export function loadTopologySpec(root = ROOT) {
  const raw = readFileSync(resolve(root, SPEC_PATH), 'utf8')
  return { spec: JSON.parse(raw), sha256: sha256(raw) }
}

function readMember(envByScope, [scope, key]) {
  return envByScope[scope]?.[key]?.trim() ?? ''
}

export function validateDeploymentTopology({ spec, envByScope, projectRef, root = ROOT }) {
  const errors = []
  const warnings = []

  if (!projectRef || !/^[a-z0-9]{20}$/.test(projectRef)) {
    errors.push(topologyIssue('MAS-DEP-006', 'project-ref', 'Production project ref 20 küçük harf/rakam olmalı.'))
  } else if (projectRef === DEV_PROJECT_REF) {
    errors.push(topologyIssue('MAS-DEP-004', 'project-ref', 'DEV Supabase projesi production topolojisi olamaz.'))
  }

  for (const scope of spec.requiredScopes) {
    if (!envByScope[scope]) errors.push(topologyIssue('MAS-DEP-001', scope, 'Production env scope dosyası eksik.'))
  }

  for (const [scope, key, originName] of spec.originBindings) {
    const value = readMember(envByScope, [scope, key])
    const expected = spec.origins[originName]
    if (!value) errors.push(topologyIssue('MAS-DEP-001', `${scope}:${key}`, 'Topology binding değeri eksik.'))
    else if (canonicalOrigin(value) !== expected) {
      errors.push(topologyIssue('MAS-DEP-012', `${scope}:${key}`, `Beklenen public origin: ${expected}`))
    }
  }

  for (const group of spec.sharedValueGroups) {
    const values = group.members.map((member) => readMember(envByScope, member))
    if (values.some((value) => !value)) {
      errors.push(topologyIssue('MAS-DEP-001', group.name, 'Paylaşılan topology değeri bir veya daha fazla scope içinde eksik.'))
    } else if (new Set(values).size !== 1) {
      errors.push(topologyIssue('MAS-DEP-013', group.name, 'Paylaşılan değer scope’lar arasında eşleşmiyor.'))
    }
  }

  const expectedSupabaseUrl = projectRef ? `https://${projectRef}.supabase.co` : null
  const supabaseUrl = readMember(envByScope, ['dashboard', 'NEXT_PUBLIC_SUPABASE_URL'])
  if (expectedSupabaseUrl && supabaseUrl && supabaseUrl !== expectedSupabaseUrl) {
    errors.push(topologyIssue('MAS-DEP-004', 'supabase-url', 'Topology beklenen production Supabase projesine bağlı değil.'))
  }

  const publicEndpoints = []
  for (const endpoint of spec.endpoints) {
    const expected = new URL(endpoint.path, spec.origins[endpoint.origin]).toString()
    const actual = readMember(envByScope, [endpoint.scope, endpoint.envKey])
    if (!actual) errors.push(topologyIssue('MAS-DEP-001', endpoint.name, 'Worker endpoint URL’si eksik.'))
    else if (actual !== expected) errors.push(topologyIssue('MAS-DEP-014', endpoint.name, `Beklenen endpoint: ${expected}`))
    if (!existsSync(resolve(root, endpoint.routeFile))) {
      errors.push(topologyIssue('MAS-DEP-015', endpoint.name, `Route dosyası bulunamadı: ${endpoint.routeFile}`))
    }
    publicEndpoints.push({ name: endpoint.name, url: expected, routeFile: endpoint.routeFile })
  }

  for (const [name, originName, path, routeFile] of spec.derivedPublicRoutes) {
    if (!existsSync(resolve(root, routeFile))) {
      errors.push(topologyIssue('MAS-DEP-015', name, `Route dosyası bulunamadı: ${routeFile}`))
    }
    publicEndpoints.push({ name, url: new URL(path, spec.origins[originName]).toString(), routeFile })
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    projectRef,
    origins: spec.origins,
    scopes: spec.requiredScopes,
    publicEndpoints,
  }
}

function parseArguments(argv) {
  const options = { envFiles: {}, json: false }
  const args = argv.filter((arg) => arg !== '--')
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    if (arg === '--env') {
      const binding = args[++index] ?? ''
      const separator = binding.indexOf('=')
      if (separator < 1) throw new Error('--env scope=path biçiminde olmalı.')
      options.envFiles[binding.slice(0, separator)] = binding.slice(separator + 1)
    } else if (arg === '--project-ref') options.projectRef = args[++index]
    else if (arg === '--json') options.json = true
    else throw new Error(`Bilinmeyen argüman: ${arg}`)
  }
  return options
}

function printResult(result, specDigest) {
  console.log(`Masabu deployment topology: ${result.ok ? 'PASS' : 'FAIL'}`)
  console.log(`Project ref: ${result.projectRef ?? 'missing'}`)
  console.log(`Scopes: ${result.scopes.join(', ')}`)
  console.log(`Public endpoints: ${result.publicEndpoints.length}`)
  console.log(`Topology SHA-256: ${specDigest}`)
  for (const item of result.errors) console.error(`ERROR ${item.code} ${item.subject}: ${item.message}`)
  for (const item of result.warnings) console.warn(`WARN  ${item.code} ${item.subject}: ${item.message}`)
}

export function runCli(argv = process.argv.slice(2), root = ROOT) {
  let options
  try {
    options = parseArguments(argv)
  } catch (error) {
    console.error(`MAS-DEP-006 arguments: ${error instanceof Error ? error.message : 'Geçersiz argüman'}`)
    return 2
  }
  if (!options.projectRef || Object.keys(options.envFiles).length === 0) {
    console.error('Kullanım: deployment-topology.mjs --project-ref <ref> --env dashboard=<path> --env menu=<path> ... [--json]')
    return 2
  }

  const envByScope = {}
  const readErrors = []
  for (const [scope, file] of Object.entries(options.envFiles)) {
    try {
      envByScope[scope] = parseEnv(readFileSync(resolve(root, file), 'utf8'))
    } catch {
      readErrors.push(topologyIssue('MAS-DEP-001', scope, `Env dosyası okunamadı: ${file}`))
    }
  }

  const { spec, sha256: specDigest } = loadTopologySpec(root)
  const result = validateDeploymentTopology({ spec, envByScope, projectRef: options.projectRef, root })
  result.errors.unshift(...readErrors)
  result.ok = result.errors.length === 0
  if (options.json) console.log(JSON.stringify({ ...result, topologySha256: specDigest }, null, 2))
  else printResult(result, specDigest)
  return result.ok ? 0 : 1
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  process.exitCode = runCli()
}
