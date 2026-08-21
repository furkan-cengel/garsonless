import { contrastRatio } from './auth-surface-policy'
import { resolveReadableMenuForeground } from './menu-cart-surface-policy'
import type { GarsonlessTheme } from './schema'

export interface MenuFooterPalette {
  background: string
  foreground: string
  muted: string
  line: string
  chip: string
  focus: string
}

export interface MenuFooterContrastIssue {
  id:
    | 'primary-text'
    | 'secondary-text'
    | 'contact-text'
    | 'icon'
    | 'border'
    | 'focus-surface'
    | 'focus-chip'
    | 'attribution'
  label: string
  ratio: number
  minimum: number
}

function parseHex(value: string): [number, number, number] | null {
  const compact = value.trim().replace(/^#/, '')
  const normalized = compact.length === 3
    ? compact.split('').map((character) => character + character).join('')
    : compact
  if (!/^[0-9a-f]{6}$/i.test(normalized)) return null
  return [0, 2, 4].map((index) => Number.parseInt(normalized.slice(index, index + 2), 16)) as [number, number, number]
}

function mixHex(foreground: string, background: string, amount: number): string {
  const fg = parseHex(foreground)
  const bg = parseHex(background)
  if (!fg || !bg) return foreground
  const mixed = fg.map((channel, index) => Math.round(channel * amount + bg[index]! * (1 - amount)))
  return `#${mixed.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`
}

function blendForMinimum(foreground: string, background: string, minimum: number, preferredAmount: number): string {
  for (let step = Math.round(preferredAmount * 100); step <= 100; step += 1) {
    const candidate = mixHex(foreground, background, step / 100)
    if (contrastRatio(candidate, background) + Number.EPSILON >= minimum) return candidate
  }
  return foreground
}

function chipForText(foreground: string, background: string, preferredAmount: number): string {
  for (let step = Math.round(preferredAmount * 100); step >= 0; step -= 1) {
    const candidate = mixHex(foreground, background, step / 100)
    if (contrastRatio(foreground, candidate) + Number.EPSILON >= 4.5) return candidate
  }
  return background
}

function derivedPalette(background: string, foreground: string): MenuFooterPalette {
  return {
    background,
    foreground,
    muted: blendForMinimum(foreground, background, 4.5, 0.72),
    line: blendForMinimum(foreground, background, 3, 0.2),
    chip: chipForText(foreground, background, 0.1),
    focus: foreground,
  }
}

/** Resolve the exact colors consumed by the shared public and preview footer. */
export function resolveMenuFooterPalette(theme: GarsonlessTheme): MenuFooterPalette {
  const tone = theme.footerTone ?? 'surface'
  if (tone === 'brand') {
    return derivedPalette(theme.accent, resolveReadableMenuForeground(theme.accent))
  }
  if (tone === 'dark') return derivedPalette('#17191d', '#ffffff')

  const background = theme.cardColor ?? '#ffffff'
  const foreground = theme.textColor ?? '#1c1d20'
  return {
    background,
    foreground,
    muted: theme.mutedTextColor ?? '#6c6f76',
    line: blendForMinimum(foreground, background, 3, 0.2),
    chip: chipForText(foreground, background, 0.06),
    focus: foreground,
  }
}

export function inspectMenuFooterContrast(theme: GarsonlessTheme): MenuFooterContrastIssue[] {
  const palette = resolveMenuFooterPalette(theme)
  const checks: Array<Omit<MenuFooterContrastIssue, 'ratio'> & { foreground: string; background: string }> = [
    { id: 'primary-text', label: 'Footer ana metni / Footer zemini', foreground: palette.foreground, background: palette.background, minimum: 4.5 },
    { id: 'secondary-text', label: 'Footer ikincil metni / Footer zemini', foreground: palette.muted, background: palette.background, minimum: 4.5 },
    { id: 'contact-text', label: 'Footer bağlantısı / bağlantı yüzeyi', foreground: palette.foreground, background: palette.chip, minimum: 4.5 },
    { id: 'icon', label: 'Footer ikonu / ikon yüzeyi', foreground: palette.foreground, background: palette.chip, minimum: 3 },
    { id: 'border', label: 'Footer bağlantı kenarlığı / Footer zemini', foreground: palette.line, background: palette.background, minimum: 3 },
    { id: 'focus-surface', label: 'Footer focus göstergesi / Footer zemini', foreground: palette.focus, background: palette.background, minimum: 3 },
    { id: 'focus-chip', label: 'Footer focus göstergesi / bağlantı yüzeyi', foreground: palette.focus, background: palette.chip, minimum: 3 },
    { id: 'attribution', label: 'Masabu bağlantısı / bağlantı yüzeyi', foreground: '#17191d', background: '#ffffff', minimum: 4.5 },
  ]
  return checks.flatMap((check) => {
    const ratio = contrastRatio(check.foreground, check.background)
    return ratio + Number.EPSILON < check.minimum
      ? [{ id: check.id, label: check.label, ratio: Number(ratio.toFixed(2)), minimum: check.minimum }]
      : []
  })
}

/** Repair Footer locally by selecting the first safe existing tone preset. */
export function buildMenuFooterContrastRepairPatch(theme: GarsonlessTheme): Partial<GarsonlessTheme> {
  if (inspectMenuFooterContrast(theme).length === 0) return {}
  for (const footerTone of ['surface', 'dark'] as const) {
    if (inspectMenuFooterContrast({ ...theme, footerTone }).length === 0) return { footerTone }
  }
  return { footerTone: 'dark' }
}
