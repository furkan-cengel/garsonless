import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

// GMP-3 section 6.1 (15): only the ÖKC issues a fiscal receipt; any other printout must say it has no fiscal value.
test('the order receipt says it is not a fiscal receipt, at the top and the bottom', () => {
  const source = readFileSync(new URL('./ReceiptModal.tsx', import.meta.url), 'utf8')
  assert.match(source, /const FISCAL_DISCLAIMER = 'MALİ DEĞERİ YOKTUR · FİŞ YERİNE GEÇMEZ'/)
  assert.equal(source.match(/\{FISCAL_DISCLAIMER\}/g)?.length, 2)
})
