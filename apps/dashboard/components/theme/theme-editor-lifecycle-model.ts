import type { GarsonlessTheme } from '@garsonless/design-engine'
import type { SettingsGroup } from '@garsonless/ui'

const DEFAULT_HISTORY_LIMIT = 25

export function createThemeOverrides(
  initialTheme: GarsonlessTheme,
  defaults: GarsonlessTheme,
  schema: SettingsGroup[],
): Partial<GarsonlessTheme> {
  const patch: Partial<GarsonlessTheme> = {}

  for (const group of schema) {
    for (const field of group.fields) {
      const key = field.themeField as keyof GarsonlessTheme
      const saved = initialTheme[key]
      const defaultValue = defaults[key]
      if (saved !== undefined && saved !== defaultValue) {
        ;(patch as Record<string, unknown>)[field.themeField] = saved
      }
    }
  }

  if (initialTheme.sections?.length) patch.sections = initialTheme.sections
  if (initialTheme.pageBlocks?.length) patch.pageBlocks = initialTheme.pageBlocks
  if (initialTheme.sectionSettings && Object.keys(initialTheme.sectionSettings).length > 0) {
    patch.sectionSettings = initialTheme.sectionSettings
  }

  return patch
}

export function appendHistorySnapshot<T>(
  history: readonly T[],
  snapshot: T,
  limit = DEFAULT_HISTORY_LIMIT,
): T[] {
  if (limit <= 0) return []
  return [...history.slice(-(limit - 1)), snapshot]
}

export function getUnsavedFieldLabels(
  hasUnsavedChanges: boolean,
  schema: SettingsGroup[],
  currentTheme: GarsonlessTheme,
  savedTheme: GarsonlessTheme,
): string[] {
  if (!hasUnsavedChanges) return []

  const labels = schema.flatMap((group) => group.fields)
    .filter((field) => {
      const key = field.themeField as keyof GarsonlessTheme
      return JSON.stringify(currentTheme[key]) !== JSON.stringify(savedTheme[key])
    })
    .map((field) => field.label)

  return labels.filter((label, index) => labels.indexOf(label) === index)
}
