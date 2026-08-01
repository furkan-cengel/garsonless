import assert from 'node:assert/strict'
import test from 'node:test'

import { haveSameOrderedIds } from './recommendation-editor-model'

test('recommendation selection is clean only when ids and order match', () => {
  assert.equal(haveSameOrderedIds(['a', 'b'], ['a', 'b']), true)
  assert.equal(haveSameOrderedIds(['b', 'a'], ['a', 'b']), false)
  assert.equal(haveSameOrderedIds(['a'], ['a', 'b']), false)
})
