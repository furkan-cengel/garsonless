import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const panel = readFileSync(new URL('./CustomerProfilePanel.tsx', import.meta.url), 'utf8')
const model = readFileSync(new URL('./customer-profile-model.ts', import.meta.url), 'utf8')
const detail = readFileSync(new URL('./CustomerDetailClient.tsx', import.meta.url), 'utf8')
const actions = readFileSync(new URL('../../lib/actions/customers.ts', import.meta.url), 'utf8')

test('the deep-link route and the side panel render one shared profile', () => {
  assert.match(detail, /<CustomerProfilePanel[\s\S]*initial=\{profile\}/)
})

test('customer profile makes timeline truncation explicit and cursor-loadable', () => {
  assert.match(panel, /loadCustomerTimelineAction/)
  assert.match(panel, /daha eski hareketler mevcut/i)
  assert.match(panel, /Daha eski hareketleri yükle/)
  assert.match(panel, /result\.events\.filter/)
  assert.match(panel, /role="status"/)
  assert.match(panel, /<Alert variant="destructive"/)
  assert.match(actions, /readCustomerTimeline/)
  assert.match(actions, /cursor\.length > 512/)
})

test('order timeline copy distinguishes collected, comp, cancelled and unpaid money', () => {
  assert.match(model, /Sipariş \(tahsil edildi\)/)
  assert.match(model, /Sipariş \(ikram - harcamaya dahil değil\)/)
  assert.match(model, /Sipariş \(iptal - harcamaya dahil değil\)/)
  assert.match(model, /served: 'servis edildi'/)
  assert.match(model, /labels\[status\] \?\? 'ödenmedi'/)
  // Staff timelines carry no order amounts; the row must not invent ₺0.
  assert.match(model, /e\.amount === undefined \? '' : formatMoney\(e\.amount\)/)
})

test('manual point changes need a reason, keep one request id across an ambiguous retry and can be undone', () => {
  assert.match(panel, /requestId\.current \?\? crypto\.randomUUID\(\)/)
  assert.match(panel, /Aynı istek güvenle yeniden denenebilir/)
  assert.match(panel, /Sebep \(zorunlu\)/)
  assert.match(panel, /maxLength=\{CUSTOMER_POINTS_REASON_MAX_LENGTH\}/)
  assert.match(panel, /deductCustomerPointsAction/)
  assert.match(panel, /\}Geri al<\/Button>/)
  assert.match(panel, /undoReason\(change\.reason\)/)
  assert.match(model, /Elle düşüldü/)
  assert.match(actions, /reason: z\.string\(\)\.trim\(\)\.min\(1/)
})

test('contact details are revealed one customer at a time and only by the owner', () => {
  assert.match(panel, /\{isOwner && <ContactSection/)
  assert.match(panel, /revealCustomerContactAction/)
  assert.match(panel, /İletişimi göster/)
  assert.match(panel, /Görüntüleme kayda geçti/)
  assert.match(panel, /detail\.spend !== null && <Stat label="Toplam harcama"/)
})

test('team notes are visible to members and deletable by the owner or the author', () => {
  assert.match(panel, /Ekip görür, müşteri görmez/)
  assert.match(panel, /\(isOwner \|\| note\.authorId === viewerId\)/)
  assert.match(panel, /maxLength=\{CUSTOMER_NOTE_MAX_LENGTH\}/)
})
