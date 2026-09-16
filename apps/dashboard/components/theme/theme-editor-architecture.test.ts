import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const directory = fileURLToPath(new URL(".", import.meta.url));
const clientSource = readFileSync(`${directory}/ThemeEditorClient.tsx`, "utf8");
const sidebarSource = readFileSync(
  `${directory}/ThemeEditorSidebar.tsx`,
  "utf8",
);
const experiencePanelsSource = readFileSync(
  `${directory}/ThemeExperiencePanels.tsx`,
  "utf8",
);
const dialogsSource = readFileSync(
  `${directory}/ThemeEditorDialogs.tsx`,
  "utf8",
);
const canonicalSectionPreviewSource = readFileSync(
  `${directory}/CanonicalSectionPreview.tsx`,
  "utf8",
);
const customSectionRendererSource = readFileSync(
  `${directory}/../../../../packages/ui/src/themes/default/sections/CustomSectionRenderer.tsx`,
  "utf8",
);
const menuFooterSource = readFileSync(
  `${directory}/../../../../packages/ui/src/menu/MenuFooter.tsx`,
  "utf8",
);
const footerPreviewSource = readFileSync(
  `${directory}/use-theme-editor-drawer-preview.ts`,
  "utf8",
);
const sectionRegistrySource = readFileSync(
  `${directory}/theme-editor-section-registry.ts`,
  "utf8",
);
const lifecycleSource = readFileSync(
  `${directory}/use-theme-editor-lifecycle.ts`,
  "utf8",
);
const publishContractSource = readFileSync(
  `${directory}/theme-publish-contract.ts`,
  "utf8",
);
const publishActionSource = readFileSync(
  `${directory}/../../lib/actions/theme.ts`,
  "utf8",
);
const workspaceSource = readFileSync(
  `${directory}/use-theme-editor-workspace.ts`,
  "utf8",
);
const workspaceModelSource = readFileSync(
  `${directory}/theme-editor-workspace-model.ts`,
  "utf8",
);
const canvasSource = readFileSync(`${directory}/ThemeEditorCanvas.tsx`, "utf8");
const topbarSource = readFileSync(`${directory}/ThemeEditorTopbar.tsx`, "utf8");
const propertiesFrameSource = readFileSync(`${directory}/ThemePropertiesFrame.tsx`, "utf8");
const previewSurfaceSource = readFileSync(
  `${directory}/ThemePreviewSurface.tsx`,
  "utf8",
);
const previewBridgeSource = readFileSync(
  `${directory}/use-theme-preview-bridge.ts`,
  "utf8",
);
const propertiesWorkspaceSource = readFileSync(
  `${directory}/ThemeEditorPropertiesWorkspace.tsx`,
  "utf8",
);
const propertyPanelsSource = readFileSync(
  `${directory}/ThemePropertyPanels.tsx`,
  "utf8",
);
const footerPropertyPanelSource = readFileSync(
  `${directory}/FooterPropertyPanel.tsx`,
  "utf8",
);
const menuFilterPropertyEditorSource = readFileSync(
  `${directory}/MenuFilterPropertyEditor.tsx`,
  "utf8",
);
const propertyControlsSource = readFileSync(
  `${directory}/ThemePropertyControls.tsx`,
  "utf8",
);
const sliderSource = readFileSync(`${directory}/../ui/slider.tsx`, "utf8");
const layoutDensityModelSource = readFileSync(
  `${directory}/layout-density-model.ts`,
  "utf8",
);
const cardPropertyOptionIconSource = readFileSync(
  `${directory}/CardPropertyOptionIcon.tsx`,
  "utf8",
);
const cardLayoutOptionIconSource = readFileSync(
  `${directory}/CardLayoutOptionIcon.tsx`,
  "utf8",
);
const navigationOptionIconSource = readFileSync(
  `${directory}/NavigationOptionIcon.tsx`,
  "utf8",
);
const headerOptionIconSource = readFileSync(
  `${directory}/HeaderOptionIcon.tsx`,
  "utf8",
);
const layoutOptionIconSource = readFileSync(
  `${directory}/LayoutOptionIcon.tsx`,
  "utf8",
);
const cartOptionIconSource = readFileSync(
  `${directory}/CartOptionIcon.tsx`,
  "utf8",
);
const logoControllerSource = readFileSync(
  `${directory}/use-theme-editor-logo.ts`,
  "utf8",
);
const logoCardSource = readFileSync(
  `${directory}/ThemeLogoUploadCard.tsx`,
  "utf8",
);
const navigationSource = readFileSync(
  `${directory}/use-theme-editor-navigation.ts`,
  "utf8",
);
const propertyCommandsSource = readFileSync(
  `${directory}/use-theme-editor-property-commands.ts`,
  "utf8",
);
const propertyCommandModelSource = readFileSync(
  `${directory}/theme-editor-property-command-model.ts`,
  "utf8",
);
const shellModelSource = readFileSync(
  `${directory}/theme-editor-shell-model.ts`,
  "utf8",
);
const toastSource = readFileSync(`${directory}/ThemeEditorToast.tsx`, "utf8");
const navigationCatalogSource = readFileSync(
  `${directory}/theme-editor-navigation-catalog.tsx`,
  "utf8",
);
const shellSource = readFileSync(`${directory}/ThemeEditorShell.tsx`, "utf8");
const dialogsLayerSource = readFileSync(
  `${directory}/ThemeEditorDialogsLayer.tsx`,
  "utf8",
);
const previewThemeModelSource = readFileSync(
  `${directory}/theme-editor-preview-theme-model.ts`,
  "utf8",
);

test("section catalogue gives an unconfigured promo slider a safe mock preview", () => {
  assert.match(canonicalSectionPreviewSource, /buildPromoSliderCatalogMock/);
  assert.match(
    canonicalSectionPreviewSource,
    /sectionId === 'promo-slider' && derivedActiveCampaigns\.length === 0/,
  );
  assert.match(canonicalSectionPreviewSource, /sourceMode: 'active'/);
  assert.match(canonicalSectionPreviewSource, /activeCampaignIds: ''/);
});

test("theme editor orchestrator delegates sidebar rendering", () => {
  assert.match(clientSource, /import \{ ThemeEditorSidebar \}/);
  assert.match(clientSource, /<ThemeEditorSidebar/);
  assert.doesNotMatch(clientSource, /<div\s+[^>]*data-page-flow-row/s);
  assert.doesNotMatch(clientSource, /<aside/);
});

test("theme editor sidebar keeps page-flow behavior behind the shared model", () => {
  assert.match(sidebarSource, /from '\.\/theme-page-flow-model'/);
  assert.match(sidebarSource, /pageBlockKey\(block\)/);
  assert.match(
    sidebarSource,
    /getCategoryParentId\(menuCategories, block\.id\)/,
  );
  assert.match(sidebarSource, /aria-label="Tema bölümlerinde ara"/);
});

test("page-flow hover belongs to the outer row instead of the inner label button", () => {
  assert.match(sidebarSource, /data-page-flow-select/);
  assert.match(shellSource, /\[data-page-flow-select\]:not\(:disabled\):hover/);
  assert.match(shellSource, /box-shadow: none !important/);
  assert.match(shellSource, /transform: none !important/);
});

test("home section hover does not draw a second frame around the label button", () => {
  assert.match(experiencePanelsSource, /data-section-select/);
  assert.match(experiencePanelsSource, /hover:bg-muted hover:text-foreground/);
  assert.match(shellSource, /\[data-section-select\]:not\(:disabled\):hover/);
});

test("page-flow rows reserve compact columns for text and ordering actions", () => {
  assert.match(sidebarSource, /ItemActions, ItemContent, ItemDescription, ItemMedia, ItemTitle/);
  assert.match(sidebarSource, /data-page-flow-drag-handle/);
  assert.match(sidebarSource, /data-page-flow-content/);
  assert.match(sidebarSource, /data-page-flow-actions/);
  assert.match(sidebarSource, /min-h-12 flex-nowrap gap-1/);
  assert.match(sidebarSource, /className="w-full truncate"/);
  assert.match(sidebarSource, /getKeyboardMoveTarget\(pageBlocks, menuCategories, key, -1\)/);
  assert.match(sidebarSource, /<DropdownMenuTrigger/);
  assert.match(sidebarSource, /className="size-11"/);
  assert.match(sidebarSource, /Bölümü kaldır/);
  assert.match(sidebarSource, /data-page-flow-add className="relative px-1 pb-1 pt-3"/);
  assert.match(sidebarSource, /variant="outline"[\s\S]*?min-h-11 w-full border-dashed[\s\S]*?Bölüm ekle/);
});

test("page-flow search, selection and hierarchy expose explicit editor semantics", () => {
  assert.match(sidebarSource, /aria-current=\{selected \? 'location' : undefined\}/);
  assert.match(sidebarSource, /<ol aria-label=\{label\}/);
  assert.match(sidebarSource, /Sayfa akışında eşleşme bulunamadı/);
  assert.match(sidebarSource, /role="status" aria-live="polite"/);
  assert.match(navigationSource, /selectedPageBlockKey/);
  assert.match(navigationSource, /filterPageBlocksForQuery/);
});

test("section picker selection and hover states preserve the card preview", () => {
  assert.match(dialogsSource, /isSelected \? 'ring-2 ring-inset ring-primary' : 'hover:-translate-y-0\.5 hover:ring-muted-foreground\/40 hover:shadow-md'/);
  assert.match(
    dialogsSource,
    /section-picker-card-select absolute inset-0[^"\n]*bg-transparent[^"\n]*hover:bg-transparent[^"\n]*focus-visible:ring-inset[^"\n]*active:translate-y-0/,
  );
  assert.match(dialogsSource, /\.section-picker-card-select:hover \{[\s\S]*?background: transparent !important/);
  assert.doesNotMatch(dialogsSource, /\.section-picker-card-select:focus-visible,/);
  assert.match(dialogsSource, /\.section-picker-close,[\s\S]*?min-height: 44px !important/);
  assert.match(dialogsSource, /section-picker-search h-11 w-52/);
  assert.match(dialogsSource, /\.section-picker-chip \{[\s\S]*?min-height: 44px !important/);
});

test("card property tiles use the dedicated twelve-icon SVG set", () => {
  assert.match(propertyControlsSource, /CardPropertyOptionIcon/);
  for (const fieldId of [
    "cardHover",
    "cardPlaceholderStyle",
    "cardCtaStyle",
    "cardCtaIcon",
  ]) {
    assert.match(cardPropertyOptionIconSource, new RegExp(fieldId));
  }
  for (const value of [
    "none",
    "lift",
    "glow",
    "neutral",
    "accent",
    "outline",
    "icon",
    "pill",
    "full",
    "plus",
    "cart",
    "bag",
  ]) {
    assert.match(cardPropertyOptionIconSource, new RegExp(`value === "${value}"`));
  }
});

test("card design panel exposes the global tag shimmer switch in a visible section", () => {
  assert.match(propertyPanelsSource, /title: "Etiketler", ids: \["tagShimmer"\]/);
  assert.match(propertyPanelsSource, /Kampanya, fırsat ve ürün rozetlerinde parlak ışık geçişini birlikte açar/);
});

test("card layout and property chrome use the dedicated nineteen-icon SVG set", () => {
  assert.match(propertyControlsSource, /CardLayoutOptionIcon/);
  assert.match(propertyControlsSource, /ThemeEditorControlIcon/);
  for (const fieldId of [
    "cardLayout",
    "cardDensity",
    "cardPriceAlign",
    "cardImageFit",
    "cardImagePosition",
  ]) {
    assert.match(cardLayoutOptionIconSource, new RegExp(fieldId));
  }
  for (const value of [
    "vertical",
    "horizontal",
    "minimal",
    "compact",
    "normal",
    "spacious",
    "left",
    "right",
    "cover",
    "contain",
    "top",
    "center",
    "bottom",
  ]) {
    assert.match(cardLayoutOptionIconSource, new RegExp(`value === "${value}"`));
  }
  for (const name of ["copy", "history", "menu", "down", "minus", "plus"]) {
    assert.match(cardLayoutOptionIconSource, new RegExp(`name === "${name}"`));
  }
});

test("navigation design and layout tiles use the dedicated twenty-icon SVG set", () => {
  assert.match(propertyControlsSource, /NavigationOptionIcon/);
  for (const fieldId of [
    "catnavStyle",
    "catnavActiveStyle",
    "catnavAlign",
    "catnavDensity",
  ]) {
    assert.match(navigationOptionIconSource, new RegExp(fieldId));
  }
  for (const value of [
    "pills",
    "visual",
    "underline",
    "segmented",
    "dots",
    "outlined",
    "filled",
    "soft",
    "outline",
    "left",
    "center",
    "spread",
    "compact",
    "normal",
    "comfortable",
  ]) {
    assert.match(navigationOptionIconSource, new RegExp(`value === "${value}"`));
  }
});

test("navigation content lets businesses configure preset and product-backed manual filters", () => {
  assert.match(propertyPanelsSource, /from ["']\.\/MenuFilterPropertyEditor["']/);
  assert.match(propertyPanelsSource, /<MenuFilterPropertyEditor/);
  assert.match(menuFilterPropertyEditorSource, /MenuFilterPresetId, ThemeMenuCustomFilter/);
  assert.match(menuFilterPropertyEditorSource, /<Checkbox/);
  assert.match(menuFilterPropertyEditorSource, /id: `manual-\$\{crypto\.randomUUID\(\)\}`/);
  assert.match(menuFilterPropertyEditorSource, /function CustomFilterProductsCombobox/);
  assert.match(menuFilterPropertyEditorSource, /<Combobox[\s\S]*?multiple/);
  assert.match(menuFilterPropertyEditorSource, /Filtredeki ürünler/);
  assert.match(menuFilterPropertyEditorSource, /En az bir ürün seçildiğinde bu filtre müşteriye gösterilir/);
  assert.match(propertiesWorkspaceSource, /<NavPropertyPanel[\s\S]*?menuItems=\{menuItems\}/);
});

test("header design and layout tiles use the dedicated option SVG set", () => {
  assert.match(propertyControlsSource, /HeaderOptionIcon/);
  for (const fieldId of [
    "headerLogoStyle",
    "headerStyle",
    "headerLayout",
    "headerAlign",
  ]) {
    assert.match(headerOptionIconSource, new RegExp(fieldId));
  }
  for (const value of [
    "display",
    "wordmark",
    "image",
    "solid",
    "blur",
    "split",
    "center",
    "stacked",
    "compact",
    "left",
  ]) {
    assert.match(headerOptionIconSource, new RegExp(`value === "${value}"`));
  }
  for (const name of ["copy", "history", "down", "minus", "plus"]) {
    assert.match(cardLayoutOptionIconSource, new RegExp(`name === "${name}"`));
  }
});

test("layout panel tiles use the dedicated option SVG set", () => {
  assert.match(propertyControlsSource, /LayoutOptionIcon/);
  for (const fieldId of ["texture", "sectionHeading", "pageMaxWidth"]) {
    assert.match(layoutOptionIconSource, new RegExp(fieldId));
  }
  for (const value of [
    "solid",
    "grid",
    "noise",
    "accent",
    "editorial",
    "catalog",
    "none",
    "960",
    "1200",
  ]) {
    assert.match(layoutOptionIconSource, new RegExp(`value === "${value}"`));
  }
  for (const name of ["copy", "history", "down", "minus", "plus"]) {
    assert.match(cardLayoutOptionIconSource, new RegExp(`name === "${name}"`));
  }
});

test("layout panel projects stable density presets without adding a theme token", () => {
  assert.match(propertyPanelsSource, /Sayfa yoğunluğu/);
  assert.match(propertyPanelsSource, /Gelişmiş boşluklar/);
  assert.match(propertyPanelsSource, /Varsayılan yüzey/);
  assert.match(propertyPanelsSource, /onPatch\(patch\)/);
  for (const field of ["pad", "gap", "sectionGap", "sectionHeadingTopGap", "sectionHeadingBottomGap"]) {
    assert.match(layoutDensityModelSource, new RegExp(`'${field}'`));
  }
  assert.doesNotMatch(layoutDensityModelSource, /layoutDensity:/);
});

test("cart design and layout tiles use the dedicated option SVG set", () => {
  assert.match(propertyControlsSource, /CartOptionIcon/);
  for (const fieldId of [
    "cartHeaderTriggerStyle",
    "cartFooterTriggerStyle",
    "cartIcon",
    "cartPillTone",
    "cartDrawerTone",
    "cartPillPosition",
  ]) {
    assert.match(cartOptionIconSource, new RegExp(fieldId));
  }
  for (const value of [
    "none",
    "icon",
    "pill",
    "bar",
    "fab",
    "thumbs",
    "cart",
    "bag",
    "basket",
    "dark",
    "accent",
    "light",
    "clean",
    "accentHeader",
    "floating",
    "edge",
  ]) {
    assert.match(cartOptionIconSource, new RegExp(`value === "${value}"`));
  }
  for (const name of ["copy", "history", "down"]) {
    assert.match(cardLayoutOptionIconSource, new RegExp(`name === "${name}"`));
  }
});

test("theme editor orchestrator delegates picker dialogs to views and navigation state to its controller", () => {
  assert.match(clientSource, /import \{ ThemeEditorDialogsLayer \}/);
  assert.match(clientSource, /<ThemeEditorDialogsLayer/);
  assert.doesNotMatch(
    clientSource,
    /<TemplatePickerDialog|<SectionPickerDialog/,
  );
  assert.match(dialogsLayerSource, /<SectionPickerDialog/);
  assert.doesNotMatch(dialogsLayerSource, /TemplatePickerDialog|ThemeTemplateOption/);
  assert.match(clientSource, /canAddAdvancedSections,/);
  assert.doesNotMatch(clientSource, /canUseFeature\(/);
  assert.match(dialogsLayerSource, /canAddAdvancedSections/);
  // Not every locked section is Pro-gated any more: Video Hero is billed by
  // its own add-on, so the copy stays plan-agnostic.
  assert.match(clientSource, /onLockedSection=\{purchaseSection\}/);
  assert.match(clientSource, /useThemeEditorNavigation/);
  assert.doesNotMatch(clientSource, /role="dialog"/);
  assert.doesNotMatch(
    clientSource,
    /setTemplatePickerOpen|setSectionPickerOpen|lastFocusedBeforeDialogRef/,
  );
  assert.match(dialogsSource, /from '@\/components\/ui\/dialog'/);
  assert.match(dialogsSource, /<Dialog open/);
  assert.match(dialogsSource, /<DialogContent/);
  assert.match(dialogsSource, /className="section-picker-dialog max-w-none gap-0 p-0 sm:max-w-none"/);
  assert.match(dialogsSource, /<DialogTitle id="section-picker-title"/);
  assert.doesNotMatch(dialogsSource, /function trapDialogFocus/);
  assert.match(dialogsSource, /className="section-picker-card-select[^"]*"/);
  assert.doesNotMatch(dialogsSource, /<button[\s\S]{0,120}className="section-picker-card"/);
  assert.match(dialogsSource, /data-modal-initial-focus/);
  assert.match(dialogsSource, /aria-label="Eklenecek bölüm ara"/);
  assert.match(dialogsSource, /className="section-picker-chip-row[^"]*"/);
  assert.match(dialogsSource, /\.section-picker-chip-row \{[\s\S]*?max-width: 100% !important/);
  assert.match(dialogsSource, /\.section-picker-chip-row \{[\s\S]*?overflow-x: auto !important/);
  assert.match(dialogsSource, /\.section-picker-catalog \{[\s\S]*?overscroll-behavior: contain/);
  assert.match(dialogsSource, /\.section-picker-card \{[\s\S]*?min-height: 236px !important/);
  assert.match(dialogsSource, /\.section-picker-card-meta \{[\s\S]*?flex: 0 0 auto !important/);
  assert.doesNotMatch(dialogsSource, /\.section-picker-card \{[\s\S]{0,120}min-height: 0 !important/);
  assert.match(dialogsSource, /const primaryDisabled = !selected \|\| selectedPlanned/);
  assert.match(dialogsSource, /selected\?\.singleton && selectedExists[\s\S]*?'Önizlemede göster'/);
  assert.match(navigationSource, /sectionId === 'request-buttons'[\s\S]*?servicePlacement: 'floating'/);
  assert.match(dialogsSource, /disabled=\{primaryDisabled\}/);
  assert.match(dialogsSource, /Geliştiriliyor/);
});

test("theme editor delegates selection, dialog and page-flow commands to one navigation controller", () => {
  assert.match(navigationSource, /addSectionToPageFlow/);
  assert.match(navigationSource, /removeSectionFromPageFlow/);
  assert.match(navigationSource, /reorderPageBlocks/);
  assert.match(navigationSource, /getKeyboardMoveTarget/);
  assert.match(navigationSource, /lastFocusedBeforeDialogRef/);
  assert.doesNotMatch(navigationSource, /dailySpecialTimer|dailySpecialInstanceId/);
  assert.doesNotMatch(navigationSource, /lib\/actions|createClient|supabase/i);
  assert.doesNotMatch(
    clientSource,
    /addSectionToPageFlow|removeSectionFromPageFlow|reorderPageBlocks|getKeyboardMoveTarget/,
  );
  assert.doesNotMatch(
    clientSource,
    /setSelectedSectionId|setActiveGroup|useState|useEffect|useRef/,
  );
});

test("section picker previews the canonical public-menu renderer instead of a mock catalog", () => {
  assert.match(dialogsLayerSource, /from '\.\/CanonicalSectionPreview'/);
  assert.match(dialogsLayerSource, /<CanonicalSectionPreview/);
  assert.doesNotMatch(
    clientSource,
    /ThemeEditorPreviewCatalog|<TemplateShowcasePreview|<SectionMiniPreview/,
  );
  assert.match(canonicalSectionPreviewSource, /CustomSectionRenderer/);
  assert.match(canonicalSectionPreviewSource, /computeThemeVars/);
  assert.match(canonicalSectionPreviewSource, /sectionId === 'hours'/);
  assert.match(canonicalSectionPreviewSource, /readStoreInfo\(restaurantSettings\)/);
  assert.match(canonicalSectionPreviewSource, /normalizeModifierGroups/);
  assert.match(canonicalSectionPreviewSource, /items=\{items\}/);
  assert.match(canonicalSectionPreviewSource, /storeInfo=\{storeInfo\}/);
  assert.doesNotMatch(canonicalSectionPreviewSource, /lib\/actions|publishTheme|createClient/);
  assert.match(customSectionRendererSource, /export function CustomSectionRenderer/);
  assert.match(customSectionRendererSource, /sectionId === 'hero-banner'/);
  assert.doesNotMatch(customSectionRendererSource, /sectionId === 'footer'|sectionId === 'social-block'/);
});

test("global footer replaces announcement and retired addable footer blocks", () => {
  assert.match(menuFooterSource, /data-component="footer"/);
  assert.match(menuFooterSource, /normalizeFooterContactLinks/);
  assert.match(menuFooterSource, /normalizeFooterSocialLinks/);
  assert.match(propertyPanelsSource, /FooterPropertyPanel/);
  assert.doesNotMatch(propertyPanelsSource, /AnnouncementPropertyPanel/);
  assert.doesNotMatch(sectionRegistrySource, /id: 'social-block'|id: 'footer'/);
  assert.match(clientSource, /useThemeEditorDrawerPreview/);
  assert.match(footerPreviewSource, /createScrollToThemeComponentCommand/);
});

test("theme editor orchestrator imports static section definitions from a typed registry", () => {
  assert.match(clientSource, /from '\.\/theme-editor-section-registry'/);
  assert.doesNotMatch(clientSource, /^const SECTION_LIBRARY =/m);
  assert.doesNotMatch(clientSource, /^const SECTION_SETTING_SCHEMA/m);
  assert.match(sectionRegistrySource, /export const SECTION_LIBRARY =/);
  assert.match(sectionRegistrySource, /export const SECTION_SETTING_SCHEMA:/);
  assert.doesNotMatch(sectionRegistrySource, /status: 'planned'/);
  assert.doesNotMatch(
    sectionRegistrySource,
    /<I\.|ReactNode|from '\.\.\/\.\.\/lib\/ui'/,
  );
  assert.doesNotMatch(sectionRegistrySource, /useState|useEffect|useReducer/);
  assert.doesNotMatch(sectionRegistrySource, /lib\/actions|publishTheme/);
});

test("theme editor lifecycle owns draft history, preview bridge and publishing", () => {
  assert.match(clientSource, /useThemeEditorLifecycle/);
  assert.doesNotMatch(clientSource, /useThemePreviewBridge/);
  assert.doesNotMatch(clientSource, /publishTheme/);
  assert.doesNotMatch(
    clientSource,
    /setUndoStack|setRedoStack|revisionRef|savedThemeRef/,
  );
  assert.match(lifecycleSource, /useThemePreviewBridge/);
  assert.match(lifecycleSource, /publishTheme/);
  assert.match(lifecycleSource, /setNavigationGuard/);
  assert.match(lifecycleSource, /appendHistorySnapshot/);
});

test("theme draft save and publish carry independent revisions and stable request ids", () => {
  assert.match(lifecycleSource, /draftRevisionRef = useRef\(initialDraftRevision\)/);
  assert.match(lifecycleSource, /publishedRevisionRef = useRef\(initialPublishedRevision\)/);
  assert.match(lifecycleSource, /prepareThemeDraftSaveAttempt/);
  assert.match(lifecycleSource, /prepareThemePublishAttempt/);
  assert.match(lifecycleSource, /expectedRevision: draftRevisionRef\.current/);
  assert.match(lifecycleSource, /expectedDraftRevision: draftRevisionRef\.current/);
  assert.match(lifecycleSource, /expectedPublishedRevision: publishedRevisionRef\.current/);
  assert.match(lifecycleSource, /requestId: attempt\.requestId/);
  assert.match(lifecycleSource, /result\.status === 'draft_conflict'/);
  assert.match(lifecycleSource, /result\.status === 'conflict'/);
  assert.match(lifecycleSource, /publishedRevisionRef\.current = result\.revision/);
  assert.match(publishContractSource, /current\?\.fingerprint === fingerprint/);
  assert.match(publishActionSource, /expectedRevision: z\.number\(\)\.int\(\)\.nonnegative\(\)\.safe\(\)/);
  assert.match(publishActionSource, /expectedDraftRevision: z\.number\(\)\.int\(\)\.positive\(\)\.safe\(\)/);
  assert.match(publishActionSource, /requestId: z\.string\(\)\.uuid\(\)/);
  assert.match(publishActionSource, /result\.value\.status === 'published'/);
});

test("theme editor delegates responsive preview workspace state to its controller", () => {
  assert.match(clientSource, /useThemeEditorWorkspace/);
  assert.doesNotMatch(
    clientSource,
    /setPreviewScale|useViewportWidth|window\.open/,
  );
  assert.match(workspaceSource, /getThemeEditorWorkspaceLayout/);
  assert.match(workspaceSource, /changeThemePreviewScale/);
  assert.match(workspaceSource, /getFittedThemePreviewScale/);
  assert.doesNotMatch(workspaceSource, /if \(!layout\.taskBased\) return/);
  assert.match(workspaceSource, /useState<ThemeEditorSurface>\('preview'\)/);
  assert.match(clientSource, /taskBased=\{taskBased\}/);
  assert.match(shellSource, /aria-label="Tema düzenleme çalışma alanı"/);
  assert.match(shellSource, /from '@\/components\/ui\/tabs'/);
  assert.match(shellSource, /<Tabs\s+value=\{activeSurface\}/);
  assert.match(shellSource, /<TabsList data-theme-editor-task-nav/);
  assert.match(shellSource, /<TabsTrigger/);
  assert.match(shellSource, /\[data-slot="scroll-area"\]\[data-scrolling\]/);
  assert.match(shellSource, /overscroll-behavior: contain/);
  assert.match(sidebarSource, /data-theme-editor-scroll="page"/);
  assert.doesNotMatch(shellSource, /overflowX: allowHorizontalOverflow/);
  assert.doesNotMatch(
    workspaceSource,
    /lib\/actions|createClient|supabase|restaurantId/i,
  );
  assert.doesNotMatch(
    workspaceModelSource,
    /useState|useEffect|window\.|lib\/actions|supabase/i,
  );
});

test("theme editor delegates preview canvas and device frame markup to a presentational view", () => {
  assert.match(clientSource, /<ThemeEditorCanvas/);
  assert.doesNotMatch(
    clientSource,
    /<ThemePreviewSurface|function PhoneFrame|Sınırlı önizleme/,
  );
  assert.match(canvasSource, /export function ThemeEditorCanvas/);
  assert.match(canvasSource, /<ThemePreviewSurface/);
  assert.match(canvasSource, /Güncelleme gecikti/);
  assert.match(canvasSource, /onPreviewRetry/);
  assert.match(previewSurfaceSource, /title="Menü tema önizlemesi"/);
  assert.match(previewSurfaceSource, /sandbox="allow-scripts allow-same-origin allow-forms"/);
  assert.match(previewSurfaceSource, /Önizleme yüklenemedi/);
  assert.match(previewSurfaceSource, /Yeniden dene/);
  assert.match(previewSurfaceSource, /onLoad=\{onLoad\}/);
  assert.match(previewSurfaceSource, /onError=\{onError\}/);
  assert.match(previewBridgeSource, /if \(targetOrigin\) armFallback\(\)/);
  assert.match(canvasSource, /function PreviewFrame/);
  assert.match(canvasSource, /<ThemeExperienceSurfaceSelector/);
  assert.doesNotMatch(topbarSource, /<ThemeExperienceSurfaceSelector/);
  assert.match(canvasSource, /data-theme-editor-preview-toolbar/);
  assert.match(canvasSource, /zIndex: 40/);
  assert.match(canvasSource, /aria-label="Önizlemeyi küçült"/);
  assert.match(canvasSource, /aria-label="Önizlemeyi büyüt"/);
  assert.match(canvasSource, /<ButtonGroup aria-label="Önizleme yakınlaştırma"/);
  assert.match(canvasSource, /<Button type="button" variant="outline" size="icon" aria-label="Önizlemeyi küçült"/);
  assert.match(canvasSource, /<Button type="button" variant="outline" size="icon" aria-label="Önizlemeyi büyüt"/);
  assert.doesNotMatch(
    canvasSource,
    /lib\/actions|createClient|supabase|restaurantId/i,
  );
});

test("theme editor exposes one page heading and ordered panel headings", () => {
  assert.match(topbarSource, /<h1[\s\S]*?id="theme-editor-title"/);
  assert.match(topbarSource, /aria-label=\{`\$\{restaurantName\} Tema Düzenleyici`\}/);
  assert.match(topbarSource, /gridTemplateColumns: 'minmax\(0, 0\.8fr\) auto minmax\(0, 1\.2fr\)'/);
  assert.match(topbarSource, /data-theme-editor-device-switch[\s\S]*?className="justify-self-center whitespace-nowrap bg-muted p-1"/);
  assert.match(topbarSource, /data-theme-editor-change-count/);
  assert.match(topbarSource, /data-theme-editor-save-status[\s\S]*?className="shrink-0"/);
  assert.match(topbarSource, /className=\{hasUnsavedChanges \? 'w-\[104px\]' : 'invisible w-\[104px\]'\}/);
  assert.equal((topbarSource.match(/<h1\b/g) ?? []).length, 1);
  assert.match(sidebarSource, /<aside aria-labelledby="theme-editor-page-heading"/);
  assert.match(sidebarSource, /<h2 id="theme-editor-page-heading"/);
  assert.match(sidebarSource, /<h3 style=\{navGroupLabelStyle\}>/);
  assert.match(canvasSource, /role="region" aria-labelledby="theme-editor-preview-heading"/);
  assert.match(canvasSource, /<h2 id="theme-editor-preview-heading"/);
  assert.match(propertiesFrameSource, /<aside aria-labelledby="theme-editor-properties-heading"/);
  assert.match(propertiesFrameSource, /<h2 id="theme-editor-properties-heading"/);
  assert.match(propertyControlsSource, /<Collapsible open=\{open\} onOpenChange=\{setOpen\}/);
  assert.match(propertyControlsSource, /<h3 className="m-0">/);
  assert.match(propertyControlsSource, /<CollapsibleTrigger/);
  assert.match(propertyControlsSource, /<CollapsibleContent/);
});

test("theme editor delegates property workspace composition to a tenant-agnostic view", () => {
  assert.match(clientSource, /<ThemeEditorPropertiesWorkspace/);
  assert.doesNotMatch(
    clientSource,
    /<ThemePropertiesFrame|<HeaderPropertyPanel|<CardPropertyPanel|<CartPropertyPanel/,
  );
  assert.match(
    propertiesWorkspaceSource,
    /export function ThemeEditorPropertiesWorkspace/,
  );
  assert.match(propertiesWorkspaceSource, /<ThemePropertiesFrame/);
  assert.match(propertiesWorkspaceSource, /<HeaderPropertyPanel/);
  assert.match(propertiesWorkspaceSource, /<SectionSettingsEditor/);
  assert.doesNotMatch(
    propertiesWorkspaceSource,
    /lib\/actions|createClient|supabase|restaurantId/i,
  );
});

test("theme property panels delegate reusable control markup to a dedicated control boundary", () => {
  assert.match(propertyPanelsSource, /from ["']\.\/ThemePropertyControls["']/);
  assert.match(propertiesWorkspaceSource, /THEME_PROPERTY_CONTROL_CSS/);
  assert.doesNotMatch(propertyPanelsSource, /function HeaderPropertyField/);
  assert.doesNotMatch(propertyPanelsSource, /function ThemeColorField/);
  assert.doesNotMatch(propertyPanelsSource, /function PropertyControl/);
  assert.match(propertyControlsSource, /export function HeaderPropertyField/);
  assert.match(propertyControlsSource, /export function ThemeColorField/);
  assert.match(propertyControlsSource, /export function PropertyFieldEditor/);
  assert.match(propertyControlsSource, /export function PropertySection/);
  assert.doesNotMatch(
    propertyControlsSource,
    /lib\/actions|createClient|supabase|restaurantId/i,
  );
  assert.ok(
    propertyPanelsSource.split("\n").length <= 700,
    "ThemePropertyPanels must remain a panel-composition boundary",
  );
});

test("page structure and general style panels share one compact density contract", () => {
  assert.match(propertiesFrameSource, /data-theme-property-density="compact"/);
  assert.match(propertiesWorkspaceSource, /data-theme-properties-body/);
  assert.match(propertyPanelsSource, /function CompactPanelCard/);
  assert.match(propertyPanelsSource, /data-theme-property-card/);
  assert.match(propertyPanelsSource, /--card-spacing:--spacing\(2\.5\)/);
  for (const section of [
    "HEADER_FIELD_SECTIONS",
    "DRAWER_FIELD_SECTIONS",
    "CARD_FIELD_SECTIONS",
    "NAV_FIELD_SECTIONS",
    "LAYOUT_FIELD_SECTIONS",
    "CART_FIELD_SECTIONS",
  ]) {
    assert.match(propertyPanelsSource, new RegExp(`sections=\\{${section}\\}`));
  }
  assert.match(propertyPanelsSource, /from ["']\.\/FooterPropertyPanel["']/);
  assert.match(footerPropertyPanelSource, /FOOTER_FIELD_SECTIONS/);
  assert.match(footerPropertyPanelSource, /data-theme-property-card/);
  assert.match(propertyControlsSource, /min-h-11 min-w-0 flex-col/);
  assert.match(logoCardSource, /size="xs"/);
});

test("action placements and preview zoom stay compact without control collisions", () => {
  assert.match(propertyControlsSource, /data-theme-action-placement-options/);
  assert.match(propertyControlsSource, /options\.length > 3 \? "grid-cols-2" : "grid-cols-3"/);
  assert.match(propertyControlsSource, /whitespace-normal/);
  assert.match(propertyControlsSource, /aria-labelledby=\{`\$\{controlId\}-label`\}/);
  assert.match(canvasSource, /data-theme-preview-zoom/);
  assert.match(canvasSource, /data-theme-preview-zoom-value/);
  assert.match(canvasSource, /className="h-8 min-w-10 justify-center px-1\.5 text-xs tabular-nums whitespace-nowrap"/);
  assert.equal((canvasSource.match(/size="icon" aria-label="Önizlemeyi/g) ?? []).length, 2);
});

test("single-value sliders expose one named 44px target", () => {
  assert.match(sliderSource, /\[value\]/);
  assert.match(sliderSource, /thumbValues = controlledValues \?\? defaultValues \?\? \[min\]/);
  assert.doesNotMatch(sliderSource, /\[min, max\]/);
  assert.match(sliderSource, /aria-label=\{ariaLabel\}/);
  assert.match(sliderSource, /className="relative block size-11/);
  assert.match(propertyControlsSource, /className="size-11 border-0 bg-transparent/);
});

test("theme editor delegates logo persistence and upload state to its feature controller", () => {
  assert.match(clientSource, /useThemeEditorLogo/);
  assert.match(clientSource, /<ThemeLogoUploadCard/);
  assert.doesNotMatch(
    clientSource,
    /uploadLogo|removeLogo|function LogoUploadCard/,
  );
  assert.match(logoControllerSource, /uploadLogo/);
  assert.match(logoControllerSource, /removeLogo/);
  assert.match(logoControllerSource, /reloadPreview/);
  assert.match(logoCardSource, /export function ThemeLogoUploadCard/);
  assert.match(logoCardSource, /alt="Yüklü restoran logosu"/);
  assert.doesNotMatch(
    logoCardSource,
    /lib\/actions|createClient|supabase|restaurantId/i,
  );
});

test("theme editor delegates property commands and their projections to a feature boundary", () => {
  assert.match(clientSource, /useThemeEditorPropertyCommands/);
  assert.match(propertyCommandsSource, /buildThemeSettingsClipboardPayload/);
  assert.match(propertyCommandsSource, /buildThemeGroupResetPatch/);
  assert.match(propertyCommandsSource, /navigator\.clipboard/);
  assert.doesNotMatch(
    clientSource,
    /navigator\.clipboard|window\.confirm|Object\.fromEntries/,
  );
  assert.doesNotMatch(
    propertyCommandModelSource,
    /useState|useEffect|navigator|window\.|lib\/actions|supabase/i,
  );
});

test("theme editor delegates shell projections, toast view and navigation catalog", () => {
  assert.match(clientSource, /getThemeEditorSaveStatus/);
  assert.match(clientSource, /<ThemeEditorShell/);
  assert.match(clientSource, /buildEditorNavigation/);
  assert.doesNotMatch(
    clientSource,
    /role="status"|Intl\.DateTimeFormat|function getNavigationIcon|<I\./,
  );
  assert.match(shellModelSource, /formatThemeEditorTime/);
  assert.doesNotMatch(
    shellModelSource,
    /useState|useEffect|navigator|window\.|lib\/actions|supabase/i,
  );
  assert.match(toastSource, /from '@\/components\/ui\/toast'/);
  assert.match(toastSource, /toast\.add\(/);
  assert.match(toastSource, /return <Toaster \/>/);
  assert.doesNotMatch(toastSource, /useState|lib\/actions|supabase/i);
  assert.match(shellSource, /<ThemeEditorToast/);
  assert.match(shellSource, /data-theme-editor-root/);
  assert.match(shellSource, /flex: '1 1 0%'/);
  assert.doesNotMatch(shellSource, /height: '100%'/);
  assert.match(shellSource, /className="min-h-0 flex-1 flex-col gap-0 overflow-hidden"/);
  assert.doesNotMatch(shellSource, /min-height: 44px !important/);
  assert.doesNotMatch(shellSource, /min-width: 44px !important/);
  assert.match(shellSource, /prefers-reduced-motion/);
  assert.doesNotMatch(
    shellSource,
    /lib\/actions|createClient|supabase|restaurantId/i,
  );
  assert.match(navigationCatalogSource, /buildThemeSettingsGroup/);
  assert.match(navigationCatalogSource, /getNavigationIcon/);
  assert.doesNotMatch(
    navigationCatalogSource,
    /useState|useEffect|lib\/actions|supabase/i,
  );
});

test("theme editor delegates preview normalization to a pure derivation model", () => {
  assert.match(clientSource, /createThemeEditorPreviewDeriver/);
  assert.doesNotMatch(
    clientSource,
    /buildPageBlocks|normalizePageBlocksForCategoryScope|SECTION_LIBRARY_IDS/,
  );
  assert.match(previewThemeModelSource, /buildPageBlocks/);
  assert.match(previewThemeModelSource, /normalizePageBlocksForCategoryScope/);
  assert.doesNotMatch(
    previewThemeModelSource,
    /useState|useEffect|navigator|window\.|lib\/actions|supabase/i,
  );
});

test("theme editor orchestrator stays below its decomposition budget", () => {
  const lineCount = clientSource.split("\n").length;
  assert.ok(lineCount <= 330, `ThemeEditorClient grew to ${lineCount} lines`);
});
