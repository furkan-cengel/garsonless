import assert from 'node:assert/strict'
import test from 'node:test'
import { normalizeDetectedTimezone, planLabel, publicMenuUrl, stepIndex, trialDaysRemaining } from './onboarding-model'

test('onboarding presentation keeps plan and configured public menu origin', () => {
  assert.equal(planLabel('plus'), 'Plus')
  assert.equal(planLabel(null), 'Daha sonra seçilecek')
  assert.equal(publicMenuUrl('maf-cafe', 'https://menu.masabu.co/'), 'https://menu.masabu.co/maf-cafe')
})
test('trial countdown clamps expired trials and rounds partial days up', () => {
  const now = new Date('2026-08-24T10:00:00.000Z')
  assert.equal(trialDaysRemaining('2026-08-25T09:00:00.000Z', now), 1)
  assert.equal(trialDaysRemaining('2026-08-23T09:00:00.000Z', now), 0)
})

test('resume state maps to the persisted step and timezone falls back safely', () => {
  assert.equal(stepIndex(null), 0)
  assert.equal(stepIndex({ currentStep: 'menu' } as never), 2)
  assert.equal(normalizeDetectedTimezone('Europe/Istanbul'), 'Europe/Istanbul')
  assert.equal(normalizeDetectedTimezone('Mars/Olympus'), 'Europe/Istanbul')
})
