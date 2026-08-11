import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const directory = fileURLToPath(new URL('.', import.meta.url))
const managerSource = readFileSync(`${directory}/MenuManager.tsx`, 'utf8')
const controllerSource = readFileSync(`${directory}/use-menu-manager-commands.ts`, 'utf8')
const modelSource = readFileSync(`${directory}/menu-manager-command-model.ts`, 'utf8')
const itemEditorSource = readFileSync(`${directory}/MenuItemEditPanel.tsx`, 'utf8')
const itemEditorFrameSource = readFileSync(`${directory}/MenuItemEditorFrame.tsx`, 'utf8')
const recommendationEditorSource = readFileSync(`${directory}/MenuItemRecommendationEditor.tsx`, 'utf8')
const newProductDrawerSource = readFileSync(`${directory}/NewProductDrawer.tsx`, 'utf8')
const itemsWorkspaceSource = readFileSync(`${directory}/MenuItemsWorkspace.tsx`, 'utf8')
const modifierEditorSource = readFileSync(`${directory}/MenuModifierGroupEditor.tsx`, 'utf8')
const shellStateSource = readFileSync(`${directory}/use-menu-manager-shell-state.ts`, 'utf8')
const chromeSource = readFileSync(`${directory}/MenuManagerChrome.tsx`, 'utf8')
const categoryWorkspaceSource = readFileSync(`${directory}/MenuCategoryWorkspace.tsx`, 'utf8')
const categoryFormSource = readFileSync(`${directory}/CategoryForm.tsx`, 'utf8')
const nutritionSource = readFileSync(`${directory}/NutritionFields.tsx`, 'utf8')
const imageAttachmentSource = readFileSync(`${directory}/MenuImageAttachment.tsx`, 'utf8')
const globalStylesSource = readFileSync(`${directory}/../../app/globals.css`, 'utf8')
const saveFeedbackSource = readFileSync(`${directory}/use-menu-save-feedback.ts`, 'utf8')

test('MenuManager delegates category and quick-item commands to its controller', () => {
  assert.match(managerSource, /useMenuManagerCommands/)
  assert.match(managerSource, /commands\.removeCategory/)
  assert.match(managerSource, /commands\.reorder/)
  assert.match(managerSource, /commands\.quickUpdate/)
  assert.match(managerSource, /commands\.setBulkAvailability/)
  assert.doesNotMatch(managerSource, /deleteCategory|reorderCategories|setMenuItemsAvailability/)
})

test('menu command controller owns actions while its projection model stays pure', () => {
  assert.match(controllerSource, /deleteCategory/)
  assert.match(controllerSource, /reorderCategories/)
  assert.match(controllerSource, /setMenuItemsAvailability/)
  assert.match(controllerSource, /patchMenuItemCollection/)
  assert.match(controllerSource, /removeCategoryTreeFromMenu/)
  assert.doesNotMatch(controllerSource, /createClient|supabase|serviceRole/i)
  assert.doesNotMatch(modelSource, /useState|useEffect|useTransition|lib\/actions|createClient|supabase/i)
})

test('MenuManager delegates allergen and modifier option editing to a tenant-agnostic view', () => {
  assert.doesNotMatch(managerSource, /function AllergenPicker|function ModifierGroupEditor|ALLERGEN_CODES|ALLERGEN_LABELS/)
  assert.match(itemEditorSource, /MenuModifierGroupEditor/)
  assert.match(modifierEditorSource, /export function MenuModifierGroupEditor/)
  assert.match(modifierEditorSource, /role="listbox"/)
  assert.match(modifierEditorSource, /aria-multiselectable="true"/)
  assert.doesNotMatch(modifierEditorSource, /lib\/actions|createClient|supabase|restaurantId/i)
})

test('modifier selection mode uses the searchable shadcn combobox', () => {
  assert.match(modifierEditorSource, /from '@\/components\/ui\/combobox'/)
  assert.match(modifierEditorSource, /<SelectionModeCombobox/)
  assert.match(modifierEditorSource, /<ComboboxInput[\s\S]*aria-label="Seçim biçimi"/)
  assert.match(modifierEditorSource, /<ComboboxList>[\s\S]*<ComboboxItem/)
  assert.match(modifierEditorSource, /Tek seçim/)
  assert.match(modifierEditorSource, /Çoklu seçim/)
  assert.match(modifierEditorSource, /Adetli seçim/)
  assert.doesNotMatch(modifierEditorSource, /NativeSelect/)
})

test('category forms use a compact searchable combobox for kitchen stations', () => {
  assert.match(categoryFormSource, /from '@\/components\/ui\/combobox'/)
  assert.match(categoryFormSource, /function KitchenStationCombobox/)
  assert.match(categoryFormSource, /aria-label="Varsayılan mutfak istasyonu"/)
  assert.match(categoryFormSource, /<ComboboxEmpty>İstasyon bulunamadı\.<\/ComboboxEmpty>/)
  assert.match(categoryFormSource, /<ComboboxList>[\s\S]*<ComboboxItem/)
  assert.match(categoryFormSource, /\{ value: '', label: 'Atanmamış' \}/)
  assert.doesNotMatch(categoryFormSource, /NativeSelect/)
})

test('category VAT controls stay bounded in the narrow category rail', () => {
  assert.match(categoryFormSource, /from '@\/components\/ui\/toggle-group'/)
  assert.match(categoryFormSource, /grid-cols-\[minmax\(0,1fr\)_64px\]/)
  assert.match(categoryFormSource, /<ToggleGroup[\s\S]*className="grid min-w-0 grid-cols-3"/)
  assert.match(categoryFormSource, /<ToggleGroupItem[\s\S]*className="min-w-0 px-1/)
  assert.match(categoryFormSource, /className="h-7 min-w-0 px-1\.5 text-right font-mono text-xs"/)
})

test('MenuManager delegates product editor state, persistence and dirty lifecycle to its feature panel', () => {
  assert.match(managerSource, /MenuItemEditPanel/)
  assert.doesNotMatch(managerSource, /deleteItem|updateItem|createDashboardBrowserClient|isMenuItemEditorDirty|NutritionFields/)
  assert.match(itemEditorSource, /export function MenuItemEditPanel/)
  assert.match(itemEditorSource, /deleteItem/)
  assert.match(itemEditorSource, /updateItem/)
  assert.match(itemEditorSource, /prepareMenuImage/)
  assert.match(itemEditorSource, /uploadMenuImage/)
  assert.doesNotMatch(itemEditorSource, /createDashboardBrowserClient|\.storage\.from/)
  assert.match(itemEditorSource, /isMenuItemEditorDirty/)
  assert.match(itemEditorSource, /onDirtyChange\(isDirty\)/)
  assert.doesNotMatch(itemEditorSource, /createServiceClient|@garsonless\/db\/server|serviceRole/i)
})

test('product editor derives volatile defaults once for both form and saved snapshot', () => {
  assert.match(itemEditorSource, /const \[initialNutrition\].*nutritionFromItem\(item\)/)
  assert.match(itemEditorSource, /const \[initialModifiers\].*normalizeGroups\(item\.modifier_groups\)/)
  assert.match(itemEditorSource, /nutrition: initialNutrition/)
  assert.match(itemEditorSource, /modifiers: initialModifiers/)
  assert.doesNotMatch(itemEditorSource, /nutrition:\s*nutritionFromItem\(item\)/)
  assert.doesNotMatch(itemEditorSource, /modifiers:\s*normalizeGroups\(item\.modifier_groups\)/)
})

test('recommendation drafts participate in the shared unsaved-change guard', () => {
  assert.match(recommendationEditorSource, /onDirtyChange\?\.\(isDirty\)/)
  assert.match(recommendationEditorSource, /savedIdsRef\.current = idsToSave/)
  assert.match(itemEditorSource, /itemIsDirty \|\| recommendationsDirty/)
  assert.match(itemEditorSource, /onDirtyChange=\{setRecommendationsDirty\}/)
})

test('new product drawer traps focus, protects drafts and restores page scrolling', () => {
  assert.match(newProductDrawerSource, /FOCUSABLE_SELECTOR/)
  assert.match(newProductDrawerSource, /dirtyRef\.current/)
  assert.match(newProductDrawerSource, /UnsavedChangesDialog/)
  assert.match(newProductDrawerSource, /document\.body\.style\.overflow = 'hidden'/)
  assert.match(newProductDrawerSource, /document\.body\.style\.overflow = previousOverflow/)
  assert.match(newProductDrawerSource, /const \[initialNutrition\].*nutritionFromItem\(null\)/)
  assert.match(newProductDrawerSource, /isNewMenuItemDraftDirty/)
  assert.doesNotMatch(newProductDrawerSource, /JSON\.stringify\(nutri\).*nutritionFromItem\(null\)/)
})

test('new product flow composes compact shadcn form controls', () => {
  assert.match(newProductDrawerSource, /from '@\/components\/ui\/field'/)
  assert.match(newProductDrawerSource, /from '@\/components\/ui\/input-group'/)
  assert.match(newProductDrawerSource, /from '@\/components\/ui\/toggle-group'/)
  assert.match(newProductDrawerSource, /from '@\/components\/ui\/combobox'/)
  assert.match(newProductDrawerSource, /<FieldGroup className="gap-4 p-5">/)
  assert.match(newProductDrawerSource, /<InputGroup className="new-product-currency h-9 overflow-hidden">/)
  assert.match(newProductDrawerSource, /aria-label="Mutfak istasyonu kaynağı"/)
  assert.match(newProductDrawerSource, /aria-label="Ürün mutfak istasyonu"/)
  assert.doesNotMatch(newProductDrawerSource, /NativeSelect/)
})

test('product and recommendation saves share one feedback state contract', () => {
  assert.match(itemEditorSource, /useMenuSaveFeedback/)
  assert.match(recommendationEditorSource, /useMenuSaveFeedback/)
  assert.match(itemEditorSource, /data-save-state=\{itemSaveState\}/)
  assert.match(recommendationEditorSource, /data-save-state=\{saveState\}/)
  assert.match(saveFeedbackSource, /getMenuSaveState/)
  assert.match(saveFeedbackSource, /markSaved/)
})

test('MenuManager delegates product filtering, selection and grid/list rendering to its workspace', () => {
  assert.match(managerSource, /MenuItemsWorkspace/)
  assert.doesNotMatch(managerSource, /function ItemsCanvas|function ItemCard|function ItemsList|selectedIds/)
  assert.match(itemsWorkspaceSource, /export function MenuItemsWorkspace/)
  assert.match(itemsWorkspaceSource, /const \[view, setView\]/)
  assert.match(itemsWorkspaceSource, /const \[filter, setFilter\]/)
  assert.match(itemsWorkspaceSource, /const \[selectedIds, setSelectedIds\]/)
  assert.match(itemsWorkspaceSource, /onBulkAvailability/)
  assert.doesNotMatch(itemsWorkspaceSource, /lib\/actions|createClient|supabase|restaurantId/i)
})

test('MenuManager delegates local lifecycle and guarded navigation to its shell-state controller', () => {
  assert.match(managerSource, /useMenuManagerShellState/)
  assert.doesNotMatch(managerSource, /useState|useEffect|useRef|useCallback|function requestEditorExit/)
  assert.match(shellStateSource, /export function useMenuManagerShellState/)
  assert.match(shellStateSource, /function requestEditorExit/)
  assert.match(shellStateSource, /pendingEditorExit/)
  assert.match(shellStateSource, /event\.metaKey \|\| event\.ctrlKey/)
  assert.doesNotMatch(shellStateSource, /lib\/actions|createClient|supabase|restaurantId/i)
})

test('MenuManager delegates topbar, skeleton, empty and toast chrome to presentational views', () => {
  assert.match(managerSource, /MenuManagerTopBar/)
  assert.match(managerSource, /MenuManagerSkeleton/)
  assert.match(managerSource, /MenuManagerEmptyPanel/)
  assert.match(managerSource, /MenuManagerToast/)
  assert.doesNotMatch(managerSource, /PageTopBar|function SkeletonGrid|function EmptyPanel|function Toast/)
  assert.match(chromeSource, /export function MenuManagerTopBar/)
  assert.match(chromeSource, /export function MenuManagerSkeleton/)
  assert.match(chromeSource, /export function MenuManagerEmptyPanel/)
  assert.match(chromeSource, /export function MenuManagerToast/)
  assert.doesNotMatch(chromeSource, /lib\/actions|createClient|supabase|restaurantId/i)
})

test('empty menu actions route to category creation before product creation', () => {
  assert.match(managerSource, /onOpenAddItem=\{requestAddItem\}/)
  assert.match(managerSource, /onOpenAddCategory=\{requestAddCategory\}/)
  assert.match(managerSource, /categoryCount=\{categories\.length\}/)
  assert.match(managerSource, /onAddCategory=\{requestAddCategory\}/)
  assert.match(managerSource, /addRequest=\{categoryAddRequest\}/)
  assert.match(categoryWorkspaceSource, /if \(addRequest > 0\) setAdding\(true\)/)
  assert.match(chromeSource, /deriveMenuManagerEmptyState/)
  assert.match(chromeSource, /requiresCategory \? onOpenAddCategory : onOpenAddItem/)
  assert.match(chromeSource, /requiresCategory \? 'Kategori ekle' : 'Yeni ürün'/)
})

test('empty product panel keeps the same fixed width contract as the item editor', () => {
  assert.match(itemEditorFrameSource, /width: 'var\(--props\)'/)
  assert.match(chromeSource, /className="menu-manager-empty-panel[^"\n]*"/)
  assert.match(chromeSource, /width: 'var\(--props\)',\s*flex: '0 0 var\(--props\)'/)
})

test('menu shell contains vertical scrolling inside its bounded workspaces', () => {
  assert.match(managerSource, /height: '100%', minHeight: 0, overflow: 'hidden'/)
  assert.match(managerSource, /overscrollBehaviorY: 'none'/)
  assert.match(managerSource, /flex: 1, display: 'flex', minHeight: 0, overflow: 'hidden'/)
  assert.match(categoryWorkspaceSource, /flexDirection: 'column',\s*minHeight: 0,\s*overflow: 'hidden'/)
  assert.match(itemsWorkspaceSource, /minWidth: 0,\s*minHeight: 0,\s*overflow: 'hidden'/)
  assert.match(itemEditorFrameSource, /minWidth: 0,\s*minHeight: 0,\s*flexShrink: 0/)
  assert.match(itemEditorFrameSource, /className="menu-item-editor-scroll"/)
  assert.match(itemEditorFrameSource, /overflowY: 'auto',[\s\S]{0,100}overscrollBehaviorY: 'contain'/)
})

test('live menu manager keeps desktop controls compact and touch targets accessible', () => {
  assert.match(managerSource, /className="menu-manager"/)
  assert.match(globalStylesSource, /@media \(pointer: coarse\) \{[\s\S]*\.menu-manager button,[\s\S]*min-height: 44px/)
  assert.match(globalStylesSource, /@media \(pointer: coarse\) \{[\s\S]*button\[aria-label\],[\s\S]*min-width: 44px/)
  assert.match(chromeSource, /<InputGroup[\s\S]*className="menu-search-control[^"\n]*"/)
  assert.match(chromeSource, /className="menu-top-action[^"\n]*"[\s\S]*size="sm"/)
  assert.match(itemsWorkspaceSource, /width: 26,\s*height: 26,\s*borderRadius: 6/)
  assert.match(newProductDrawerSource, /className="new-product-action[^"\n]*"[\s\S]*size="lg"/)
})

test('product card selection stays visible over photos and color swatches', () => {
  assert.match(itemsWorkspaceSource, /className="menu-product-select-hit-area"/)
  assert.match(itemsWorkspaceSource, /className="menu-product-select-surface[^"\n]*bg-card[^"\n]*shadow-sm"/)
  assert.match(itemsWorkspaceSource, /className="size-\[18px\] border-border bg-card"/)
  assert.match(globalStylesSource, /\.menu-product-select-hit-area:hover \.menu-product-select-surface/)
})

test('menu search and nutrition macros replace black input outlines with surface feedback', () => {
  assert.match(chromeSource, /className="menu-search-control[^"\n]*"/)
  assert.match(chromeSource, /className="menu-search-input"/)
  assert.match(nutritionSource, /className="nutrition-macro-field[^"\n]*"/)
  assert.match(nutritionSource, /className="nutrition-macro-input"/)
  assert.match(globalStylesSource, /\.menu-manager input:focus-visible,[\s\S]*?outline: none !important;/)
  assert.doesNotMatch(globalStylesSource, /\.menu-manager input:focus-visible,[^{]*\{[^}]*outline: 2px solid/)
  assert.match(globalStylesSource, /\.menu-manager \.menu-search-input:focus-visible,[\s\S]*outline: none !important;/)
  assert.match(globalStylesSource, /\.menu-search-control:focus-within \{[\s\S]*background: var\(--surface-inset\) !important;/)
  assert.match(globalStylesSource, /\.nutrition-macro-field:focus-within \{[\s\S]*background: var\(--surface-2\) !important;/)
})

test('nutrition declarations use compact labelled shadcn checkbox cards without clipped copy', () => {
  assert.match(nutritionSource, /<FieldSet>/)
  assert.match(nutritionSource, /<FieldLabel htmlFor=\{id\} className="nutrition-choice-card"/)
  assert.match(nutritionSource, /<Checkbox id=\{id\} checked=\{on\}/)
  assert.match(nutritionSource, /whitespace-normal text-\[12\.5px\]/)
  assert.match(globalStylesSource, /\.nutrition-choice-card \{[\s\S]*overflow: hidden;/)
  assert.doesNotMatch(nutritionSource, /onClick=\{onToggle\}[\s\S]{0,300}whiteSpace: 'nowrap'/)
})

test('nutrition ingredients use compact shadcn field groups within the narrow editor', () => {
  assert.match(nutritionSource, /<FieldGroup className="gap-2">/)
  assert.match(nutritionSource, /className="nutrition-ingredient-card[^"\n]*"/)
  assert.match(nutritionSource, /grid-cols-\[minmax\(0,1fr\)_88px\]/)
  assert.match(nutritionSource, /<InputGroupInput[\s\S]*placeholder="Bileşen adı"/)
  assert.match(nutritionSource, /<Switch[\s\S]*Müşteri çıkarabilir/)
  assert.match(nutritionSource, /className="mt-3 grid grid-cols-2 gap-2"/)
  assert.doesNotMatch(nutritionSource, />\s*çıkar\s*</)
})

test('menu image uploads compose the shadcn Attachment lifecycle and accessible actions', () => {
  assert.match(imageAttachmentSource, /from '@\/components\/ui\/attachment'/)
  assert.match(imageAttachmentSource, /state=\{uploading \? 'uploading' : hasImage \? 'done' : 'idle'\}/)
  assert.match(imageAttachmentSource, /<AttachmentMedia[\s\S]*variant=\{hasImage \? 'image' : 'icon'\}/)
  assert.match(imageAttachmentSource, /<AttachmentAction[\s\S]*aria-label=\{`\$\{title\} görselini kaldır`\}/)
  assert.match(imageAttachmentSource, /<AttachmentTrigger aria-label=\{selectLabel\}/)
  assert.match(categoryFormSource, /<MenuImageAttachment/)
  assert.match(itemEditorSource, /<MenuImageAttachment/)
})

test('MenuManager stays below its shell-state and chrome strangler decomposition budget', () => {
  const lineCount = managerSource.split('\n').length
  assert.ok(lineCount <= 240, `MenuManager grew to ${lineCount} lines`)
})
