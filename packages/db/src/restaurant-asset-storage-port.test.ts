import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { isCanonicalRestaurantAssetPath } from './restaurant-asset-storage-port'

const id = '11111111-1111-4111-8111-111111111111'
const secondId = '22222222-2222-4222-8222-222222222222'
const thirdId = '33333333-3333-4333-8333-333333333333'

test('restaurant asset service port accepts only canonical immutable paths', () => {
  assert.equal(isCanonicalRestaurantAssetPath(`${id}/${secondId}/logo-${thirdId}.png`), true)
  assert.equal(isCanonicalRestaurantAssetPath(`restaurants/${id}/items/${secondId}/${thirdId}.webp`), true)
  assert.equal(isCanonicalRestaurantAssetPath(`restaurants/${id}/theme/section-icon/${thirdId}.webp`), true)
  assert.equal(isCanonicalRestaurantAssetPath(`restaurants/${id}/theme/auth-header-background/${thirdId}.webp`), true)
  assert.equal(isCanonicalRestaurantAssetPath(`restaurants/${id}/theme/auth-header-logo/${thirdId}.webp`), true)
  assert.equal(isCanonicalRestaurantAssetPath(`restaurants/${id}/theme/home-hero-poster/${thirdId}.webp`), true)
  assert.equal(isCanonicalRestaurantAssetPath(`restaurants/${id}/theme/home-hero-video/${thirdId}.mp4`), true)
  assert.equal(isCanonicalRestaurantAssetPath(`restaurants/${id}/theme/home-hero-video/${thirdId}.webm`), true)
  assert.equal(isCanonicalRestaurantAssetPath(`restaurants/${id}/theme/section-icon/../../escape.svg`), false)
  assert.equal(isCanonicalRestaurantAssetPath(`restaurants/${id}/theme/section-icon/${thirdId}.svg`), false)
  assert.equal(isCanonicalRestaurantAssetPath(`restaurants/${id}/theme/auth-header-background/${thirdId}.png`), false)
  assert.equal(isCanonicalRestaurantAssetPath(`restaurants/${id}/theme/home-hero-video/${thirdId}.webp`), false)
  assert.equal(isCanonicalRestaurantAssetPath(`restaurants/${id}/other/${secondId}/${thirdId}.png`), false)
})

test('storage migration removes every authenticated mutation policy', () => {
  const directory = fileURLToPath(new URL('.', import.meta.url))
  const migration = readFileSync(
    `${directory}/../supabase/migrations/20260801040000_storage_asset_tenant_boundaries.sql`,
    'utf8',
  )
  assert.match(migration, /drop policy if exists storage_authenticated_write/)
  assert.match(migration, /drop policy if exists storage_authenticated_update/)
  assert.match(migration, /drop policy if exists storage_authenticated_delete/)
  assert.doesNotMatch(migration, /create policy[\s\S]+for (insert|update|delete)/i)
})
