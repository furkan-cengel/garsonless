import type { GarsonlessTheme, ThemeSurfaceOverride } from './schema'
import { contrastRatio } from './auth-surface-policy'
import {
  resolveCheckoutErrorState,
  resolveCheckoutSuccessState,
  resolveCheckoutTablePaymentState,
} from './checkout-state-policy'

export interface CheckoutSurfacePalette {
  background: string
  surface: string
  text: string
  mutedText: string
  fieldSurface: string
  fieldBorder: string
  accent: string
  cta: string
  ctaText: string
}

export interface CheckoutContrastIssue {
  id: 'primary-text' | 'secondary-text' | 'input-text' | 'input-border' | 'cta' | 'success-icon' | 'table-icon' | 'error-icon'
  label: string
  ratio: number
  minimum: number
}

export function resolveCheckoutSurfacePalette(theme: GarsonlessTheme): CheckoutSurfacePalette {
  const override: ThemeSurfaceOverride = theme.surfaces?.checkout.override ?? {}
  return {
    background: override.background ?? theme.bg,
    surface: override.surface ?? theme.cardColor ?? '#ffffff',
    text: override.text ?? theme.textColor ?? '#1c1d20',
    mutedText: override.mutedText ?? theme.mutedTextColor ?? '#6c6f76',
    fieldSurface: override.fieldSurface ?? theme.bg,
    fieldBorder: override.fieldBorder ?? theme.borderColor ?? '#e3e4e7',
    accent: override.accent ?? theme.accent,
    cta: override.cta ?? theme.cta,
    ctaText: override.ctaText ?? theme.ctaTextColor ?? '#ffffff',
  }
}

export function inspectCheckoutSurfaceContrast(theme: GarsonlessTheme): CheckoutContrastIssue[] {
  const palette = resolveCheckoutSurfacePalette(theme)
  const override = theme.surfaces?.checkout.override ?? {}
  const stateOverrides = theme.surfaces?.checkout.states
  const success = resolveCheckoutSuccessState(theme.surfaces?.checkout)
  const table = resolveCheckoutTablePaymentState(theme.surfaces?.checkout)
  const error = resolveCheckoutErrorState(theme.surfaces?.checkout)
  const checks: Array<Omit<CheckoutContrastIssue, 'ratio'> & { foreground: string; background: string }> = []
  // Existing flat themes keep their published appearance; once a semantic pair is overridden,
  // the complete effective pair becomes subject to the publish gate.
  if (override.text !== undefined || override.surface !== undefined) checks.push(
    { id: 'primary-text', label: 'Ana metin / panel', foreground: palette.text, background: palette.surface, minimum: 4.5 },
  )
  if (override.mutedText !== undefined || override.surface !== undefined) checks.push(
    { id: 'secondary-text', label: 'İkincil metin / panel', foreground: palette.mutedText, background: palette.surface, minimum: 4.5 },
  )
  if (override.text !== undefined || override.fieldSurface !== undefined) checks.push(
    { id: 'input-text', label: 'Alan metni / alan zemini', foreground: palette.text, background: palette.fieldSurface, minimum: 4.5 },
  )
  if (override.fieldBorder !== undefined || override.fieldSurface !== undefined) checks.push(
    { id: 'input-border', label: 'Alan kenarlığı / alan zemini', foreground: palette.fieldBorder, background: palette.fieldSurface, minimum: 3 },
  )
  if (override.cta !== undefined || override.ctaText !== undefined) checks.push(
    { id: 'cta', label: 'CTA metni / ana CTA', foreground: palette.ctaText, background: palette.cta, minimum: 4.5 },
  )
  if (stateOverrides?.success?.iconColor !== undefined || stateOverrides?.success?.iconBackground !== undefined) checks.push(
    { id: 'success-icon', label: 'Başarı ikonu / ikon zemini', foreground: success.iconColor, background: success.iconBackground, minimum: 3 },
  )
  if (stateOverrides?.tablePayment?.iconColor !== undefined || stateOverrides?.tablePayment?.iconBackground !== undefined) checks.push(
    { id: 'table-icon', label: 'Masada ödeme ikonu / ikon zemini', foreground: table.iconColor, background: table.iconBackground, minimum: 3 },
  )
  if (stateOverrides?.error?.iconColor !== undefined || stateOverrides?.error?.iconBackground !== undefined) checks.push(
    { id: 'error-icon', label: 'Hata ikonu / ikon zemini', foreground: error.iconColor, background: error.iconBackground, minimum: 3 },
  )
  return checks.flatMap((check) => {
    const ratio = contrastRatio(check.foreground, check.background)
    return ratio + Number.EPSILON < check.minimum
      ? [{ id: check.id, label: check.label, ratio: Number(ratio.toFixed(2)), minimum: check.minimum }]
      : []
  })
}
