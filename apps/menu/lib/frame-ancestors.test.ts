import assert from 'node:assert/strict'
import test from 'node:test'

import {
  frameAncestorsDirective,
  resolveFrameAncestors,
  shouldApplyMenuFrameAncestors,
} from './frame-ancestors.ts'

test('ordinary public menu routes cannot be framed', () => {
  const origins = resolveFrameAncestors({
    isThemePreview: false,
    configuredOrigins: 'https://dashboard.example.com',
    isProduction: true,
  })
  assert.deepEqual(origins, [])
  assert.equal(frameAncestorsDirective(origins), "frame-ancestors 'none'")
})

test('theme preview allows only normalized configured web origins', () => {
  const origins = resolveFrameAncestors({
    isThemePreview: true,
    configuredOrigins: 'https://dashboard.example.com/path,invalid,https://dashboard.example.com',
    isProduction: true,
  })
  assert.deepEqual(origins, ['https://dashboard.example.com'])
  assert.equal(frameAncestorsDirective(origins), 'frame-ancestors https://dashboard.example.com')
})

test('development preview includes standard and sandbox dashboard origins', () => {
  const origins = resolveFrameAncestors({
    isThemePreview: true,
    configuredOrigins: undefined,
    isProduction: false,
  })
  assert.deepEqual(origins, [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:3004',
    'http://127.0.0.1:3004',
  ])
})

test('payment callback owns its same-origin iframe CSP while other routes use the menu policy', () => {
  assert.equal(shouldApplyMenuFrameAncestors('/api/payment/callback'), false)
  assert.equal(shouldApplyMenuFrameAncestors('/api/payment'), true)
  assert.equal(shouldApplyMenuFrameAncestors('/restaurant/menu'), true)
})
