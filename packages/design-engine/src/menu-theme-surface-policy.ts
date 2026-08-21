import { contrastRatio } from './auth-surface-policy'
import type { GarsonlessTheme } from './schema'

export type MenuThemeColorField =
  | 'bg'
  | 'cardColor'
  | 'textColor'
  | 'mutedTextColor'
  | 'accent'
  | 'accentSoft'
  | 'cta'
  | 'ctaTextColor'
  | 'borderColor'

export interface MenuThemeContrastIssue {
  id:
    | 'text-page'
    | 'text-surface'
    | 'muted-page'
    | 'muted-surface'
    | 'accent-page'
    | 'accent-surface'
    | 'accent-soft'
    | 'cta'
    | 'focus-page'
    | 'focus-surface'
    | 'border-page'
    | 'border-surface'
  label: string
  ratio: number
  minimum: number
  fields: MenuThemeColorField[]
}

interface ContrastCheck extends Omit<MenuThemeContrastIssue, 'ratio'> {
  foreground: string
  background: string
}

function checksFor(theme: GarsonlessTheme): ContrastCheck[] {
  const page = theme.bg
  const surface = theme.cardColor ?? '#ffffff'
  const text = theme.textColor ?? '#1c1d20'
  const muted = theme.mutedTextColor ?? '#6c6f76'
  const accent = theme.accent
  const accentSoft = theme.accentSoft
  const cta = theme.cta
  const ctaText = theme.ctaTextColor ?? '#ffffff'
  const checks: ContrastCheck[] = [
    { id: 'text-page', label: 'Ana metin / sayfa', foreground: text, background: page, minimum: 4.5, fields: ['textColor', 'bg'] },
    { id: 'text-surface', label: 'Ana metin / varsayılan yüzey', foreground: text, background: surface, minimum: 4.5, fields: ['textColor', 'cardColor'] },
    { id: 'muted-page', label: 'İkincil metin / sayfa', foreground: muted, background: page, minimum: 4.5, fields: ['mutedTextColor', 'bg'] },
    { id: 'muted-surface', label: 'İkincil metin / varsayılan yüzey', foreground: muted, background: surface, minimum: 4.5, fields: ['mutedTextColor', 'cardColor'] },
    { id: 'accent-page', label: 'Marka rengi / sayfa', foreground: accent, background: page, minimum: 4.5, fields: ['accent', 'bg'] },
    { id: 'accent-surface', label: 'Marka rengi / varsayılan yüzey', foreground: accent, background: surface, minimum: 4.5, fields: ['accent', 'cardColor'] },
    { id: 'accent-soft', label: 'Marka rengi / hafif marka yüzeyi', foreground: accent, background: accentSoft, minimum: 4.5, fields: ['accent', 'accentSoft'] },
    { id: 'cta', label: 'Eylem metni / eylem rengi', foreground: ctaText, background: cta, minimum: 4.5, fields: ['ctaTextColor', 'cta'] },
    { id: 'focus-page', label: 'Focus göstergesi / sayfa', foreground: accent, background: page, minimum: 3, fields: ['accent', 'bg'] },
    { id: 'focus-surface', label: 'Focus göstergesi / varsayılan yüzey', foreground: accent, background: surface, minimum: 3, fields: ['accent', 'cardColor'] },
  ]
  // Hairlines are decorative when the card shadow already identifies the
  // surface. The non-text 3:1 contract applies to the explicit solid boundary.
  if (theme.border === 'solid') {
    const border = theme.borderColor ?? accentSoft
    checks.push(
      { id: 'border-page', label: 'Etkin kenarlık / sayfa', foreground: border, background: page, minimum: 3, fields: ['borderColor', 'bg'] },
      { id: 'border-surface', label: 'Etkin kenarlık / varsayılan yüzey', foreground: border, background: surface, minimum: 3, fields: ['borderColor', 'cardColor'] },
    )
  }
  return checks
}

export function inspectMenuThemeContrast(theme: GarsonlessTheme): MenuThemeContrastIssue[] {
  return checksFor(theme).flatMap((check) => {
    const ratio = contrastRatio(check.foreground, check.background)
    return ratio + Number.EPSILON < check.minimum
      ? [{
          id: check.id,
          label: check.label,
          ratio: Number(ratio.toFixed(2)),
          minimum: check.minimum,
          fields: check.fields,
        }]
      : []
  })
}

function parseHex(value: string): [number, number, number] | null {
  const normalized = value.trim().replace(/^#/, '')
  if (!/^[0-9a-f]{6}$/i.test(normalized)) return null
  return [0, 2, 4].map((index) => Number.parseInt(normalized.slice(index, index + 2), 16)) as [number, number, number]
}

function mixHex(color: string, target: '#000000' | '#ffffff', amount: number) {
  const source = parseHex(color)
  const destination = target === '#000000' ? [0, 0, 0] : [255, 255, 255]
  if (!source) return target
  const mixed = source.map((channel, index) => Math.round(channel * (1 - amount) + destination[index]! * amount))
  return `#${mixed.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`
}

function meets(color: string, backgrounds: string[], minimum: number) {
  return backgrounds.every((background) => contrastRatio(color, background) + Number.EPSILON >= minimum)
}

/** Adjust only lightness toward black/white and select the smallest passing change. */
function repairColor(color: string, backgrounds: string[], minimum: number) {
  if (meets(color, backgrounds, minimum)) return color
  for (let step = 1; step <= 100; step += 1) {
    const amount = step / 100
    const darker = mixHex(color, '#000000', amount)
    const lighter = mixHex(color, '#ffffff', amount)
    const darkPasses = meets(darker, backgrounds, minimum)
    const lightPasses = meets(lighter, backgrounds, minimum)
    if (darkPasses && lightPasses) {
      const darkDistance = contrastRatio(darker, color)
      const lightDistance = contrastRatio(lighter, color)
      return darkDistance <= lightDistance ? darker : lighter
    }
    if (darkPasses) return darker
    if (lightPasses) return lighter
  }
  const blackMinimum = Math.min(...backgrounds.map((background) => contrastRatio('#000000', background)))
  const whiteMinimum = Math.min(...backgrounds.map((background) => contrastRatio('#ffffff', background)))
  return blackMinimum >= whiteMinimum ? '#000000' : '#ffffff'
}

export function buildMenuThemeContrastRepairPatch(theme: GarsonlessTheme): Partial<GarsonlessTheme> {
  const page = theme.bg
  const surface = theme.cardColor ?? '#ffffff'
  const accent = repairColor(theme.accent, [page, surface], 4.5)
  const patch: Partial<GarsonlessTheme> = {
    textColor: repairColor(theme.textColor ?? '#1c1d20', [page, surface], 4.5),
    mutedTextColor: repairColor(theme.mutedTextColor ?? '#6c6f76', [page, surface], 4.5),
    accent,
    accentSoft: repairColor(theme.accentSoft, [accent], 4.5),
    ctaTextColor: repairColor(theme.ctaTextColor ?? '#ffffff', [theme.cta], 4.5),
  }
  if (theme.border === 'solid') {
    patch.borderColor = repairColor(theme.borderColor ?? theme.accentSoft, [page, surface], 3)
  }
  return patch
}
