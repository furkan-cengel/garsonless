import { contrastRatio } from './auth-surface-policy'
import type { GarsonlessTheme } from './schema'

export interface MenuHeaderContrastIssue {
  id: 'header-text' | 'header-icon' | 'header-control-icon'
  label: string
  ratio: number
  minimum: number
}

/**
 * Resolve Menu-only Header overrides without changing the legacy flat theme.
 * Home intentionally resolves from the flat fallback plus its own Home scope.
 */
export function resolveMenuHeaderTheme(theme: GarsonlessTheme): GarsonlessTheme {
  const scoped = theme.surfaces?.menu?.chrome?.header
  return scoped && Object.keys(scoped).length > 0 ? { ...theme, ...scoped } : theme
}

export function inspectMenuHeaderContrast(theme: GarsonlessTheme): MenuHeaderContrastIssue[] {
  const resolved = resolveMenuHeaderTheme(theme)
  const headerBackground = resolved.headerBg
  const text = resolved.headerTextColor ?? resolved.accent
  const icon = resolved.headerIconColor ?? resolved.accent
  const checks: Array<Omit<MenuHeaderContrastIssue, 'ratio'> & { foreground: string; background: string }> = [
    { id: 'header-text', label: 'Header metni / Header zemini', foreground: text, background: headerBackground, minimum: 4.5 },
    { id: 'header-icon', label: 'Header ikonu / Header zemini', foreground: icon, background: headerBackground, minimum: 3 },
    { id: 'header-control-icon', label: 'Header ikonu / kontrol zemini', foreground: icon, background: resolved.accentSoft, minimum: 3 },
  ]
  return checks.flatMap((check) => {
    const ratio = contrastRatio(check.foreground, check.background)
    return ratio + Number.EPSILON < check.minimum
      ? [{ id: check.id, label: check.label, ratio: Number(ratio.toFixed(2)), minimum: check.minimum }]
      : []
  })
}
