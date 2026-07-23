import { createHash } from 'node:crypto'
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const MIGRATIONS_DIRECTORY = 'packages/db/supabase/migrations'
const DEV_PROJECT_REF = 'yxsegwkzyiscrxiwdeuf'

function sha256(value) {
  return createHash('sha256').update(value).digest('hex')
}

function releaseIssue(code, subject, message) {
  return { code, subject, message }
}

export function createMigrationManifest(root = ROOT) {
  const directory = resolve(root, MIGRATIONS_DIRECTORY)
  const files = readdirSync(directory)
    .filter((name) => /^\d{14}_.+\.sql$/.test(name))
    .sort()
  const migrations = files.map((file) => {
    const contents = readFileSync(resolve(directory, file))
    return { version: file.slice(0, 14), file, sha256: sha256(contents) }
  })
  const digestInput = migrations
    .map((migration) => `${migration.version}:${migration.file}:${migration.sha256}`)
    .join('\n')

  return {
    schemaVersion: 1,
    count: migrations.length,
    first: migrations[0]?.version ?? null,
    latest: migrations.at(-1)?.version ?? null,
    sha256: sha256(digestInput),
    migrations,
  }
}

export function parseMigrationListEvidence(text) {
  const metadata = {}
  const rows = []

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim()
    const metadataMatch = line.match(/^#\s*masabu-([a-z-]+)\s*:\s*(.+)$/i)
    if (metadataMatch) {
      metadata[metadataMatch[1].toLowerCase()] = metadataMatch[2].trim()
      continue
    }

    if (!rawLine.includes('|')) continue
    const [localCell = '', remoteCell = ''] = rawLine.split('|')
    const local = localCell.trim()
    const remote = remoteCell.trim()
    if (!/^\d{14}$/.test(local) && !/^\d{14}$/.test(remote)) continue
    rows.push({
      local: /^\d{14}$/.test(local) ? local : null,
      remote: /^\d{14}$/.test(remote) ? remote : null,
    })
  }

  return {
    projectRef: metadata['project-ref'] ?? null,
    capturedAt: metadata['captured-at'] ?? null,
    localVersions: rows.flatMap((row) => row.local ? [row.local] : []),
    remoteVersions: rows.flatMap((row) => row.remote ? [row.remote] : []),
  }
}

function firstDuplicate(values) {
  const seen = new Set()
  for (const value of values) {
    if (seen.has(value)) return value
    seen.add(value)
  }
  return null
}

function isStrictlyOrdered(values) {
  return values.every((value, index) => index === 0 || values[index - 1] < value)
}

export function verifyMigrationEvidence({ manifest, evidence, expectedProjectRef, mode = 'pre-deploy' }) {
  const errors = []
  const warnings = []
  const localVersions = manifest.migrations.map((migration) => migration.version)
  const { projectRef, capturedAt, localVersions: listedLocal, remoteVersions } = evidence

  if (!['pre-deploy', 'post-deploy'].includes(mode)) {
    errors.push(releaseIssue('MAS-DEP-006', 'mode', 'Mode pre-deploy veya post-deploy olmalı.'))
  }
  if (!expectedProjectRef || !/^[a-z0-9]{20}$/.test(expectedProjectRef)) {
    errors.push(releaseIssue('MAS-DEP-006', 'project-ref', 'Beklenen project ref 20 küçük harf/rakam olmalı.'))
  } else if (expectedProjectRef === DEV_PROJECT_REF) {
    errors.push(releaseIssue('MAS-DEP-004', 'project-ref', 'DEV projesi production migration kanıtı olamaz.'))
  }
  if (!projectRef) {
    errors.push(releaseIssue('MAS-DEP-010', 'evidence', 'Kanıtta masabu-project-ref metadata satırı eksik.'))
  } else if (projectRef !== expectedProjectRef || projectRef === DEV_PROJECT_REF) {
    errors.push(releaseIssue('MAS-DEP-004', 'evidence', 'Migration kanıtı beklenen production projesine ait değil.'))
  }
  if (!capturedAt || Number.isNaN(Date.parse(capturedAt))) {
    errors.push(releaseIssue('MAS-DEP-010', 'evidence', 'Kanıtta geçerli masabu-captured-at metadata satırı eksik.'))
  }
  if (remoteVersions.length === 0) {
    errors.push(releaseIssue('MAS-DEP-010', 'evidence', 'Remote migration listesi boş veya okunamadı.'))
  }

  const duplicateLocal = firstDuplicate(listedLocal)
  const duplicateRemote = firstDuplicate(remoteVersions)
  if (duplicateLocal || duplicateRemote) {
    errors.push(releaseIssue('MAS-DEP-007', 'evidence', `Migration kanıtında tekrarlanan version: ${duplicateLocal ?? duplicateRemote}`))
  }
  if (!isStrictlyOrdered(listedLocal) || !isStrictlyOrdered(remoteVersions)) {
    errors.push(releaseIssue('MAS-DEP-008', 'evidence', 'Migration listesi sıralı ve append-only değil.'))
  }
  if (listedLocal.length > 0 && JSON.stringify(listedLocal) !== JSON.stringify(localVersions)) {
    errors.push(releaseIssue('MAS-DEP-008', 'local-history', 'Kanıttaki local geçmiş bu release manifestiyle eşleşmiyor.'))
  }

  const remoteIsPrefix = remoteVersions.every((version, index) => localVersions[index] === version)
  if (!remoteIsPrefix) {
    errors.push(releaseIssue('MAS-DEP-008', 'remote-history', "Remote geçmiş local migration zincirinin append-only prefix'i değil."))
  }

  const pending = remoteIsPrefix ? localVersions.slice(remoteVersions.length) : []
  if (mode === 'post-deploy' && pending.length > 0) {
    errors.push(releaseIssue('MAS-DEP-009', 'remote-history', `Deploy sonrası remote geçmişte ${pending.length} migration eksik.`))
  } else if (mode === 'pre-deploy' && pending.length > 0) {
    warnings.push(releaseIssue('MAS-DEP-W03', 'remote-history', `Deploy planında ${pending.length} bekleyen migration var.`))
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    projectRef,
    capturedAt,
    mode,
    localCount: localVersions.length,
    remoteCount: remoteVersions.length,
    pending,
    manifestSha256: manifest.sha256,
  }
}

function parseArguments(argv) {
  const [command, ...rest] = argv.filter((arg) => arg !== '--')
  const options = { command, mode: 'pre-deploy', json: false }
  for (let index = 0; index < rest.length; index += 1) {
    const arg = rest[index]
    if (arg === '--output') options.output = rest[++index]
    else if (arg === '--remote-list') options.remoteList = rest[++index]
    else if (arg === '--project-ref') options.projectRef = rest[++index]
    else if (arg === '--mode') options.mode = rest[++index]
    else if (arg === '--json') options.json = true
    else throw new Error(`Bilinmeyen argüman: ${arg}`)
  }
  return options
}

function printVerification(result) {
  console.log(`Masabu migration drift check: ${result.ok ? 'PASS' : 'FAIL'}`)
  console.log(`Mode: ${result.mode}`)
  console.log(`Project ref: ${result.projectRef ?? 'missing'}`)
  console.log(`Migration count: local=${result.localCount}, remote=${result.remoteCount}, pending=${result.pending.length}`)
  console.log(`Manifest SHA-256: ${result.manifestSha256}`)
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

  const manifest = createMigrationManifest(root)
  if (options.command === 'manifest') {
    const serialized = `${JSON.stringify(manifest, null, 2)}\n`
    if (options.output) writeFileSync(resolve(root, options.output), serialized, { mode: 0o600 })
    else process.stdout.write(serialized)
    return 0
  }
  if (options.command !== 'verify' || !options.remoteList || !options.projectRef) {
    console.error('Kullanım: migration-release.mjs manifest [--output <path>] | verify --remote-list <path> --project-ref <ref> [--mode pre-deploy|post-deploy] [--json]')
    return 2
  }

  let evidence
  try {
    evidence = parseMigrationListEvidence(readFileSync(resolve(root, options.remoteList), 'utf8'))
  } catch {
    console.error(`MAS-DEP-001 remote-list: Migration kanıt dosyası okunamadı: ${options.remoteList}`)
    return 2
  }
  const result = verifyMigrationEvidence({ manifest, evidence, expectedProjectRef: options.projectRef, mode: options.mode })
  if (options.json) console.log(JSON.stringify(result, null, 2))
  else printVerification(result)
  return result.ok ? 0 : 1
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  process.exitCode = runCli()
}
