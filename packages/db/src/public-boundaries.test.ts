import assert from 'node:assert/strict'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { test } from 'node:test'

function source(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), 'utf8')
}

function repositorySource(relativePath: string): string {
  return readFileSync(new URL(`../../../${relativePath}`, import.meta.url), 'utf8')
}

function listSourceFiles(relativeDirectory: string): string[] {
  const directory = new URL(`../../../${relativeDirectory}/`, import.meta.url)
  return readdirSync(directory).flatMap((entry) => {
    const path = new URL(entry, directory)
    if (statSync(path).isDirectory()) return listSourceFiles(`${relativeDirectory}/${entry}`)
    return /\.(?:ts|tsx)$/.test(entry) ? [`${relativeDirectory}/${entry}`] : []
  })
}

test('DB types have an explicit type-only entrypoint', () => {
  const packageJson = JSON.parse(source('../package.json')) as {
    main?: string
    exports?: Record<string, string>
  }
  const types = source('./types.ts')

  assert.equal(packageJson.main, undefined)
  assert.equal(packageJson.exports?.['.'], undefined)
  assert.equal(packageJson.exports?.['./types'], './src/types.ts')
  assert.equal(existsSync(new URL('./index.ts', import.meta.url)), false)
  assert.doesNotMatch(types, /^export(?!\s+type\b)/m)
})

test('DB type consumers use the explicit types entrypoint', () => {
  for (const directory of ['apps/dashboard', 'apps/kitchen', 'apps/menu', 'packages/ui']) {
    for (const path of listSourceFiles(directory)) {
      assert.doesNotMatch(repositorySource(path), /from ['"]@garsonless\/db['"]/, path)
    }
  }
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
