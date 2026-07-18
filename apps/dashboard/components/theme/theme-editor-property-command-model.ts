import type { GarsonlessTheme } from '@garsonless/design-engine'
import type { SettingsGroup } from '@garsonless/ui'

interface ThemeSettingsClipboardOptions {
  selectedSectionId: string | null
  mergedTheme: GarsonlessTheme
  previewTheme: GarsonlessTheme
  activeGroupData?: SettingsGroup
}

export type ThemeSettingsClipboardPayload =
  | { type: 'section'; id: string; settings: Record<string, string> }
  | { type: 'group'; id: string; settings: Record<string, unknown> }

export function buildThemeSettingsClipboardPayload({
  selectedSectionId,
  mergedTheme,
  previewTheme,
  activeGroupData,
}: ThemeSettingsClipboardOptions): ThemeSettingsClipboardPayload {
  if (selectedSectionId) {
    return {
      type: 'section' as const,
      id: selectedSectionId,
      settings: mergedTheme.sectionSettings?.[selectedSectionId] ?? {},
    }
  }

  return {
    type: 'group' as const,
    id: activeGroupData?.id ?? 'page',
    settings: Object.fromEntries(
      (activeGroupData?.fields ?? []).map((field) => [
        field.themeField,
        previewTheme[field.themeField],
      ]),
    ),
  }
}

export function buildSectionSettingsResetPatch(
  theme: GarsonlessTheme,
  sectionId: string,
): Partial<GarsonlessTheme> {
  const sectionSettings = { ...(theme.sectionSettings ?? {}) }
  delete sectionSettings[sectionId]
  return { sectionSettings }
}

export function buildThemeGroupResetPatch(
  group: SettingsGroup,
  defaults: GarsonlessTheme,
): Partial<GarsonlessTheme> {
  const patch: Partial<GarsonlessTheme> = {}
  for (const field of group.fields) {
    ;(patch as Record<string, unknown>)[field.themeField] = defaults[field.themeField]
  }
  return patch
}
