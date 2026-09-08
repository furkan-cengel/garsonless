import assert from 'node:assert/strict'
import test from 'node:test'
import { brandEmailSender } from './email-messages'

test('transactional sender has a brand name while keeping the configured mailbox', () => {
  assert.equal(brandEmailSender(' noreply@masabu.co '), 'masabu <noreply@masabu.co>')
  assert.equal(brandEmailSender('noreply@masabu.co <noreply@masabu.co>'), 'masabu <noreply@masabu.co>')
  assert.equal(brandEmailSender('Masabu <billing@masabu.co>'), 'masabu <billing@masabu.co>')
  assert.equal(brandEmailSender('Masabu Faturalama <billing@masabu.co>'), 'Masabu Faturalama <billing@masabu.co>')
})

test('sender configuration fails closed for missing, multiple or injected addresses', () => {
  for (const value of [undefined, '', 'not an address', 'a@masabu.co,b@masabu.co', 'a@masabu.co\r\nBcc: b@example.com']) {
    assert.equal(brandEmailSender(value), undefined)
  }
})
