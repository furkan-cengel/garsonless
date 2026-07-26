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
const sectionRegistrySource = readFileSync(
  `${directory}/theme-editor-section-registry.ts`,
  "utf8",
);
const lifecycleSource = readFileSync(
  `${directory}/use-theme-editor-lifecycle.ts`,
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
const propertiesWorkspaceSource = readFileSync(
  `${directory}/ThemeEditorPropertiesWorkspace.tsx`,
  "utf8",
);
const propertyPanelsSource = readFileSync(
  `${directory}/ThemePropertyPanels.tsx`,
  "utf8",
);
const propertyControlsSource = readFileSync(
  `${directory}/ThemePropertyControls.tsx`,
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
  assert.match(clientSource, /canAddAdvancedSections: boolean/);
  assert.doesNotMatch(clientSource, /canUseFeature\(/);
  assert.match(dialogsLayerSource, /canAddAdvancedSections/);
  assert.match(clientSource, /Bu bölüm Pro pakette kullanılabilir/);
  assert.match(clientSource, /useThemeEditorNavigation/);
  assert.doesNotMatch(clientSource, /role="dialog"/);
  assert.doesNotMatch(
    clientSource,
    /setTemplatePickerOpen|setSectionPickerOpen|lastFocusedBeforeDialogRef/,
  );
  assert.match(dialogsSource, /function trapDialogFocus/);
  assert.match(dialogsSource, /aria-labelledby="section-picker-title"/);
  assert.match(dialogsSource, /aria-label="Eklenecek bölüm ara"/);
  assert.match(
    dialogsSource,
    /const primaryDisabled = !selected \|\| selectedPlanned \|\| Boolean\(selected\.singleton && selectedExists\)/,
  );
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
  assert.match(canonicalSectionPreviewSource, /readStoreInfo/);
  assert.match(canonicalSectionPreviewSource, /normalizeModifierGroups/);
  assert.match(canonicalSectionPreviewSource, /items=\{items\}/);
  assert.match(canonicalSectionPreviewSource, /storeInfo=\{storeInfo\}/);
  assert.doesNotMatch(canonicalSectionPreviewSource, /lib\/actions|publishTheme|createClient/);
  assert.match(customSectionRendererSource, /export function CustomSectionRenderer/);
  assert.match(customSectionRendererSource, /sectionId === 'hero-banner'/);
  assert.match(customSectionRendererSource, /sectionId === 'footer'/);
});

test("theme editor orchestrator imports static section definitions from a typed registry", () => {
  assert.match(clientSource, /from '\.\/theme-editor-section-registry'/);
  assert.doesNotMatch(clientSource, /^const SECTION_LIBRARY =/m);
  assert.doesNotMatch(clientSource, /^const SECTION_SETTING_SCHEMA/m);
  assert.match(sectionRegistrySource, /export const SECTION_LIBRARY =/);
  assert.match(sectionRegistrySource, /export const SECTION_SETTING_SCHEMA:/);
  assert.match(sectionRegistrySource, /status: 'planned'/);
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

test("theme editor delegates responsive preview workspace state to its controller", () => {
  assert.match(clientSource, /useThemeEditorWorkspace/);
  assert.doesNotMatch(
    clientSource,
    /setPreviewScale|useViewportWidth|window\.open/,
  );
  assert.match(workspaceSource, /getThemeEditorWorkspaceLayout/);
  assert.match(workspaceSource, /changeThemePreviewScale/);
  assert.match(workspaceSource, /getFittedThemePreviewScale/);
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
  assert.match(canvasSource, /function PreviewFrame/);
  assert.match(canvasSource, /aria-label="Önizlemeyi küçült"/);
  assert.match(canvasSource, /aria-label="Önizlemeyi büyüt"/);
  assert.doesNotMatch(
    canvasSource,
    /lib\/actions|createClient|supabase|restaurantId/i,
  );
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
  assert.match(toastSource, /role="status"/);
  assert.match(toastSource, /aria-live="polite"/);
  assert.doesNotMatch(toastSource, /useState|useEffect|lib\/actions|supabase/i);
  assert.match(shellSource, /<ThemeEditorToast/);
  assert.match(shellSource, /data-theme-editor-root/);
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
