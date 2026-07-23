import assert from 'node:assert/strict'
import test from 'node:test'
import { createMigrationManifest, parseMigrationListEvidence, verifyMigrationEvidence } from './migration-release.mjs'

const PROD_REF = 'svxvloeosiksqfadgkvo'
const VERSIONS = ['20260101000000', '20260102000000', '20260103000000']
const manifest = {
  schemaVersion: 1,
  count: 3,
  first: VERSIONS[0],
  latest: VERSIONS.at(-1),
  sha256: 'release-digest',
  migrations: VERSIONS.map((version) => ({ version, file: `${version}_fixture.sql`, sha256: version })),
}

function evidence(rows, metadata = {}) {
  return parseMigrationListEvidence([
    `# masabu-project-ref: ${metadata.projectRef ?? PROD_REF}`,
    `# masabu-captured-at: ${metadata.capturedAt ?? '2026-07-23T12:00:00Z'}`,
    '   Local          | Remote         | Time (UTC)',
    '  ----------------|----------------|---------------------',
    ...rows,
  ].join('\n'))
}

test('manifest fingerprints every ordered local migration deterministically', () => {
  const first = createMigrationManifest()
  const second = createMigrationManifest()
  assert.ok(first.count > 0)
  assert.equal(first.sha256, second.sha256)
  assert.deepEqual(first.migrations, second.migrations)
  assert.match(first.sha256, /^[a-f0-9]{64}$/)
})

test('parser extracts safe project metadata and both migration columns', () => {
  const parsed = evidence([
    `   ${VERSIONS[0]} | ${VERSIONS[0]} | 2026-01-01 00:00:00`,
    `   ${VERSIONS[1]} | ${VERSIONS[1]} | 2026-01-02 00:00:00`,
    `   ${VERSIONS[2]} |                | 2026-01-03 00:00:00`,
  ])
  assert.equal(parsed.projectRef, PROD_REF)
  assert.equal(parsed.capturedAt, '2026-07-23T12:00:00Z')
  assert.deepEqual(parsed.localVersions, VERSIONS)
  assert.deepEqual(parsed.remoteVersions, VERSIONS.slice(0, 2))
})

test('pre-deploy accepts an append-only remote prefix and reports pending migrations', () => {
  const result = verifyMigrationEvidence({
    manifest,
    evidence: evidence([
      `   ${VERSIONS[0]} | ${VERSIONS[0]} |`,
      `   ${VERSIONS[1]} | ${VERSIONS[1]} |`,
      `   ${VERSIONS[2]} |                |`,
    ]),
    expectedProjectRef: PROD_REF,
    mode: 'pre-deploy',
  })
  assert.equal(result.ok, true)
  assert.deepEqual(result.pending, [VERSIONS[2]])
  assert.ok(result.warnings.some((warning) => warning.code === 'MAS-DEP-W03'))
})

test('post-deploy requires exact local and remote equality', () => {
  const pending = verifyMigrationEvidence({
    manifest,
    evidence: evidence([
      `   ${VERSIONS[0]} | ${VERSIONS[0]} |`,
      `   ${VERSIONS[1]} | ${VERSIONS[1]} |`,
      `   ${VERSIONS[2]} |                |`,
    ]),
    expectedProjectRef: PROD_REF,
    mode: 'post-deploy',
  })
  assert.equal(pending.ok, false)
  assert.ok(pending.errors.some((error) => error.code === 'MAS-DEP-009'))

  const complete = verifyMigrationEvidence({
    manifest,
    evidence: evidence(VERSIONS.map((version) => `   ${version} | ${version} |`)),
    expectedProjectRef: PROD_REF,
    mode: 'post-deploy',
  })
  assert.equal(complete.ok, true)
  assert.deepEqual(complete.pending, [])
})

test('wrong project, missing metadata and DEV evidence fail closed', () => {
  const wrong = verifyMigrationEvidence({
    manifest,
    evidence: evidence(VERSIONS.map((version) => `   ${version} | ${version} |`), { projectRef: 'aaaaaaaaaaaaaaaaaaaa' }),
    expectedProjectRef: PROD_REF,
  })
  assert.equal(wrong.ok, false)
  assert.ok(wrong.errors.some((error) => error.code === 'MAS-DEP-004'))

  const missing = verifyMigrationEvidence({
    manifest,
    evidence: parseMigrationListEvidence(`   ${VERSIONS[0]} | ${VERSIONS[0]} |`),
    expectedProjectRef: PROD_REF,
  })
  assert.ok(missing.errors.some((error) => error.code === 'MAS-DEP-010'))
})

test('remote-only, reordered and different-local histories are rejected', () => {
  const remoteOnly = verifyMigrationEvidence({
    manifest,
    evidence: evidence([
      `   ${VERSIONS[0]} | ${VERSIONS[0]} |`,
      `   ${VERSIONS[1]} | 20260101500000 |`,
      `   ${VERSIONS[2]} | ${VERSIONS[1]} |`,
    ]),
    expectedProjectRef: PROD_REF,
  })
  assert.equal(remoteOnly.ok, false)
  assert.ok(remoteOnly.errors.some((error) => error.code === 'MAS-DEP-008'))

  const differentLocal = verifyMigrationEvidence({
    manifest,
    evidence: evidence([
      `   ${VERSIONS[0]} | ${VERSIONS[0]} |`,
      `   20260102500000 | ${VERSIONS[1]} |`,
    ]),
    expectedProjectRef: PROD_REF,
  })
  assert.ok(differentLocal.errors.some((error) => error.subject === 'local-history'))
})
