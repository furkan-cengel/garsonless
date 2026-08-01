export interface SettingsMutationIntent {
  patch: Record<string, unknown>
  expectedSettings: Record<string, unknown>
}

export interface SettingsMutationAttempt {
  fingerprint: string
  requestId: string
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${canonicalJson(entry)}`)
      .join(',')}}`
  }
  return JSON.stringify(value) ?? 'null'
}

/** Reuses one request id for the same intent, including double-click/retry. */
export function prepareSettingsMutationAttempt(
  current: SettingsMutationAttempt | null,
  intent: SettingsMutationIntent,
  createId: () => string = () => crypto.randomUUID(),
): SettingsMutationAttempt {
  const fingerprint = canonicalJson(intent)
  return current?.fingerprint === fingerprint
    ? current
    : { fingerprint, requestId: createId() }
}

/** Applies only the canonical keys returned by the settings RPC. */
export function mergeCanonicalSettings(
  snapshot: Record<string, unknown>,
  canonicalProjection: Record<string, unknown>,
): Record<string, unknown> {
  return { ...snapshot, ...canonicalProjection }
}
