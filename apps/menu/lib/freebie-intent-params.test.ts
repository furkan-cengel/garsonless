import assert from 'node:assert/strict'
import test from 'node:test'
import { consumeFreebieIntentHandoff, FREEBIE_HANDOFF_STORAGE_KEY, storeFreebieIntentHandoff } from './freebie-intent-params'

function memoryStorage() {
  const values = new Map<string, string>()
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value) },
    removeItem: (key: string) => { values.delete(key) },
    has: (key: string) => values.has(key),
  }
}

test('preview freebie handoff carries only bounded campaign configuration once', () => {
  const storage = memoryStorage()
  assert.equal(storeFreebieIntentHandoff(storage, {
    restaurantSlug: 'maf',
    sectionInstanceId: 'home-slider',
    config: {
      sourceMode: 'manual',
      freebieEnabled: 'true',
      freebieOfferType: 'gift-with-purchase',
      freebieQualifierMode: 'category',
      freebieQualifierCategoryId: 'coffee',
      freebieRewardItem1Id: 'cake',
      unrelatedSecret: 'drop-me',
    },
  }, 100), true)
  assert.equal(storage.has(FREEBIE_HANDOFF_STORAGE_KEY), true)
  assert.deepEqual(consumeFreebieIntentHandoff(storage, 'home-slider', 'maf', 200), {
    sourceMode: 'manual',
    freebieEnabled: 'true',
    freebieOfferType: 'gift-with-purchase',
    freebieQualifierMode: 'category',
    freebieQualifierCategoryId: 'coffee',
    freebieRewardItem1Id: 'cake',
  })
  assert.equal(consumeFreebieIntentHandoff(storage, 'home-slider', 'maf', 200), null)
})

test('preview freebie handoff rejects another restaurant and expired state', () => {
  const storage = memoryStorage()
  storeFreebieIntentHandoff(storage, { restaurantSlug: 'maf', sectionInstanceId: 'slider', config: { freebieEnabled: 'true' } }, 100)
  assert.equal(consumeFreebieIntentHandoff(storage, 'slider', 'other', 200), null)
  storeFreebieIntentHandoff(storage, { restaurantSlug: 'maf', sectionInstanceId: 'slider', config: { freebieEnabled: 'true' } }, 100)
  assert.equal(consumeFreebieIntentHandoff(storage, 'slider', 'maf', 5 * 60 * 1000 + 101), null)
})
