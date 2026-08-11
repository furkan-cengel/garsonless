import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const directory = fileURLToPath(new URL('.', import.meta.url))
const categoryNavSource = readFileSync(`${directory}/CategoryNav.tsx`, 'utf8')
const filterBarSource = readFileSync(`${directory}/DietaryFilterBar.tsx`, 'utf8')
const menuPageSource = readFileSync(`${directory}/../themes/default/MenuPage.tsx`, 'utf8')

test('category navigation keeps the filter control fixed while category chips scroll', () => {
  assert.match(categoryNavSource, /leadingControl\?: ReactNode/)
  assert.match(categoryNavSource, /\{leadingControl\}/)
  assert.match(categoryNavSource, /data-catnav-scroll/)
  assert.match(categoryNavSource, /minWidth: 0,[\s\S]*?flex: 1,[\s\S]*?overflowX: 'auto'/)
  assert.match(categoryNavSource, /width: 'max-content',[\s\S]*?minWidth: '100%'/)
  assert.match(categoryNavSource, /const minHeight = density === 'compact' \? 34 : density === 'comfortable' \? 44 : 38/)
  assert.match(menuPageSource, /<CategoryNav[\s\S]*?leadingControl=\{menuFilters\}/)
  assert.doesNotMatch(menuPageSource, /data-component="dietary-filters"/)
})

test('menu filter trigger is compact, counted and keyboard dismissible', () => {
  assert.match(filterBarSource, /<SlidersHorizontal size=\{17\}/)
  assert.match(filterBarSource, /width: 42,[\s\S]*?height: 38/)
  assert.match(filterBarSource, /aria-haspopup="dialog"/)
  assert.match(filterBarSource, /aria-expanded=\{open\}/)
  assert.match(filterBarSource, /role="dialog"/)
  assert.match(filterBarSource, /event\.key !== 'Escape'/)
  assert.match(filterBarSource, /triggerRef\.current\?\.focus\(\)/)
  assert.match(filterBarSource, /onSelectionChange\(reconciled\)/)
  assert.match(filterBarSource, /\{activeCount\}<\/span>/)
  assert.match(filterBarSource, /filter\.kind === 'custom'/)
})
