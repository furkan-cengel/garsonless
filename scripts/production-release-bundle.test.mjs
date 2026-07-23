import assert from 'node:assert/strict'
import { mkdtempSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { buildReleaseBundle, verifyBundleRepository, verifyBundleSourceBinding, verifyReleaseBundle, writeReleaseBundle } from './production-release-bundle.mjs'
import { createMigrationManifest } from './migration-release.mjs'
import { loadTopologySpec } from './deployment-topology.mjs'
import { buildRuntimeManifest, loadRuntimeSpec } from './runtime-deployment.mjs'
import { buildSmokeManifest, loadSmokeSpec } from './business-smoke.mjs'
import { loadReleasePolicy } from './production-release-decision.mjs'

const PROD_REF = 'svxvloeosiksqfadgkvo'
const COMMIT = 'a'.repeat(40)

function fixture() {
  const migrationManifest = createMigrationManifest()
  const { spec: topologySpec, sha256: topologySha256 } = loadTopologySpec()
  const { spec: runtimeSpec, sha256: runtimeSpecSha256 } = loadRuntimeSpec()
  const runtimeManifest = buildRuntimeManifest({ spec: runtimeSpec, specSha256: runtimeSpecSha256, projectRef: PROD_REF })
  const { spec: smokeSpec, sha256: smokeSpecSha256 } = loadSmokeSpec()
  const smokeManifest = buildSmokeManifest({ spec: smokeSpec, specSha256: smokeSpecSha256, topologySpec, topologySha256, projectRef: PROD_REF })
  const { policy, sha256: policySha256 } = loadReleasePolicy()
  return {
    projectRef: PROD_REF,
    commitSha: COMMIT,
    packageManager: 'pnpm@9.15.4',
    lockfileContents: 'lockfileVersion: 9\n',
    migrationManifest,
    topologySpec,
    topologySha256,
    runtimeSpec,
    runtimeManifest,
    smokeManifest,
    policy,
    policySha256,
  }
}

function fakeGit(values) {
  return (...args) => values[args.join(' ')] ?? ''
}

test('bundle is deterministic, source-bound and mutation-free', () => {
  const first = buildReleaseBundle(fixture())
  const second = buildReleaseBundle(fixture())
  assert.deepEqual(first, second)
  assert.equal(first.manifest.productionMutationPerformed, false)
  assert.equal(first.manifest.artifacts.length, 7)
  assert.equal(first.manifest.requiredOperatorEvidence.length, 7)
  assert.ok(first.manifest.requiredOperatorEvidence.includes('prod-release-candidate-evidence.json'))
  assert.ok(first.manifest.requiredOperatorEvidence.includes('prod-release-execution-evidence.json'))
  assert.deepEqual(first.manifest.conditionalOperatorEvidence, ['prod-release-recovery-evidence.json'])
  assert.match(first.manifest.artifactSha256, /^[a-f0-9]{64}$/)
})

test('attestation template is bound but cannot accidentally approve a release', () => {
  const bundle = buildReleaseBundle(fixture())
  const template = JSON.parse(bundle.files['release-attestation.template.json'])
  const backupRestore = JSON.parse(bundle.files['backup-restore-evidence.template.json'])
  assert.equal(template.capturedAt, null)
  assert.equal(template.backupRestoreEvidenceSha256, null)
  assert.equal(template.releaseCandidateEvidenceSha256, null)
  assert.equal(template.releaseExecutionEvidenceSha256, null)
  assert.ok(Object.values(template.enabledCapabilities).every((value) => value === false))
  assert.ok(Object.values(template.approvals).every((value) => value === false))
  assert.equal(template.releaseArtifactSha256, bundle.manifest.releaseArtifactSha256)
  assert.equal(template.rehearsalArtifactSha256, bundle.manifest.rehearsalArtifactSha256)
  assert.equal(backupRestore.status, 'pending')
  assert.equal(backupRestore.productionMutationPerformed, false)
  assert.ok(Object.values(backupRestore.restoreDrill).every((value) => value === false))
})

test('written bundle verifies and uses restrictive local permissions', () => {
  const output = join(mkdtempSync(join(tmpdir(), 'masabu-bundle-')), 'release')
  writeReleaseBundle({ output, bundle: buildReleaseBundle(fixture()) })
  const manifest = verifyReleaseBundle(output)
  assert.equal(manifest.commitSha, COMMIT)
  assert.equal(statMode(output), 0o700)
  assert.equal(statMode(join(output, 'bundle-manifest.json')), 0o600)
})

test('tampered and contaminated bundles fail closed', () => {
  const output = join(mkdtempSync(join(tmpdir(), 'masabu-bundle-')), 'release')
  writeReleaseBundle({ output, bundle: buildReleaseBundle(fixture()) })
  writeFileSync(join(output, 'release-evidence.json'), '{}\n')
  assert.throws(() => verifyReleaseBundle(output), { code: 'MAS-DEP-034' })

  const clean = join(mkdtempSync(join(tmpdir(), 'masabu-bundle-')), 'release')
  writeReleaseBundle({ output: clean, bundle: buildReleaseBundle(fixture()) })
  writeFileSync(join(clean, 'unexpected.txt'), 'not allowed')
  assert.throws(() => verifyReleaseBundle(clean), { code: 'MAS-DEP-034' })
})

test('bundle must match the exact checked-out source projection', () => {
  const output = join(mkdtempSync(join(tmpdir(), 'masabu-bundle-')), 'release')
  const bundle = buildReleaseBundle(fixture())
  writeReleaseBundle({ output, bundle })
  const manifest = verifyReleaseBundle(output)
  assert.doesNotThrow(() => verifyBundleSourceBinding({ input: output, manifest, expectedBundle: bundle }))
  const differentSource = buildReleaseBundle({ ...fixture(), lockfileContents: 'lockfileVersion: changed\n' })
  assert.throws(() => verifyBundleSourceBinding({ input: output, manifest, expectedBundle: differentSource }), { code: 'MAS-DEP-034' })
})

test('local repository gate requires clean main equal to origin/main', () => {
  const valid = fakeGit({
    'status --porcelain --untracked-files=all': '',
    'rev-parse HEAD': COMMIT,
    'branch --show-current': 'main',
    'rev-parse origin/main': COMMIT,
  })
  assert.deepEqual(verifyBundleRepository({ gitRunner: valid, env: {} }), { commitSha: COMMIT, branch: 'main' })
  const dirty = fakeGit({ 'status --porcelain --untracked-files=all': ' M file' })
  assert.throws(() => verifyBundleRepository({ gitRunner: dirty, env: {} }), { code: 'MAS-DEP-011' })
})

test('GitHub gate accepts only workflow_dispatch on exact main checkout SHA', () => {
  const gitRunner = fakeGit({
    'status --porcelain --untracked-files=all': '',
    'rev-parse HEAD': COMMIT,
  })
  const env = { GITHUB_ACTIONS: 'true', GITHUB_EVENT_NAME: 'workflow_dispatch', GITHUB_REF: 'refs/heads/main', GITHUB_SHA: COMMIT }
  assert.deepEqual(verifyBundleRepository({ gitRunner, env }), { commitSha: COMMIT, branch: 'main' })
  assert.throws(() => verifyBundleRepository({ gitRunner, env: { ...env, GITHUB_EVENT_NAME: 'pull_request' } }), { code: 'MAS-DEP-033' })
  assert.throws(() => verifyBundleRepository({ gitRunner, env: { ...env, GITHUB_SHA: 'b'.repeat(40) } }), { code: 'MAS-DEP-033' })
})

test('bundle payload contains no credential values or operator identity', () => {
  const serialized = JSON.stringify(buildReleaseBundle(fixture()))
  assert.doesNotMatch(serialized, /service-role-value|authorization|password|operator@email/)
})

function statMode(path) {
  return statSync(path).mode & 0o777
}
