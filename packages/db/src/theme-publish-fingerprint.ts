import { createHash } from 'node:crypto'
import type { Json } from './types.gen'

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

/** Hashes only immutable, server-derived publish intent fields. */
export function fingerprintThemePublish(input: {
  restaurantId: string
  templateId: string
  tokens: Json
  publishedBy: string
  expectedRevision: number
}): string {
  return createHash('sha256').update(canonicalJson(input)).digest('hex')
}

export function fingerprintThemeDraftSave(input: {
  restaurantId: string
  templateId: string
  tokens: Json
  savedBy: string
  expectedRevision: number
}): string {
  return createHash('sha256').update(canonicalJson(input)).digest('hex')
}

export function fingerprintSavedThemePublish(input: {
  restaurantId: string
  publishedBy: string
  expectedDraftRevision: number
  expectedPublishedRevision: number
}): string {
  return createHash('sha256').update(canonicalJson(input)).digest('hex')
}
