'use client'
import { useMemo } from 'react'
import { THEME_REGISTRY, type SettingsGroup } from '@garsonless/ui/themes'
import { CANONICAL_THEME_ID, type GarsonlessTheme } from '@garsonless/design-engine'
import { useShell } from '../../lib/shell-context'
import { ThemeEditorTopbar } from './ThemeEditorTopbar'; import { ThemeEditorCanvas } from './ThemeEditorCanvas'
import { ThemeExperienceProperties, ThemeExperienceSidebar } from './ThemeExperiencePanels'
import { ThemeEditorDialogsLayer } from './ThemeEditorDialogsLayer'; import { ThemeEditorPropertiesWorkspace } from './ThemeEditorPropertiesWorkspace'
import { ThemeEditorShell } from './ThemeEditorShell'; import { ThemeEditorSidebar } from './ThemeEditorSidebar'
import { ChefPickIconUploadPanels, GalleryUploadPanel, PromoSliderImageUploadPanel, SectionImageUploadPanel, ServiceRequestIconUploadPanels } from './ThemeSectionSettings'
import { ThemeLogoUploadCard } from './ThemeLogoUploadCard'
import { useThemeEditorLifecycle } from './use-theme-editor-lifecycle'
import { useThemeEditorLogo } from './use-theme-editor-logo'
import { useThemeEditorNavigation } from './use-theme-editor-navigation'
import { useThemeEditorPropertyCommands } from './use-theme-editor-property-commands'
import { useThemeEditorWorkspace } from './use-theme-editor-workspace'
import { useThemeEditorDrawerPreview } from './use-theme-editor-drawer-preview'
import { useThemeExperienceSurface } from './use-theme-experience-surface'
import { buildEditorNavigation, buildThemeSettingsGroup } from './theme-editor-navigation-catalog'
import { getThemeEditorSaveStatus } from './theme-editor-shell-model'
import { createThemeEditorPreviewDeriver } from './theme-editor-preview-theme-model'
import { HOME_SECTION_LIBRARY, SECTION_GROUPS, SECTION_LIBRARY } from './theme-editor-section-registry'
import { createHomeThemeEditorController } from './home-theme-editor-controller'
import { projectHomeV2ForEditor } from './home-theme-editor-model'
import type { ThemeEditorClientProps } from './theme-editor-client-contract'
export default function ThemeEditorClient({ restaurantId, restaurantSlug, restaurantName, restaurantLogoUrl,
  canAddAdvancedSections, experienceV2Enabled, templateId, initialPersistence, restaurantSettings, menuCategories, menuItems }: ThemeEditorClientProps) {
  const entry = THEME_REGISTRY[CANONICAL_THEME_ID]!
  const schema: SettingsGroup[] = entry.SETTINGS_SCHEMA
  const { setNavigationGuard } = useShell()
  const menuBaseUrl = process.env.NEXT_PUBLIC_MENU_URL ?? 'http://localhost:3011'
  const initialHomeEnabled = initialPersistence.initialTheme.surfaces?.home.enabled === true
  const {
    surface: experienceSurface,
    setSurface: setExperienceSurface,
    authState,
    setAuthState,
    checkoutState,
    setCheckoutState,
    selectedHomeSectionId,
    setSelectedHomeSectionId,
  } = useThemeExperienceSurface(initialHomeEnabled, experienceV2Enabled,
    initialPersistence.initialTheme.surfaces?.home.blocks?.[0]?.id ?? initialPersistence.initialTheme.surfaces?.home.sections[0]?.id ?? null)
  const previewContext = useMemo(() => ({
    surface: experienceSurface,
    ...(experienceSurface === 'auth' ? { state: authState } : {}),
    ...(experienceSurface === 'checkout' ? { state: checkoutState } : {}),
  }) as const, [authState, checkoutState, experienceSurface])
  const previewUrl = useMemo(() => {
    const params = new URLSearchParams({ preview: '1', surface: experienceSurface })
    if (experienceSurface === 'auth') params.set('state', authState)
    if (experienceSurface === 'checkout') params.set('state', checkoutState)
    const path = experienceSurface === 'menu'
      ? `/${encodeURIComponent(restaurantSlug)}/menu`
      : `/theme-preview/${encodeURIComponent(restaurantSlug)}`
    return `${menuBaseUrl.replace(/\/$/, '')}${path}?${params.toString()}`
  }, [authState, checkoutState, experienceSurface, menuBaseUrl, restaurantSlug])
  const derivePreviewTheme = useMemo(() => {
    const deriveBaseTheme = createThemeEditorPreviewDeriver(entry.THEME_DEFAULTS, menuCategories)
    return (overrides: Partial<GarsonlessTheme>) => projectHomeV2ForEditor(deriveBaseTheme(overrides))
  }, [entry.THEME_DEFAULTS, menuCategories])
  const {
    overrides, previewTheme, iframeRef,
    previewStatus, reloadPreviewFrame, handlePreviewFrameLoad, handlePreviewFrameError,
    savingDraft, publishing, toast, hasUnsavedChanges, lastSavedAt, lastPublishedAt,
    hasUnpublishedChanges, authContrastIssues, checkoutContrastIssues, unsavedFieldLabels, canUndo, canRedo, flashToast,
    handleUndo, handleRedo, handleFieldChange, updateThemePatch, handleSave, handlePublish,
  } = useThemeEditorLifecycle({
    restaurantId,
    templateId,
    previewUrl,
    ...initialPersistence,
    defaults: entry.THEME_DEFAULTS,
    schema,
    derivePreviewTheme,
    setNavigationGuard,
    previewContext,
  })
  const {
    previewMode, setPreviewMode, previewScale, layout: workspaceLayout,
    activeSurface, setActiveSurface, changeZoom, fitPreview, openPreview,
  } = useThemeEditorWorkspace(previewUrl)
  const {
    logoUrl: localLogoUrl, uploading: logoUploading,
    upload: handleLogoUpload, remove: handleLogoRemove,
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
    activeGroup, sectionPickerOpen, sectionSearch, editorSearch, editorQuery, sectionGroup,
    selectedSectionId, selectedSectionDefinitionId, selectedSectionBlock, dragBlockKey,
    sectionTriggerRef, sectionCloseRef, pageBlocks, activeSectionDefinitionIds, activeGroupData,
    filteredNavGroups, selectedSection, selectedSectionSettings, visibleEditorTabs, effectiveEditorTab,
    visibleFields, visibleSectionFields, filteredSections, filteredPageBlocks,
    setSectionSearch, setEditorSearch, setSectionGroup, setDragBlockKey, setActiveEditorTab,
    openSectionPicker, closeSectionPicker, addSection: handleAddSection, removeSection: handleRemoveSection,
    changeSectionSetting: handleSectionSettingChange, changeSectionVisibility: handleSectionVisibilityChange,
    changeSectionPlacement: handleSectionPlacementChange, dropPageBlock: handlePageBlockDrop,
    movePageBlock: handlePageBlockKeyboardMove, selectGroup, selectPageBlock,
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
  useThemeEditorDrawerPreview({ activeGroup, iframeRef, previewStatus, previewUrl, selectedSectionDefinitionId, selectedSectionPlacement: selectedSectionBlock?.placement })
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
  const { leftPanelWidth, rightPanelWidth, showFullTopbarCopy, taskBased } = workspaceLayout
  const saveStatus = getThemeEditorSaveStatus({
    savingDraft,
    publishing,
    hasUnsavedChanges,
    hasUnpublishedChanges,
    lastSavedAt,
    lastPublishedAt,
  })
  const homeEnabled = previewTheme.surfaces?.home.enabled === true
  const menuSectionGroups = SECTION_GROUPS.filter((group) => group === 'Tümü' || SECTION_LIBRARY.some((section) => section.group === group))
  const homeEditor = createHomeThemeEditorController({
    theme: previewTheme, query: sectionSearch, group: sectionGroup, setQuery: setSectionSearch, setGroup: setSectionGroup,
    openPicker: openSectionPicker, closePicker: closeSectionPicker, updateTheme: updateThemePatch, selectBlock: setSelectedHomeSectionId,
    showDesignSurface: () => { if (taskBased) setActiveSurface('design') },
  })
  const experienceSidebar = experienceSurface === 'menu' ? (
    <ThemeEditorSidebar
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
      onSelectGroup={(groupId) => { selectGroup(groupId); if (taskBased) setActiveSurface('design') }}
      onSelectPageBlock={(block) => { selectPageBlock(block); if (taskBased) setActiveSurface('design') }}
      onDragStart={setDragBlockKey}
      onDragEnd={() => setDragBlockKey(null)}
      onDrop={handlePageBlockDrop}
      onMove={handlePageBlockKeyboardMove}
      onRemoveSection={handleRemoveSection}
      onOpenSectionPicker={openSectionPicker}
    />
  ) : (
    <ThemeExperienceSidebar
      width={leftPanelWidth}
      surface={experienceSurface}
      theme={previewTheme}
      selectedSectionId={selectedHomeSectionId}
      authState={authState}
      checkoutState={checkoutState}
      sectionTriggerRef={sectionTriggerRef}
      onSelectSection={(id) => { setSelectedHomeSectionId(id); if (taskBased) setActiveSurface('design') }}
      onSelectShared={(target) => {
        setSelectedHomeSectionId(target === 'header' ? '__shared-header' : '__shared-footer')
        selectGroup(target)
        if (taskBased) setActiveSurface('design')
      }}
      onOpenSectionPicker={homeEditor.open}
      onAuthStateChange={setAuthState}
      onCheckoutStateChange={setCheckoutState}
      onPatch={updateThemePatch}
    />
  )
  const sharedChromeActive = experienceSurface === 'home' && (selectedHomeSectionId === '__shared-header' || selectedHomeSectionId === '__shared-footer')
  const menuOrSharedProperties = (
    <ThemeEditorPropertiesWorkspace
      width={rightPanelWidth}
      activeGroup={activeGroup}
      activeGroupData={activeGroupData}
      selectedSection={sharedChromeActive ? null : selectedSection}
      selectedSectionId={sharedChromeActive ? null : selectedSectionId}
      selectedSectionBlock={sharedChromeActive ? null : selectedSectionBlock}
      selectedSectionSettings={sharedChromeActive ? {} : selectedSectionSettings}
      visibleEditorTabs={visibleEditorTabs}
      effectiveEditorTab={effectiveEditorTab}
      visibleFields={visibleFields}
      visibleSectionFields={visibleSectionFields}
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
        <GalleryUploadPanel restaurantId={restaurantId} values={selectedSectionSettings} onChange={(key, value) => handleSectionSettingChange(selectedSectionId, key, value)} />
      ) : effectiveEditorTab === 'design' && selectedSectionId && selectedSectionDefinitionId === 'hero-banner' ? (
        <SectionImageUploadPanel restaurantId={restaurantId} label="Hero Banner" value={selectedSectionSettings.imageUrl ?? ''} onChange={(value) => handleSectionSettingChange(selectedSectionId, 'imageUrl', value)} />
      ) : effectiveEditorTab === 'design' && selectedSectionId && selectedSectionDefinitionId === 'promo-slider' ? (
        <PromoSliderImageUploadPanel restaurantId={restaurantId} values={selectedSectionSettings} onChange={(key, value) => handleSectionSettingChange(selectedSectionId, key, value)} />
      ) : effectiveEditorTab === 'design' && selectedSectionId && selectedSectionDefinitionId === 'chef-pick' ? (
        <ChefPickIconUploadPanels restaurantId={restaurantId} values={selectedSectionSettings} onChange={(key, value) => handleSectionSettingChange(selectedSectionId, key, value)} />
      ) : effectiveEditorTab === 'content' && selectedSectionId && selectedSectionDefinitionId === 'request-buttons' ? (
        <ServiceRequestIconUploadPanels restaurantId={restaurantId} values={selectedSectionSettings} onChange={(key, value) => handleSectionSettingChange(selectedSectionId, key, value)} />
      ) : undefined}
      onTabChange={setActiveEditorTab}
      onReset={handleResetCurrentSettings}
      onCopy={handleCopyCurrentSettings}
      onFieldChange={handleFieldChange}
      onSectionSettingChange={(key, value) => { if (selectedSectionId) handleSectionSettingChange(selectedSectionId, key, value) }}
      onSectionVisibilityChange={handleSectionVisibilityChange}
      onSectionPlacementChange={handleSectionPlacementChange}
    />
  )
  const experienceProperties = experienceSurface === 'menu' || sharedChromeActive ? menuOrSharedProperties : (
    <ThemeExperienceProperties
      width={rightPanelWidth}
      restaurantId={restaurantId}
      canAddAdvancedSections={canAddAdvancedSections}
      surface={experienceSurface}
      authState={authState}
      checkoutState={checkoutState}
      theme={previewTheme}
      selectedSectionId={selectedHomeSectionId}
      menuCategories={menuCategories}
      menuItems={menuItems}
      onPatch={updateThemePatch}
    />
  )
  return (
    <ThemeEditorShell
      taskBased={taskBased}
      activeSurface={activeSurface}
      onSurfaceChange={setActiveSurface}
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
        savingDraft={savingDraft}
        publishing={publishing}
        hasUnpublishedChanges={hasUnpublishedChanges}
        publishBlockedReason={authContrastIssues.length > 0 ? 'Giriş yüzeyindeki kritik kontrast sorunlarını düzelt' : checkoutContrastIssues.length > 0 ? 'Checkout yüzeyindeki kritik kontrast sorunlarını düzelt' : undefined}
        onPreviewModeChange={setPreviewMode}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onOpenPreview={openPreview}
        onSave={handleSave}
        onPublish={handlePublish}
      />}
      sidebar={experienceSidebar}
      canvas={<ThemeEditorCanvas
        iframeRef={iframeRef}
        previewUrl={previewUrl}
        previewStatus={previewStatus}
        previewTheme={previewTheme}
        previewMode={previewMode}
        previewScale={previewScale}
        isTaskBased={taskBased}
        experienceSurface={experienceSurface}
        homeEnabled={homeEnabled}
        experienceV2Enabled={experienceV2Enabled}
        onPreviewRetry={reloadPreviewFrame}
        onPreviewLoad={handlePreviewFrameLoad} onPreviewError={handlePreviewFrameError}
        onPreviewModeChange={setPreviewMode}
        onExperienceSurfaceChange={setExperienceSurface}
        onZoom={changeZoom}
        onFit={fitPreview}
      />}
      properties={experienceProperties}
      dialogs={experienceSurface === 'menu' || experienceSurface === 'home' ? <ThemeEditorDialogsLayer
        sectionPickerOpen={sectionPickerOpen}
        sectionCloseRef={sectionCloseRef}
        previewTheme={previewTheme}
        restaurantName={restaurantName}
        restaurantSettings={restaurantSettings}
        menuCategories={menuCategories}
        menuItems={menuItems}
        sectionSearch={sectionSearch}
        sectionGroup={sectionGroup}
        surface={experienceSurface}
        sections={experienceSurface === 'home' ? HOME_SECTION_LIBRARY : SECTION_LIBRARY}
        groups={experienceSurface === 'home' ? homeEditor.groups : menuSectionGroups}
        filteredSections={experienceSurface === 'home' ? homeEditor.filteredSections : filteredSections}
        activeSections={experienceSurface === 'home'
          ? homeEditor.state.home.blocks.map((block) => block.sectionId)
          : activeSectionDefinitionIds}
        canAddAdvancedSections={canAddAdvancedSections}
        setSectionSearch={setSectionSearch}
        setSectionGroup={setSectionGroup}
        onSectionAdd={experienceSurface === 'home' ? homeEditor.add : handleAddSection}
        onLockedSection={() => flashToast('Bu bölüm Pro pakette kullanılabilir.')}
        onSectionClose={closeSectionPicker}
      /> : null}
    />
  )
}
