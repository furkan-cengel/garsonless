import assert from 'node:assert/strict'
import test from 'node:test'
import { buildReleaseEvidence } from './release-evidence.mjs'
import { createMigrationManifest } from './migration-release.mjs'
import { loadTopologySpec } from './deployment-topology.mjs'
import { buildRuntimeManifest, loadRuntimeSpec } from './runtime-deployment.mjs'
import { buildSmokeManifest, loadSmokeSpec } from './business-smoke.mjs'

const PROD_REF = 'svxvloeosiksqfadgkvo'
const COMMIT = 'a'.repeat(40)

function fixture(overrides = {}) {
  const migrationManifest = createMigrationManifest()
  const { spec: topologySpec, sha256: topologySha256 } = loadTopologySpec()
  const { spec: runtimeSpec, sha256: runtimeSpecSha256 } = loadRuntimeSpec()
  const runtimeManifest = buildRuntimeManifest({ spec: runtimeSpec, specSha256: runtimeSpecSha256, projectRef: PROD_REF })
  const { spec: smokeSpec, sha256: smokeSpecSha256 } = loadSmokeSpec()
  const smokeManifest = buildSmokeManifest({ spec: smokeSpec, specSha256: smokeSpecSha256, topologySpec, topologySha256, projectRef: PROD_REF })
  return {
    projectRef: PROD_REF,
    commitSha: COMMIT,
    packageManager: 'pnpm@10.11.0',
    lockfileContents: 'lockfileVersion: 9\n',
    migrationManifest,
    topologySpec,
    topologySha256,
    runtimeManifest,
    smokeManifest,
    ...overrides,
  }
}

test('release identity is deterministic and binds commit, lockfile, migrations, topology, runtime and smoke', () => {
  const first = buildReleaseEvidence(fixture())
  const second = buildReleaseEvidence(fixture())
  assert.deepEqual(first, second)
  assert.equal(first.commitSha, COMMIT)
  assert.ok(first.migrations.count > 0)
  assert.equal(first.topology.publicEndpoints.length, 13)
  assert.equal(first.runtime.edgeFunctionCount, 3)
  assert.equal(first.runtime.cronJobCount, 5)
  assert.equal(first.smoke.checkCount, 14)
  assert.match(first.lockfileSha256, /^[a-f0-9]{64}$/)
  assert.match(first.artifactSha256, /^[a-f0-9]{64}$/)
})

test('lockfile, migration, topology, runtime or smoke changes alter the release identity', () => {
  const baseline = buildReleaseEvidence(fixture())
  const lockChanged = buildReleaseEvidence(fixture({ lockfileContents: 'lockfileVersion: changed\n' }))
  const migrationChanged = buildReleaseEvidence(fixture({
    migrationManifest: { ...fixture().migrationManifest, sha256: 'b'.repeat(64) },
  }))
  const topologyChanged = buildReleaseEvidence(fixture({ topologySha256: 'c'.repeat(64) }))
  const runtimeChanged = buildReleaseEvidence(fixture({
    runtimeManifest: { ...fixture().runtimeManifest, artifactSha256: 'd'.repeat(64) },
  }))
  const smokeChanged = buildReleaseEvidence(fixture({
    smokeManifest: { ...fixture().smokeManifest, artifactSha256: 'e'.repeat(64) },
  }))
  assert.notEqual(lockChanged.artifactSha256, baseline.artifactSha256)
  assert.notEqual(migrationChanged.artifactSha256, baseline.artifactSha256)
  assert.notEqual(topologyChanged.artifactSha256, baseline.artifactSha256)
  assert.notEqual(runtimeChanged.artifactSha256, baseline.artifactSha256)
  assert.notEqual(smokeChanged.artifactSha256, baseline.artifactSha256)
})

test('evidence contains public deployment facts but no credential material', () => {
  const evidence = buildReleaseEvidence(fixture())
  const serialized = JSON.stringify(evidence)
  assert.match(serialized, /https:\/\/app\.masabu\.co/)
  assert.match(serialized, /https:\/\/menu\.masabu\.co/)
  assert.doesNotMatch(serialized, /service-role|anon-key|worker-value|RESEND_API_KEY/)
})

test('DEV project, malformed commit and missing release inputs fail closed', () => {
  assert.throws(() => buildReleaseEvidence(fixture({ projectRef: 'yxsegwkzyiscrxiwdeuf' })), { code: 'MAS-DEP-004' })
  assert.throws(() => buildReleaseEvidence(fixture({ commitSha: 'short' })), { code: 'MAS-DEP-006' })
  assert.throws(() => buildReleaseEvidence(fixture({ packageManager: '' })), { code: 'MAS-DEP-001' })
})
