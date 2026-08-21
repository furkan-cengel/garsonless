import { contrastRatio } from './auth-surface-policy'
import type { GarsonlessTheme, HomeChromeTarget, HomeSectionDefinitionId } from './schema'

export type HomeColorToken = 'background' | 'surface' | 'text' | 'mutedText' | 'accent' | 'cta' | 'ctaText'

export interface HomeSurfacePalette {
  background: string
  surface: string
  text: string
  mutedText: string
  accent: string
  accentSoft: string
  cta: string
  ctaText: string
}

export interface HomeContrastIssue {
  id: 'background-text' | 'surface-text' | 'background-muted' | 'cta' | 'background-accent' | 'surface-accent'
  label: string
  ratio: number
  minimum: number
}

const LEGACY_SECTION_COLOR_DEFAULTS: Partial<Record<HomeSectionDefinitionId, Record<string, HomeColorToken | string>>> = {
  'featured-scroll': {
    sectionBgColor: 'transparent',
    titleColor: 'text',
    subtitleColor: 'mutedText',
    cardBgColor: 'surface',
    cardTextColor: 'text',
    cardMutedColor: 'mutedText',
  },
  gallery: {
    sectionBgColor: 'surface',
    accentColor: 'accent',
    titleColor: 'accent',
    bodyColor: 'mutedText',
    labelBgColor: '#ffffff',
    labelTextColor: 'accent',
  },
  'chef-pick': {
    bgColor: '#1a1612',
    accentColor: '#ffd089',
    textColor: '#ffffff',
    itemBgColor: '#241f1a',
    itemBorderColor: '#3b342d',
    itemTextColor: '#ffffff',
    itemMutedColor: '#b9b2ab',
    priceColor: '#ffd089',
    imageBgColor: '#3a3024',
    buttonBgColor: '#ffd089',
    buttonTextColor: '#1a1612',
  },
  'combo-ribbon': {
    bgColor: '#fff7dc',
    titleColor: '#1c1d20',
    accentColor: '#e86b3d',
    badgeTextColor: '#1c1d20',
    combo1Color: '#26a69a',
    combo1TextColor: '#ffffff',
    combo2Color: '#ee6c4d',
    combo2TextColor: '#ffffff',
    combo3Color: '#d8a72f',
    combo3TextColor: '#ffffff',
    itemBgColor: 'rgba(255,255,255,.22)',
    itemTextColor: '#ffffff',
    priceColor: '#ffffff',
    buttonBgColor: '#1c1d20',
    buttonTextColor: '#ffffff',
  },
}

function parseHex(value: string) {
  const compact = value.trim().replace(/^#/, '')
  if (!/^[0-9a-f]{6}$/i.test(compact)) return null
  return [0, 2, 4].map((index) => Number.parseInt(compact.slice(index, index + 2), 16))
}

function mixHex(foreground: string, background: string, foregroundWeight: number) {
  const front = parseHex(foreground)
  const back = parseHex(background)
  if (!front || !back) return foreground
  const channels = front.map((channel, index) => Math.round(channel * foregroundWeight + back[index]! * (1 - foregroundWeight)))
  return `#${channels.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`
}

export function resolveHomeSurfacePalette(theme: GarsonlessTheme): HomeSurfacePalette {
  const override = theme.surfaces?.home.override ?? {}
  const background = override.background ?? theme.bg
  const accent = override.accent ?? theme.accent
  return {
    background,
    surface: override.surface ?? theme.cardColor ?? '#ffffff',
    text: override.text ?? theme.textColor ?? '#1c1d20',
    mutedText: override.mutedText ?? theme.mutedTextColor ?? '#6c6f76',
    accent,
    accentSoft: override.accentSoft ?? (override.accent ? mixHex(accent, background, 0.14) : theme.accentSoft),
    cta: override.cta ?? theme.cta,
    ctaText: override.ctaText ?? theme.ctaTextColor ?? '#ffffff',
  }
}

export function resolveHomeChromeTheme(theme: GarsonlessTheme, target: HomeChromeTarget): GarsonlessTheme {
  const scoped = theme.surfaces?.home.chrome?.[target]
  if (target === 'header') {
    return {
      ...theme,
      // Home heroes attach to the Header by default; Menu spacing remains independent.
      headerBottomGap: 0,
      ...(scoped ?? {}),
    }
  }
  return scoped && Object.keys(scoped).length > 0 ? { ...theme, ...scoped } : theme
}

export function inspectHomeSurfaceContrast(theme: GarsonlessTheme): HomeContrastIssue[] {
  const palette = resolveHomeSurfacePalette(theme)
  const checks: Array<Omit<HomeContrastIssue, 'ratio'> & { foreground: string; background: string }> = [
    { id: 'background-text', label: 'Ana metin / sayfa zemini', foreground: palette.text, background: palette.background, minimum: 4.5 },
    { id: 'surface-text', label: 'Ana metin / kart yüzeyi', foreground: palette.text, background: palette.surface, minimum: 4.5 },
    { id: 'background-muted', label: 'İkincil metin / sayfa zemini', foreground: palette.mutedText, background: palette.background, minimum: 4.5 },
    { id: 'cta', label: 'Buton metni / ana buton', foreground: palette.ctaText, background: palette.cta, minimum: 4.5 },
    { id: 'background-accent', label: 'Vurgu / sayfa zemini', foreground: palette.accent, background: palette.background, minimum: 3 },
    { id: 'surface-accent', label: 'Vurgu / kart yüzeyi', foreground: palette.accent, background: palette.surface, minimum: 3 },
  ]
  return checks.flatMap((check) => {
    const ratio = contrastRatio(check.foreground, check.background)
    return ratio + Number.EPSILON < check.minimum
      ? [{ id: check.id, label: check.label, ratio: Number(ratio.toFixed(2)), minimum: check.minimum }]
      : []
  })
}

export function snapshotLegacyHomeSectionColors(
  sectionId: HomeSectionDefinitionId,
  settings: Record<string, string>,
  palette: HomeSurfacePalette,
) {
  const defaults = LEGACY_SECTION_COLOR_DEFAULTS[sectionId]
  if (!defaults) return settings
  const next = { ...settings }
  for (const [key, source] of Object.entries(defaults)) {
    if (next[key] !== undefined) continue
    next[key] = source in palette ? palette[source as HomeColorToken] : source
  }
  return next
}

export function resolveHomeSectionColorConfig(
  sectionId: HomeSectionDefinitionId,
  settings: Record<string, string>,
  colorInheritanceVersion: 2 | undefined,
) {
  if (colorInheritanceVersion !== 2) return settings
  if (sectionId === 'featured-scroll') {
    return {
      sectionBgColor: 'var(--p-bg)',
      titleColor: 'var(--p-text)',
      subtitleColor: 'var(--p-text-2)',
      cardBgColor: 'var(--p-card)',
      cardTextColor: 'var(--p-text)',
      cardMutedColor: 'var(--p-text-2)',
      ...settings,
    }
  }
  if (sectionId === 'gallery') {
    const modern = settings.editorialVersion === '2'
    return {
      sectionBgColor: 'var(--p-card)',
      accentColor: 'var(--p-accent)',
      titleColor: modern ? 'var(--p-text)' : 'var(--p-accent)',
      bodyColor: 'var(--p-text-2)',
      labelBgColor: 'var(--p-card)',
      labelTextColor: 'var(--p-accent)',
      ...settings,
    }
  }
  if (sectionId === 'chef-pick') {
    const inheritedDefaults = settings.editorialVersion === '2'
    return {
      bgColor: inheritedDefaults ? 'var(--p-card)' : '#1a1612',
      accentColor: inheritedDefaults ? 'var(--p-accent)' : '#ffd089',
      textColor: inheritedDefaults ? 'var(--p-text)' : '#ffffff',
      itemBgColor: inheritedDefaults ? 'var(--p-card)' : '#241f1a',
      itemBorderColor: inheritedDefaults ? 'var(--p-border)' : '#3b342d',
      itemTextColor: inheritedDefaults ? 'var(--p-text)' : '#ffffff',
      itemMutedColor: inheritedDefaults ? 'var(--p-text-2)' : '#b9b2ab',
      priceColor: inheritedDefaults ? 'var(--p-text)' : '#ffd089',
      imageBgColor: inheritedDefaults ? 'var(--p-card)' : '#3a3024',
      buttonBgColor: inheritedDefaults ? 'var(--p-cta)' : '#ffd089',
      buttonTextColor: inheritedDefaults ? 'var(--p-cta-text)' : '#1a1612',
      ...settings,
    }
  }
  if (sectionId === 'combo-ribbon') {
    const inheritedDefaults = settings.editorialVersion === '2'
    return {
      bgColor: inheritedDefaults ? 'var(--p-bg)' : '#fff7dc',
      titleColor: inheritedDefaults ? 'var(--p-text)' : '#1c1d20',
      accentColor: inheritedDefaults ? 'var(--p-accent)' : '#e86b3d',
      badgeTextColor: inheritedDefaults ? 'var(--p-text)' : '#1c1d20',
      combo1Color: inheritedDefaults ? 'var(--p-card)' : '#26a69a',
      combo1TextColor: inheritedDefaults ? 'var(--p-text)' : '#ffffff',
      combo2Color: inheritedDefaults ? 'var(--p-card)' : '#ee6c4d',
      combo2TextColor: inheritedDefaults ? 'var(--p-text)' : '#ffffff',
      combo3Color: inheritedDefaults ? 'var(--p-card)' : '#d8a72f',
      combo3TextColor: inheritedDefaults ? 'var(--p-text)' : '#ffffff',
      itemBgColor: inheritedDefaults ? 'var(--p-bg)' : 'rgba(255,255,255,.22)',
      itemTextColor: inheritedDefaults ? 'var(--p-text)' : '#ffffff',
      priceColor: inheritedDefaults ? 'var(--p-text)' : '#ffffff',
      buttonBgColor: inheritedDefaults ? 'var(--p-cta)' : '#1c1d20',
      buttonTextColor: inheritedDefaults ? 'var(--p-cta-text)' : '#ffffff',
      ...settings,
    }
  }
  return settings
}
