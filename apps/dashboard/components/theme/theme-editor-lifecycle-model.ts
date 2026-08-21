import type { GarsonlessTheme } from '@garsonless/design-engine'
import type { SettingsGroup } from '@garsonless/ui/themes'

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
  if (initialTheme.experienceVersion === 2) patch.experienceVersion = 2
  if (initialTheme.surfaces) patch.surfaces = initialTheme.surfaces

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

export function shouldAppendHistoryForGroup(
  activeGroup: string | null,
  requestedGroup: string | null,
): boolean {
  return requestedGroup === null || activeGroup !== requestedGroup
}

export function isContinuousThemeHistoryControl(control: {
  tagName: string
  inputType?: string
  role?: string | null
}): boolean {
  if (control.role === 'slider') return true
  if (control.tagName.toLowerCase() === 'textarea') return true
  if (control.tagName.toLowerCase() !== 'input') return false
  return !new Set(['button', 'checkbox', 'file', 'hidden', 'radio', 'reset', 'submit']).has(
    control.inputType?.toLowerCase() ?? 'text',
  )
}

export function areThemeOverridesEqual(
  left: Partial<GarsonlessTheme>,
  right: Partial<GarsonlessTheme>,
): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
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

  if (JSON.stringify(currentTheme.surfaces) !== JSON.stringify(savedTheme.surfaces)) {
    labels.push('Yüzeyler')
  }

  return labels.filter((label, index) => labels.indexOf(label) === index)
}
