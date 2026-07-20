import test from 'node:test'
import assert from 'node:assert/strict'
import {
  isValidTeamEmail,
  normalizeTeamEmail,
  sanitizeTeamPermissions,
} from './team'

test('team vocabulary normalizes email and drops unknown or duplicate permissions', () => {
  assert.equal(normalizeTeamEmail('  STAFF@Cafe.test '), 'staff@cafe.test')
  assert.equal(isValidTeamEmail('staff@cafe.test'), true)
  assert.equal(isValidTeamEmail('not-an-email'), false)
  assert.deepEqual(
    sanitizeTeamPermissions(['menu', 'unknown', 'menu', 'orders', 7]),
    ['menu', 'orders'],
  )
})
