import assert from 'node:assert/strict'
import test from 'node:test'
import { classifyCampaignMarketingContacts, classifyCampaignMarketingEmails } from './campaigns'

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

  assert.deepEqual(result.contacts.map((contact) => ({ id: contact.customerId, phone: contact.recipient })), [
    { id: 'a', phone: '+905321234567' },
    { id: 'd', phone: '+442079460958' },
  ])
  assert.equal(result.skippedNoMarketingConsent, 1)
  assert.equal(result.skippedInvalidContact, 1)
  assert.equal(result.skippedDuplicateContact, 1)
})

test('email campaign audience requires consent, validates and deduplicates normalized email', () => {
  const result = classifyCampaignMarketingEmails([
    { customerId: 'a', name: 'A' },
    { customerId: 'b', name: 'B' },
    { customerId: 'c', name: 'C' },
    { customerId: 'd', name: 'D' },
  ], new Set(['a', 'b', 'c']), new Map([
    ['a', { name: 'A', email: ' USER@example.com ' }],
    ['b', { name: 'B', email: 'user@example.com' }],
    ['c', { name: 'C', email: 'bozuk' }],
    ['d', { name: 'D', email: 'other@example.com' }],
  ]))

  assert.deepEqual(result.contacts.map((contact) => contact.recipient), ['user@example.com'])
  assert.equal(result.skippedNoMarketingConsent, 1)
  assert.equal(result.skippedInvalidContact, 1)
  assert.equal(result.skippedDuplicateContact, 1)
})
