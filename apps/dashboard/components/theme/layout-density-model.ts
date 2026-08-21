import type { GarsonlessTheme } from '@garsonless/design-engine'

export const LAYOUT_DENSITY_FIELDS = [
  'pad',
  'gap',
  'sectionGap',
  'sectionHeadingTopGap',
  'sectionHeadingBottomGap',
] as const satisfies ReadonlyArray<keyof GarsonlessTheme>

export type LayoutDensityField = (typeof LAYOUT_DENSITY_FIELDS)[number]
export type LayoutDensityPresetId = 'compact' | 'normal' | 'comfortable'

export const LAYOUT_DENSITY_PRESETS: ReadonlyArray<{
  id: LayoutDensityPresetId
  label: string
  values: Pick<GarsonlessTheme, LayoutDensityField>
}> = [
  {
    id: 'compact',
    label: 'Kompakt',
    values: { pad: 12, gap: 8, sectionGap: 16, sectionHeadingTopGap: 16, sectionHeadingBottomGap: 8 },
  },
  {
    id: 'normal',
    label: 'Normal',
    values: { pad: 16, gap: 12, sectionGap: 24, sectionHeadingTopGap: 24, sectionHeadingBottomGap: 12 },
  },
  {
    id: 'comfortable',
    label: 'Rahat',
    values: { pad: 24, gap: 16, sectionGap: 32, sectionHeadingTopGap: 32, sectionHeadingBottomGap: 16 },
  },
]

export function resolveLayoutDensityPreset(
  values: Partial<Record<LayoutDensityField, unknown>>,
): LayoutDensityPresetId | null {
  return LAYOUT_DENSITY_PRESETS.find((preset) =>
    LAYOUT_DENSITY_FIELDS.every((field) => Number(values[field]) === preset.values[field]),
  )?.id ?? null
}

export function buildLayoutDensityPatch(
  presetId: LayoutDensityPresetId,
): Partial<Pick<GarsonlessTheme, LayoutDensityField>> {
  const preset = LAYOUT_DENSITY_PRESETS.find((candidate) => candidate.id === presetId)
  return preset ? { ...preset.values } : {}
}
