'use client'

import type { Dispatch, RefObject, SetStateAction } from 'react'
import type { GarsonlessTheme } from '@garsonless/design-engine'
import {
  SectionPickerDialog,
  TemplatePickerDialog,
  type ThemeSectionOption,
  type ThemeTemplateOption,
} from './ThemeEditorDialogs'
import { SectionMiniPreview, TemplateShowcasePreview } from './ThemeEditorPreviewCatalog'
import { SECTION_GROUPS, SECTION_LIBRARY } from './theme-editor-section-registry'

interface ThemeEditorDialogsLayerProps {
  templatePickerOpen: boolean
  sectionPickerOpen: boolean
  templateCloseRef: RefObject<HTMLButtonElement | null>
  sectionCloseRef: RefObject<HTMLButtonElement | null>
  templateId: string
  previewTheme: GarsonlessTheme
  templateEntries: readonly ThemeTemplateOption[]
  sectionSearch: string
  sectionGroup: (typeof SECTION_GROUPS)[number]
  filteredSections: readonly ThemeSectionOption[]
  activeSections: readonly string[]
  setSectionSearch: Dispatch<SetStateAction<string>>
  setSectionGroup: Dispatch<SetStateAction<(typeof SECTION_GROUPS)[number]>>
  onTemplateSelect: (templateId: string) => void
  onTemplateClose: () => void
  onSectionAdd: (sectionId: string) => void
  onSectionClose: () => void
}

export function ThemeEditorDialogsLayer({
  templatePickerOpen,
  sectionPickerOpen,
  templateCloseRef,
  sectionCloseRef,
  templateId,
  previewTheme,
  templateEntries,
  sectionSearch,
  sectionGroup,
  filteredSections,
  activeSections,
  setSectionSearch,
  setSectionGroup,
  onTemplateSelect,
  onTemplateClose,
  onSectionAdd,
  onSectionClose,
}: ThemeEditorDialogsLayerProps) {
  return (
    <>
      {templatePickerOpen && (
        <TemplatePickerDialog
          closeRef={templateCloseRef}
          templateId={templateId}
          previewTheme={previewTheme}
          templates={templateEntries}
          onSelect={onTemplateSelect}
          onClose={onTemplateClose}
          renderPreview={(id, theme, title) => (
            <TemplateShowcasePreview id={id} theme={theme} title={title} />
          )}
        />
      )}
      {sectionPickerOpen && (
        <SectionPickerDialog
          closeRef={sectionCloseRef}
          search={sectionSearch}
          activeGroup={sectionGroup}
          groups={SECTION_GROUPS}
          sections={SECTION_LIBRARY}
          visibleSections={filteredSections}
          activeSectionIds={activeSections}
          onSearchChange={setSectionSearch}
          onGroupChange={(group) => setSectionGroup(group as (typeof SECTION_GROUPS)[number])}
          onAddSection={onSectionAdd}
          onClose={onSectionClose}
          renderPreview={(sectionId) => <SectionMiniPreview id={sectionId} />}
        />
      )}
    </>
  )
}
