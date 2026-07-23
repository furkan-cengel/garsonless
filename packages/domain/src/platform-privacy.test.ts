import assert from 'node:assert/strict'
import test from 'node:test'
import {
  isPlatformPrivacyOperationStatus,
  isPlatformPrivacyOperationType,
  isPrivacyOperationSummary,
} from './platform-privacy'

test('privacy operation vocabularies are closed', () => {
  assert.equal(isPlatformPrivacyOperationType('export'), true)
  assert.equal(isPlatformPrivacyOperationType('erase'), true)
  assert.equal(isPlatformPrivacyOperationType('delete-tenant'), false)
  assert.equal(isPlatformPrivacyOperationStatus('completed'), true)
  assert.equal(isPlatformPrivacyOperationStatus('pending'), false)
})

test('privacy summaries contain only non-negative integral counters', () => {
  assert.equal(isPrivacyOperationSummary({
    customerCount: 1,
    consentCount: 2,
    orderLinkCount: 3,
    loyaltyRowCount: 4,
    campaignRecipientCount: 5,
    paymentShareLinkCount: 6,
    anonymizedGlobalCustomerCount: 1,
  }), true)
  assert.equal(isPrivacyOperationSummary({ customerCount: -1 }), false)
})
