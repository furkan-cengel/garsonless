import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { projectSettlementItems } from '../../lib/settlement-items'

test('projects canonical settlement item details without flattening them', () => {
  const items = projectSettlementItems([{
    itemId: 'burger',
    name: 'Özel Burger',
    price: 280,
    quantity: 2,
    modifiers: [
      { groupName: 'Pişirme', optionName: 'Orta', quantity: 1 },
      { groupName: 'Ekstra', optionName: 'Cheddar', quantity: 2 },
    ],
    removedIngredients: [{ id: 'onion', name: 'Soğan' }, { id: 'pickle', name: 'Turşu' }],
    productNote: 'Ayrı tabakta servis edin.',
  }])

  assert.deepEqual(items, [{
    lineIndex: 0,
    name: 'Özel Burger',
    quantity: 2,
    unitPrice: 280,
    total: 560,
    productNote: 'Ayrı tabakta servis edin.',
    modifiers: [
      { groupName: 'Pişirme', optionName: 'Orta', quantity: 1 },
      { groupName: 'Ekstra', optionName: 'Cheddar', quantity: 2 },
    ],
    removedIngredients: ['Soğan', 'Turşu'],
  }])
})

test('projects historical aliases through the shared snapshot compatibility reader', () => {
  const items = projectSettlementItems([{
    name: 'Limonata',
    qty: 3,
    modifiers: [{ group_name: 'Şeker', option_name: 'Az şeker', quantity: 1 }],
    removedIngredients: ['Buz'],
    product_note: '  Pipetsiz  ',
  }])

  assert.deepEqual(items, [{
    lineIndex: 0,
    name: 'Limonata',
    quantity: 3,
    unitPrice: 0,
    total: 0,
    productNote: 'Pipetsiz',
    modifiers: [{ groupName: 'Şeker', optionName: 'Az şeker', quantity: 1 }],
    removedIngredients: ['Buz'],
  }])
})

test('settlement and transfer surfaces consume the same structured item component', () => {
  const directory = fileURLToPath(new URL('.', import.meta.url))
  const action = readFileSync(`${directory}/../../lib/actions/settlement.ts`, 'utf8')
  const settlement = readFileSync(`${directory}/SettlementSheet.tsx`, 'utf8')
  const transfer = readFileSync(`${directory}/TableTransferDialog.tsx`, 'utf8')
  const transferSelector = readFileSync(`${directory}/TableTransferOrderSelector.tsx`, 'utf8')

  assert.match(action, /items: projectSettlementItems\(r\.items\)/)
  assert.doesNotMatch(action, /itemsSummary/)
  assert.match(settlement, /<SettlementOrderItems items=\{o\.items\}/)
  assert.match(transfer, /<TableTransferOrderSelector/)
  assert.match(transferSelector, /<SettlementOrderItems items=\{\[item\]\} compact/)
  assert.doesNotMatch(transfer, /labelOf|itemsSummary/)
})
