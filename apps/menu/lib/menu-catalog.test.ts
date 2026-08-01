import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'

test('catalog projection is isolated from the page orchestration shell', () => {
  const hook = readFileSync(new URL('./hooks/useMenuCatalog.ts', import.meta.url), 'utf8')
  const shell = readFileSync(new URL('../app/[slug]/MenuPageClient.tsx', import.meta.url), 'utf8')
  assert.match(hook, /filteredItems/)
  assert.match(hook, /itemsByCategory/)
  assert.match(hook, /cartQuantityByItemId/)
  assert.match(shell, /useMenuCatalog/)
  assert.doesNotMatch(shell, /const itemsByCategory = useMemo/)
})
