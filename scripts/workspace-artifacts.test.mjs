import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { cleanArtifacts, collectArtifactTargets } from './workspace-artifacts.mjs'

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'masabu-artifacts-'))
  const file = (relative, contents = 'fixture') => {
    const path = join(root, relative)
    mkdirSync(join(path, '..'), { recursive: true })
    writeFileSync(path, contents)
  }
  file('package.json', JSON.stringify({ name: 'garsonless', private: true }))
  file('apps/dashboard/.next/cache/pack')
  file('apps/dashboard/.next-release-mobile/server/page.js')
  file('apps/dashboard/.nextrc', 'keep')
  file('apps/dashboard/tsconfig.tsbuildinfo')
  file('apps/dashboard/.env.local', 'SECRET=keep')
  file('assets/.DS_Store')
  file('scripts/nested/.DS_Store')
  file('node_modules/package/index.js')
  file('node_modules/.DS_Store')
  file('agent-skills/README.md')
  file('agent-skills/.DS_Store')
  file('.git/.DS_Store')
  file('test-results/old-audit/screenshot.png')
  file('test-results/dashboard-spinner-audit/REPORT.md')
  file('test-results/shell-entrypoints-audit/REPORT.md')
  return root
}

test('cleanup is dry-run by default and only exposes allowlisted artifacts', () => {
  const root = fixture()
  try {
    const targets = collectArtifactTargets(root).map((target) => target.relative)
    assert.deepEqual(targets, [
      'apps/dashboard/.next',
      'apps/dashboard/.next-release-mobile',
      'apps/dashboard/tsconfig.tsbuildinfo',
      'assets/.DS_Store',
      'scripts/nested/.DS_Store',
      'test-results/old-audit',
    ])
    cleanArtifacts({ rootDirectory: root })
    assert.equal(readFileSync(join(root, 'apps/dashboard/.next/cache/pack'), 'utf8'), 'fixture')
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('apply removes artifacts while preserving env, dependencies, agent clone and QA evidence', () => {
  const root = fixture()
  try {
    cleanArtifacts({ rootDirectory: root, apply: true })
    assert.equal(readFileSync(join(root, 'apps/dashboard/.env.local'), 'utf8'), 'SECRET=keep')
    assert.equal(readFileSync(join(root, 'apps/dashboard/.nextrc'), 'utf8'), 'keep')
    assert.equal(readFileSync(join(root, 'node_modules/package/index.js'), 'utf8'), 'fixture')
    assert.equal(readFileSync(join(root, 'node_modules/.DS_Store'), 'utf8'), 'fixture')
    assert.equal(readFileSync(join(root, 'agent-skills/README.md'), 'utf8'), 'fixture')
    assert.equal(readFileSync(join(root, 'agent-skills/.DS_Store'), 'utf8'), 'fixture')
    assert.equal(readFileSync(join(root, '.git/.DS_Store'), 'utf8'), 'fixture')
    assert.equal(readFileSync(join(root, 'test-results/dashboard-spinner-audit/REPORT.md'), 'utf8'), 'fixture')
    assert.equal(readFileSync(join(root, 'test-results/shell-entrypoints-audit/REPORT.md'), 'utf8'), 'fixture')
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
