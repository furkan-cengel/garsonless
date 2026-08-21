import { contrastRatio } from './auth-surface-policy'
import { buildMenuThemeContrastRepairPatch } from './menu-theme-surface-policy'
import type { GarsonlessTheme } from './schema'

export interface MenuCartContrastIssue {
  id: 'trigger-dark' | 'trigger-accent' | 'trigger-light' | 'cta' | 'badge' | 'focus-page' | 'focus-surface'
  label: string
  ratio: number
  minimum: number
}

/** Pick a deterministic foreground without introducing another persisted color token. */
export function resolveReadableMenuForeground(background: string): '#111111' | '#ffffff' {
  return contrastRatio('#111111', background) >= contrastRatio('#ffffff', background) ? '#111111' : '#ffffff'
}

export function inspectMenuCartContrast(theme: GarsonlessTheme): MenuCartContrastIssue[] {
  const page = theme.bg
  const surface = theme.cardColor ?? '#ffffff'
  const text = theme.textColor ?? '#1c1d20'
  const accent = theme.accent
  const cta = theme.cta
  const ctaText = theme.ctaTextColor ?? '#ffffff'
  const checks: Array<Omit<MenuCartContrastIssue, 'ratio'> & { foreground: string; background: string }> = [
    { id: 'trigger-dark', label: 'Koyu sepet tetikleyicisi', foreground: resolveReadableMenuForeground(text), background: text, minimum: 4.5 },
    { id: 'trigger-accent', label: 'Marka sepet tetikleyicisi', foreground: resolveReadableMenuForeground(accent), background: accent, minimum: 4.5 },
    { id: 'trigger-light', label: 'Açık sepet tetikleyicisi', foreground: text, background: surface, minimum: 4.5 },
    { id: 'cta', label: 'Sepet CTA metni / CTA zemini', foreground: ctaText, background: cta, minimum: 4.5 },
    { id: 'badge', label: 'Sepet rozeti / rozet zemini', foreground: ctaText, background: cta, minimum: 4.5 },
    { id: 'focus-page', label: 'Sepet focus göstergesi / sayfa', foreground: accent, background: page, minimum: 3 },
    { id: 'focus-surface', label: 'Sepet focus göstergesi / yüzey', foreground: accent, background: surface, minimum: 3 },
  ]
  return checks.flatMap((check) => {
    const ratio = contrastRatio(check.foreground, check.background)
    return ratio + Number.EPSILON < check.minimum
      ? [{ id: check.id, label: check.label, ratio: Number(ratio.toFixed(2)), minimum: check.minimum }]
      : []
  })
}

export function buildMenuCartContrastRepairPatch(theme: GarsonlessTheme): Partial<GarsonlessTheme> {
  return buildMenuThemeContrastRepairPatch(theme)
}
