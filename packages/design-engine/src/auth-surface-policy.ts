import type { GarsonlessTheme, ThemeSurfaceOverride } from './schema'
import { resolveAuthErrorState, resolveAuthSuccessState } from './auth-state-policy'

const AUTH_SURFACE_DEFAULTS = {
  background: '#101113',
  surface: '#17181b',
  text: '#ffffff',
  mutedText: '#c2c3c7',
  fieldSurface: '#25262a',
  fieldBorder: '#707279',
  accent: '#55b982',
  cta: '#2f855a',
  ctaText: '#ffffff',
} as const

export interface AuthSurfacePalette {
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

export interface AuthContrastIssue {
  id: 'primary-text' | 'secondary-text' | 'input-text' | 'input-border' | 'cta' | 'success-icon' | 'error-icon'
  label: string
  ratio: number
  minimum: number
}

function normalizeHex(value: string): string | null {
  const compact = value.trim().replace(/^#/, '')
  if (!/^[0-9a-f]{3}$|^[0-9a-f]{6}$/i.test(compact)) return null
  return compact.length === 3
    ? compact.split('').map((character) => character + character).join('')
    : compact
}

function luminance(value: string): number {
  const normalized = normalizeHex(value)
  if (!normalized) return 0
  const channels = [0, 2, 4].map((index) => Number.parseInt(normalized.slice(index, index + 2), 16) / 255)
  const [r, g, b] = channels.map((channel) => channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4)
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!
}

export function contrastRatio(foreground: string, background: string): number {
  const light = Math.max(luminance(foreground), luminance(background))
  const dark = Math.min(luminance(foreground), luminance(background))
  return (light + 0.05) / (dark + 0.05)
}

export function resolveAuthSurfacePalette(theme: GarsonlessTheme): AuthSurfacePalette {
  const override: ThemeSurfaceOverride = theme.surfaces?.auth.override ?? {}
  return {
    background: override.background ?? AUTH_SURFACE_DEFAULTS.background,
    surface: override.surface ?? AUTH_SURFACE_DEFAULTS.surface,
    text: override.text ?? AUTH_SURFACE_DEFAULTS.text,
    mutedText: override.mutedText ?? AUTH_SURFACE_DEFAULTS.mutedText,
    fieldSurface: override.fieldSurface ?? AUTH_SURFACE_DEFAULTS.fieldSurface,
    fieldBorder: override.fieldBorder ?? AUTH_SURFACE_DEFAULTS.fieldBorder,
    accent: override.accent ?? theme.accent ?? AUTH_SURFACE_DEFAULTS.accent,
    cta: override.cta ?? AUTH_SURFACE_DEFAULTS.cta,
    ctaText: override.ctaText ?? theme.ctaTextColor ?? AUTH_SURFACE_DEFAULTS.ctaText,
  }
}

export function inspectAuthSurfaceContrast(theme: GarsonlessTheme): AuthContrastIssue[] {
  const palette = resolveAuthSurfacePalette(theme)
  const success = resolveAuthSuccessState(theme.surfaces?.auth)
  const error = resolveAuthErrorState(theme.surfaces?.auth)
  const checks: Array<Omit<AuthContrastIssue, 'ratio'> & { foreground: string; background: string }> = [
    { id: 'primary-text', label: 'Ana metin / form paneli', foreground: palette.text, background: palette.surface, minimum: 4.5 },
    { id: 'secondary-text', label: 'İkincil metin / form paneli', foreground: palette.mutedText, background: palette.surface, minimum: 4.5 },
    { id: 'input-text', label: 'Alan metni / alan zemini', foreground: palette.text, background: palette.fieldSurface, minimum: 4.5 },
    { id: 'input-border', label: 'Alan kenarlığı / alan zemini', foreground: palette.fieldBorder, background: palette.fieldSurface, minimum: 3 },
    { id: 'cta', label: 'CTA metni / ana CTA', foreground: palette.ctaText, background: palette.cta, minimum: 4.5 },
    { id: 'success-icon', label: 'Başarı ikonu / ikon zemini', foreground: success.iconColor, background: success.iconBackground, minimum: 3 },
    { id: 'error-icon', label: 'Hata ikonu / ikon zemini', foreground: error.iconColor, background: error.iconBackground, minimum: 3 },
  ]
  return checks.flatMap((check) => {
    const ratio = contrastRatio(check.foreground, check.background)
    return ratio + Number.EPSILON < check.minimum
      ? [{ id: check.id, label: check.label, ratio: Number(ratio.toFixed(2)), minimum: check.minimum }]
      : []
  })
}
