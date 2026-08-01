import assert from 'node:assert/strict'
import test from 'node:test'
import {
  isEmptyCustomerSegmentDefinition,
  isCustomerLapsed,
  isCustomerNew,
  maskCustomerEmail,
  maskCustomerPhone,
  normalizeCustomerEmail,
  resolveCustomerName,
  sanitizeCustomerSegmentDefinition,
} from './customers'

const REFERENCE_NOW = '2026-07-30T12:00:00.000Z'

test('customer PII masking keeps only the minimum useful identity hint', () => {
  assert.equal(maskCustomerPhone('+90 532 123 45 67'), '0532 *** ** 67')
  assert.equal(maskCustomerEmail('customer@example.com'), 'cu******@example.com')
  assert.equal(maskCustomerPhone(null), '—')
})

test('auth identity normalization is deterministic and bounded', () => {
  assert.equal(normalizeCustomerEmail('  Member@Example.COM '), 'member@example.com')
  assert.equal(normalizeCustomerEmail(null), null)
  assert.equal(resolveCustomerName(null, { full_name: '  Ada Lovelace  ' }), 'Ada Lovelace')
  assert.equal(resolveCustomerName(' Explicit ', { full_name: 'Provider' }), 'Explicit')
})

test('segment definitions discard unknown, negative and malformed rules', () => {
  assert.deepEqual(sanitizeCustomerSegmentDefinition({
    consent: 'granted',
    visits: { op: '>=', value: 4.999 },
    spend: { op: '>', value: 10 },
    points: { op: '<=', value: -1 },
    ignored: { op: '>=', value: 20 },
  }), {
    consent: 'granted',
    visits: { op: '>=', value: 4.99 },
  })
})

test('empty segment detection follows the canonical sanitized vocabulary', () => {
  assert.equal(isEmptyCustomerSegmentDefinition({}), true)
  assert.equal(isEmptyCustomerSegmentDefinition({ consent: 'missing' }), false)
  assert.equal(isEmptyCustomerSegmentDefinition({ spend: { op: '>=', value: 100 } }), false)
})

test('built-in customer segment edges are inclusive and share one exact-time contract', () => {
  assert.equal(isCustomerNew('2026-06-30T12:00:00.000Z', REFERENCE_NOW), true)
  assert.equal(isCustomerNew('2026-06-30T11:59:59.999Z', REFERENCE_NOW), false)
  assert.equal(isCustomerLapsed('2026-05-31T12:00:00.000Z', REFERENCE_NOW), true)
  assert.equal(isCustomerLapsed('2026-05-31T12:00:00.001Z', REFERENCE_NOW), false)
  assert.equal(isCustomerNew(null, REFERENCE_NOW), false)
  assert.equal(isCustomerLapsed('not-a-date', REFERENCE_NOW), false)
})
