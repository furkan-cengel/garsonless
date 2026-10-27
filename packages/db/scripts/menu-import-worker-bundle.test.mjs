import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
test('deployed menu reader is the exact application adapter exercised by provider tests', () => {
  const source = readFileSync(new URL('../../application/src/menu-import.ts', import.meta.url), 'utf8')
  const worker = readFileSync(new URL('../supabase/functions/_shared/menu-import.ts', import.meta.url), 'utf8')
  assert.equal(worker.split('\n').slice(2).join('\n'), source)
})

test('deployed invoice reader is the exact application adapter exercised by provider tests', () => {
  const source = readFileSync(new URL('../../application/src/invoice-import.ts', import.meta.url), 'utf8')
  const worker = readFileSync(new URL('../supabase/functions/_shared/invoice-import.ts', import.meta.url), 'utf8')
  assert.equal(worker.split('\n').slice(2).join('\n'), source)
})
