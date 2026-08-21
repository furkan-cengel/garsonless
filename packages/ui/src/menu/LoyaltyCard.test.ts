import assert from 'node:assert/strict'
import test from 'node:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { LoyaltyStampGrid } from './LoyaltyCard'

function renderGrid(earnedStamps: number, stampGoal = 9) {
  return renderToStaticMarkup(React.createElement(LoyaltyStampGrid, { earnedStamps, stampGoal }))
}

test('loyalty grid renders paid stamps plus one separate reward slot', () => {
  const html = renderGrid(4)
  assert.equal((html.match(/data-stamp-state=/g) ?? []).length, 10)
  assert.equal((html.match(/data-stamp-state="filled"/g) ?? []).length, 4)
  assert.equal((html.match(/data-stamp-state="empty"/g) ?? []).length, 5)
  assert.match(html, /data-stamp-state="reward-locked"/)
  assert.match(html, /data-newest="true"/)
  assert.match(html, /4 \/ 9 sadakat damgası/)
})

test('loyalty grid unlocks the separate reward at and above the goal', () => {
  for (const earnedStamps of [9, 12]) {
    const html = renderGrid(earnedStamps)
    assert.equal((html.match(/data-stamp-state="filled"/g) ?? []).length, 9)
    assert.match(html, /data-stamp-state="reward-ready"/)
    assert.match(html, /Ödül: hazır/)
  }
})

test('loyalty grid exposes a complete zero-progress state', () => {
  const html = renderGrid(0)
  assert.equal((html.match(/data-stamp-state="empty"/g) ?? []).length, 9)
  assert.doesNotMatch(html, /data-newest="true"/)
  assert.match(html, /0 \/ 9 sadakat damgası/)
})
