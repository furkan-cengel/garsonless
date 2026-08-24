import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const client = readFileSync(new URL('./CustomersClient.tsx', import.meta.url), 'utf8')
const actions = readFileSync(new URL('../../lib/actions/campaigns.ts', import.meta.url), 'utf8')
const customerActions = readFileSync(new URL('../../lib/actions/customers.ts', import.meta.url), 'utf8')
const page = readFileSync(new URL('../../app/dashboard/[restaurantId]/customers/page.tsx', import.meta.url), 'utf8')

test('email delivery is configuration-gated while SMS stays out of the active UI', () => {
  assert.match(page, /getCampaignEmailDeliveryAvailability\(\)\.enabled/)
  assert.match(client, /E-posta gönderimi için Resend yapılandırması eksik/)
  assert.match(client, /const canSend = emailDeliveryEnabled/)
  assert.doesNotMatch(client, />SMS kampanyası</)
  assert.doesNotMatch(client, /customer-test-phone/)
  assert.match(client, /previewCampaignAudienceAction/)
})

test('campaign intent keeps one request id and exposes exclusion reasons separately', () => {
  assert.match(client, /sendRequestId\.current \?\? crypto\.randomUUID\(\)/)
  assert.match(client, /sendRequestId\.current = requestId/)
  assert.match(actions, /requestId: z\.string\(\)\.uuid\(\)/)
  assert.match(client, /İzin yok/)
  assert.match(client, /E-posta yok\/geçersiz/)
  assert.match(client, /Tekrar e-posta/)
  assert.match(client, /E-posta kampanyası gönderilsin mi\?/)
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

test('secondary CRM aggregates stay outside the route critical path', () => {
  assert.doesNotMatch(page, /readCustomerSegmentCounts|readCustomerSegments|readCampaigns|listCampaignEmailTemplates/)
  assert.match(page, /const initialResult = await readCustomers/)
  assert.match(client, /loadCustomerPageSupportAction\(restaurantId\)/)
  assert.match(customerActions, /const \[counts, segments, campaigns, emailTemplates\] = await Promise\.all/)
  assert.match(customerActions, /readCustomerSegmentCounts/)
  assert.match(customerActions, /readCampaigns/)
})
