import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const boardSource = readFileSync(new URL('./KitchenBoard.tsx', import.meta.url), 'utf8')
const cardSource = readFileSync(new URL('./KitchenCard.tsx', import.meta.url), 'utf8')

test('kitchen station tabs filter line snapshots without exposing an unassigned customer tab', () => {
  assert.match(boardSource, /Tüm İstasyonlar/)
  assert.match(boardSource, /item\.station\?\.id === activeStationId/)
  assert.doesNotMatch(boardSource, /name: ['"]Atanmamış['"]/)
  assert.match(boardSource, /aria-pressed=\{active\}/)
})

test('kitchen transport reconciles on interval, visibility and focus', () => {
  assert.match(boardSource, /setInterval\(\(\) => void poller\.poll\(\), 2_000\)/)
  assert.match(boardSource, /visibilitychange/)
  assert.match(boardSource, /addEventListener\('focus'/)
  assert.match(boardSource, /createKitchenOrderPoller/)
})

test('kitchen status transitions stay behind the authenticated action boundary', () => {
  assert.match(cardSource, /updateOrderStatusAction/)
  assert.doesNotMatch(cardSource, /createClient|supabase\.from|fetch\(/)
})
