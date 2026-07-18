'use client'

import { useMemo } from 'react'
import { THEME_REGISTRY } from '@garsonless/ui'
import type { SettingsGroup } from '@garsonless/ui'
import type { GarsonlessTheme } from '@garsonless/design-engine'
import { useShell } from '../../lib/shell-context'
import { ThemeEditorTopbar } from './ThemeEditorTopbar'
import { ThemeEditorCanvas } from './ThemeEditorCanvas'
import { ThemeEditorDialogsLayer } from './ThemeEditorDialogsLayer'
import { ThemeEditorPropertiesWorkspace } from './ThemeEditorPropertiesWorkspace'
import { ThemeEditorShell } from './ThemeEditorShell'
import { ThemeEditorSidebar } from './ThemeEditorSidebar'
import { GalleryUploadPanel } from './ThemeSectionSettings'
import { ThemeLogoUploadCard } from './ThemeLogoUploadCard'
import { useThemeEditorLifecycle } from './use-theme-editor-lifecycle'
import { useThemeEditorLogo } from './use-theme-editor-logo'
import { useThemeEditorNavigation } from './use-theme-editor-navigation'
import { useThemeEditorPropertyCommands } from './use-theme-editor-property-commands'
import { useThemeEditorWorkspace } from './use-theme-editor-workspace'
import {
  buildEditorNavigation,
  buildThemeSettingsGroup,
} from './theme-editor-navigation-catalog'
import { getThemeEditorSaveStatus } from './theme-editor-shell-model'
import { createThemeEditorPreviewDeriver } from './theme-editor-preview-theme-model'
import { SECTION_LIBRARY } from './theme-editor-section-registry'

interface Props {
  restaurantId: string
  restaurantSlug: string
  restaurantName: string
  restaurantLogoUrl: string | null
  templateId: string
  initialTheme: GarsonlessTheme
  menuCategories: Array<{ id: string; name: string; parentId?: string | null }>
  menuItems: Array<{ id: string; name: string; categoryId: string; categoryName: string }>
}

export default function ThemeEditorClient({
  restaurantId,
  restaurantSlug,
  restaurantName,
  restaurantLogoUrl,
  templateId,
  initialTheme,
  menuCategories,
  menuItems,
}: Props) {
  const entry = THEME_REGISTRY[templateId] ?? THEME_REGISTRY['default']!
  const schema: SettingsGroup[] = entry.SETTINGS_SCHEMA
  const { setNavigationGuard } = useShell()
  const menuBaseUrl = process.env.NEXT_PUBLIC_MENU_URL ?? 'http://localhost:3011'
  const previewUrl = `${menuBaseUrl.replace(/\/$/, '')}/${encodeURIComponent(restaurantSlug)}?preview=1&template=${encodeURIComponent(templateId)}`
  const derivePreviewTheme = useMemo(
    () => createThemeEditorPreviewDeriver(entry.THEME_DEFAULTS, menuCategories),
    [entry.THEME_DEFAULTS, menuCategories],
  )
  const {
    overrides,
    previewTheme,
    iframeRef,
    previewStatus,
    reloadPreviewFrame,
    saving,
    toast,
    hasUnsavedChanges,
    lastSavedAt,
    unsavedFieldLabels,
    canUndo,
    canRedo,
    flashToast,
    handleUndo,
    handleRedo,
    handleFieldChange,
    updateThemePatch,
    handleSave,
  } = useThemeEditorLifecycle({
    restaurantId,
    templateId,
    previewUrl,
    initialTheme,
    defaults: entry.THEME_DEFAULTS,
    schema,
    derivePreviewTheme,
    setNavigationGuard,
  })

  const {
    previewMode,
    setPreviewMode,
    previewScale,
    layout: workspaceLayout,
    changeZoom,
    fitPreview,
    openPreview,
  } = useThemeEditorWorkspace(previewUrl)
  const {
    logoUrl: localLogoUrl,
    uploading: logoUploading,
    upload: handleLogoUpload,
    remove: handleLogoRemove,
  } = useThemeEditorLogo({
    restaurantId,
    initialLogoUrl: restaurantLogoUrl,
    flashToast,
    reloadPreview: reloadPreviewFrame,
  })

  const mergedTheme = useMemo(
    () => ({ ...entry.THEME_DEFAULTS, ...overrides }) as GarsonlessTheme,
    [entry.THEME_DEFAULTS, overrides],
  )
  const themeGroupData = buildThemeSettingsGroup(schema)
  const navGroups = buildEditorNavigation(schema, entry.name)
  const {
    activeGroup,
    templatePickerOpen,
    sectionPickerOpen,
    sectionSearch,
    editorSearch,
    editorQuery,
    sectionGroup,
    selectedSectionId,
    dragBlockKey,
    sectionTriggerRef,
    templateCloseRef,
    sectionCloseRef,
    pageBlocks,
    activeSections,
    templateEntries,
    activeGroupData,
    filteredNavGroups,
    selectedSection,
    selectedSectionSettings,
    visibleEditorTabs,
    effectiveEditorTab,
    visibleFields,
    visibleSectionFields,
    filteredSections,
    filteredPageBlocks,
    setSectionSearch,
    setEditorSearch,
    setSectionGroup,
    setDragBlockKey,
    setActiveEditorTab,
    closeTemplatePicker,
    openSectionPicker,
    closeSectionPicker,
    selectTemplate: handleTemplateSelect,
    addSection: handleAddSection,
    removeSection: handleRemoveSection,
    changeSectionSetting: handleSectionSettingChange,
    dropPageBlock: handlePageBlockDrop,
    movePageBlock: handlePageBlockKeyboardMove,
    selectGroup,
    selectPageBlock,
  } = useThemeEditorNavigation({
    restaurantId,
    templateId,
    schema,
    themeGroupData,
    navGroups,
    mergedTheme,
    previewTheme,
    menuCategories,
    updateThemePatch,
    flashToast,
  })
  const {
    copyCurrentSettings: handleCopyCurrentSettings,
    resetCurrentSettings: handleResetCurrentSettings,
  } = useThemeEditorPropertyCommands({
    activeGroup,
    activeGroupData,
    selectedSectionId,
    mergedTheme,
    previewTheme,
    defaults: entry.THEME_DEFAULTS,
    updateThemePatch,
    flashToast,
  })

  const isNarrowEditor = workspaceLayout.viewport === 'narrow'
  const { leftPanelWidth, rightPanelWidth, showFullTopbarCopy } = workspaceLayout
  const saveStatus = getThemeEditorSaveStatus({ saving, hasUnsavedChanges, lastSavedAt })

  return (
    <ThemeEditorShell
      allowHorizontalOverflow={isNarrowEditor}
      toastMessage={toast}
      topbar={<ThemeEditorTopbar
        restaurantName={restaurantName}
        previewMode={previewMode}
        showFullCopy={showFullTopbarCopy}
        saveStatusText={saveStatus.text}
        saveStatusColor={saveStatus.color}
        unsavedFieldLabels={unsavedFieldLabels}
        hasUnsavedChanges={hasUnsavedChanges}
        canUndo={canUndo}
        canRedo={canRedo}
        saving={saving}
        onPreviewModeChange={setPreviewMode}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onOpenPreview={openPreview}
        onSave={handleSave}
      />}
      sidebar={<ThemeEditorSidebar
        width={leftPanelWidth}
        templateName={entry.name}
        editorSearch={editorSearch}
        editorQuery={editorQuery}
        navGroups={filteredNavGroups}
        activeGroup={activeGroup}
        pageBlocks={pageBlocks}
        visiblePageBlocks={filteredPageBlocks}
        menuCategories={menuCategories}
        sectionLibrary={SECTION_LIBRARY}
        selectedSectionId={selectedSectionId}
        dragBlockKey={dragBlockKey}
        sectionTriggerRef={sectionTriggerRef}
        onEditorSearchChange={setEditorSearch}
        onSelectGroup={selectGroup}
        onSelectPageBlock={selectPageBlock}
        onDragStart={setDragBlockKey}
        onDragEnd={() => setDragBlockKey(null)}
        onDrop={handlePageBlockDrop}
        onMove={handlePageBlockKeyboardMove}
        onRemoveSection={handleRemoveSection}
        onOpenSectionPicker={openSectionPicker}
      />}
      canvas={<ThemeEditorCanvas
        iframeRef={iframeRef}
        previewUrl={previewUrl}
        previewStatus={previewStatus}
        previewTheme={previewTheme}
        previewMode={previewMode}
        previewScale={previewScale}
        isNarrow={isNarrowEditor}
        onZoom={changeZoom}
        onFit={fitPreview}
      />}
      properties={<ThemeEditorPropertiesWorkspace
        width={rightPanelWidth}
        activeGroup={activeGroup}
        activeGroupData={activeGroupData}
        selectedSection={selectedSection}
        selectedSectionId={selectedSectionId}
        selectedSectionSettings={selectedSectionSettings}
        visibleEditorTabs={visibleEditorTabs}
        effectiveEditorTab={effectiveEditorTab}
        visibleFields={visibleFields}
        visibleSectionFields={visibleSectionFields}
        mergedTheme={mergedTheme}
        overrides={overrides}
        defaults={entry.THEME_DEFAULTS}
        schema={schema}
        menuCategories={menuCategories}
        menuItems={menuItems}
        menuHref={`/dashboard/${restaurantId}/menu`}
        logoCard={activeGroup === 'header' && mergedTheme.headerLogoStyle === 'image' && effectiveEditorTab === 'design' ? (
          <ThemeLogoUploadCard
            logoUrl={localLogoUrl}
            uploading={logoUploading}
            onUpload={handleLogoUpload}
            onRemove={handleLogoRemove}
          />
        ) : undefined}
        galleryPanel={selectedSectionId === 'gallery' && effectiveEditorTab === 'design' ? (
          <GalleryUploadPanel
            restaurantId={restaurantId}
            values={selectedSectionSettings}
            onChange={(key, value) => handleSectionSettingChange(selectedSectionId, key, value)}
          />
        ) : undefined}
        onTabChange={setActiveEditorTab}
        onReset={handleResetCurrentSettings}
        onCopy={handleCopyCurrentSettings}
        onFieldChange={handleFieldChange}
        onPatch={updateThemePatch}
        onSectionSettingChange={(key, value) => {
          if (selectedSectionId) handleSectionSettingChange(selectedSectionId, key, value)
        }}
      />}
      dialogs={<ThemeEditorDialogsLayer
        templatePickerOpen={templatePickerOpen}
        sectionPickerOpen={sectionPickerOpen}
        templateCloseRef={templateCloseRef}
        sectionCloseRef={sectionCloseRef}
        templateId={templateId}
        previewTheme={previewTheme}
        templateEntries={templateEntries}
        sectionSearch={sectionSearch}
        sectionGroup={sectionGroup}
        filteredSections={filteredSections}
        activeSections={activeSections}
        setSectionSearch={setSectionSearch}
        setSectionGroup={setSectionGroup}
        onTemplateSelect={handleTemplateSelect}
        onTemplateClose={closeTemplatePicker}
        onSectionAdd={handleAddSection}
        onSectionClose={closeSectionPicker}
      />}
    />
  )
}
