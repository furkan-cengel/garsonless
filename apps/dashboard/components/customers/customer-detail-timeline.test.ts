import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const detail = readFileSync(new URL('./CustomerDetailClient.tsx', import.meta.url), 'utf8')
const actions = readFileSync(new URL('../../lib/actions/customers.ts', import.meta.url), 'utf8')

test('customer detail makes timeline truncation explicit and cursor-loadable', () => {
  assert.match(detail, /loadCustomerTimelineAction/)
  assert.match(detail, /daha eski hareketler mevcut/i)
  assert.match(detail, /Daha eski hareketleri yükle/)
  assert.match(detail, /result\.events\.filter/)
  assert.match(detail, /role="status"/)
  assert.match(detail, /<Alert variant="destructive"/)
  assert.match(actions, /readCustomerTimeline/)
  assert.match(actions, /cursor\.length > 512/)
})

test('order timeline copy distinguishes collected, comp, cancelled and unpaid money', () => {
  assert.match(detail, /Sipariş \(tahsil edildi\)/)
  assert.match(detail, /Sipariş \(ikram - harcamaya dahil değil\)/)
  assert.match(detail, /Sipariş \(iptal - harcamaya dahil değil\)/)
  assert.match(detail, /served: 'servis edildi'/)
  assert.match(detail, /labels\[status\] \?\? 'ödenmedi'/)
})

test('manual credit keeps one request id across an ambiguous retry and exposes accessible feedback', () => {
  assert.match(detail, /useRef<string \| null>/)
  assert.match(detail, /grantRequestId\.current \?\? crypto\.randomUUID\(\)/)
  assert.match(detail, /grantRequestId\.current = requestId/)
  assert.match(detail, /Aynı istek güvenle yeniden denenebilir/)
  assert.match(detail, /role=\{msg\.kind === 'err' \? 'alert' : 'status'\}/)
  assert.match(detail, /<FieldGroup className="customer-grant-form/)
  assert.match(detail, /<ToggleGroup[\s\S]*aria-label="Hızlı puan tutarı"/)
  assert.match(detail, /<ToggleGroupItem key=\{value\} value=\{String\(value\)\}/)
  assert.match(detail, /<Alert variant=\{msg\.kind === 'err' \? 'destructive' : 'default'\}/)
})

test('customer detail controls use compact shadcn inputs, buttons and feedback', () => {
  assert.match(detail, /<Input[\s\S]*aria-label="Tanımlanacak puan"/)
  assert.match(detail, /<Button type="button" onClick=\{submitGrant\}/)
  assert.match(detail, /variant="ghost" size="xs" className="rounded-full"/)
  assert.match(detail, /<Spinner data-icon="inline-start" \/>/)
  assert.match(detail, /<Progress value=\{progress\}>/)
  assert.match(detail, /<CardAction/)
  assert.match(detail, /<ItemGroup/)
  assert.match(detail, /<Separator \/>/)
})
