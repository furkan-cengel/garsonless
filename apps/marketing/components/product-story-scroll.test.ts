import assert from 'node:assert/strict'
import test from 'node:test'
import { nextStoryChapter } from './product-story-scroll'

test('a chapter crossing the activation line does not flicker inside the dead band', () => {
  assert.equal(nextStoryChapter(0, [400, 600, 800], 432), 0)
  assert.equal(nextStoryChapter(0, [383, 583, 783], 432), 1)
  assert.equal(nextStoryChapter(1, [400, 600, 800], 432), 1)
  assert.equal(nextStoryChapter(1, [481, 681, 881], 432), 0)
})

test('large scroll jumps and reverse scrolling resolve to the correct chapter', () => {
  assert.equal(nextStoryChapter(0, [-300, -100, 100], 432), 2)
  assert.equal(nextStoryChapter(2, [600, 800, 1000], 432), 0)
  assert.equal(nextStoryChapter(2, [-100, 500, 700], 432), 1)
})
