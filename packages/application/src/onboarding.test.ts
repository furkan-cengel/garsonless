import assert from 'node:assert/strict'
import test from 'node:test'
import { err, ok } from '@garsonless/domain'
import {
  advanceOnboardingBranding,
  completeOnboardingCsv,
  createOnboardingFirstItem,
  type OnboardingApplicationPort,
  type OnboardingSnapshot,
} from './onboarding'

const request = {
  restaurantId: 'restaurant-a',
  expectedRevision: 2,
  requestId: '11111111-1111-4111-8111-111111111111',
}
const actor = {
  actor: 'dashboard-member' as const,
  userId: 'owner-a',
  restaurantId: 'restaurant-a',
  permissions: ['menu', 'theme'],
  isOwner: true,
}
const snapshot: OnboardingSnapshot = {
  status: 'in_progress', restaurantId: 'restaurant-a', restaurantName: 'Cafe A', slug: 'cafe-a',
  logoUrl: null, accent: '#2e7d52', currentStep: 'menu', completedSteps: ['business', 'branding'],
  menuEntryMethod: null, targetPlan: 'plus', trialEndsAt: '2026-09-07T00:00:00.000Z',
  startedAt: '2026-08-24T00:00:00.000Z', completedAt: null, revision: 3,
  categoryCount: 0, itemCount: 0, checklistDismissedAt: null,
}

function port(): OnboardingApplicationPort {
  const result = ok({ outcome: 'saved' as const, snapshot })
  return {
    async advanceBranding() { return result },
    async createFirstItem() { return result },
    async completeCsv() { return result },
    async dismissChecklist() { return result },
  }
}

test('owner onboarding mutations preserve trusted restaurant scope', async () => {
  let touched = false
  const adapter = port()
  adapter.advanceBranding = async () => { touched = true; return ok({ outcome: 'saved', snapshot }) }
  assert.deepEqual(await advanceOnboardingBranding({ ...actor, restaurantId: 'restaurant-b' }, {
    ...request, accent: '#2e7d52', theme: { accent: '#2e7d52' },
  }, adapter), err('Not authorized'))
  assert.equal(touched, false)
})

test('members cannot complete onboarding even with menu permission', async () => {
  let touched = false
  const adapter = port()
  adapter.completeCsv = async () => { touched = true; return ok({ outcome: 'saved', snapshot }) }
  assert.deepEqual(await completeOnboardingCsv({ ...actor, isOwner: false }, request, adapter), err('Not authorized'))
  assert.equal(touched, false)
})

test('malformed revisions and request ids fail before persistence', async () => {
  let touched = false
  const adapter = port()
  adapter.createFirstItem = async () => { touched = true; return ok({ outcome: 'saved', snapshot }) }
  const result = await createOnboardingFirstItem(actor, {
    ...request,
    expectedRevision: -1,
    requestId: 'retry-me',
    categoryName: 'Kahveler',
    itemName: 'Latte',
    price: 120,
  }, adapter)
  assert.deepEqual(result, err('Invalid onboarding request'))
  assert.equal(touched, false)
})

test('valid first-item command is forwarded without changing the intent', async () => {
  let captured: unknown
  const adapter = port()
  adapter.createFirstItem = async (input) => {
    captured = input
    return ok({ outcome: 'saved', snapshot: { ...snapshot, status: 'completed', currentStep: 'complete' } })
  }
  const input = { ...request, categoryName: 'Kahveler', itemName: 'Latte', price: 120, description: 'Sıcak' }
  const result = await createOnboardingFirstItem(actor, input, adapter)
  assert.deepEqual(captured, input)
  assert.equal(result.ok, true)
})
