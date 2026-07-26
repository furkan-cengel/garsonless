'use client'

import type { Dispatch, RefObject, SetStateAction } from 'react'
import type { GarsonlessTheme } from '@garsonless/design-engine'
import {
  SectionPickerDialog,
  type ThemeSectionOption,
} from './ThemeEditorDialogs'
import {
  CanonicalSectionPreview,
  type ThemeEditorPreviewCategory,
  type ThemeEditorPreviewItem,
} from './CanonicalSectionPreview'
import { SECTION_GROUPS, SECTION_LIBRARY } from './theme-editor-section-registry'

interface ThemeEditorDialogsLayerProps {
  sectionPickerOpen: boolean
  sectionCloseRef: RefObject<HTMLButtonElement | null>
  previewTheme: GarsonlessTheme
  restaurantName: string
  restaurantSettings: Record<string, unknown> | null
  menuCategories: ThemeEditorPreviewCategory[]
  menuItems: ThemeEditorPreviewItem[]
  sectionSearch: string
  sectionGroup: (typeof SECTION_GROUPS)[number]
  filteredSections: readonly ThemeSectionOption[]
  activeSections: readonly string[]
  canAddAdvancedSections: boolean
  setSectionSearch: Dispatch<SetStateAction<string>>
  setSectionGroup: Dispatch<SetStateAction<(typeof SECTION_GROUPS)[number]>>
  onSectionAdd: (sectionId: string) => void
  onLockedSection: () => void
  onSectionClose: () => void
}

export function ThemeEditorDialogsLayer({
  sectionPickerOpen,
  sectionCloseRef,
  previewTheme,
  restaurantName,
  restaurantSettings,
  menuCategories,
  menuItems,
  sectionSearch,
  sectionGroup,
  filteredSections,
  activeSections,
  canAddAdvancedSections,
  setSectionSearch,
  setSectionGroup,
  onSectionAdd,
  onLockedSection,
  onSectionClose,
}: ThemeEditorDialogsLayerProps) {
  return (
    <>
      {sectionPickerOpen && (
        <SectionPickerDialog
          closeRef={sectionCloseRef}
          search={sectionSearch}
          activeGroup={sectionGroup}
          groups={SECTION_GROUPS}
          sections={SECTION_LIBRARY}
          visibleSections={filteredSections}
          activeSectionIds={activeSections}
          canAddAdvancedSections={canAddAdvancedSections}
          onSearchChange={setSectionSearch}
          onGroupChange={(group) => setSectionGroup(group as (typeof SECTION_GROUPS)[number])}
          onAddSection={onSectionAdd}
          onLockedSection={onLockedSection}
          onClose={onSectionClose}
          renderPreview={(sectionId, compact) => (
            <CanonicalSectionPreview
              sectionId={sectionId}
              theme={previewTheme}
              restaurantName={restaurantName}
              restaurantSettings={restaurantSettings}
              menuCategories={menuCategories}
              menuItems={menuItems}
              compact={compact}
            />
          )}
        />
      )}
    </>
  )
}
