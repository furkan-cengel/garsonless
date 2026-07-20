import assert from 'node:assert/strict'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { test } from 'node:test'

const packageRoot = new URL('../', import.meta.url)
const repositoryRoot = new URL('../../../', import.meta.url)

function source(relativePath: string): string {
  return readFileSync(new URL(relativePath, repositoryRoot), 'utf8')
}

function listSourceFiles(relativeDirectory: string): string[] {
  const directory = new URL(`./${relativeDirectory}/`, repositoryRoot)
  return readdirSync(directory).flatMap((entry) => {
    const path = new URL(entry, directory)
    if (statSync(path).isDirectory()) return listSourceFiles(`${relativeDirectory}/${entry}`)
    return /\.(?:ts|tsx)$/.test(entry) ? [`${relativeDirectory}/${entry}`] : []
  })
}

test('application package has no ambiguous root barrel', () => {
  const packageJson = JSON.parse(readFileSync(new URL('./package.json', packageRoot), 'utf8')) as {
    main?: string
    exports?: Record<string, string>
  }

  assert.equal(packageJson.main, undefined)
  assert.equal(packageJson.exports?.['.'], undefined)
  assert.equal(existsSync(new URL('./src/index.ts', packageRoot)), false)
})

test('application consumers use explicit feature entrypoints', () => {
  const workspaceFiles = [
    'apps/dashboard',
    'apps/kitchen',
    'apps/menu',
    'packages/db',
  ]

  for (const directory of workspaceFiles) {
    for (const path of listSourceFiles(directory)) {
      assert.doesNotMatch(source(`./${path}`), /from ['"]@garsonless\/application['"]/, path)
    }
  }
})
