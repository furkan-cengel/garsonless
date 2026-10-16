import assert from 'node:assert/strict'
import test from 'node:test'
import { getPanoGreeting, getPanoHealthChecks, getPanoKpiCards } from './pano-view-model'

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

const operational = {
  orderSummary: { pending: 2, preparing: 3 },
  tables: [{
    id: 'table-1', label: 'Masa 1', status: 'late' as const, time: 50, total: 320,
    sessionId: 'session-1', openedAt: '2026-07-29T08:00:00.000Z', unpaidTotal: 500,
    splitSettledTotal: 180, splitDeclaredCashTotal: 0, orderCount: 2, hasUnfinished: false,
  }],
  serviceRequests: [{ id: 'request-1', tableId: 'table-1', createdAt: '', requestType: 'bill' as const }],
  canAnalytics: true,
  canOrders: true,
  canTables: true,
}

test('stale-only operation shows one attention table with a critical indicator', () => {
  const cards = getPanoKpiCards(kpis, 'restaurant-1', {
    ...operational,
    tables: [{ ...operational.tables[0]!, status: 'stale' }],
    serviceRequests: [],
  })
  assert.equal(cards[3]?.value, '1')
  assert.equal(cards[3]?.indicatorTone, 'critical')
  assert.match(cards[3]?.sub ?? '', /1 eski oturum/)
})

test('missing payment setup is not duplicated as a live connection failure', () => {
  const checks = getPanoHealthChecks({
    paymentStatus: { configured: false, mode: null }, isOwner: true,
    realtime: 'live', updatedAt: new Date('2026-09-05T08:00:00.000Z'),
    lastOrderAt: null, now: new Date('2026-09-05T08:00:00.000Z'),
  })
  assert.deepEqual(checks.map((check) => check.label), ['Canlı veri', 'Son sipariş'])
  assert.equal(checks[0]?.status, 'ok')
})

test('Pano model derives greeting and KPI comparison cards from one snapshot', () => {
  assert.equal(getPanoGreeting('Europe/Istanbul', new Date('2026-07-20T06:00:00.000Z')), 'Günaydın')
  assert.equal(getPanoGreeting('Europe/Istanbul', new Date('2026-07-20T12:00:00.000Z')), 'İyi günler')
  assert.equal(getPanoGreeting('Europe/Istanbul', new Date('2026-07-20T18:00:00.000Z')), 'İyi akşamlar')

  const cards = getPanoKpiCards(kpis, 'restaurant-1', operational)
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
  assert.deepEqual(cards.slice(1).map((card) => ({ label: card.label, value: card.value })), [
    { label: 'Açık hesap', value: '₺320' },
    { label: 'Bekleyen sipariş', value: '2' },
    { label: 'Dikkat gereken masa', value: '1' },
  ])
  assert.equal(cards[2]?.href, '/dashboard/restaurant-1/orders')
})

test('Pano zero-baseline trends avoid misleading percentages', () => {
  const cards = getPanoKpiCards({
    ...kpis,
    revenue: 100,
    revenueYesterday: 0,
    paidOrders: 1,
    paidOrdersYesterday: 0,
    sessions: 0,
    sessionsYesterday: 0,
  }, 'restaurant-1', operational)
  assert.equal(cards[0]?.delta, 'Yeni')
})

test('Pano equal revenue uses a neutral flat trend', () => {
  const cards = getPanoKpiCards({ ...kpis, revenue: 0, revenueYesterday: 0 }, 'restaurant-1', operational)
  assert.equal(cards[0]?.trend, 'flat')
  assert.equal(cards[0]?.indicatorTone, 'neutral')
  assert.equal(cards[0]?.delta, 'Değişmedi')
})

test('Pano declining trend keeps direction in the arrow without a duplicate minus sign', () => {
  const cards = getPanoKpiCards({ ...kpis, revenue: 0, revenueYesterday: 320 }, 'restaurant-1', operational)
  assert.equal(cards[0]?.trend, 'down')
  assert.equal(cards[0]?.delta, '100%')
})

test('Pano KPI links respect trusted section permissions', () => {
  const cards = getPanoKpiCards(kpis, 'restaurant-1', {
    ...operational,
    canAnalytics: false,
    canOrders: false,
    canTables: false,
  })
  assert.deepEqual(cards.map((card) => card.label), ['Açık hesap', 'Bekleyen sipariş', 'Dikkat gereken masa'])
  assert.equal(cards[0]?.href, undefined)
  assert.equal(cards[1]?.href, undefined)
  assert.equal(cards[2]?.href, '#pano-attention')
})

test('revenue is hidden without analytics access and only accented when non-zero', () => {
  const withoutAnalytics = getPanoKpiCards(kpis, 'restaurant-1', { ...operational, canAnalytics: false })
  assert.equal(withoutAnalytics.some((card) => card.label === 'Tahsil edilen ciro'), false)
  const zero = getPanoKpiCards({ ...kpis, revenue: 0 }, 'restaurant-1', operational)
  assert.equal(zero[0]?.featured, false)
  assert.match(zero[0]?.sub ?? '', /Bugün henüz tahsilat yok/)
})

test('Pano health model only reports real payment, realtime and order-liveness signals', () => {
  const now = new Date('2026-07-20T12:00:00.000Z')
  const checks = getPanoHealthChecks({
    paymentStatus: { configured: true, mode: 'test' },
    isOwner: true,
    realtime: 'live',
    updatedAt: new Date('2026-07-20T11:59:30.000Z'),
    lastOrderAt: '2026-07-20T11:55:00.000Z',
    now,
  })

  assert.deepEqual(checks, [
    { label: 'İyzico ödeme', status: 'warn', detail: 'Test modu (sandbox)' },
    { label: 'Canlı veri', status: 'ok', detail: 'Bağlı · son başarılı az önce' },
    { label: 'Son sipariş', status: 'ok', detail: '5 dk önce' },
  ])

  const memberChecks = getPanoHealthChecks({
    paymentStatus: { configured: false, mode: 'test' },
    isOwner: false,
    realtime: 'offline',
    updatedAt: new Date('2026-07-20T11:55:00.000Z'),
    lastOrderAt: null,
    now,
  })

  assert.deepEqual(memberChecks, [
    { label: 'Canlı veri', status: 'down', detail: 'Çevrimdışı · son başarılı 5 dk önce' },
    { label: 'Son sipariş', status: 'idle', detail: 'Henüz sipariş yok' },
  ])
})

test('Pano health exposes stale and refresh-error states without hiding last success', () => {
  const base = {
    paymentStatus: null,
    isOwner: false,
    lastOrderAt: null,
    updatedAt: new Date('2026-07-20T11:58:00.000Z'),
    now: new Date('2026-07-20T12:00:00.000Z'),
  }
  assert.deepEqual(getPanoHealthChecks({ ...base, realtime: 'stale' })[0], {
    label: 'Canlı veri', status: 'warn', detail: 'Güncelleme gecikti · son başarılı 2 dk önce',
  })
  assert.deepEqual(getPanoHealthChecks({ ...base, realtime: 'error' })[0], {
    label: 'Canlı veri', status: 'down', detail: 'Yenileme başarısız · son başarılı 2 dk önce',
  })
})
