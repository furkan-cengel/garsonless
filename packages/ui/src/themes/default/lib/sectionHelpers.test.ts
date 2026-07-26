import assert from 'node:assert/strict'
import test from 'node:test'

import { makeReaders, resolveSectionTarget } from './sectionHelpers'

test('section CTA targets only resolve to supported safe actions', () => {
  assert.deepEqual(resolveSectionTarget({ targetType: 'category', targetId: 'drinks' }), {
    kind: 'anchor', href: '#section-drinks',
  })
  assert.deepEqual(resolveSectionTarget({ targetType: 'product', targetId: 'latte' }), {
    kind: 'anchor', href: '#product-latte',
  })
  assert.deepEqual(resolveSectionTarget({ targetType: 'cart' }), { kind: 'cart' })
  assert.deepEqual(resolveSectionTarget({ targetType: 'link', targetUrl: 'https://masabu.co/demo' }), {
    kind: 'external', href: 'https://masabu.co/demo',
  })
  assert.deepEqual(resolveSectionTarget({ targetType: 'link', targetUrl: 'javascript:alert(1)' }), { kind: 'none' })
  assert.deepEqual(resolveSectionTarget({ targetType: 'category' }), { kind: 'none' })
  assert.deepEqual(resolveSectionTarget({ targetType: 'none' }), { kind: 'none' })
})

test('numeric section readers use renderer defaults for empty or malformed values', () => {
  assert.equal(makeReaders({ height: '' }).number('height', 168), 168)
  assert.equal(makeReaders({ height: 'invalid' }).number('height', 168), 168)
  assert.equal(makeReaders({ height: '200' }).number('height', 168), 200)
})
