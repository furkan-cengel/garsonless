import assert from 'node:assert/strict'
import test from 'node:test'
import { classifyCampaignMarketingContacts } from './campaigns'

test('campaign audience separates consent, invalid phone and normalized-phone duplicates', () => {
  const result = classifyCampaignMarketingContacts([
    { customerId: 'a', name: 'A' },
    { customerId: 'b', name: 'B' },
    { customerId: 'c', name: 'C' },
    { customerId: 'd', name: 'D' },
    { customerId: 'e', name: 'E' },
  ], new Set(['a', 'b', 'c', 'd']), new Map([
    ['a', { name: 'A', phone: '0532 123 45 67' }],
    ['b', { name: 'B', phone: '+90 532 123 45 67' }],
    ['c', { name: 'C', phone: '0312 123 45 67' }],
    ['d', { name: 'D', phone: '+44 20 7946 0958' }],
    ['e', { name: 'E', phone: '+90 533 111 22 33' }],
  ]))

  assert.deepEqual(result.contacts.map((contact) => ({ id: contact.customerId, phone: contact.phone })), [
    { id: 'a', phone: '+905321234567' },
    { id: 'd', phone: '+442079460958' },
  ])
  assert.equal(result.skippedNoMarketingConsent, 1)
  assert.equal(result.skippedInvalidPhone, 1)
  assert.equal(result.skippedDuplicatePhone, 1)
})
