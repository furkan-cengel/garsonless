import assert from 'node:assert/strict'
import test from 'node:test'

import {
  TAG_SHIMMER_CSS,
  TAG_SHIMMER_SCOPE_CLASS,
  tagShimmerScopeClass,
} from './tagShimmer'

test('tag shimmer is controlled by one theme switch and disabled when motion is off', () => {
  assert.equal(tagShimmerScopeClass({ tagShimmer: true, motion: 'full' }), TAG_SHIMMER_SCOPE_CLASS)
  assert.equal(tagShimmerScopeClass({ tagShimmer: true, motion: 'reduced' }), TAG_SHIMMER_SCOPE_CLASS)
  assert.equal(tagShimmerScopeClass({ tagShimmer: true, motion: 'none' }), undefined)
  assert.equal(tagShimmerScopeClass({ tagShimmer: false, motion: 'full' }), undefined)
})

test('tag shimmer honors the operating system reduced-motion preference', () => {
  assert.match(TAG_SHIMMER_CSS, /prefers-reduced-motion: reduce/)
  assert.match(TAG_SHIMMER_CSS, /animation: none !important/)
  assert.match(TAG_SHIMMER_CSS, /pointer-events: none/)
})
