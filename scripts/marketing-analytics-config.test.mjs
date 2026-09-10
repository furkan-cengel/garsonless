import assert from 'node:assert/strict'
import test from 'node:test'
import { createSecurityHeaders } from '../next-security-headers.mjs'

test('production analytics requires an explicit technical activation independent of legal review', () => {
  const previous = process.env['ANALYTICS_PRODUCTION_ENABLED']
  const previousReview = process.env['ANALYTICS_DATA_TRANSFER_APPROVED']
  try {
    delete process.env['ANALYTICS_PRODUCTION_ENABLED']
    process.env['ANALYTICS_DATA_TRANSFER_APPROVED'] = 'true'
    assert.doesNotThrow(() => createSecurityHeaders({ isProduction: true }))
    assert.throws(() => createSecurityHeaders({ analyticsEnabled: true, isProduction: true }), /explicit production activation/)
    assert.doesNotThrow(() => createSecurityHeaders({ analyticsEnabled: true, isProduction: false }))
    process.env['ANALYTICS_DATA_TRANSFER_APPROVED'] = 'false'
    process.env['ANALYTICS_PRODUCTION_ENABLED'] = 'false'
    assert.throws(() => createSecurityHeaders({ analyticsEnabled: true, isProduction: true }), /explicit production activation/)
    process.env['ANALYTICS_PRODUCTION_ENABLED'] = 'true'
    const headers = createSecurityHeaders({ analyticsEnabled: true, isProduction: true })
    assert.match(headers.find((header) => header.key === 'Content-Security-Policy-Report-Only').value, /https:\/\/www\.googletagmanager\.com/)
  } finally {
    if (previous === undefined) delete process.env['ANALYTICS_PRODUCTION_ENABLED']
    else process.env['ANALYTICS_PRODUCTION_ENABLED'] = previous
    if (previousReview === undefined) delete process.env['ANALYTICS_DATA_TRANSFER_APPROVED']
    else process.env['ANALYTICS_DATA_TRANSFER_APPROVED'] = previousReview
  }
})
