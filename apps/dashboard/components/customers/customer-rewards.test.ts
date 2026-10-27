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
