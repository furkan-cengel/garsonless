import type { GarsonlessTheme } from '@garsonless/design-engine'

export interface ThemePublishIntent {
  expectedDraftRevision: number
  expectedPublishedRevision: number
}

export interface ThemeDraftSaveIntent {
  expectedRevision: number
  templateId: string
  theme: GarsonlessTheme
}

export interface ThemePublishAttempt {
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

/** Reuses the request id only while the complete immutable publish intent is unchanged. */
export function prepareThemePublishAttempt(
  current: ThemePublishAttempt | null,
  intent: ThemePublishIntent,
  createId: () => string = () => crypto.randomUUID(),
): ThemePublishAttempt {
  const fingerprint = canonicalJson(intent)
  return current?.fingerprint === fingerprint
    ? current
    : { fingerprint, requestId: createId() }
}

export function prepareThemeDraftSaveAttempt(
  current: ThemePublishAttempt | null,
  intent: ThemeDraftSaveIntent,
  createId: () => string = () => crypto.randomUUID(),
): ThemePublishAttempt {
  const fingerprint = canonicalJson(intent)
  return current?.fingerprint === fingerprint
    ? current
    : { fingerprint, requestId: createId() }
}
