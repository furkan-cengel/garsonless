import assert from 'node:assert/strict'
import test from 'node:test'

import { resolveServiceRequestFabConfig } from './serviceRequestFabConfig'

test('service request fab config exposes safe defaults for every supported request', () => {
  const result = resolveServiceRequestFabConfig()

  assert.equal(result.title, 'Nasıl yardımcı olalım?')
  assert.equal(result.position, 'right')
  assert.equal(result.size, 'normal')
  assert.equal(result.bottomOffset, 96)
  assert.deepEqual(result.requests.map((request) => request.type), [
    'waiter',
    'clean_table',
    'change_ashtray',
    'table_service',
    'water',
    'bill',
  ])
  assert.deepEqual(result.requests.map((request) => request.icon), [
    'bell',
    'spray',
    'cigarette',
    'hand-platter',
    'glass-water',
    'receipt',
  ])
  assert.equal(result.requests.every((request) => request.customIconUrl === null), true)
})

test('service request fab config applies restaurant labels and clamps layout controls', () => {
  const result = resolveServiceRequestFabConfig({
    title: '  Bir isteğiniz mi var?  ',
    waiterEnabled: 'false',
    waterLabel: 'Soda getir',
    position: 'left',
    size: 'large',
    bottomOffset: '999',
    waterIcon: 'custom',
    waterIconUrl: 'https://cdn.example.com/water.svg',
    cleanTableIcon: 'none',
    billIcon: 'invalid-icon',
  })

  assert.equal(result.title, 'Bir isteğiniz mi var?')
  assert.equal(result.position, 'left')
  assert.equal(result.size, 'large')
  assert.equal(result.bottomOffset, 180)
  assert.equal(result.requests.some((request) => request.type === 'waiter'), false)
  assert.equal(result.requests.find((request) => request.type === 'water')?.label, 'Soda getir')
  assert.equal(result.requests.find((request) => request.type === 'water')?.icon, 'custom')
  assert.equal(result.requests.find((request) => request.type === 'water')?.customIconUrl, 'https://cdn.example.com/water.svg')
  assert.equal(result.requests.find((request) => request.type === 'clean_table')?.icon, 'none')
  assert.equal(result.requests.find((request) => request.type === 'bill')?.icon, 'receipt')
})
