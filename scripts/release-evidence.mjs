import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createMigrationManifest } from './migration-release.mjs'
import { loadTopologySpec } from './deployment-topology.mjs'
import { buildRuntimeManifest, loadRuntimeSpec } from './runtime-deployment.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const DEV_PROJECT_REF = 'yxsegwkzyiscrxiwdeuf'
const APPLICATIONS = ['dashboard', 'menu', 'kitchen', 'marketing', 'platform-admin']
const QUALITY_GATES = ['check:ci', 'build', 'prod:preflight', 'prod:topology', 'prod:migration-drift', 'prod:runtime-verify']

function sha256(value) {
  return createHash('sha256').update(value).digest('hex')
}

function releaseError(code, message) {
  const error = new Error(message)
  error.code = code
  return error
}

export function buildReleaseEvidence({
  projectRef,
  commitSha,
  packageManager,
  lockfileContents,
  migrationManifest,
  topologySpec,
  topologySha256,
  runtimeManifest,
}) {
  if (!projectRef || !/^[a-z0-9]{20}$/.test(projectRef) || projectRef === DEV_PROJECT_REF) {
    throw releaseError('MAS-DEP-004', 'Production project ref geçersiz veya DEV projesine ait.')
  }
  if (!/^[a-f0-9]{40}$/.test(commitSha)) {
    throw releaseError('MAS-DEP-006', 'Release commit SHA geçersiz.')
  }
  if (!packageManager || !lockfileContents || !migrationManifest?.sha256 || !topologySha256 || !runtimeManifest?.artifactSha256) {
    throw releaseError('MAS-DEP-001', 'Release identity girdilerinden biri eksik.')
  }

  const publicEndpoints = [
    ...topologySpec.endpoints.map((endpoint) => ({
      name: endpoint.name,
      url: new URL(endpoint.path, topologySpec.origins[endpoint.origin]).toString(),
    })),
    ...topologySpec.derivedPublicRoutes.map(([name, origin, path]) => ({
      name,
      url: new URL(path, topologySpec.origins[origin]).toString(),
    })),
  ]
  const identity = {
    schemaVersion: 1,
    projectRef,
    commitSha,
    packageManager,
    applications: APPLICATIONS,
    qualityGates: QUALITY_GATES,
    lockfileSha256: sha256(lockfileContents),
    migrations: {
      count: migrationManifest.count,
      first: migrationManifest.first,
      latest: migrationManifest.latest,
      sha256: migrationManifest.sha256,
    },
    topology: {
      sha256: topologySha256,
      origins: topologySpec.origins,
      publicEndpoints,
    },
    runtime: {
      sha256: runtimeManifest.artifactSha256,
      edgeFunctionCount: runtimeManifest.edgeFunctions.length,
      cronJobCount: runtimeManifest.cronJobs.length,
      vaultSecretCount: runtimeManifest.vaultSecrets.length,
    },
  }
  return { ...identity, artifactSha256: sha256(JSON.stringify(identity)) }
}

function git(root, ...args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim()
}

function parseArguments(argv) {
  const options = { expectedBranch: 'main' }
  const args = argv.filter((arg) => arg !== '--')
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    if (arg === '--project-ref') options.projectRef = args[++index]
    else if (arg === '--output') options.output = args[++index]
    else if (arg === '--expected-branch') options.expectedBranch = args[++index]
    else throw releaseError('MAS-DEP-006', `Bilinmeyen argüman: ${arg}`)
  }
  return options
}

export function runCli(argv = process.argv.slice(2), root = ROOT) {
  let options
  try {
    options = parseArguments(argv)
  } catch (error) {
    console.error(`${error.code ?? 'MAS-DEP-006'} arguments: ${error.message}`)
    return 2
  }
  if (!options.projectRef || !options.output) {
    console.error('Kullanım: release-evidence.mjs --project-ref <ref> --output <path> [--expected-branch main]')
    return 2
  }

  try {
    const dirty = git(root, 'status', '--porcelain', '--untracked-files=all')
    if (dirty) throw releaseError('MAS-DEP-011', 'Release evidence yalnız temiz çalışma ağacından üretilebilir.')
    const branch = git(root, 'branch', '--show-current')
    if (branch !== options.expectedBranch) throw releaseError('MAS-DEP-016', `Release branch ${options.expectedBranch} olmalı.`)
    const commitSha = git(root, 'rev-parse', 'HEAD')
    const remoteSha = git(root, 'rev-parse', `origin/${options.expectedBranch}`)
    if (commitSha !== remoteSha) throw releaseError('MAS-DEP-017', 'HEAD ile yerel origin branch ref’i eşleşmiyor; önce push/fetch doğrulanmalı.')

    const packageJson = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'))
    const migrationManifest = createMigrationManifest(root)
    const { spec: topologySpec, sha256: topologySha256 } = loadTopologySpec(root)
    const { spec: runtimeSpec, sha256: runtimeSpecSha256 } = loadRuntimeSpec(root)
    const runtimeManifest = buildRuntimeManifest({
      spec: runtimeSpec,
      specSha256: runtimeSpecSha256,
      projectRef: options.projectRef,
      root,
    })
    const evidence = buildReleaseEvidence({
      projectRef: options.projectRef,
      commitSha,
      packageManager: packageJson.packageManager,
      lockfileContents: readFileSync(resolve(root, 'pnpm-lock.yaml')),
      migrationManifest,
      topologySpec,
      topologySha256,
      runtimeManifest,
    })
    writeFileSync(resolve(root, options.output), `${JSON.stringify(evidence, null, 2)}\n`, { mode: 0o600 })
    console.log('Masabu release evidence: PASS')
    console.log(`Commit: ${evidence.commitSha}`)
    console.log(`Artifact SHA-256: ${evidence.artifactSha256}`)
    console.log(`Output: ${options.output}`)
    return 0
  } catch (error) {
    console.error(`${error.code ?? 'MAS-DEP-006'} release-evidence: ${error.message}`)
    return 1
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  process.exitCode = runCli()
}
