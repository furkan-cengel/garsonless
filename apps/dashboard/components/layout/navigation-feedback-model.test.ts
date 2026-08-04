import assert from 'node:assert/strict'
import test from 'node:test'
import {
  NAVIGATION_FEEDBACK_DELAY_MS,
  NAVIGATION_FEEDBACK_STALLED_MS,
  NavigationFeedbackController,
  getRouteKey,
} from './navigation-feedback-model'

class FakeScheduler {
  now = 0
  nextId = 1
  tasks = new Map<number, { at: number; callback: () => void }>()

  setTimeout = (callback: () => void, delay: number) => {
    const id = this.nextId++
    this.tasks.set(id, { at: this.now + delay, callback })
    return id as unknown as ReturnType<typeof setTimeout>
  }

  clearTimeout = (timer: ReturnType<typeof setTimeout>) => {
    this.tasks.delete(timer as unknown as number)
  }

  advance(milliseconds: number) {
    const target = this.now + milliseconds
    while (true) {
      const next = [...this.tasks.entries()]
        .filter(([, task]) => task.at <= target)
        .sort((a, b) => a[1].at - b[1].at)[0]
      if (!next) break
      this.tasks.delete(next[0])
      this.now = next[1].at
      next[1].callback()
    }
    this.now = target
  }
}

test('route keys include query, ignore hash, and reject external targets', () => {
  const base = 'https://dashboard.test/dashboard/r1/customers?page=1'
  assert.equal(getRouteKey('?page=2#row', base), '/dashboard/r1/customers?page=2')
  assert.equal(getRouteKey('#row', base), '/dashboard/r1/customers?page=1')
  assert.equal(getRouteKey('https://other.test/path', base), null)
})

test('feedback is delayed, becomes visible, then exposes recovery', () => {
  const scheduler = new FakeScheduler()
  const controller = new NavigationFeedbackController(scheduler)
  const id = controller.begin('/dashboard/r1/menu', 'https://dashboard.test/dashboard/r1')
  assert.ok(id)
  assert.equal(controller.getSnapshot().phase, 'delay')
  scheduler.advance(NAVIGATION_FEEDBACK_DELAY_MS - 1)
  assert.equal(controller.getSnapshot().phase, 'delay')
  scheduler.advance(1)
  assert.equal(controller.getSnapshot().phase, 'visible')
  scheduler.advance(NAVIGATION_FEEDBACK_STALLED_MS - NAVIGATION_FEEDBACK_DELAY_MS)
  assert.equal(controller.getSnapshot().phase, 'stalled')
})

test('same route does not start and query-only completion clears feedback', () => {
  const scheduler = new FakeScheduler()
  const controller = new NavigationFeedbackController(scheduler)
  const current = 'https://dashboard.test/dashboard/r1/customers?page=1'
  assert.equal(controller.begin('#row', current), null)
  assert.ok(controller.begin('?page=2', current))
  controller.completeForHref('https://dashboard.test/dashboard/r1/customers?page=2')
  assert.equal(controller.getSnapshot().phase, 'idle')
  assert.equal(scheduler.tasks.size, 0)
})

test('rapid navigation replaces the operation and scoped cancellation preserves the latest one', () => {
  const scheduler = new FakeScheduler()
  const controller = new NavigationFeedbackController(scheduler)
  const current = 'https://dashboard.test/dashboard/r1'
  const first = controller.begin('/dashboard/r1/menu', current)!
  const second = controller.begin('/dashboard/r1/theme', current)!
  assert.notEqual(first, second)
  controller.cancel(first)
  assert.equal(controller.getSnapshot().operation?.id, second)
  controller.cancel(second)
  assert.equal(controller.getSnapshot().phase, 'idle')
})

test('retry restarts timers and dispose clears pending work', () => {
  const scheduler = new FakeScheduler()
  const controller = new NavigationFeedbackController(scheduler)
  const current = 'https://dashboard.test/dashboard/r1'
  const first = controller.begin('/dashboard/r1/orders', current)!
  scheduler.advance(NAVIGATION_FEEDBACK_STALLED_MS)
  const retry = controller.retry(current)
  assert.ok(retry)
  assert.notEqual(retry.id, first)
  assert.equal(controller.getSnapshot().phase, 'delay')
  assert.equal(scheduler.tasks.size, 2)
  controller.dispose()
  assert.equal(controller.getSnapshot().phase, 'idle')
  assert.equal(scheduler.tasks.size, 0)
})
