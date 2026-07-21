import assert from 'node:assert/strict'
import test from 'node:test'
import { getPanoGreeting, getPanoHealthChecks, getPanoKpiCards, getPanoQuickActions } from './pano-view-model'

const kpis = {
  revenue: 320,
  revenueYesterday: 160,
  orders: 5,
  ordersYesterday: 3,
  paidOrders: 4,
  paidOrdersYesterday: 2,
  avgBasket: 80,
  activeOrders: 1,
  sessions: 9,
  sessionsYesterday: 6,
}

test('Pano model derives greeting and KPI comparison cards from one snapshot', () => {
  assert.equal(getPanoGreeting('Europe/Istanbul', new Date('2026-07-20T06:00:00.000Z')), 'Günaydın')
  assert.equal(getPanoGreeting('Europe/Istanbul', new Date('2026-07-20T12:00:00.000Z')), 'İyi günler')
  assert.equal(getPanoGreeting('Europe/Istanbul', new Date('2026-07-20T18:00:00.000Z')), 'İyi akşamlar')

  const cards = getPanoKpiCards(kpis, 'restaurant-1')
  assert.equal(cards.length, 4)
  assert.deepEqual(cards[0], {
    label: 'Tahsil edilen ciro',
    value: '₺320',
    delta: '+100%',
    trend: 'up',
    sub: 'vs. dün ₺160',
    featured: true,
    href: '/dashboard/restaurant-1/analytics',
  })
  assert.equal(cards[1]?.href, '/dashboard/restaurant-1/orders')
  assert.equal(cards[2]?.value, '₺80')
})

test('Pano quick actions are derived from trusted section permissions', () => {
  const memberActions = getPanoQuickActions('restaurant-1', ['menu', 'orders'], false)
  assert.deepEqual(memberActions.map((action) => action.key), ['menu', 'orders'])

  const ownerActions = getPanoQuickActions('restaurant-1', [], true)
  assert.deepEqual(ownerActions.map((action) => action.key), ['menu', 'tables', 'theme', 'orders', 'analytics'])
})

test('Pano health model only reports real payment, realtime and order-liveness signals', () => {
  const now = new Date('2026-07-20T12:00:00.000Z')
  const checks = getPanoHealthChecks({
    paymentStatus: { configured: true, mode: 'test' },
    isOwner: true,
    realtime: 'connected',
    lastOrderAt: '2026-07-20T11:55:00.000Z',
    now,
  })

  assert.deepEqual(checks, [
    { label: 'İyzico ödeme', status: 'warn', detail: 'Test modu (sandbox)' },
    { label: 'Gerçek zamanlı', status: 'ok', detail: 'Canlı bağlantı açık' },
    { label: 'Son sipariş', status: 'ok', detail: '5 dk önce' },
  ])

  const memberChecks = getPanoHealthChecks({
    paymentStatus: { configured: false, mode: 'test' },
    isOwner: false,
    realtime: 'down',
    lastOrderAt: null,
    now,
  })

  assert.deepEqual(memberChecks, [
    { label: 'Gerçek zamanlı', status: 'down', detail: 'Bağlantı yok' },
    { label: 'Son sipariş', status: 'idle', detail: 'Henüz sipariş yok' },
  ])
})
