import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const client = readFileSync(new URL('./CustomersClient.tsx', import.meta.url), 'utf8')
const actions = readFileSync(new URL('../../lib/actions/campaigns.ts', import.meta.url), 'utf8')
const page = readFileSync(new URL('../../app/dashboard/[restaurantId]/customers/page.tsx', import.meta.url), 'utf8')

test('SMS stays visibly fail-closed while audience preview remains available', () => {
  assert.match(page, /getSmsDeliveryAvailability\(\)\.enabled/)
  assert.match(client, /SMS gönderimi şirket ve provider aktivasyonuna kadar kapalı/)
  assert.match(client, /const canSend = smsDeliveryEnabled/)
  assert.match(client, /disabled=\{!smsDeliveryEnabled \|\| testing/)
  assert.match(client, /previewCampaignAudienceAction/)
})

test('campaign intent keeps one request id and exposes exclusion reasons separately', () => {
  assert.match(client, /sendRequestId\.current \?\? crypto\.randomUUID\(\)/)
  assert.match(client, /sendRequestId\.current = requestId/)
  assert.match(actions, /requestId: z\.string\(\)\.uuid\(\)/)
  assert.match(client, /İzin yok/)
  assert.match(client, /Telefon yok\/geçersiz/)
  assert.match(client, /Tekrar telefon/)
})

test('campaign modal uses the shadcn accessible responsive dialog', () => {
  assert.match(client, /<Dialog open onOpenChange=/)
  assert.match(client, /<DialogTitle id="customer-campaign-title"/)
  assert.match(client, /<DialogDescription id="customer-campaign-description"/)
  assert.match(client, /showCloseButton=\{!sending\}/)
  assert.match(client, /customer-campaign-panel/)
  assert.match(client, /@media \(max-width:760px\)/)
  assert.match(client, /grid-template-columns:1fr!important/)
  assert.match(client, /role=\{error \? 'alert' : 'status'\}/)
})
