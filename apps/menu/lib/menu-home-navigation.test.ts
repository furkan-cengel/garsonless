import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const menuClient = readFileSync(new URL('../app/[slug]/MenuPageClient.tsx', import.meta.url), 'utf8')
const menuExperience = readFileSync(new URL('../app/[slug]/_menu-experience.tsx', import.meta.url), 'utf8')
const tablePage = readFileSync(new URL('../app/[slug]/table/[tableId]/page.tsx', import.meta.url), 'utf8')
const defaultMenu = readFileSync(new URL('../../../packages/ui/src/themes/default/MenuPage.tsx', import.meta.url), 'utf8')
const header = readFileSync(new URL('../../../packages/ui/src/menu/Header.tsx', import.meta.url), 'utf8')
const drawer = readFileSync(new URL('../../../packages/ui/src/menu/NavDrawer.tsx', import.meta.url), 'utf8')

test('enabled live home surfaces expose a table-safe return path from the menu drawer', () => {
  assert.match(menuExperience, /const homeEnabled = !isPreview && experienceV2Enabled && servedTheme\.surfaces\?\.home\.enabled === true/)
  assert.match(menuExperience, /homeEnabled=\{homeEnabled\}/)
  assert.match(tablePage, /homeEnabled=\{homeEnabled\}/)
  assert.match(menuClient, /const homeHref = homeEnabled[\s\S]*?encodeURIComponent\(tableToken\)/)
  assert.match(menuClient, /homeHref=\{homeHref\}/)
  assert.match(defaultMenu, /homeHref=\{homeHref \?\? null\}/)
  assert.match(header, /<NavDrawer[\s\S]*?homeHref=\{homeHref\}/)
  assert.match(drawer, /homeHref && \([\s\S]*?data-drawer-home-link[\s\S]*?Ana Sayfa/)
})
