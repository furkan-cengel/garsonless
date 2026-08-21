import { getSectionDefinitionId, type GarsonlessTheme } from '@garsonless/design-engine'
import type { SettingsGroup } from '@garsonless/ui/themes'
import { buildVideoHeroResetSettings, createInitialSectionSettings, GALLERY_CONTENT_KEYS } from './theme-section-initial-settings'

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
  const homeDefinition = theme.surfaces?.home.blocks?.find((block) => block.id === sectionId)?.sectionId
  const menuBlock = theme.pageBlocks?.find((block) => block.type === 'section' && block.id === sectionId)
  const definitionId = homeDefinition ?? (menuBlock ? getSectionDefinitionId(menuBlock) : null) ?? sectionId
  const initialSettings = createInitialSectionSettings(definitionId)
  if (definitionId === 'gallery') {
    const current = sectionSettings[sectionId] ?? {}
    const content = Object.fromEntries(GALLERY_CONTENT_KEYS.flatMap((key) => current[key] === undefined ? [] : [[key, current[key]!]]))
    sectionSettings[sectionId] = { ...initialSettings, ...content }
    return { sectionSettings }
  }
  if (definitionId === 'storefront-video-hero') {
    sectionSettings[sectionId] = buildVideoHeroResetSettings(sectionSettings[sectionId] ?? {})
    return { sectionSettings }
  }
  if (Object.keys(initialSettings).length > 0) sectionSettings[sectionId] = initialSettings
  else delete sectionSettings[sectionId]
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
