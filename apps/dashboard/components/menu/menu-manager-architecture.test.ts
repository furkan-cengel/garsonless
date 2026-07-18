import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const directory = fileURLToPath(new URL('.', import.meta.url))
const managerSource = readFileSync(`${directory}/MenuManager.tsx`, 'utf8')
const controllerSource = readFileSync(`${directory}/use-menu-manager-commands.ts`, 'utf8')
const modelSource = readFileSync(`${directory}/menu-manager-command-model.ts`, 'utf8')
const itemEditorSource = readFileSync(`${directory}/MenuItemEditPanel.tsx`, 'utf8')
const itemsWorkspaceSource = readFileSync(`${directory}/MenuItemsWorkspace.tsx`, 'utf8')
const modifierEditorSource = readFileSync(`${directory}/MenuModifierGroupEditor.tsx`, 'utf8')
const shellStateSource = readFileSync(`${directory}/use-menu-manager-shell-state.ts`, 'utf8')
const chromeSource = readFileSync(`${directory}/MenuManagerChrome.tsx`, 'utf8')

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
  assert.match(itemEditorSource, /createDashboardBrowserClient/)
  assert.match(itemEditorSource, /isMenuItemEditorDirty/)
  assert.match(itemEditorSource, /onDirtyChange\(isDirty\)/)
  assert.doesNotMatch(itemEditorSource, /createServiceClient|@garsonless\/db\/server|serviceRole/i)
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

test('MenuManager stays below its shell-state and chrome strangler decomposition budget', () => {
  const lineCount = managerSource.split('\n').length
  assert.ok(lineCount <= 240, `MenuManager grew to ${lineCount} lines`)
})
