import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { test } from 'node:test'

function source(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), 'utf8')
}

test('root DB entrypoint stays type-only', () => {
  const root = source('./index.ts')
  assert.doesNotMatch(root, /^export(?!\s+type\b)/m)
})

test('browser DB entrypoint is explicit and cannot grow through a wildcard', () => {
  const browser = source('./browser.ts')
  assert.doesNotMatch(browser, /export\s+\*/)
  assert.doesNotMatch(browser, /createServiceClient|\.\/server/)
})

test('server DB entrypoint exposes ports, not the raw service-role client', () => {
  const server = source('./server.ts')
  assert.doesNotMatch(server, /createServiceClient|from ['"]\.\/client['"]/)
})

test('retired compatibility facades stay deleted', () => {
  for (const path of ['./customer-auth.ts', './menu-nutrition.ts', './service-request-types.ts']) {
    assert.equal(existsSync(new URL(path, import.meta.url)), false, `${path} must not be restored`)
  }
})
