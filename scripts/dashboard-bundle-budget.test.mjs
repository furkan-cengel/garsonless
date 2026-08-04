import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import test from 'node:test'
import {
  DASHBOARD_BUNDLE_BUDGETS,
  verifyDashboardBundleBudgets,
} from './dashboard-bundle-budget.mjs'

function createBuildFixture() {
  const buildDirectory = mkdtempSync(join(tmpdir(), 'masabu-dashboard-budget-'))
  const shared = 'static/chunks/shared.js'
  const pages = {}
  mkdirSync(dirname(join(buildDirectory, shared)), { recursive: true })
  writeFileSync(join(buildDirectory, shared), Buffer.from('shared'.repeat(100)), { flag: 'w' })
  for (const [index, budget] of DASHBOARD_BUNDLE_BUDGETS.entries()) {
    const entry = `${budget.entryDirectory}page-${String(index + 1).padStart(6, 'a')}.js`
    pages[budget.manifestRoute] = [shared, entry]
    const output = join(buildDirectory, entry)
    mkdirSync(dirname(output), { recursive: true })
    writeFileSync(output, Buffer.from(`${budget.publicRoute}-entry`.repeat(100)))
  }
  writeFileSync(join(buildDirectory, 'app-build-manifest.json'), JSON.stringify({ pages }))
  return buildDirectory
}

test('enforces hard ceilings and five-percent post-fix regression gates for every critical route', () => {
  assert.equal(DASHBOARD_BUNDLE_BUDGETS.length, 9)
  for (const budget of DASHBOARD_BUNDLE_BUDGETS) {
    assert.equal(
      budget.maxInitialGzipBytes,
      Math.min(budget.hardMaxInitialGzipBytes, Math.ceil(budget.baselineInitialGzipBytes * 1.05)),
    )
  }
  const evidence = verifyDashboardBundleBudgets({ buildDirectory: createBuildFixture() })
  assert.equal(evidence.passed, true)
  assert.equal(evidence.kind, 'dashboard-critical-route-bundle-budget')
  assert.equal(evidence.routes.length, 9)
})

test('repository and production workflow run the critical route budget gate', () => {
  const packageJson = JSON.parse(readFileSync('package.json', 'utf8'))
  assert.equal(packageJson.scripts['test:dashboard-bundle-budget'], 'node --test scripts/dashboard-bundle-budget.test.mjs')
  assert.equal(packageJson.scripts['check:dashboard-bundle-budget'], 'node scripts/dashboard-bundle-budget.mjs')
  assert.match(packageJson.scripts['check:ci'], /test:dashboard-bundle-budget/u)

  const workflow = readFileSync('.github/workflows/tables-runtime.yml', 'utf8')
  assert.match(workflow, /check:dashboard-bundle-budget/u)
  assert.match(workflow, /dashboard-bundle-budget-evidence\.json/u)
})
