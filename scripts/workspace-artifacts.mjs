import {
  existsSync,
  lstatSync,
  readFileSync,
  readdirSync,
  rmSync,
} from 'node:fs'
import { relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const APP_NAMES = ['dashboard', 'kitchen', 'marketing', 'menu', 'platform-admin']
const PRESERVED_TEST_RESULTS = new Set(['dashboard-spinner-audit', 'shell-entrypoints-audit'])
const NEVER_DELETE_SEGMENTS = new Set(['.git', 'agent-skills', 'node_modules'])

function workspacePackage(root) {
  const packagePath = resolve(root, 'package.json')
  if (!existsSync(packagePath)) throw new Error(`Workspace package.json bulunamadı: ${packagePath}`)
  const parsed = JSON.parse(readFileSync(packagePath, 'utf8'))
  if (parsed.name !== 'garsonless' || parsed.private !== true) {
    throw new Error('Temizlik yalnızca private garsonless workspace kökünde çalışabilir.')
  }
  return parsed
}

function walk(directory, visit) {
  if (!existsSync(directory)) return
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name)
    if (entry.isSymbolicLink()) continue
    if (entry.isDirectory()) {
      if (NEVER_DELETE_SEGMENTS.has(entry.name)) continue
      walk(path, visit)
      continue
    }
    visit(path, entry.name)
  }
}

function assertSafeTarget(root, target) {
  const rel = relative(root, target)
  if (!rel || rel.startsWith(`..${sep}`) || rel === '..') throw new Error(`Güvenli olmayan hedef: ${target}`)
  const segments = rel.split(sep)
  if (segments.some((segment) => NEVER_DELETE_SEGMENTS.has(segment))) {
    throw new Error(`Korunan dizin hedeflenemez: ${rel}`)
  }
  if (segments.some((segment) => segment === '.env' || segment.startsWith('.env.'))) {
    throw new Error(`Ortam dosyası hedeflenemez: ${rel}`)
  }
  return rel
}

export function collectArtifactTargets(rootDirectory = process.cwd()) {
  const root = resolve(rootDirectory)
  workspacePackage(root)
  const targets = new Set()

  for (const appName of APP_NAMES) {
    const nextDirectory = resolve(root, 'apps', appName, '.next')
    if (existsSync(nextDirectory)) targets.add(nextDirectory)
  }

  for (const sourceRoot of [resolve(root, 'apps'), resolve(root, 'packages')]) {
    walk(sourceRoot, (path, name) => {
      if (name === 'tsconfig.tsbuildinfo' || name === '.DS_Store') targets.add(path)
    })
  }
  const rootDsStore = resolve(root, '.DS_Store')
  if (existsSync(rootDsStore)) targets.add(rootDsStore)

  const testResults = resolve(root, 'test-results')
  if (existsSync(testResults)) {
    for (const entry of readdirSync(testResults, { withFileTypes: true })) {
      if (PRESERVED_TEST_RESULTS.has(entry.name)) continue
      targets.add(resolve(testResults, entry.name))
    }
  }

  return [...targets]
    .map((target) => ({ absolute: target, relative: assertSafeTarget(root, target) }))
    .sort((a, b) => a.relative.localeCompare(b.relative))
}

export function cleanArtifacts({ rootDirectory = process.cwd(), apply = false } = {}) {
  const targets = collectArtifactTargets(rootDirectory)
  for (const target of targets) {
    console.log(`${apply ? 'REMOVE' : 'DRY-RUN'} ${target.relative}`)
    if (apply) rmSync(target.absolute, { recursive: true, force: true })
  }
  console.log(`${targets.length} allowlist hedefi ${apply ? 'temizlendi' : 'bulundu'}.`)
  return targets
}

function entrySize(path) {
  const stat = lstatSync(path)
  if (stat.isSymbolicLink()) return stat.size
  if (!stat.isDirectory()) return stat.size
  let total = stat.size
  for (const entry of readdirSync(path)) total += entrySize(resolve(path, entry))
  return total
}

function formatSize(bytes) {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(2)} GiB`
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MiB`
  return `${(bytes / 1024).toFixed(1)} KiB`
}

export function reportWorkspaceSize(rootDirectory = process.cwd()) {
  const root = resolve(rootDirectory)
  workspacePackage(root)
  const entries = readdirSync(root)
    .map((name) => ({ name, bytes: entrySize(resolve(root, name)) }))
    .sort((a, b) => b.bytes - a.bytes)
  for (const entry of entries) console.log(`${formatSize(entry.bytes).padStart(10)}  ${entry.name}`)
  console.log(`${formatSize(entries.reduce((sum, entry) => sum + entry.bytes, 0)).padStart(10)}  TOTAL`)
  return entries
}

function runCli(argumentsList) {
  const [command, ...options] = argumentsList
  if (command === 'size') return reportWorkspaceSize()
  if (command === 'clean') return cleanArtifacts({ apply: options.includes('--apply') })
  throw new Error('Kullanım: workspace-artifacts.mjs size | clean [--apply]')
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    runCli(process.argv.slice(2))
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  }
}
