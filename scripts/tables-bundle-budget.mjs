import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, isAbsolute, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gzipSync } from 'node:zlib'

export const TABLES_BUNDLE_BUDGETS = Object.freeze([
  Object.freeze({
    label: 'Canlı Masalar',
    publicRoute: '/tables',
    manifestRoute: '/dashboard/[restaurantId]/tables/page',
    entryDirectory: 'static/chunks/app/dashboard/[restaurantId]/tables/',
    maxEntryGzipBytes: 12_500,
    maxInitialGzipBytes: 350_000,
  }),
  Object.freeze({
    label: 'QR Studio',
    publicRoute: '/tables/qr',
    manifestRoute: '/dashboard/[restaurantId]/tables/qr/page',
    entryDirectory: 'static/chunks/app/dashboard/[restaurantId]/tables/qr/',
    maxEntryGzipBytes: 20_000,
    maxInitialGzipBytes: 155_000,
  }),
])

export class TablesBundleBudgetError extends Error {
  constructor(message) {
    super(message)
    this.name = 'TablesBundleBudgetError'
    this.code = 'TABLES_BUNDLE_BUDGET'
  }
}

function fail(message) {
  throw new TablesBundleBudgetError(message)
}

function parseManifest(buildDirectory) {
  const manifestPath = resolve(buildDirectory, 'app-build-manifest.json')
  if (!existsSync(manifestPath)) {
    fail(`Next.js app build manifest bulunamadı: ${manifestPath}`)
  }

  let manifest
  try {
    manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
  } catch (error) {
    fail(`Next.js app build manifest okunamadı: ${error instanceof Error ? error.message : String(error)}`)
  }

  if (!manifest || typeof manifest !== 'object' || !manifest.pages || typeof manifest.pages !== 'object') {
    fail('Next.js app build manifest geçerli bir pages kaydı içermiyor.')
  }
  return manifest
}

function resolveChunk(buildDirectory, chunk) {
  const buildRoot = resolve(buildDirectory)
  const chunkPath = resolve(buildRoot, chunk)
  const relativeChunk = relative(buildRoot, chunkPath)
  if (relativeChunk.startsWith('..') || isAbsolute(relativeChunk)) {
    fail(`Build manifest güvenli olmayan bir chunk yolu içeriyor: ${chunk}`)
  }
  if (!existsSync(chunkPath)) {
    fail(`Build manifestteki chunk bulunamadı: ${chunk}`)
  }
  return chunkPath
}

function isRouteEntry(chunk, budget) {
  if (!chunk.startsWith(budget.entryDirectory)) return false
  const fileName = chunk.slice(budget.entryDirectory.length)
  return /^page-[a-f0-9]+\.js$/u.test(fileName)
}

export function measureTablesRoute({ buildDirectory, manifest, budget }) {
  const routeFiles = manifest.pages[budget.manifestRoute]
  if (!Array.isArray(routeFiles) || routeFiles.length === 0) {
    fail(`Build manifestte ${budget.publicRoute} route'u bulunamadı.`)
  }

  const javascriptFiles = [...new Set(routeFiles.filter((file) => typeof file === 'string' && file.endsWith('.js')))]
  if (javascriptFiles.length === 0) {
    fail(`${budget.publicRoute} route'u için JavaScript chunk bulunamadı.`)
  }

  const entryFiles = javascriptFiles.filter((file) => isRouteEntry(file, budget))
  if (entryFiles.length !== 1) {
    fail(`${budget.publicRoute} route entry chunk sayısı 1 olmalı; bulunan: ${entryFiles.length}.`)
  }

  const files = javascriptFiles.map((file) => {
    const contents = readFileSync(resolveChunk(buildDirectory, file))
    return {
      file,
      rawBytes: contents.byteLength,
      gzipBytes: gzipSync(contents, { level: 9 }).byteLength,
    }
  })
  const entry = files.find((file) => file.file === entryFiles[0])
  if (!entry) fail(`${budget.publicRoute} route entry chunk ölçülemedi.`)

  const initialRawBytes = files.reduce((total, file) => total + file.rawBytes, 0)
  const initialGzipBytes = files.reduce((total, file) => total + file.gzipBytes, 0)
  return {
    label: budget.label,
    publicRoute: budget.publicRoute,
    manifestRoute: budget.manifestRoute,
    chunkCount: files.length,
    entryFile: entry.file,
    entryRawBytes: entry.rawBytes,
    entryGzipBytes: entry.gzipBytes,
    initialRawBytes,
    initialGzipBytes,
    maxEntryGzipBytes: budget.maxEntryGzipBytes,
    maxInitialGzipBytes: budget.maxInitialGzipBytes,
    ...(budget.hardMaxInitialGzipBytes ? { hardMaxInitialGzipBytes: budget.hardMaxInitialGzipBytes } : {}),
    ...(budget.baselineInitialGzipBytes ? { baselineInitialGzipBytes: budget.baselineInitialGzipBytes } : {}),
    ...(budget.maxRegressionPercent ? { maxRegressionPercent: budget.maxRegressionPercent } : {}),
    entryHeadroomBytes: budget.maxEntryGzipBytes - entry.gzipBytes,
    initialHeadroomBytes: budget.maxInitialGzipBytes - initialGzipBytes,
  }
}

export function verifyTablesBundleBudgets({ buildDirectory, budgets = TABLES_BUNDLE_BUDGETS } = {}) {
  if (!buildDirectory) fail('Build dizini zorunludur.')
  if (!Array.isArray(budgets) || budgets.length === 0) fail('En az bir bundle bütçesi zorunludur.')

  const absoluteBuildDirectory = resolve(buildDirectory)
  const manifest = parseManifest(absoluteBuildDirectory)
  const routes = budgets.map((budget) => measureTablesRoute({ buildDirectory: absoluteBuildDirectory, manifest, budget }))
  const violations = routes.flatMap((route) => {
    const routeViolations = []
    if (route.entryGzipBytes > route.maxEntryGzipBytes) {
      routeViolations.push(`${route.publicRoute} entry ${route.entryGzipBytes} B > ${route.maxEntryGzipBytes} B`)
    }
    if (route.initialGzipBytes > route.maxInitialGzipBytes) {
      routeViolations.push(`${route.publicRoute} initial ${route.initialGzipBytes} B > ${route.maxInitialGzipBytes} B`)
    }
    return routeViolations
  })
  if (violations.length > 0) {
    fail(`Masalar bundle bütçesi aşıldı: ${violations.join('; ')}`)
  }

  return {
    schemaVersion: 1,
    kind: 'tables-route-bundle-budget',
    compression: 'gzip-level-9',
    passed: true,
    buildDirectory: absoluteBuildDirectory,
    routes,
  }
}

function parseArguments(argumentsList) {
  const options = { buildDirectory: 'apps/dashboard/.next', output: null }
  for (let index = 0; index < argumentsList.length; index += 1) {
    const argument = argumentsList[index]
    if (argument === '--') continue
    if (argument === '--build-dir') {
      options.buildDirectory = argumentsList[index + 1]
      index += 1
      continue
    }
    if (argument === '--output') {
      options.output = argumentsList[index + 1]
      index += 1
      continue
    }
    fail(`Bilinmeyen argüman: ${argument}`)
  }
  if (!options.buildDirectory) fail('--build-dir bir değer gerektirir.')
  if (argumentsList.includes('--output') && !options.output) fail('--output bir değer gerektirir.')
  return options
}

function formatKilobytes(bytes) {
  return `${(bytes / 1000).toFixed(1)} kB`
}

export function runTablesBundleBudgetCli(argumentsList = process.argv.slice(2)) {
  const options = parseArguments(argumentsList)
  const evidence = verifyTablesBundleBudgets({ buildDirectory: options.buildDirectory })
  for (const route of evidence.routes) {
    console.log(
      `PASS ${route.publicRoute}: entry ${formatKilobytes(route.entryGzipBytes)}/${formatKilobytes(route.maxEntryGzipBytes)}, initial ${formatKilobytes(route.initialGzipBytes)}/${formatKilobytes(route.maxInitialGzipBytes)}`,
    )
  }
  if (options.output) {
    const outputPath = resolve(options.output)
    mkdirSync(dirname(outputPath), { recursive: true })
    writeFileSync(outputPath, `${JSON.stringify(evidence, null, 2)}\n`, { mode: 0o600 })
    console.log(`Evidence: ${outputPath}`)
  }
  return evidence
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    runTablesBundleBudgetCli()
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  }
}
