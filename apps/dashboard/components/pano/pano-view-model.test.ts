import assert from 'node:assert/strict'
import test from 'node:test'
import { getPanoGreeting, getPanoHealthChecks } from './pano-view-model'

test('missing payment setup is not duplicated as a live connection failure', () => {
  const checks = getPanoHealthChecks({
    paymentStatus: { configured: false, mode: null }, isOwner: true,
    realtime: 'live', updatedAt: new Date('2026-09-05T08:00:00.000Z'),
    lastOrderAt: null, now: new Date('2026-09-05T08:00:00.000Z'),
  })
  assert.deepEqual(checks.map((check) => check.label), ['Canlı veri', 'Son sipariş'])
  assert.equal(checks[0]?.status, 'ok')
})

test('Pano greets by the restaurant clock', () => {
  assert.equal(getPanoGreeting('Europe/Istanbul', new Date('2026-07-20T06:00:00.000Z')), 'Günaydın')
  assert.equal(getPanoGreeting('Europe/Istanbul', new Date('2026-07-20T12:00:00.000Z')), 'İyi günler')
  assert.equal(getPanoGreeting('Europe/Istanbul', new Date('2026-07-20T18:00:00.000Z')), 'İyi akşamlar')
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
