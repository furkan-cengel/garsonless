export const RELEASE_BUNDLE_ARTIFACT_NAMES = Object.freeze([
  'migration-manifest.json',
  'release-evidence.json',
  'release-rehearsal.json',
  'runtime-manifest.json',
  'smoke-manifest.json',
  'backup-restore-evidence.template.json',
  'release-attestation.template.json',
])

export const REQUIRED_OPERATOR_EVIDENCE = Object.freeze([
  'prod-migration-list.txt',
  'prod-runtime-evidence.json',
  'prod-smoke-evidence.json',
  'prod-backup-restore-evidence.json',
  'prod-release-candidate-evidence.json',
  'prod-release-attestation.json',
])

export const RELEASE_APPLICATIONS = Object.freeze([
  'dashboard',
  'menu',
  'kitchen',
  'marketing',
  'platform-admin',
])

export const RELEASE_EDGE_FUNCTIONS = Object.freeze([
  'outbox-worker',
  'send-email-hook',
])
