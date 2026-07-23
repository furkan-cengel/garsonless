import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { buildRuntimeManifest, loadRuntimeSpec } from './runtime-deployment.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const DEV_PROJECT_REF = 'yxsegwkzyiscrxiwdeuf'
const sha256 = (value) => createHash('sha256').update(value).digest('hex')

function rehearsalError(code, message) {
  const error = new Error(message)
  error.code = code
  return error
}

function verifyReleaseEvidence(evidence, projectRef) {
  if (evidence?.schemaVersion !== 1 || evidence?.projectRef !== projectRef || projectRef === DEV_PROJECT_REF) {
    throw rehearsalError('MAS-DEP-019', 'Release evidence sürümü veya production project ref eşleşmiyor.')
  }
  if (!/^[a-f0-9]{40}$/.test(evidence.commitSha ?? '') || !/^[a-f0-9]{64}$/.test(evidence.artifactSha256 ?? '')) {
    throw rehearsalError('MAS-DEP-019', 'Release evidence commit veya artifact kimliği geçersiz.')
  }
  const { artifactSha256, ...identity } = evidence
  if (sha256(JSON.stringify(identity)) !== artifactSha256) {
    throw rehearsalError('MAS-DEP-019', 'Release evidence içeriği artifact kimliğiyle uyuşmuyor.')
  }
}

export function buildReleaseRehearsal({ projectRef, releaseEvidence, runtimeManifest, runtimeSpec }) {
  verifyReleaseEvidence(releaseEvidence, projectRef)
  if (runtimeManifest.projectRef !== projectRef || releaseEvidence.runtime?.sha256 !== runtimeManifest.artifactSha256) {
    throw rehearsalError('MAS-DEP-024', 'Release evidence ile runtime manifest aynı release sözleşmesine bağlı değil.')
  }
  const steps = runtimeSpec.deploymentSteps.map((name, index) => ({
    order: index + 1,
    name,
    mutatesProduction: [
      'database-migrations',
      'edge-secrets',
      'edge-functions',
      'vault-metadata',
      'cron-and-auth-hook',
      'applications',
    ].includes(name),
  }))
  const rehearsal = {
    schemaVersion: 1,
    status: 'local-dry-run',
    projectRef,
    commitSha: releaseEvidence.commitSha,
    releaseArtifactSha256: releaseEvidence.artifactSha256,
    runtimeArtifactSha256: runtimeManifest.artifactSha256,
    productionMutationPerformed: false,
    steps,
    rollbackDecisions: runtimeSpec.rollbackDecisions,
    requiredProductionEvidence: [
      'migration-pre-deploy-drift',
      'runtime-pre-deploy-evidence',
      'migration-post-deploy-drift',
      'runtime-post-deploy-evidence-and-probes',
      'app-smoke-and-business-critical-matrix',
    ],
  }
  return { ...rehearsal, artifactSha256: sha256(JSON.stringify(rehearsal)) }
}

function parseArguments(argv) {
  const args = argv.filter((arg) => arg !== '--')
  const options = {}
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    if (arg === '--project-ref') options.projectRef = args[++index]
    else if (arg === '--release-evidence') options.releaseEvidence = args[++index]
    else if (arg === '--output') options.output = args[++index]
    else throw rehearsalError('MAS-DEP-006', `Bilinmeyen argüman: ${arg}`)
  }
  return options
}

export function runCli(argv = process.argv.slice(2), root = ROOT) {
  try {
    const options = parseArguments(argv)
    if (!options.projectRef || !options.releaseEvidence || !options.output) {
      throw rehearsalError('MAS-DEP-006', '--project-ref, --release-evidence ve --output zorunlu.')
    }
    const releaseEvidence = JSON.parse(readFileSync(resolve(root, options.releaseEvidence), 'utf8'))
    const { spec, sha256: specSha256 } = loadRuntimeSpec(root)
    const runtimeManifest = buildRuntimeManifest({ spec, specSha256, projectRef: options.projectRef, root })
    const rehearsal = buildReleaseRehearsal({ projectRef: options.projectRef, releaseEvidence, runtimeManifest, runtimeSpec: spec })
    writeFileSync(resolve(root, options.output), `${JSON.stringify(rehearsal, null, 2)}\n`, { mode: 0o600 })
    console.log('Masabu local release rehearsal: PASS')
    console.log(`Commit: ${rehearsal.commitSha}`)
    console.log(`Runtime SHA-256: ${rehearsal.runtimeArtifactSha256}`)
    console.log(`Rehearsal SHA-256: ${rehearsal.artifactSha256}`)
    console.log('Production mutation: none')
    console.log(`Output: ${options.output}`)
    return 0
  } catch (error) {
    console.error(`${error.code ?? 'MAS-DEP-006'} release-rehearsal: ${error.message}`)
    return 1
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  process.exitCode = runCli()
}
