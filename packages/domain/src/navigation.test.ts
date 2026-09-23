import assert from 'node:assert/strict'
import test from 'node:test'
import { safeReturnPath } from './navigation'

test('safe return path keeps same-origin paths with query and hash', () => {
  assert.equal(safeReturnPath('/dashboard?x=1#top', '/'), '/dashboard?x=1#top')
  assert.equal(safeReturnPath('/cafe/../menu', '/'), '/menu')
  assert.equal(safeReturnPath('/%2F%2Fevil.example', '/'), '/%2F%2Fevil.example')
})

test('safe return path rejects absolute and protocol-relative targets', () => {
  for (const value of ['https://evil.example', '//evil.example', '/\\evil.example', 'evil.example', 'javascript:alert(1)']) {
    assert.equal(safeReturnPath(value, '/fallback'), '/fallback', value)
  }
})

test('safe return path rejects targets that only escape after normalization', () => {
  for (const value of ['/.//evil.example', '/dashboard/..//evil.example', '/./\\evil.example', '/\t/evil.example']) {
    assert.equal(safeReturnPath(value, '/fallback'), '/fallback', value)
  }
})

test('safe return path falls back for empty or oversized input', () => {
  assert.equal(safeReturnPath(null, '/fallback'), '/fallback')
  assert.equal(safeReturnPath('', '/fallback'), '/fallback')
  assert.equal(safeReturnPath(`/${'a'.repeat(2_048)}`, '/fallback'), '/fallback')
})
