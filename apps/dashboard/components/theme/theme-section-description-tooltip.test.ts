import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const homeSidebar = readFileSync(new URL('./ThemeExperiencePanels.tsx', import.meta.url), 'utf8')
const menuSidebar = readFileSync(new URL('./ThemeEditorSidebar.tsx', import.meta.url), 'utf8')

test('Ana Sayfa bölüm açıklamaları hover ve klavye odağında siyah tooltip ile açılır', () => {
  assert.match(homeSidebar, /TooltipTrigger render=\{<Button data-section-select/)
  assert.match(homeSidebar, /TooltipContent side="right" sideOffset=\{8\}[\s\S]*?\{catalog\.sub\}/)
  assert.match(homeSidebar, /ItemDescription className="w-full truncate text-\[10\.5px\]"/)
})

test('Menü sayfa akışı aynı tooltip ve taşma davranışını kullanır', () => {
  assert.match(menuSidebar, /TooltipTrigger render=\{<Button[\s\S]*?data-page-flow-select/)
  assert.match(menuSidebar, /TooltipContent side="right" sideOffset=\{8\}[\s\S]*?\{description\}/)
  assert.match(menuSidebar, /ItemDescription className="w-full truncate"/)
})
