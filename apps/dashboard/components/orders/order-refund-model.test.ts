import assert from 'node:assert/strict'
import test from 'node:test'
import { parseOrderRefundAmount } from './order-refund-model'

test('refund input accepts comma and dot cents and enforces remaining maximum', () => {
  for (const [text, amount] of [['19,99', 19.99], [' 0.29 ', 0.29], ['1,1', 1.1], ['130,01', 130.01]] as const) {
    assert.equal(parseOrderRefundAmount(text, 130.01), amount)
  }
  assert.equal(parseOrderRefundAmount('130,02', 130.01), null)
})

test('refund input never rounds excess decimals or accepts ambiguous numeric notation', () => {
  for (const text of ['', ' ', '0', '-1', '19,999', '1e2', '0x10', '1.000,00', '1,2,3', 'Infinity']) {
    assert.equal(parseOrderRefundAmount(text, 1000), null, text)
  }
})
