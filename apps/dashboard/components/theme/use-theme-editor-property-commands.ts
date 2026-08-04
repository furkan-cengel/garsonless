'use client'

import { useCallback } from 'react'
import type { GarsonlessTheme } from '@garsonless/design-engine'
import type { SettingsGroup } from '@garsonless/ui/themes'
import {
  buildSectionSettingsResetPatch,
  buildThemeGroupResetPatch,
  buildThemeSettingsClipboardPayload,
} from './theme-editor-property-command-model'

interface ThemeEditorPropertyCommandOptions {
  activeGroup: string
  activeGroupData?: SettingsGroup
  selectedSectionId: string | null
  mergedTheme: GarsonlessTheme
  previewTheme: GarsonlessTheme
  defaults: GarsonlessTheme
  updateThemePatch: (patch: Partial<GarsonlessTheme>) => void
  flashToast: (message: string) => void
}

export function useThemeEditorPropertyCommands({
  activeGroup,
  activeGroupData,
  selectedSectionId,
  mergedTheme,
  previewTheme,
  defaults,
  updateThemePatch,
  flashToast,
}: ThemeEditorPropertyCommandOptions) {
  const copyCurrentSettings = useCallback(async () => {
    const payload = buildThemeSettingsClipboardPayload({
      selectedSectionId,
      mergedTheme,
      previewTheme,
      activeGroupData,
    })

    try {
      await navigator.clipboard.writeText(JSON.stringify(payload, null, 2))
      flashToast('Ayarlar kopyalandı')
    } catch {
      flashToast('Kopyalama başarısız')
    }
  }, [activeGroupData, flashToast, mergedTheme, previewTheme, selectedSectionId])

  const resetCurrentSettings = useCallback(() => {
    if (selectedSectionId) {
      updateThemePatch(buildSectionSettingsResetPatch(mergedTheme, selectedSectionId))
      flashToast('Bölüm ayarları sıfırlandı')
      return
    }

    if (!activeGroupData) return
    if (
      activeGroup === 'header' &&
      !window.confirm('Header ayarları varsayılan değerlerine döndürülsün mü?')
    ) return

    updateThemePatch(buildThemeGroupResetPatch(activeGroupData, defaults))
    flashToast('Panel ayarları sıfırlandı')
  }, [activeGroup, activeGroupData, defaults, flashToast, mergedTheme, selectedSectionId, updateThemePatch])

  return { copyCurrentSettings, resetCurrentSettings }
}
