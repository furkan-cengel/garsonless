import { sanitizeThemeTokens, type GarsonlessTheme } from '@garsonless/design-engine'

export interface ThemeRecoveryScope { userId: string; restaurantId: string; templateId: string }
export interface ThemeRecoveryRecord extends ThemeRecoveryScope {
  version: 1
  updatedAt: number
  base: GarsonlessTheme
  local: GarsonlessTheme
}
export const THEME_RECOVERY_TTL = 24 * 60 * 60 * 1000
export function themeRecoveryKey(scope: ThemeRecoveryScope) {
  return `masabu:theme-recovery:${JSON.stringify([scope.userId, scope.restaurantId, scope.templateId])}`
}
export function readThemeRecovery(raw: string | null, scope: ThemeRecoveryScope, now = Date.now()): ThemeRecoveryRecord | null {
  if (!raw || raw.length > 2_000_000) return null
  try {
    const value = JSON.parse(raw) as ThemeRecoveryRecord
    if (!value || value.version !== 1 || value.userId !== scope.userId || value.restaurantId !== scope.restaurantId
      || value.templateId !== scope.templateId || !Number.isFinite(value.updatedAt)
      || value.updatedAt > now || now - value.updatedAt > THEME_RECOVERY_TTL) return null
    const base = sanitizeThemeTokens(value.base, scope.templateId)
    const local = sanitizeThemeTokens(value.local, scope.templateId)
    return base && local ? { ...scope, version: 1, updatedAt: value.updatedAt, base, local } : null
  } catch { return null }
}

function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}
function equal(a: unknown, b: unknown): boolean {
  if (object(a) && object(b)) {
    const keys = Object.keys(a)
    return keys.length === Object.keys(b).length && keys.every((key) => Object.hasOwn(b, key) && equal(a[key], b[key]))
  }
  return JSON.stringify(a) === JSON.stringify(b)
}
interface ThemeRecoveryConflict { path: string; local: unknown; remote: unknown }
/** Arrays are atomic: block reordering/removal must never be silently interleaved. */
export function mergeThemeRecovery(base: GarsonlessTheme, local: GarsonlessTheme, remote: GarsonlessTheme, preference: 'local' | 'remote' = 'local') {
  const conflicts: ThemeRecoveryConflict[] = []
  function merge(before: unknown, ours: unknown, theirs: unknown, path: string): unknown {
    if (equal(ours, before)) return theirs
    if (equal(theirs, before) || equal(ours, theirs)) return ours
    if (object(before) && object(ours) && object(theirs)) {
      const keys = new Set([...Object.keys(before), ...Object.keys(ours), ...Object.keys(theirs)])
      return Object.fromEntries([...keys].filter((key) => !['__proto__', 'constructor', 'prototype'].includes(key)).flatMap((key) => {
        const value = merge(before[key], ours[key], theirs[key], path ? `${path}.${key}` : key)
        return value === undefined ? [] : [[key, value]]
      }))
    }
    conflicts.push({ path, local: ours, remote: theirs })
    return preference === 'local' ? ours : theirs
  }
  return { theme: merge(base, local, remote, '') as GarsonlessTheme, conflicts }
}
