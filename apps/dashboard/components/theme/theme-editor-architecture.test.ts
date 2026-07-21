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
const previewCatalogSource = readFileSync(
  `${directory}/ThemeEditorPreviewCatalog.tsx`,
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

test("theme editor orchestrator delegates picker dialogs to views and navigation state to its controller", () => {
  assert.match(clientSource, /import \{ ThemeEditorDialogsLayer \}/);
  assert.match(clientSource, /<ThemeEditorDialogsLayer/);
  assert.doesNotMatch(
    clientSource,
    /<TemplatePickerDialog|<SectionPickerDialog/,
  );
  assert.match(dialogsLayerSource, /<TemplatePickerDialog/);
  assert.match(dialogsLayerSource, /<SectionPickerDialog/);
  assert.match(clientSource, /canUseFeature\(restaurantPlan, 'theme_advanced_sections'\)/);
  assert.match(dialogsLayerSource, /canAddAdvancedSections/);
  assert.match(dialogsSource, /Pro pakette kullanılabilir/);
  assert.match(clientSource, /useThemeEditorNavigation/);
  assert.doesNotMatch(clientSource, /role="dialog"/);
  assert.doesNotMatch(
    clientSource,
    /setTemplatePickerOpen|setSectionPickerOpen|lastFocusedBeforeDialogRef/,
  );
  assert.match(dialogsSource, /function trapDialogFocus/);
  assert.match(dialogsSource, /aria-label="Şablonlar"/);
  assert.match(dialogsSource, /aria-label="Bölüm ekle"/);
  assert.match(dialogsSource, /aria-label="Eklenecek bölüm ara"/);
});

test("theme editor delegates selection, dialog and page-flow commands to one navigation controller", () => {
  assert.match(navigationSource, /addSectionToPageFlow/);
  assert.match(navigationSource, /removeSectionFromPageFlow/);
  assert.match(navigationSource, /reorderPageBlocks/);
  assert.match(navigationSource, /getKeyboardMoveTarget/);
  assert.match(navigationSource, /lastFocusedBeforeDialogRef/);
  assert.match(navigationSource, /daily-special/);
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

test("theme editor orchestrator delegates picker preview drawings to a render-only catalog", () => {
  assert.match(dialogsLayerSource, /from '\.\/ThemeEditorPreviewCatalog'/);
  assert.match(dialogsLayerSource, /<TemplateShowcasePreview/);
  assert.match(dialogsLayerSource, /<SectionMiniPreview/);
  assert.doesNotMatch(
    clientSource,
    /ThemeEditorPreviewCatalog|<TemplateShowcasePreview|<SectionMiniPreview/,
  );
  assert.doesNotMatch(clientSource, /function ClassicTemplatePhone/);
  assert.doesNotMatch(clientSource, /function SectionMiniPreview/);
  assert.match(previewCatalogSource, /export function TemplateShowcasePreview/);
  assert.match(previewCatalogSource, /export function SectionMiniPreview/);
  assert.doesNotMatch(previewCatalogSource, /useState|useEffect|useReducer/);
  assert.doesNotMatch(
    previewCatalogSource,
    /lib\/actions|publishTheme|onSelect/,
  );
});

test("theme editor orchestrator imports static section definitions from a typed registry", () => {
  assert.match(clientSource, /from '\.\/theme-editor-section-registry'/);
  assert.doesNotMatch(clientSource, /^const SECTION_LIBRARY =/m);
  assert.doesNotMatch(clientSource, /^const SECTION_SETTING_SCHEMA/m);
  assert.match(sectionRegistrySource, /export const SECTION_LIBRARY =/);
  assert.match(sectionRegistrySource, /export const SECTION_SETTING_SCHEMA:/);
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
