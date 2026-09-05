'use client'
import { useMemo } from 'react'
import { THEME_REGISTRY, type SettingsGroup } from '@garsonless/ui/themes'
import { buildMenuCartContrastRepairPatch, buildMenuFooterContrastRepairPatch, buildMenuThemeContrastRepairPatch, CANONICAL_THEME_ID, createRevealMenuPageBlockCommand, resolveMenuHeaderTheme, type GarsonlessTheme } from '@garsonless/design-engine'
import { useShell } from '../../lib/shell-context'
import { ThemeEditorTopbar } from './ThemeEditorTopbar'; import { ThemeEditorCanvas } from './ThemeEditorCanvas'
import { ThemeExperienceProperties, ThemeExperienceSidebar } from './ThemeExperiencePanels'
import { ThemeEditorDialogsLayer } from './ThemeEditorDialogsLayer'; import { ThemeEditorPropertiesWorkspace } from './ThemeEditorPropertiesWorkspace'
import { ThemeEditorShell } from './ThemeEditorShell'; import { ThemeEditorSidebar } from './ThemeEditorSidebar'
import { ChefPickIconUploadPanels, GalleryUploadPanel, PromoSliderImageUploadPanel, SectionImageUploadPanel, ServiceRequestIconUploadPanels } from './ThemeSectionSettings'
import { ThemeLogoUploadCard } from './ThemeLogoUploadCard'
import { useThemeEditorLifecycle } from './use-theme-editor-lifecycle'; import { useThemeEditorLogo } from './use-theme-editor-logo'
import { useThemeEditorNavigation } from './use-theme-editor-navigation'; import { useThemeEditorCoupons } from './use-theme-editor-coupons'
import { useThemeEditorPropertyCommands } from './use-theme-editor-property-commands'; import { useThemeEditorWorkspace } from './use-theme-editor-workspace'; import { useThemeEditorCartPreview } from './use-theme-editor-cart-preview'
import { useThemeEditorChromeScope } from './use-theme-editor-chrome-scope'; import { buildMenuHeaderContrastRepairPatch } from './menu-header-editor-scope'
import { useThemeEditorDrawerPreview } from './use-theme-editor-drawer-preview'; import { useThemePublishGuidance } from './use-theme-publish-guidance'; import { useThemeExperienceSurface } from './use-theme-experience-surface'; import { buildEditorNavigation, buildThemeSettingsGroup, restrictOrderingThemeSchema } from './theme-editor-navigation-catalog'
import { getThemeEditorSaveStatus } from './theme-editor-shell-model'; import { createThemeEditorPreviewDeriver } from './theme-editor-preview-theme-model'
import { HOME_SECTION_LIBRARY, SECTION_GROUPS, SECTION_LIBRARY } from './theme-editor-section-registry'; import { createHomeThemeEditorController } from './home-theme-editor-controller'; import { resolveFooterStoreDataAvailability } from './footer-store-data'
import { projectHomeV2ForEditor } from './home-theme-editor-model'; import { buildThemePreviewUrl } from './theme-preview-url'; import type { ThemeEditorClientProps } from './theme-editor-client-contract'
export default function ThemeEditorClient({ restaurantId, restaurantSlug, restaurantName, restaurantLogoUrl,
  canAddAdvancedSections, canUseVideoHero, canUseGuestOrdering, experienceV2Enabled, previewAccessToken, templateId, initialPersistence, restaurantSettings, initialCouponOptions, menuCategories, menuItems }: ThemeEditorClientProps) {
  const entry = THEME_REGISTRY[CANONICAL_THEME_ID]!
  const fullSchema: SettingsGroup[] = entry.SETTINGS_SCHEMA
  const schema = useMemo(() => restrictOrderingThemeSchema(fullSchema, canUseGuestOrdering), [canUseGuestOrdering, fullSchema])
  const { setNavigationGuard } = useShell()
  const menuBaseUrl = process.env.NEXT_PUBLIC_MENU_URL ?? 'http://localhost:3011'
  const initialHomeEnabled = initialPersistence.initialTheme.surfaces?.home.enabled === true
  const { surface: experienceSurface, setSurface: setExperienceSurface, authState, setAuthState,
    accountState, setAccountState, checkoutState, setCheckoutState, selectedHomeSectionId, setSelectedHomeSectionId,
  } = useThemeExperienceSurface(initialHomeEnabled, experienceV2Enabled,
    initialPersistence.initialTheme.surfaces?.home.blocks?.[0]?.id ?? initialPersistence.initialTheme.surfaces?.home.sections[0]?.id ?? null)
  const previewContext = useMemo(() => ({
    surface: experienceSurface,
    ...(experienceSurface === 'auth' ? { state: authState } : {}),
    ...(experienceSurface === 'account' ? { state: accountState } : {}),
    ...(experienceSurface === 'checkout' ? { state: checkoutState } : {}),
  }) as const, [accountState, authState, checkoutState, experienceSurface])
  const previewUrl = useMemo(() => buildThemePreviewUrl({ menuBaseUrl, restaurantSlug, templateId, previewAccessToken, surface: experienceSurface, authState, accountState, checkoutState }), [accountState, authState, checkoutState, experienceSurface, menuBaseUrl, previewAccessToken, restaurantSlug, templateId])
  const derivePreviewTheme = useMemo(() => {
    const deriveBaseTheme = createThemeEditorPreviewDeriver(entry.THEME_DEFAULTS, menuCategories)
    return (overrides: Partial<GarsonlessTheme>) => projectHomeV2ForEditor(deriveBaseTheme(overrides))
  }, [entry.THEME_DEFAULTS, menuCategories])
  const {
    overrides, previewTheme, iframeRef, previewFrameUrl,
    previewStatus, reloadPreviewFrame, handlePreviewFrameLoad, handlePreviewFrameError,
    savingDraft, publishing, toast, hasUnsavedChanges, lastSavedAt, lastPublishedAt,
    hasUnpublishedChanges, authContrastIssues, checkoutContrastIssues, menuHeaderContrastIssues, menuNavigationContrastIssues, menuCardContrastIssues, menuCartContrastIssues, menuFooterContrastIssues, menuThemeContrastIssues, unsavedFieldLabels, canUndo, canRedo, flashToast, postPreviewMessage,
    handleUndo, handleRedo, handleFieldChange, updateThemePatch, retireThemeMediaUrl, handleSave, handlePublish,
  } = useThemeEditorLifecycle({
    restaurantId, templateId, previewUrl, ...initialPersistence,
    defaults: entry.THEME_DEFAULTS, schema, derivePreviewTheme, setNavigationGuard,
    previewContext, onPreviewSurfaceNavigation: setExperienceSurface, menuItems, canAddAdvancedSections, canUseVideoHero,
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
  const mergedTheme = useMemo(() => ({ ...entry.THEME_DEFAULTS, ...overrides }) as GarsonlessTheme,
    [entry.THEME_DEFAULTS, overrides])
  const resolvedMenuPreviewTheme = useMemo(() => resolveMenuHeaderTheme(previewTheme), [previewTheme])
  const editorMergedTheme = experienceSurface === 'menu' ? resolvedMenuPreviewTheme : mergedTheme
  const couponOptions = useThemeEditorCoupons(restaurantId, initialCouponOptions)
  const footerStoreDataAvailability = useMemo(() => resolveFooterStoreDataAvailability(restaurantSettings), [restaurantSettings])
  const themeGroupData = buildThemeSettingsGroup(schema)
  const navGroups = buildEditorNavigation(fullSchema, entry.name, canUseGuestOrdering ? new Set() : new Set(['cart']))
  const {
    activeGroup, sectionPickerOpen, sectionSearch, editorSearch, editorQuery, sectionGroup,
    selectedSectionId, selectedPageBlockKey, pageFlowStatus, selectedSectionDefinitionId, selectedSectionBlock, dragBlockKey,
    sectionTriggerRef, sectionCloseRef, pageBlocks, activeSectionDefinitionIds, activeGroupData,
    filteredNavGroups, selectedSection, selectedSectionSettings, visibleEditorTabs, effectiveEditorTab,
    visibleFields, visibleSectionFields, filteredSections, filteredPageBlocks,
    setSectionSearch, setEditorSearch, setSectionGroup, setDragBlockKey, setActiveEditorTab,
    openSectionPicker, closeSectionPicker, addSection: handleAddSection, removeSection: handleRemoveSection,
    changeSectionSetting: handleSectionSettingChange, changeSectionSettings: handleSectionSettingsChange, changeSectionVisibility: handleSectionVisibilityChange,
    changeSectionPlacement: handleSectionPlacementChange, dropPageBlock: handlePageBlockDrop,
    movePageBlock: handlePageBlockKeyboardMove, selectGroup, selectPageBlock,
  } = useThemeEditorNavigation({
    schema,
    themeGroupData,
    navGroups,
    mergedTheme: editorMergedTheme,
    previewTheme,
    menuCategories,
    menuItems,
    updateThemePatch,
    flashToast,
    onRevealPageBlock: (block) => postPreviewMessage(createRevealMenuPageBlockCommand({ kind: block.type, id: block.id })),
  })
  const { cartPreviewState, setCartPreviewState } = useThemeEditorCartPreview({ activeGroup, previewStatus, postPreviewMessage })
  const openOrderingUpsell = () => { flashToast('Sepet ve checkout Pro pakette kullanılabilir.'); window.location.assign(`/dashboard/${restaurantId}/settings?section=billing`) }
  useThemeEditorDrawerPreview({ activeGroup, iframeRef, previewStatus, previewUrl, selectedSectionDefinitionId,
    selectedSectionPlacement: selectedSectionBlock?.placement, selectedServicePlacement: resolvedMenuPreviewTheme.servicePlacement })
  const { copyCurrentSettings: handleCopyCurrentSettings, resetCurrentSettings: handleResetCurrentSettings } = useThemeEditorPropertyCommands({
    activeGroup,
    activeGroupData,
    selectedSectionId,
    mergedTheme: editorMergedTheme,
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
  const { publishBlockedReason, handlePublishRequest } = useThemePublishGuidance({ authContrastIssues, checkoutContrastIssues, menuHeaderContrastIssues, menuNavigationContrastIssues, menuCardContrastIssues, menuCartContrastIssues, menuFooterContrastIssues, menuThemeContrastIssues, taskBased, setExperienceSurface, setAuthState, setCheckoutState, setActiveSurface, flashToast, handlePublish })
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
      selectedPageBlockKey={selectedPageBlockKey}
      pageFlowStatus={pageFlowStatus}
      dragBlockKey={dragBlockKey}
      sectionTriggerRef={sectionTriggerRef}
      onEditorSearchChange={setEditorSearch}
      onSelectGroup={(groupId) => { selectGroup(groupId); if (taskBased) setActiveSurface('design') }}
      onSelectLockedGroup={openOrderingUpsell}
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
      accountState={accountState}
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
      onAccountStateChange={setAccountState}
      onCheckoutStateChange={setCheckoutState}
      onPatch={updateThemePatch} onRetireMedia={retireThemeMediaUrl}
    />
  )
  const chromeScope = useThemeEditorChromeScope({ activeGroup, activeGroupData, experienceSurface, selectedHomeSectionId, previewTheme, resolvedMenuPreviewTheme, overrides, defaults: entry.THEME_DEFAULTS, updateThemePatch, flashToast }); const { sharedChromeActive, menuHeaderActive } = chromeScope
  const menuOrSharedProperties = (
    <ThemeEditorPropertiesWorkspace
      couponOptions={couponOptions} width={rightPanelWidth}
      activeGroup={activeGroup} activeGroupData={activeGroupData}
      selectedSection={sharedChromeActive ? null : selectedSection} selectedSectionId={sharedChromeActive ? null : selectedSectionId}
      selectedSectionBlock={sharedChromeActive ? null : selectedSectionBlock} selectedSectionSettings={sharedChromeActive ? {} : selectedSectionSettings}
      visibleEditorTabs={visibleEditorTabs} effectiveEditorTab={effectiveEditorTab}
      visibleFields={visibleFields} visibleSectionFields={visibleSectionFields}
      mergedTheme={chromeScope.theme} overrides={chromeScope.overrides} defaults={chromeScope.defaults}
      schema={schema} menuCategories={menuCategories} menuItems={menuItems}
      menuHref={`/dashboard/${restaurantId}/menu`}
      footerStoreDataAvailability={footerStoreDataAvailability} storeSettingsHref={`/dashboard/${restaurantId}/settings?section=store`}
      scopeNotice={menuHeaderActive ? 'Bu panel yalnız Menü Header görünümünü değiştirir. Ana Sayfa Header ortak temel ayarlarını ve kendi özel ayarlarını korur.' : undefined}
      themeContrastIssues={menuThemeContrastIssues}
      contrastIssues={menuHeaderActive ? menuHeaderContrastIssues : activeGroup === 'nav' ? menuNavigationContrastIssues : activeGroup === 'cards' ? menuCardContrastIssues : activeGroup === 'cart' ? menuCartContrastIssues : activeGroup === 'footer' && effectiveEditorTab === 'design' ? menuFooterContrastIssues : undefined}
      contrastRepairLabel={menuHeaderActive && menuHeaderContrastIssues.length > 0 ? 'Header renklerini güvenli hale getir' : activeGroup === 'nav' && menuNavigationContrastIssues.length > 0 ? 'Navigasyon paletini güvenli hale getir' : activeGroup === 'cards' && menuCardContrastIssues.length > 0 ? 'Kart paletini güvenli değerlere getir' : activeGroup === 'cart' && menuCartContrastIssues.length > 0 ? 'Sepet paletini güvenli hale getir' : activeGroup === 'footer' && menuFooterContrastIssues.length > 0 ? 'Footer tonunu güvenli hale getir' : undefined}
      onContrastRepair={menuHeaderActive && menuHeaderContrastIssues.length > 0 ? () => updateThemePatch(buildMenuHeaderContrastRepairPatch(previewTheme)) : activeGroup === 'nav' && menuNavigationContrastIssues.length > 0 ? () => updateThemePatch({
        bg: '#f8f9f8',
        cardColor: '#ffffff',
        mutedTextColor: '#4b5563',
        accent: '#166534',
        accentSoft: '#dcfce7',
        ctaTextColor: '#ffffff',
        catnavOverlayColor: '#111827',
        catnavOverlayTextColor: '#ffffff',
      }) : activeGroup === 'cards' && menuCardContrastIssues.length > 0 ? () => updateThemePatch({
        bg: '#f8f9f8',
        cardColor: '#ffffff',
        textColor: '#1c1d20',
        mutedTextColor: '#4b5563',
        accent: '#166534',
        cta: '#166534',
        ctaTextColor: '#ffffff',
      }) : activeGroup === 'cart' && menuCartContrastIssues.length > 0 ? () => updateThemePatch(buildMenuCartContrastRepairPatch(previewTheme)) : activeGroup === 'footer' && menuFooterContrastIssues.length > 0 ? () => updateThemePatch(buildMenuFooterContrastRepairPatch(previewTheme)) : undefined}
      onThemeContrastRepair={() => updateThemePatch(buildMenuThemeContrastRepairPatch(previewTheme))}
      cartPreviewState={cartPreviewState} onCartPreviewStateChange={setCartPreviewState}
      inheritanceNotice={chromeScope.inheritanceTarget ? { target: chromeScope.inheritanceTarget === 'header' ? 'Header' : 'Footer', customized: chromeScope.customized } : undefined}
      logoCard={activeGroup === 'header' && chromeScope.theme.headerLogoStyle === 'image' && effectiveEditorTab === 'design' ? (
        <ThemeLogoUploadCard logoUrl={localLogoUrl} uploading={logoUploading} onUpload={handleLogoUpload} onRemove={handleLogoRemove} />
      ) : undefined}
      sectionMediaPanel={effectiveEditorTab === 'content' && selectedSectionId && selectedSectionDefinitionId === 'gallery' ? (
        <GalleryUploadPanel restaurantId={restaurantId} values={selectedSectionSettings} onPatch={(patch) => handleSectionSettingsChange(selectedSectionId, patch)} onRetireMedia={retireThemeMediaUrl} />
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
      onReset={chromeScope.active ? chromeScope.reset : handleResetCurrentSettings}
      onCopy={chromeScope.active ? () => { void chromeScope.copy() } : handleCopyCurrentSettings}
      onFieldChange={chromeScope.active ? chromeScope.changeField : handleFieldChange}
      onThemePatch={updateThemePatch}
      onSectionSettingChange={(key, value) => { if (selectedSectionId) handleSectionSettingChange(selectedSectionId, key, value) }}
      onSectionSettingsChange={(patch) => { if (selectedSectionId) handleSectionSettingsChange(selectedSectionId, patch) }}
      onSectionVisibilityChange={handleSectionVisibilityChange}
      onSectionPlacementChange={handleSectionPlacementChange}
    />
  )
  const experienceProperties = experienceSurface === 'menu' || sharedChromeActive ? menuOrSharedProperties : (
    <ThemeExperienceProperties
      width={rightPanelWidth}
      restaurantId={restaurantId}
      canAddAdvancedSections={canAddAdvancedSections} canUseVideoHero={canUseVideoHero}
      surface={experienceSurface}
      authState={authState}
      accountState={accountState}
      checkoutState={checkoutState}
      theme={previewTheme}
      selectedSectionId={selectedHomeSectionId}
      couponOptions={couponOptions}
      menuCategories={menuCategories} menuItems={menuItems}
      onPatch={updateThemePatch}
      onRetireMedia={retireThemeMediaUrl}
    />
  )
  return (
    <ThemeEditorShell
      taskBased={taskBased} activeSurface={activeSurface} onSurfaceChange={setActiveSurface} toastMessage={toast}
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
        publishBlockedReason={publishBlockedReason}
        onPreviewModeChange={setPreviewMode}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onOpenPreview={openPreview}
        onSave={handleSave}
        onPublish={handlePublishRequest}
      />}
      sidebar={experienceSidebar}
      canvas={<ThemeEditorCanvas
        iframeRef={iframeRef}
        previewUrl={previewUrl} previewFrameUrl={previewFrameUrl}
        previewStatus={previewStatus}
        previewMode={previewMode}
        previewScale={previewScale}
        isTaskBased={taskBased}
        experienceSurface={experienceSurface}
        homeEnabled={homeEnabled}
        experienceV2Enabled={experienceV2Enabled}
        canUseGuestOrdering={canUseGuestOrdering}
        onPreviewRetry={reloadPreviewFrame}
        onPreviewLoad={handlePreviewFrameLoad} onPreviewError={handlePreviewFrameError}
        onPreviewModeChange={setPreviewMode}
        onExperienceSurfaceChange={setExperienceSurface}
        onLockedExperienceSurface={openOrderingUpsell}
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
        canAddAdvancedSections={canAddAdvancedSections} canUseVideoHero={canUseVideoHero}
        setSectionSearch={setSectionSearch} setSectionGroup={setSectionGroup}
        onSectionAdd={experienceSurface === 'home' ? homeEditor.add : handleAddSection}
        onLockedSection={() => flashToast('Bu bölüm mevcut paketinde kullanılabilir değil.')}
        onSectionClose={closeSectionPicker}
      /> : null} />
  )}
