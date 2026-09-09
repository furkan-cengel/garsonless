import assert from 'node:assert/strict'
import test from 'node:test'
import { createSecurityHeaders } from '../next-security-headers.mjs'

test('production analytics cannot start before the provider and transfer review', () => {
  const previous = process.env['ANALYTICS_DATA_TRANSFER_APPROVED']
  try {
    delete process.env['ANALYTICS_DATA_TRANSFER_APPROVED']
    assert.doesNotThrow(() => createSecurityHeaders({ isProduction: true }))
    assert.throws(() => createSecurityHeaders({ analyticsEnabled: true, isProduction: true }), /provider\/transfer review/)
    assert.doesNotThrow(() => createSecurityHeaders({ analyticsEnabled: true, isProduction: false }))
    process.env['ANALYTICS_DATA_TRANSFER_APPROVED'] = 'true'
    const headers = createSecurityHeaders({ analyticsEnabled: true, isProduction: true })
    assert.match(headers.find((header) => header.key === 'Content-Security-Policy-Report-Only').value, /https:\/\/www\.googletagmanager\.com/)
  } finally {
    if (previous === undefined) delete process.env['ANALYTICS_DATA_TRANSFER_APPROVED']
    else process.env['ANALYTICS_DATA_TRANSFER_APPROVED'] = previous
  }
})
