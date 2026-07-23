import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { chmodSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { buildReleaseEvidence } from './release-evidence.mjs'
import { buildReleaseRehearsal } from './release-rehearsal.mjs'
import { createMigrationManifest } from './migration-release.mjs'
import { loadTopologySpec } from './deployment-topology.mjs'
import { buildRuntimeManifest, loadRuntimeSpec } from './runtime-deployment.mjs'
import { buildSmokeManifest, loadSmokeSpec } from './business-smoke.mjs'
import { loadReleasePolicy, validateReleasePolicy } from './production-release-decision.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const DEV_PROJECT_REF = 'yxsegwkzyiscrxiwdeuf'
const ARTIFACT_NAMES = [
  'migration-manifest.json',
  'release-evidence.json',
  'release-rehearsal.json',
  'runtime-manifest.json',
  'smoke-manifest.json',
  'release-attestation.template.json',
]
const sha256 = (value) => createHash('sha256').update(value).digest('hex')

function bundleError(code, message) {
  return Object.assign(new Error(message), { code })
}

function assertProjectRef(projectRef) {
  if (!/^[a-z0-9]{20}$/.test(projectRef ?? '') || projectRef === DEV_PROJECT_REF) {
    throw bundleError('MAS-DEP-004', 'Production project ref geçersiz veya DEV projesine ait.')
  }
}

function gitAt(root, ...args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim()
}

export function verifyBundleRepository({
  root = ROOT,
  expectedBranch = 'main',
  env = process.env,
  gitRunner = (...args) => gitAt(root, ...args),
}) {
  if (gitRunner('status', '--porcelain', '--untracked-files=all')) {
    throw bundleError('MAS-DEP-011', 'Release paketi yalnız temiz çalışma ağacından üretilebilir.')
  }
  const commitSha = gitRunner('rev-parse', 'HEAD')
  if (!/^[a-f0-9]{40}$/.test(commitSha)) throw bundleError('MAS-DEP-006', 'HEAD commit SHA geçersiz.')

  if (env.GITHUB_ACTIONS === 'true') {
    if (
      env.GITHUB_EVENT_NAME !== 'workflow_dispatch'
      || env.GITHUB_REF !== `refs/heads/${expectedBranch}`
      || env.GITHUB_SHA !== commitSha
    ) {
      throw bundleError('MAS-DEP-033', 'CI paketi yalnız manuel, exact main ref ve checkout SHA eşleşmesiyle üretilebilir.')
    }
  } else {
    if (gitRunner('branch', '--show-current') !== expectedBranch) {
      throw bundleError('MAS-DEP-016', `Release branch ${expectedBranch} olmalı.`)
    }
    if (gitRunner('rev-parse', `origin/${expectedBranch}`) !== commitSha) {
      throw bundleError('MAS-DEP-017', 'HEAD ile yerel origin branch ref’i eşleşmiyor.')
    }
  }
  return { commitSha, branch: expectedBranch }
}

function jsonFile(value) {
  return `${JSON.stringify(value, null, 2)}\n`
}

function verifySelfHash(value, label) {
  if (!value || !/^[a-f0-9]{64}$/.test(value.artifactSha256 ?? '')) {
    throw bundleError('MAS-DEP-034', `${label} artifact SHA-256 kimliği geçersiz.`)
  }
  const { artifactSha256, ...contents } = value
  if (sha256(JSON.stringify(contents)) !== artifactSha256) {
    throw bundleError('MAS-DEP-034', `${label} artifact bütünlüğü bozuk.`)
  }
}

export function buildReleaseBundle({
  projectRef,
  commitSha,
  packageManager,
  lockfileContents,
  migrationManifest,
  topologySpec,
  topologySha256,
  runtimeSpec,
  runtimeManifest,
  smokeManifest,
  policy,
  policySha256,
}) {
  assertProjectRef(projectRef)
  const policyResult = validateReleasePolicy(policy)
  if (!policyResult.ok) throw bundleError('MAS-DEP-029', 'Release policy geçersiz.')

  const releaseEvidence = buildReleaseEvidence({
    projectRef,
    commitSha,
    packageManager,
    lockfileContents,
    migrationManifest,
    topologySpec,
    topologySha256,
    runtimeManifest,
    smokeManifest,
  })
  const rehearsal = buildReleaseRehearsal({ projectRef, releaseEvidence, runtimeManifest, runtimeSpec, smokeManifest })
  const attestationTemplate = {
    schemaVersion: 1,
    environment: 'production',
    projectRef,
    capturedAt: null,
    commitSha,
    releaseArtifactSha256: releaseEvidence.artifactSha256,
    rehearsalArtifactSha256: rehearsal.artifactSha256,
    enabledCapabilities: Object.fromEntries(Object.keys(policy.capabilityScopes).map((name) => [name, false])),
    approvals: Object.fromEntries(policy.requiredApprovals.map((name) => [name, false])),
  }
  const values = {
    'migration-manifest.json': migrationManifest,
    'release-evidence.json': releaseEvidence,
    'release-rehearsal.json': rehearsal,
    'runtime-manifest.json': runtimeManifest,
    'smoke-manifest.json': smokeManifest,
    'release-attestation.template.json': attestationTemplate,
  }
  const files = Object.fromEntries(Object.entries(values).map(([name, value]) => [name, jsonFile(value)]))
  const artifacts = ARTIFACT_NAMES.map((name) => ({
    name,
    sha256: sha256(files[name]),
    bytes: Buffer.byteLength(files[name]),
  }))
  const manifest = {
    schemaVersion: 1,
    kind: 'masabu-production-release-bundle',
    projectRef,
    commitSha,
    releaseArtifactSha256: releaseEvidence.artifactSha256,
    rehearsalArtifactSha256: rehearsal.artifactSha256,
    policySha256,
    productionMutationPerformed: false,
    artifacts,
    requiredOperatorEvidence: [
      'prod-migration-list.txt',
      'prod-runtime-evidence.json',
      'prod-smoke-evidence.json',
      'prod-release-attestation.json',
    ],
  }
  return { files, manifest: { ...manifest, artifactSha256: sha256(JSON.stringify(manifest)) } }
}

export function writeReleaseBundle({ output, bundle }) {
  mkdirSync(output, { mode: 0o700 })
  chmodSync(output, 0o700)
  for (const [name, contents] of Object.entries(bundle.files)) {
    writeFileSync(resolve(output, name), contents, { mode: 0o600, flag: 'wx' })
  }
  writeFileSync(resolve(output, 'bundle-manifest.json'), jsonFile(bundle.manifest), { mode: 0o600, flag: 'wx' })
}

export function verifyReleaseBundle(input) {
  const manifestPath = resolve(input, 'bundle-manifest.json')
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
  verifySelfHash(manifest, 'bundle-manifest')
  assertProjectRef(manifest.projectRef)
  if (manifest.kind !== 'masabu-production-release-bundle' || manifest.productionMutationPerformed !== false) {
    throw bundleError('MAS-DEP-034', 'Release paket türü veya mutation sözleşmesi geçersiz.')
  }
  const actualNames = readdirSync(input).filter((name) => name !== 'bundle-manifest.json').sort()
  if (JSON.stringify(actualNames) !== JSON.stringify([...ARTIFACT_NAMES].sort())) {
    throw bundleError('MAS-DEP-034', 'Release paketi eksik veya tanımsız dosya içeriyor.')
  }
  const listedNames = manifest.artifacts?.map((item) => item.name).sort()
  if (JSON.stringify(listedNames) !== JSON.stringify([...ARTIFACT_NAMES].sort())) {
    throw bundleError('MAS-DEP-034', 'Bundle artifact envanteri exact sözleşmeyle uyuşmuyor.')
  }
  for (const artifact of manifest.artifacts) {
    const file = resolve(input, artifact.name)
    const contents = readFileSync(file)
    if (!statSync(file).isFile() || sha256(contents) !== artifact.sha256 || contents.byteLength !== artifact.bytes) {
      throw bundleError('MAS-DEP-034', `${artifact.name} dosya bütünlüğü bozuk.`)
    }
  }
  const releaseEvidence = JSON.parse(readFileSync(resolve(input, 'release-evidence.json'), 'utf8'))
  const migrationManifest = JSON.parse(readFileSync(resolve(input, 'migration-manifest.json'), 'utf8'))
  const rehearsal = JSON.parse(readFileSync(resolve(input, 'release-rehearsal.json'), 'utf8'))
  const runtimeManifest = JSON.parse(readFileSync(resolve(input, 'runtime-manifest.json'), 'utf8'))
  const smokeManifest = JSON.parse(readFileSync(resolve(input, 'smoke-manifest.json'), 'utf8'))
  const attestation = JSON.parse(readFileSync(resolve(input, 'release-attestation.template.json'), 'utf8'))
  for (const [label, value] of Object.entries({ releaseEvidence, rehearsal, runtimeManifest, smokeManifest })) verifySelfHash(value, label)
  if (
    releaseEvidence.projectRef !== manifest.projectRef
    || releaseEvidence.commitSha !== manifest.commitSha
    || migrationManifest.sha256 !== releaseEvidence.migrations?.sha256
    || migrationManifest.count !== releaseEvidence.migrations?.count
    || migrationManifest.first !== releaseEvidence.migrations?.first
    || migrationManifest.latest !== releaseEvidence.migrations?.latest
    || rehearsal.releaseArtifactSha256 !== releaseEvidence.artifactSha256
    || releaseEvidence.runtime?.sha256 !== runtimeManifest.artifactSha256
    || releaseEvidence.smoke?.sha256 !== smokeManifest.artifactSha256
    || attestation.releaseArtifactSha256 !== releaseEvidence.artifactSha256
    || attestation.rehearsalArtifactSha256 !== rehearsal.artifactSha256
    || attestation.capturedAt !== null
    || Object.values(attestation.approvals ?? {}).some((value) => value !== false)
  ) {
    throw bundleError('MAS-DEP-034', 'Release paketi iç bağları veya güvenli attestation şablonu geçersiz.')
  }
  return manifest
}

export function verifyBundleSourceBinding({ input, manifest, expectedBundle }) {
  if (JSON.stringify(manifest) !== JSON.stringify(expectedBundle.manifest)) {
    throw bundleError('MAS-DEP-034', 'Bundle manifesti mevcut checkout kaynaklarıyla uyuşmuyor.')
  }
  for (const name of ARTIFACT_NAMES) {
    if (readFileSync(resolve(input, name), 'utf8') !== expectedBundle.files[name]) {
      throw bundleError('MAS-DEP-034', `${name} mevcut checkout kaynaklarından üretilen artifact ile uyuşmuyor.`)
    }
  }
}

function assembleBundle({ root, projectRef, commitSha }) {
  const packageJson = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'))
  const migrationManifest = createMigrationManifest(root)
  const { spec: topologySpec, sha256: topologySha256 } = loadTopologySpec(root)
  const { spec: runtimeSpec, sha256: runtimeSpecSha256 } = loadRuntimeSpec(root)
  const runtimeManifest = buildRuntimeManifest({ spec: runtimeSpec, specSha256: runtimeSpecSha256, projectRef, root })
  const { spec: smokeSpec, sha256: smokeSpecSha256 } = loadSmokeSpec(root)
  const smokeManifest = buildSmokeManifest({ spec: smokeSpec, specSha256: smokeSpecSha256, topologySpec, topologySha256, projectRef, root })
  const { policy, sha256: policySha256 } = loadReleasePolicy(root)
  return buildReleaseBundle({
    projectRef,
    commitSha,
    packageManager: packageJson.packageManager,
    lockfileContents: readFileSync(resolve(root, 'pnpm-lock.yaml')),
    migrationManifest,
    topologySpec,
    topologySha256,
    runtimeSpec,
    runtimeManifest,
    smokeManifest,
    policy,
    policySha256,
  })
}

function parseArguments(argv) {
  const args = argv.filter((arg) => arg !== '--')
  const command = args.shift()
  const options = { expectedBranch: 'main' }
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    if (arg === '--project-ref') options.projectRef = args[++index]
    else if (arg === '--output') options.output = args[++index]
    else if (arg === '--input') options.input = args[++index]
    else if (arg === '--expected-branch') options.expectedBranch = args[++index]
    else throw bundleError('MAS-DEP-006', `Bilinmeyen argüman: ${arg}`)
  }
  return { command, options }
}

export function runCli(argv = process.argv.slice(2), root = ROOT, env = process.env) {
  try {
    const { command, options } = parseArguments(argv)
    if (command === 'build') {
      if (!options.projectRef || !options.output) throw bundleError('MAS-DEP-006', 'build için --project-ref ve --output zorunlu.')
      assertProjectRef(options.projectRef)
      const { commitSha } = verifyBundleRepository({ root, expectedBranch: options.expectedBranch, env })
      const bundle = assembleBundle({ root, projectRef: options.projectRef, commitSha })
      writeReleaseBundle({ output: resolve(root, options.output), bundle })
      console.log('Masabu production release bundle: PASS')
      console.log(`Commit: ${commitSha}`)
      console.log(`Bundle SHA-256: ${bundle.manifest.artifactSha256}`)
      console.log('Production mutation: none')
      console.log(`Output: ${options.output}`)
      return 0
    }
    if (command === 'verify') {
      if (!options.input) throw bundleError('MAS-DEP-006', 'verify için --input zorunlu.')
      const input = resolve(root, options.input)
      const manifest = verifyReleaseBundle(input)
      const commitSha = gitAt(root, 'rev-parse', 'HEAD')
      if (commitSha !== manifest.commitSha) throw bundleError('MAS-DEP-034', 'Bundle farklı bir checkout commit’ine ait.')
      const expectedBundle = assembleBundle({ root, projectRef: manifest.projectRef, commitSha })
      verifyBundleSourceBinding({ input, manifest, expectedBundle })
      console.log('Masabu production release bundle verification: PASS')
      console.log(`Commit: ${manifest.commitSha}`)
      console.log(`Bundle SHA-256: ${manifest.artifactSha256}`)
      console.log('Production mutation: none')
      return 0
    }
    throw bundleError('MAS-DEP-006', 'Komut build veya verify olmalı.')
  } catch (error) {
    console.error(`${error.code ?? 'MAS-DEP-033'} release-bundle: ${error.message}`)
    return 1
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  process.exitCode = runCli()
}
