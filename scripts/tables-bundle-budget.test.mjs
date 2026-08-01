import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import test from 'node:test'
import { gzipSync } from 'node:zlib'
import {
  TABLES_BUNDLE_BUDGETS,
  verifyTablesBundleBudgets,
} from './tables-bundle-budget.mjs'

function createBuildFixture({ omitRoute = null, omitChunk = null } = {}) {
  const buildDirectory = mkdtempSync(join(tmpdir(), 'masabu-tables-bundle-'))
  const shared = 'static/chunks/shared.js'
  const entries = [
    'static/chunks/app/dashboard/[restaurantId]/tables/page-aaa111.js',
    'static/chunks/app/dashboard/[restaurantId]/tables/qr/page-bbb222.js',
  ]
  const contents = new Map([
    [shared, Buffer.from('shared-runtime'.repeat(200))],
    [entries[0], Buffer.from('tables-entry'.repeat(300))],
    [entries[1], Buffer.from('qr-entry'.repeat(250))],
  ])
  const pages = {
    '/dashboard/[restaurantId]/tables/page': [shared, entries[0]],
    '/dashboard/[restaurantId]/tables/qr/page': [shared, entries[1]],
  }
  if (omitRoute) delete pages[omitRoute]
  writeFileSync(join(buildDirectory, 'app-build-manifest.json'), JSON.stringify({ pages }))
  for (const [file, value] of contents) {
    if (file === omitChunk) continue
    const output = join(buildDirectory, file)
    mkdirSync(dirname(output), { recursive: true })
    writeFileSync(output, value)
  }
  return { buildDirectory, contents, shared, entries }
}

test('measures route entry and initial JavaScript with deterministic gzip budgets', () => {
  const fixture = createBuildFixture()
  const evidence = verifyTablesBundleBudgets({ buildDirectory: fixture.buildDirectory })
  assert.equal(evidence.passed, true)
  assert.equal(evidence.compression, 'gzip-level-9')
  assert.equal(evidence.routes.length, 2)

  const tables = evidence.routes[0]
  const expectedShared = gzipSync(fixture.contents.get(fixture.shared), { level: 9 }).byteLength
  const expectedEntry = gzipSync(fixture.contents.get(fixture.entries[0]), { level: 9 }).byteLength
  assert.equal(tables.entryGzipBytes, expectedEntry)
  assert.equal(tables.initialGzipBytes, expectedShared + expectedEntry)
  assert.equal(tables.entryFile, fixture.entries[0])
})

test('fails when either route entry or initial bundle exceeds its explicit threshold', () => {
  const fixture = createBuildFixture()
  const strictEntryBudgets = TABLES_BUNDLE_BUDGETS.map((budget, index) =>
    index === 0 ? { ...budget, maxEntryGzipBytes: 1 } : budget,
  )
  assert.throws(
    () => verifyTablesBundleBudgets({ buildDirectory: fixture.buildDirectory, budgets: strictEntryBudgets }),
    { code: 'TABLES_BUNDLE_BUDGET', message: /\/tables entry/u },
  )

  const strictInitialBudgets = TABLES_BUNDLE_BUDGETS.map((budget, index) =>
    index === 1 ? { ...budget, maxInitialGzipBytes: 1 } : budget,
  )
  assert.throws(
    () => verifyTablesBundleBudgets({ buildDirectory: fixture.buildDirectory, budgets: strictInitialBudgets }),
    { code: 'TABLES_BUNDLE_BUDGET', message: /\/tables\/qr initial/u },
  )
})

test('fails closed for missing manifest route and chunk evidence', () => {
  const missingManifest = mkdtempSync(join(tmpdir(), 'masabu-tables-bundle-missing-'))
  assert.throws(() => verifyTablesBundleBudgets({ buildDirectory: missingManifest }), {
    code: 'TABLES_BUNDLE_BUDGET',
    message: /manifest bulunamadı/u,
  })

  const missingRoute = createBuildFixture({ omitRoute: '/dashboard/[restaurantId]/tables/page' })
  assert.throws(() => verifyTablesBundleBudgets({ buildDirectory: missingRoute.buildDirectory }), {
    code: 'TABLES_BUNDLE_BUDGET',
    message: /route'u bulunamadı/u,
  })

  const missingChunk = createBuildFixture({ omitChunk: 'static/chunks/shared.js' })
  assert.throws(() => verifyTablesBundleBudgets({ buildDirectory: missingChunk.buildDirectory }), {
    code: 'TABLES_BUNDLE_BUDGET',
    message: /chunk bulunamadı/u,
  })
})

test('repository scripts and tables runtime workflow enforce the budget after the production build', () => {
  const packageJson = JSON.parse(readFileSync('package.json', 'utf8'))
  assert.equal(packageJson.scripts['test:tables-bundle-budget'], 'node --test scripts/tables-bundle-budget.test.mjs')
  assert.equal(packageJson.scripts['check:tables-bundle-budget'], 'node scripts/tables-bundle-budget.mjs')
  assert.match(packageJson.scripts['check:ci'], /test:tables-bundle-budget/u)

  const workflow = readFileSync('.github/workflows/tables-runtime.yml', 'utf8')
  const buildIndex = workflow.indexOf('- name: Build dashboard production bundle')
  const budgetIndex = workflow.indexOf('- name: Enforce Masalar route bundle budgets')
  const browserIndex = workflow.indexOf('- name: Run production browser and Realtime gate')
  assert.ok(buildIndex >= 0 && budgetIndex > buildIndex && browserIndex > budgetIndex)
  assert.match(workflow, /bundle-budget-evidence\.json/u)
})
