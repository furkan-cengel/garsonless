'use client'
import type { AddOnPrice } from '@garsonless/domain/add-on-purchases'

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
import { SECTION_GROUPS } from './theme-editor-section-registry'

interface ThemeEditorDialogsLayerProps {
  sectionPickerOpen: boolean
  sectionCloseRef: RefObject<HTMLButtonElement | null>
  previewTheme: GarsonlessTheme
  restaurantName: string
  restaurantSettings: Record<string, unknown> | null
  menuCategories: ThemeEditorPreviewCategory[]
  menuItems: ThemeEditorPreviewItem[]
  sectionSearch: string
  surface: 'menu' | 'home'
  sectionGroup: (typeof SECTION_GROUPS)[number]
  filteredSections: readonly ThemeSectionOption[]
  sections: readonly ThemeSectionOption[]
  groups: readonly string[]
  activeSections: readonly string[]
  canAddAdvancedSections: boolean
  canUseVideoHero: boolean
  setSectionSearch: Dispatch<SetStateAction<string>>
  setSectionGroup: Dispatch<SetStateAction<(typeof SECTION_GROUPS)[number]>>
  onSectionAdd: (sectionId: string) => void
  onLockedSection: (sectionId: string) => void
  videoHeroOffer?: { price: AddOnPrice | null; owned: boolean; included: boolean; purchasable: boolean }
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
  surface,
  sectionGroup,
  filteredSections,
  sections,
  groups,
  activeSections,
  canAddAdvancedSections,
  canUseVideoHero,
  setSectionSearch,
  setSectionGroup,
  onSectionAdd,
  onLockedSection,
  videoHeroOffer,
  onSectionClose,
}: ThemeEditorDialogsLayerProps) {
  return (
    <>
      {sectionPickerOpen && (
        <SectionPickerDialog
          surface={surface}
          closeRef={sectionCloseRef}
          search={sectionSearch}
          activeGroup={sectionGroup}
          groups={groups}
          sections={sections}
          visibleSections={filteredSections}
          activeSectionIds={activeSections}
          canAddAdvancedSections={canAddAdvancedSections}
          canUseVideoHero={canUseVideoHero}
          onSearchChange={setSectionSearch}
          onGroupChange={(group) => setSectionGroup(group as (typeof SECTION_GROUPS)[number])}
          onAddSection={onSectionAdd}
          onLockedSection={onLockedSection}
          videoHeroOffer={videoHeroOffer}
          onClose={onSectionClose}
          renderPreview={(sectionId, compact) => (
            <CanonicalSectionPreview
              surface={surface}
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
