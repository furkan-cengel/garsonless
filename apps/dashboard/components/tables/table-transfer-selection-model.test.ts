import assert from 'node:assert/strict'
import test from 'node:test'
import type { SettlementLineItem } from '../../lib/settlement-items'
import {
  buildInitialTransferItemSelection,
  fullySelectedOrderIds,
  orderSelectionState,
  selectedTransferItems,
  selectionNeedsOrderSplit,
  setTransferItemQuantity,
  toggleTransferItem,
  toggleTransferOrder,
  transferItemKey,
} from './table-transfer-selection-model'

function item(lineIndex: number, quantity: number): SettlementLineItem {
  return { lineIndex, name: `Ürün ${lineIndex}`, quantity, unitPrice: 100, total: quantity * 100, productNote: null, modifiers: [], removedIngredients: [] }
}

const orders = [{ id: 'order-a', items: [item(0, 1), item(1, 2)] }]

test('initial order selection expands into every product quantity', () => {
  assert.deepEqual(buildInitialTransferItemSelection(orders, ['order-a'], false), {
    [transferItemKey('order-a', 0)]: 1,
    [transferItemKey('order-a', 1)]: 2,
  })
})

test('a single product can be selected and its transfer quantity reduced', () => {
  let selected = toggleTransferItem({}, 'order-a', orders[0]!.items[1]!, true)
  selected = setTransferItemQuantity(selected, 'order-a', orders[0]!.items[1]!, 1)
  assert.deepEqual(selectedTransferItems(orders, selected), [{ orderId: 'order-a', lineIndex: 1, quantity: 1 }])
  assert.equal(orderSelectionState(orders[0]!, selected), 'partial')
  assert.equal(selectionNeedsOrderSplit(orders, selected), true)
})

test('whole-order selection stays on the established order transfer path', () => {
  const selected = toggleTransferOrder({}, orders[0]!, true)
  assert.equal(orderSelectionState(orders[0]!, selected), 'all')
  assert.deepEqual(fullySelectedOrderIds(orders, selected), ['order-a'])
  assert.equal(selectionNeedsOrderSplit(orders, selected), false)
})
