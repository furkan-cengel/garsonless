import type { GarsonlessTheme } from '@garsonless/design-engine'

export const THEME_FONT_PAIR_PRESETS = [
  { id: 'editorial', label: 'Editoryal', displayFont: 'Fraunces', bodyFont: 'DM Sans' },
  { id: 'classic', label: 'Klasik', displayFont: 'Playfair Display', bodyFont: 'Inter' },
  { id: 'modern', label: 'Modern', displayFont: 'Manrope', bodyFont: 'Inter' },
  { id: 'soft', label: 'Yumuşak', displayFont: 'Fredoka', bodyFont: 'Nunito' },
  { id: 'plain', label: 'Sade', displayFont: 'Inter', bodyFont: 'Inter' },
] as const

export const THEME_TYPE_SCALE_PRESETS = [
  { id: 'compact', label: 'Kompakt', fs: 14, lh: 145 },
  { id: 'normal', label: 'Normal', fs: 15, lh: 148 },
  { id: 'comfortable', label: 'Rahat', fs: 16, lh: 155 },
] as const

export type ThemeFontPairPresetId = typeof THEME_FONT_PAIR_PRESETS[number]['id'] | 'custom'
export type ThemeTypeScalePresetId = typeof THEME_TYPE_SCALE_PRESETS[number]['id'] | 'custom'

export function resolveThemeFontPairPreset(theme: Pick<GarsonlessTheme, 'displayFont' | 'bodyFont'>): ThemeFontPairPresetId {
  return THEME_FONT_PAIR_PRESETS.find((preset) => preset.displayFont === theme.displayFont && preset.bodyFont === theme.bodyFont)?.id ?? 'custom'
}

export function resolveThemeTypeScalePreset(theme: Pick<GarsonlessTheme, 'fs' | 'lh'>): ThemeTypeScalePresetId {
  return THEME_TYPE_SCALE_PRESETS.find((preset) => preset.fs === theme.fs && preset.lh === theme.lh)?.id ?? 'custom'
}

export function buildThemeFontPairPatch(id: Exclude<ThemeFontPairPresetId, 'custom'>): Pick<GarsonlessTheme, 'displayFont' | 'bodyFont'> {
  const preset = THEME_FONT_PAIR_PRESETS.find((candidate) => candidate.id === id) ?? THEME_FONT_PAIR_PRESETS[0]
  return { displayFont: preset.displayFont, bodyFont: preset.bodyFont }
}

export function buildThemeTypeScalePatch(id: Exclude<ThemeTypeScalePresetId, 'custom'>): Pick<GarsonlessTheme, 'fs' | 'lh'> {
  const preset = THEME_TYPE_SCALE_PRESETS.find((candidate) => candidate.id === id) ?? THEME_TYPE_SCALE_PRESETS[1]
  return { fs: preset.fs, lh: preset.lh }
}
