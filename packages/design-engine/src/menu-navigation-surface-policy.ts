import { contrastRatio } from './auth-surface-policy'
import type { GarsonlessTheme } from './schema'

export interface MenuNavigationContrastIssue {
  id: 'inactive' | 'active-filled' | 'active-soft' | 'active-line' | 'overlay-caption' | 'filter-icon' | 'focus-page' | 'focus-card'
  label: string
  ratio: number
  minimum: number
}

/** Contrast contract shared by text navigation, visual category cards and filters. */
export function inspectMenuNavigationContrast(theme: GarsonlessTheme): MenuNavigationContrastIssue[] {
  const page = theme.bg
  const card = theme.cardColor ?? '#ffffff'
  const accent = theme.accent
  const accentSoft = theme.accentSoft
  const muted = theme.mutedTextColor ?? '#6c6f76'
  const activeText = theme.ctaTextColor ?? '#ffffff'
  const overlay = theme.catnavOverlayColor ?? '#000000'
  const overlayText = theme.catnavOverlayTextColor ?? '#ffffff'
  const checks: Array<Omit<MenuNavigationContrastIssue, 'ratio'> & { foreground: string; background: string }> = [
    { id: 'inactive', label: 'Pasif kategori metni / sayfa zemini', foreground: muted, background: page, minimum: 4.5 },
    { id: 'active-filled', label: 'Dolgulu aktif kategori / vurgu zemini', foreground: activeText, background: accent, minimum: 4.5 },
    { id: 'active-soft', label: 'Hafif aktif kategori / hafif vurgu zemini', foreground: accent, background: accentSoft, minimum: 4.5 },
    { id: 'active-line', label: 'Alt çizgi ve çerçeveli kategori / sayfa zemini', foreground: accent, background: page, minimum: 4.5 },
    { id: 'overlay-caption', label: 'Görselli kategori metni / caption zemini', foreground: overlayText, background: overlay, minimum: 4.5 },
    { id: 'filter-icon', label: 'Filtre ikonu / kart zemini', foreground: muted, background: card, minimum: 3 },
    { id: 'focus-page', label: 'Navigasyon focus göstergesi / sayfa zemini', foreground: accent, background: page, minimum: 3 },
    { id: 'focus-card', label: 'Navigasyon focus göstergesi / kart zemini', foreground: accent, background: card, minimum: 3 },
  ]
  return checks.flatMap((check) => {
    const ratio = contrastRatio(check.foreground, check.background)
    return ratio + Number.EPSILON < check.minimum
      ? [{ id: check.id, label: check.label, ratio: Number(ratio.toFixed(2)), minimum: check.minimum }]
      : []
  })
}
