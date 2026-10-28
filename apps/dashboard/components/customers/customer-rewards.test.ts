import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { customerRewardMessage } from '@garsonless/domain/customers'
import { timelineLabel } from './customer-profile-model'

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8')

test('automatic rewards are an owner-only page linked from the customers header', () => {
  const page = read('../../app/dashboard/[restaurantId]/customers/rewards/page.tsx')
  assert.match(page, /actor\.isOwner !== true\) notFound\(\)/)
  assert.match(read('./CustomersClient.tsx'), /\{isOwner && <Button[^>]*customers\/rewards/)
})

test('the rewards page previews the same card the QR menu shows', () => {
  const client = read('./CustomerRewardsClient.tsx')
  assert.match(client, /customerRewardMessage\(draft\.kind, draft\.points\)/)
  assert.match(client, /geçmiş ziyaret ve hesaplar için toplu puan verilmez/)
  assert.match(read('../../../menu/app/[slug]/components/RewardNoticeCard.tsx'), /customerRewardMessage\(latest!\.kind, total\)/)
  assert.equal(customerRewardMessage('birthday', 300).body, 'Hesabına 300 puan eklendi. Bir sonraki siparişinde kullanabilirsin.')
})

test('only the owner sees and edits a birthday on the profile', () => {
  assert.match(read('./CustomerProfilePanel.tsx'), /\{isOwner && <BirthdaySection /)
})

test('reward points are named in the timeline', () => {
  const event = { id: 'e', type: 'points', direction: 'earn', delta: 300, reason: 'reward:birthday', at: 'now' } as unknown as Parameters<typeof timelineLabel>[0]
  assert.equal(timelineLabel(event, String).label, 'Otomatik ödül · Doğum günü')
})

test('the after-visit question offers Google on every rating and sends low ratings to the business', () => {
  const prompt = read('../../../menu/app/[slug]/components/ReviewPrompt.tsx')
  assert.match(prompt, /const googleLink = prompt\.googleUrl && step !== "ask"/)
  assert.match(prompt, /if \(isLowCustomerRating\(value\)\) \{\s*setStep\("low"\)/)
  assert.match(prompt, /İşletmeye gönder/)
  assert.match(read('./CustomerRewardsClient.tsx'), /yalnızca memnun müşteriyi Google’a yönlendirmek Google kurallarına aykırıdır/)
  assert.match(read('./CustomerProfilePanel.tsx'), /Ele alındı olarak işaretle/)
})

test('low ratings reach Pano only for people with customer access', async () => {
  const { buildPanoAttentionItems } = await import('../../lib/pano-attention-model')
  const items = buildPanoAttentionItems({
    restaurantId: 'r', generatedAt: '2026-10-30T10:00:00Z', pendingOrderCount: 0, recentOrders: [], tableStatuses: [], serviceRequests: [], paymentStatus: null,
    feedback: [{ id: 'f', customerId: 'c', customerName: 'Ada', rating: 2, comment: 'Soğuktu', createdAt: '2026-10-30T09:00:00Z' }],
  })
  assert.deepEqual(items.map((item) => [item.kind, item.title, item.actionHref]), [['customer_feedback', '2 yıldız · Ada', '/dashboard/r/customers/c']])
  assert.match(read('../../lib/queries/pano.ts'), /readOpenCustomerFeedback\(actor/)
  assert.match(read('../../lib/pano-attention-model.ts'), /if \(kind === 'customer_feedback'\) return can\('customers'\)/)
})
