import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import {
  customerOrderSavings,
  customerOrderStatus,
  decodeCustomerOrderCursor,
  encodeCustomerOrderCursor,
  parseCustomerAccountPatch,
  projectCustomerOrderLines,
} from './customer-account-contract.ts'

test('account profile patch accepts only a normalized bounded name', () => {
  assert.deepEqual(parseCustomerAccountPatch({ name: '  Deniz   Yılmaz  ' }), { name: 'Deniz Yılmaz' })
  assert.equal(parseCustomerAccountPatch({ name: 'D' }), null)
  assert.equal(parseCustomerAccountPatch({ name: 'D'.repeat(81) }), null)
  assert.equal(parseCustomerAccountPatch({ name: 'Deniz', email: 'other@example.com' }), null)
  assert.equal(parseCustomerAccountPatch({ customerId: 'attacker', name: 'Deniz' }), null)
})

test('order cursor is opaque, versioned and rejects malformed identity fields', () => {
  const input = {
    createdAt: '2026-08-02T11:42:00.000Z',
    id: '11111111-1111-4111-8111-111111111111',
  }
  const cursor = encodeCustomerOrderCursor(input)
  assert.doesNotMatch(cursor, /2026|11111111/)
  assert.deepEqual(decodeCustomerOrderCursor(cursor), input)
  assert.equal(decodeCustomerOrderCursor(Buffer.from(JSON.stringify({ v: 1, c: input.createdAt, i: 'not-an-id' })).toString('base64url')), null)
  assert.equal(decodeCustomerOrderCursor('not-base64-json'), null)
})

test('order projection exposes bounded display snapshots and derives safe totals', () => {
  const lines = projectCustomerOrderLines([{
    itemId: 'internal-item-id',
    name: 'Trüflü Burger',
    price: 350,
    modifiersPriceDelta: 40,
    quantity: 2,
    modifiers: [{ id: 'internal-modifier-id', name: 'Ekstra cheddar', quantity: 2 }],
    removedIngredients: [{ id: 'internal-ingredient-id', name: 'Soğan' }],
    productNote: '  Sos   ayrı  ',
    station: { id: 'internal-station-id', name: 'Izgara' },
  }])
  assert.deepEqual(lines, [{
    name: 'Trüflü Burger',
    quantity: 2,
    unitPrice: 390,
    originalUnitPrice: null,
    modifiers: ['Ekstra cheddar × 2'],
    removedIngredients: ['Soğan'],
    note: 'Sos ayrı',
  }])
  assert.equal(JSON.stringify(lines).includes('internal-'), false)
  assert.equal(customerOrderSavings({ memberDiscountAmount: 10, pointsDiscountAmount: 20, stampDiscountAmount: 30, catalogDiscountAmount: 40 }), 100)
})

test('customer order status prefers settlement without hiding cancellation', () => {
  assert.deepEqual(customerOrderStatus('preparing', '2026-08-02T12:00:00.000Z'), { code: 'paid', label: 'Tamamlandı', tone: 'success' })
  assert.deepEqual(customerOrderStatus('cancelled', '2026-08-02T12:00:00.000Z'), { code: 'cancelled', label: 'İptal edildi', tone: 'danger' })
  assert.equal(customerOrderStatus('unexpected', null).code, 'pending')
})

test('account routes derive ownership from the trusted session', () => {
  const accountRoute = readFileSync(new URL('../app/api/account/route.ts', import.meta.url), 'utf8')
  const ordersRoute = readFileSync(new URL('../app/api/account/orders/route.ts', import.meta.url), 'utf8')
  const detailRoute = readFileSync(new URL('../app/api/account/orders/[id]/route.ts', import.meta.url), 'utf8')
  const accountServer = readFileSync(new URL('./customer-account-server.ts', import.meta.url), 'utf8')
  const dbPort = readFileSync(new URL('../../../packages/db/src/customer-account-read-port.ts', import.meta.url), 'utf8')

  for (const route of [accountRoute, ordersRoute, detailRoute]) {
    assert.match(route, /getCustomerSession\(\)/)
    assert.doesNotMatch(route, /searchParams\.get\(['"]customerId/)
  }
  assert.match(accountServer, /customerId: input\.session\.customerId/)
  assert.match(accountServer, /readCustomerOrderRecord\(session\.customerId, orderId\)/)
  assert.match(dbPort, /\.eq\('customer_id', input\.customerId\)/)
  assert.match(dbPort, /\.eq\('customer_id', customerId\)/)
})

test('account UI keeps the global entry visible and ships account accessibility semantics', () => {
  const menuPage = readFileSync(new URL('../app/[slug]/MenuPageClient.tsx', import.meta.url), 'utf8')
  const header = readFileSync(new URL('../../../packages/ui/src/menu/Header.tsx', import.meta.url), 'utf8')
  const drawer = readFileSync(new URL('../../../packages/ui/src/menu/NavDrawer.tsx', import.meta.url), 'utf8')
  const center = readFileSync(new URL('../app/[slug]/components/AccountCenter.tsx', import.meta.url), 'utf8')

  assert.match(menuPage, /onOpenMember=\{\(\) => \{ setCustomerAuthSurface\('menu'\); setIsMemberOpen\(true\) \}\}/)
  assert.match(header, /aria-label=\{memberIsMember \? 'Hesabımı aç' : 'Müşteri hesabını aç'\}/)
  assert.match(header, /height: 44, minWidth: 44/)
  assert.match(drawer, /'Hesap ve üyelik'/)
  assert.match(center, /role="tablist"/)
  assert.match(center, /aria-live="polite"/)
  assert.match(center, /prefers-reduced-motion:reduce/)
})
