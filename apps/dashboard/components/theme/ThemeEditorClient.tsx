'use client'
import { useMemo } from 'react'
import { CANONICAL_THEME_ID, THEME_REGISTRY, type SettingsGroup } from '@garsonless/ui'
import type { GarsonlessTheme } from '@garsonless/design-engine'
import { useShell } from '../../lib/shell-context'
import { ThemeEditorTopbar } from './ThemeEditorTopbar'
import { ThemeEditorCanvas } from './ThemeEditorCanvas'
import { ThemeEditorDialogsLayer } from './ThemeEditorDialogsLayer'
import { ThemeEditorPropertiesWorkspace } from './ThemeEditorPropertiesWorkspace'
import { ThemeEditorShell } from './ThemeEditorShell'
import { ThemeEditorSidebar } from './ThemeEditorSidebar'
import { ChefPickIconUploadPanels, GalleryUploadPanel, PromoSliderImageUploadPanel, SectionImageUploadPanel, ServiceRequestIconUploadPanels } from './ThemeSectionSettings'
import { ThemeLogoUploadCard } from './ThemeLogoUploadCard'
import { useThemeEditorLifecycle } from './use-theme-editor-lifecycle'
import { useThemeEditorLogo } from './use-theme-editor-logo'
import { useThemeEditorNavigation } from './use-theme-editor-navigation'
import { useThemeEditorPropertyCommands } from './use-theme-editor-property-commands'
import { useThemeEditorWorkspace } from './use-theme-editor-workspace'
import { buildEditorNavigation, buildThemeSettingsGroup } from './theme-editor-navigation-catalog'
import { getThemeEditorSaveStatus } from './theme-editor-shell-model'
import { createThemeEditorPreviewDeriver } from './theme-editor-preview-theme-model'
import { SECTION_LIBRARY } from './theme-editor-section-registry'
import type { ThemeEditorPreviewCategory, ThemeEditorPreviewItem } from './CanonicalSectionPreview'
interface Props {
  restaurantId: string
  restaurantSlug: string
  restaurantName: string
  restaurantLogoUrl: string | null
  canAddAdvancedSections: boolean
  templateId: string
  initialTheme: GarsonlessTheme
  restaurantSettings: Record<string, unknown> | null
  menuCategories: ThemeEditorPreviewCategory[]
  menuItems: ThemeEditorPreviewItem[]
}

export default function ThemeEditorClient({
  restaurantId,
  restaurantSlug,
  restaurantName,
  restaurantLogoUrl,
  canAddAdvancedSections,
  templateId,
  initialTheme,
  restaurantSettings,
  menuCategories,
  menuItems,
}: Props) {
  const entry = THEME_REGISTRY[CANONICAL_THEME_ID]!
  const schema: SettingsGroup[] = entry.SETTINGS_SCHEMA
  const { setNavigationGuard } = useShell()
  const menuBaseUrl = process.env.NEXT_PUBLIC_MENU_URL ?? 'http://localhost:3011'
  const previewUrl = `${menuBaseUrl.replace(/\/$/, '')}/${encodeURIComponent(restaurantSlug)}?preview=1`
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
    sectionPickerOpen,
    sectionSearch,
    editorSearch,
    editorQuery,
    sectionGroup,
    selectedSectionId,
    selectedSectionDefinitionId,
    selectedSectionBlock,
    dragBlockKey,
    sectionTriggerRef,
    sectionCloseRef,
    pageBlocks,
    activeSectionDefinitionIds,
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
    openSectionPicker,
    closeSectionPicker,
    addSection: handleAddSection,
    removeSection: handleRemoveSection,
    changeSectionSetting: handleSectionSettingChange,
    changeSectionVisibility: handleSectionVisibilityChange,
    dropPageBlock: handlePageBlockDrop,
    movePageBlock: handlePageBlockKeyboardMove,
    selectGroup,
    selectPageBlock,
  } = useThemeEditorNavigation({
    schema,
    themeGroupData,
    navGroups,
    mergedTheme,
    previewTheme,
    menuCategories,
    updateThemePatch,
    flashToast,
  })
  const { copyCurrentSettings: handleCopyCurrentSettings, resetCurrentSettings: handleResetCurrentSettings } = useThemeEditorPropertyCommands({
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
        selectedSectionBlock={selectedSectionBlock}
        selectedSectionSettings={selectedSectionSettings}
        visibleEditorTabs={visibleEditorTabs}
        effectiveEditorTab={effectiveEditorTab}
        visibleFields={visibleFields}
        visibleSectionFields={visibleSectionFields}
        // Campaign controls must read the normalized instance-scoped page flow.
        mergedTheme={previewTheme}
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
        sectionMediaPanel={effectiveEditorTab === 'design' && selectedSectionId && selectedSectionDefinitionId === 'gallery' ? (
          <GalleryUploadPanel
            restaurantId={restaurantId}
            values={selectedSectionSettings}
            onChange={(key, value) => handleSectionSettingChange(selectedSectionId, key, value)}
          />
        ) : effectiveEditorTab === 'design' && selectedSectionId && selectedSectionDefinitionId === 'hero-banner' ? (
          <SectionImageUploadPanel
            restaurantId={restaurantId}
            sectionId={selectedSectionId}
            label="Hero Banner"
            value={selectedSectionSettings.imageUrl ?? ''}
            onChange={(value) => handleSectionSettingChange(selectedSectionId, 'imageUrl', value)}
          />
        ) : effectiveEditorTab === 'design' && selectedSectionId && selectedSectionDefinitionId === 'promo-slider' ? (
          <PromoSliderImageUploadPanel
            restaurantId={restaurantId}
            sectionId={selectedSectionId}
            values={selectedSectionSettings}
            onChange={(key, value) => handleSectionSettingChange(selectedSectionId, key, value)}
          />
        ) : effectiveEditorTab === 'design' && selectedSectionId && selectedSectionDefinitionId === 'chef-pick' ? (
          <ChefPickIconUploadPanels
            restaurantId={restaurantId}
            values={selectedSectionSettings}
            onChange={(key, value) => handleSectionSettingChange(selectedSectionId, key, value)}
          />
        ) : effectiveEditorTab === 'content' && selectedSectionId && selectedSectionDefinitionId === 'request-buttons' ? (
          <ServiceRequestIconUploadPanels
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
        onSectionVisibilityChange={handleSectionVisibilityChange}
      />}
      dialogs={<ThemeEditorDialogsLayer
        sectionPickerOpen={sectionPickerOpen}
        sectionCloseRef={sectionCloseRef}
        previewTheme={previewTheme}
        restaurantName={restaurantName}
        restaurantSettings={restaurantSettings}
        menuCategories={menuCategories}
        menuItems={menuItems}
        sectionSearch={sectionSearch}
        sectionGroup={sectionGroup}
        filteredSections={filteredSections}
        activeSections={activeSectionDefinitionIds}
        canAddAdvancedSections={canAddAdvancedSections}
        setSectionSearch={setSectionSearch}
        setSectionGroup={setSectionGroup}
        onSectionAdd={handleAddSection}
        onLockedSection={() => flashToast('Bu bölüm Pro pakette kullanılabilir.')}
        onSectionClose={closeSectionPicker}
      />}
    />
  )
}
