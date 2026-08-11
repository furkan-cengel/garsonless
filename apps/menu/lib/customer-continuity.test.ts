import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import {
  parseCustomerFavoriteDelete,
  parseCustomerFavoritePut,
} from './customer-account-contract.ts'
import { menuTenantScopeKey } from './menu-scope-key.ts'

const RESTAURANT_ID = '11111111-1111-4111-8111-111111111111'
const ITEM_ID = '22222222-2222-4222-8222-222222222222'
const OTHER_ITEM_ID = '33333333-3333-4333-8333-333333333333'

test('favorite commands are bounded, strict and idempotent at the contract edge', () => {
  assert.deepEqual(parseCustomerFavoritePut({
    restaurantId: RESTAURANT_ID,
    menuItemIds: [ITEM_ID, ITEM_ID, OTHER_ITEM_ID],
  }), { restaurantId: RESTAURANT_ID, menuItemIds: [ITEM_ID, OTHER_ITEM_ID] })
  assert.equal(parseCustomerFavoritePut({ restaurantId: RESTAURANT_ID, menuItemIds: [ITEM_ID], customerId: 'attacker' }), null)
  assert.equal(parseCustomerFavoritePut({ restaurantId: RESTAURANT_ID, menuItemIds: [] }), null)
  assert.deepEqual(parseCustomerFavoriteDelete({ restaurantId: RESTAURANT_ID, menuItemId: ITEM_ID }), {
    restaurantId: RESTAURANT_ID,
    menuItemId: ITEM_ID,
  })
})

test('cart and active-order keys separate restaurants and table sessions', () => {
  assert.equal(menuTenantScopeKey(RESTAURANT_ID, null), `v1:${RESTAURANT_ID}:menu`)
  assert.notEqual(menuTenantScopeKey(RESTAURANT_ID, ITEM_ID), menuTenantScopeKey(RESTAURANT_ID, OTHER_ITEM_ID))
  assert.notEqual(menuTenantScopeKey(RESTAURANT_ID, null), menuTenantScopeKey(OTHER_ITEM_ID, null))

  const cartStore = readFileSync(new URL('./store/useCartStore.ts', import.meta.url), 'utf8')
  const orderStore = readFileSync(new URL('./store/useOrderStore.ts', import.meta.url), 'utf8')
  assert.match(cartStore, /version: 6/)
  assert.match(cartStore, /legacyUnbound: version < 6/)
  assert.match(cartStore, /lastTableByRestaurant/)
  assert.match(orderStore, /version: 2/)
  assert.match(orderStore, /legacyUnbound: version < 2/)
  assert.match(orderStore, /bindScope: \(restaurantId, tableToken\)/)
})

test('favorite and reorder APIs derive customer ownership from the HttpOnly session', () => {
  const favoritesRoute = readFileSync(new URL('../app/api/account/favorites/route.ts', import.meta.url), 'utf8')
  const reorderRoute = readFileSync(new URL('../app/api/account/orders/[id]/reorder-preview/route.ts', import.meta.url), 'utf8')
  const accountServer = readFileSync(new URL('./customer-account-server.ts', import.meta.url), 'utf8')
  const continuityPort = readFileSync(new URL('../../../packages/db/src/customer-continuity-port.ts', import.meta.url), 'utf8')

  for (const route of [favoritesRoute, reorderRoute]) {
    assert.match(route, /getCustomerSession\(\)/)
    assert.doesNotMatch(route, /customerId/)
  }
  assert.match(favoritesRoute, /validateCustomerAuthMutation\(request\)/)
  assert.match(reorderRoute, /validateCustomerAuthMutation\(request\)/)
  assert.match(accountServer, /customerId: session\.customerId/)
  assert.match(continuityPort, /\.eq\('customer_id', input\.customerId\)/)
})

test('auth return preserves a closed surface context without putting PII in the URL', () => {
  const memberSheet = readFileSync(new URL('../app/[slug]/components/MemberSheet.tsx', import.meta.url), 'utf8')
  const menuPage = readFileSync(new URL('../app/[slug]/MenuPageClient.tsx', import.meta.url), 'utf8')
  const continuity = readFileSync(new URL('./menu-continuity-client.ts', import.meta.url), 'utf8')

  assert.match(memberSheet, /storePendingCustomerAuthContext/)
  assert.match(memberSheet, /guestSessionId/)
  assert.match(memberSheet, /deviceId/)
  assert.match(menuPage, /consumePendingCustomerAuthContext/)
  assert.match(menuPage, /case 'cart'/)
  assert.match(menuPage, /case 'order'/)
  assert.match(menuPage, /case 'bill'/)
  assert.match(menuPage, /case 'split'/)
  assert.match(menuPage, /case 'service'/)
  assert.match(continuity, /expiresAt: Date\.now\(\) \+ 10 \* 60_000/)
  assert.doesNotMatch(continuity, /\b(email|name|consent)\b/)
})

test('favorite controls are accessible and reorder remains an explicit preview', () => {
  const productCard = readFileSync(new URL('../../../packages/ui/src/menu/ProductCard.tsx', import.meta.url), 'utf8')
  const menuPage = readFileSync(new URL('../app/[slug]/MenuPageClient.tsx', import.meta.url), 'utf8')
  const accountCenter = readFileSync(new URL('../app/[slug]/components/AccountCenter.tsx', import.meta.url), 'utf8')
  assert.match(productCard, /aria-pressed=\{favorite\}/)
  assert.match(productCard, /width: 44, height: 44/)
  assert.match(productCard, /width: 38, height: 38/)
  assert.match(productCard, /AppIcons\.heart size=\{17\}/)
  assert.match(menuPage, /\.\.\.\(member \? \{[\s\S]*?onToggleFavorite:[\s\S]*?\} : \{\}\)/)
  assert.match(accountCenter, /Güvenli önizleme/)
  assert.match(accountCenter, /Sipariş verilmedi; güncel menü doğrulandı\./)
  assert.doesNotMatch(accountCenter, /\/api\/orders\/place/)
})
