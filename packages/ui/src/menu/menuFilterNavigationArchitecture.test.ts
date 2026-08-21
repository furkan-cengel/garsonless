import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const directory = fileURLToPath(new URL('.', import.meta.url))
const categoryNavSource = readFileSync(`${directory}/CategoryNav.tsx`, 'utf8')
const filterBarSource = readFileSync(`${directory}/DietaryFilterBar.tsx`, 'utf8')
const visualNavSource = readFileSync(`${directory}/VisualCategoryNavigator.tsx`, 'utf8')
const previewBridgeSource = readFileSync(`${directory}/ThemePreviewBridge.tsx`, 'utf8')
const menuPageSource = readFileSync(`${directory}/../themes/default/MenuPage.tsx`, 'utf8')

test('category navigation keeps the filter control fixed while category chips scroll', () => {
  assert.match(categoryNavSource, /leadingControl\?: ReactNode/)
  assert.match(categoryNavSource, /\{leadingControl\}/)
  assert.match(categoryNavSource, /data-catnav-scroll/)
  assert.match(categoryNavSource, /minWidth: 0,[\s\S]*?flex: 1,[\s\S]*?overflowX: 'auto'/)
  assert.match(categoryNavSource, /width: 'max-content',[\s\S]*?minWidth: '100%'/)
  assert.match(categoryNavSource, /minWidth: 44,[\s\S]*?minHeight: 44/)
  assert.match(categoryNavSource, /const visibleHeight = density === 'compact' \? 32 : density === 'comfortable' \? 40 : 36/)
  assert.match(categoryNavSource, /clamp\(12px, calc\(var\(--p-fs\) - 2px\), 17px\)/)
  assert.match(categoryNavSource, /justifyContent: contentFits \? 'center' : 'flex-start'/)
  assert.match(categoryNavSource, /role="status"/)
  assert.match(menuPageSource, /<CategoryNav[\s\S]*?leadingControl=\{menuFilters\}/)
  assert.doesNotMatch(menuPageSource, /data-component="dietary-filters"/)
})

test('menu filter trigger is compact, counted and keyboard dismissible', () => {
  assert.match(filterBarSource, /<SlidersHorizontal size=\{17\}/)
  assert.match(filterBarSource, /width: 44,[\s\S]*?height: 44/)
  assert.match(filterBarSource, /data-filter-trigger-surface style=\{\{ width: 42, height: 38/)
  assert.match(filterBarSource, /aria-haspopup="dialog"/)
  assert.match(filterBarSource, /aria-expanded=\{open\}/)
  assert.match(filterBarSource, /role="dialog"/)
  assert.match(filterBarSource, /event\.key !== 'Escape'/)
  assert.match(filterBarSource, /triggerRef\.current\?\.focus\(\)/)
  assert.match(filterBarSource, /onSelectionChange\(reconciled\)/)
  assert.match(filterBarSource, /\{activeCount\}<\/span>/)
  assert.match(filterBarSource, /filter\.kind === 'custom'/)
})

test('visual category navigation uses bounded responsive cards and compact 44px controls', () => {
  assert.match(visualNavSource, /maxWidth: 420/)
  assert.match(visualNavSource, /@container \(min-width:560px\)/)
  assert.match(visualNavSource, /@container \(min-width:900px\)/)
  assert.match(visualNavSource, /@container \(min-width:1280px\)/)
  assert.match(visualNavSource, /width: 44,[\s\S]*?height: 44/)
  assert.match(visualNavSource, /data-visual-back-surface/)
  assert.match(visualNavSource, /@media \(hover:hover\) and \(pointer:fine\)/)
  assert.match(visualNavSource, /@media \(prefers-reduced-motion:reduce\)/)
  assert.match(visualNavSource, /event\.key === 'Home'/)
  assert.match(visualNavSource, /event\.key === 'End'/)
  assert.match(menuPageSource, /window\.history\.pushState\([\s\S]*?#category-/)
  assert.match(menuPageSource, /window\.addEventListener\('popstate'/)
})

test('editor page-flow reveal uses the shared resolver without filling browser history', () => {
  assert.match(menuPageSource, /resolveMenuPageFlow\(/)
  assert.match(menuPageSource, /data-menu-page-section-id=\{block\.id\}/)
  assert.match(previewBridgeSource, /data\.type === 'REVEAL_MENU_PAGE_BLOCK'/)
  assert.match(previewBridgeSource, /window\.history\.replaceState/)
  assert.doesNotMatch(previewBridgeSource, /REVEAL_MENU_PAGE_BLOCK'[\s\S]{0,700}pushState/)
  assert.match(previewBridgeSource, /prefers-reduced-motion: reduce/)
})
