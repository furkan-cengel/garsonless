import { contrastRatio } from './auth-surface-policy'
import type { GarsonlessTheme } from './schema'

export interface MenuCardContrastIssue {
  id: 'title' | 'primary-text' | 'secondary-text' | 'cta' | 'promotion' | 'focus-card' | 'focus-page'
  label: string
  ratio: number
  minimum: number
}

/**
 * Product cards use the flat menu palette, including the same CTA pair for
 * quick-add controls and promotional badges.
 */
export function inspectMenuCardSurfaceContrast(theme: GarsonlessTheme): MenuCardContrastIssue[] {
  const card = theme.cardColor ?? '#ffffff'
  const page = theme.bg
  const accent = theme.accent
  const text = theme.textColor ?? '#1c1d20'
  const muted = theme.mutedTextColor ?? '#6c6f76'
  const cta = theme.cta
  const ctaText = theme.ctaTextColor ?? '#ffffff'
  const checks: Array<Omit<MenuCardContrastIssue, 'ratio'> & { foreground: string; background: string }> = [
    { id: 'title', label: 'Kart başlığı / kart zemini', foreground: accent, background: card, minimum: 4.5 },
    { id: 'primary-text', label: 'Kart ana metni / kart zemini', foreground: text, background: card, minimum: 4.5 },
    { id: 'secondary-text', label: 'Kart ikincil metni / kart zemini', foreground: muted, background: card, minimum: 4.5 },
    { id: 'cta', label: 'Kart CTA metni / CTA zemini', foreground: ctaText, background: cta, minimum: 4.5 },
    { id: 'promotion', label: 'Kampanya etiketi / etiket zemini', foreground: ctaText, background: cta, minimum: 4.5 },
    { id: 'focus-card', label: 'Kart focus göstergesi / kart zemini', foreground: accent, background: card, minimum: 3 },
    { id: 'focus-page', label: 'Kart focus göstergesi / sayfa zemini', foreground: accent, background: page, minimum: 3 },
  ]
  return checks.flatMap((check) => {
    const ratio = contrastRatio(check.foreground, check.background)
    return ratio + Number.EPSILON < check.minimum
      ? [{ id: check.id, label: check.label, ratio: Number(ratio.toFixed(2)), minimum: check.minimum }]
      : []
  })
}
