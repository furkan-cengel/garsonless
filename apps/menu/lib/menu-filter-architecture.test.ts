import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const directory = fileURLToPath(new URL('.', import.meta.url))
const catalogSource = readFileSync(`${directory}/hooks/useMenuCatalog.ts`, 'utf8')
const pageSource = readFileSync(`${directory}/../app/[slug]/MenuPageClient.tsx`, 'utf8')

test('public menu applies selected preset and manual filters through one catalog model', () => {
  assert.match(catalogSource, /itemMatchesMenuFilters/)
  assert.match(catalogSource, /items\.filter\(\(item\) => itemMatchesMenuFilters\(item, menuFilters\)\)/)
  assert.match(pageSource, /useState<MenuFilterDefinition\[]>\(\[\]\)/)
  assert.match(pageSource, /<DietaryFilterBar/)
  assert.match(pageSource, /selected=\{menuFilters\}/)
  assert.match(pageSource, /onClear=\{\(\) => setMenuFilters\(\[\]\)\}/)
  assert.match(pageSource, /onSelectionChange=\{setMenuFilters\}/)
  assert.match(pageSource, /Seçili filtrelere uyan ürün yok\./)
})
