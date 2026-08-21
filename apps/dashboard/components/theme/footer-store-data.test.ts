import assert from 'node:assert/strict'
import test from 'node:test'

import { resolveFooterStoreDataAvailability } from './footer-store-data'

test('footer data readiness mirrors only renderable public store fields', () => {
  assert.deepEqual(resolveFooterStoreDataAvailability(null), {
    address: false,
    contact: false,
    social: false,
  })

  assert.deepEqual(resolveFooterStoreDataAvailability({
    contact: {
      city: 'İstanbul',
      email: 'hello@example.com',
      instagram: '@masabu',
    },
  }), {
    address: true,
    contact: true,
    social: true,
  })
})

test('invalid links stay marked as missing instead of promising invisible footer content', () => {
  assert.deepEqual(resolveFooterStoreDataAvailability({
    contact: {
      email: 'bozuk',
      website: 'javascript:alert(1)',
      instagram: '',
    },
  }), {
    address: false,
    contact: false,
    social: false,
  })
})
