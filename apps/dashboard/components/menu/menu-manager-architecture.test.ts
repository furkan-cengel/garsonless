import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const directory = fileURLToPath(new URL('.', import.meta.url))
const managerSource = readFileSync(`${directory}/MenuManager.tsx`, 'utf8')
const controllerSource = readFileSync(`${directory}/use-menu-manager-commands.ts`, 'utf8')
const modelSource = readFileSync(`${directory}/menu-manager-command-model.ts`, 'utf8')
const itemEditorSource = readFileSync(`${directory}/MenuItemEditPanel.tsx`, 'utf8')
const recommendationEditorSource = readFileSync(`${directory}/MenuItemRecommendationEditor.tsx`, 'utf8')
const newProductDrawerSource = readFileSync(`${directory}/NewProductDrawer.tsx`, 'utf8')
const itemsWorkspaceSource = readFileSync(`${directory}/MenuItemsWorkspace.tsx`, 'utf8')
const modifierEditorSource = readFileSync(`${directory}/MenuModifierGroupEditor.tsx`, 'utf8')
const shellStateSource = readFileSync(`${directory}/use-menu-manager-shell-state.ts`, 'utf8')
const chromeSource = readFileSync(`${directory}/MenuManagerChrome.tsx`, 'utf8')
const categoryWorkspaceSource = readFileSync(`${directory}/MenuCategoryWorkspace.tsx`, 'utf8')
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

test('live menu manager keeps desktop controls compact and touch targets accessible', () => {
  assert.match(managerSource, /className="menu-manager"/)
  assert.match(globalStylesSource, /@media \(pointer: coarse\) \{[\s\S]*\.menu-manager button,[\s\S]*min-height: 44px/)
  assert.match(globalStylesSource, /@media \(pointer: coarse\) \{[\s\S]*button\[aria-label\],[\s\S]*min-width: 44px/)
  assert.match(chromeSource, /height: 32, padding: '0 12px'/)
  assert.match(itemsWorkspaceSource, /width: 26, height: 26, borderRadius: 6/)
  assert.match(newProductDrawerSource, /const btnGhost: React\.CSSProperties = \{ height: 36/)
})

test('MenuManager stays below its shell-state and chrome strangler decomposition budget', () => {
  const lineCount = managerSource.split('\n').length
  assert.ok(lineCount <= 240, `MenuManager grew to ${lineCount} lines`)
})
